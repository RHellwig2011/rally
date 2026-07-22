import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { checkCsrf } from "@/lib/csrf";

const updateRoleSchema = z.object({
  role: z.enum(['DONOR', 'PLAYER', 'TEAM_MEMBER', 'CAMPAIGN_LEADER', 'GUARDIAN', 'ADMIN', 'BANK_ADMIN']),
  reason: z.string().optional(),
});

/**
 * PUT /api/admin/users/[userId]/role
 * Update user role (BANK_ADMIN only)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Check CSRF token
    const csrfCheck = checkCsrf(req);
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

    // Authentication check
    const sessionToken = req.cookies.get("sessionToken")?.value;
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const user = await getUserFromToken(sessionToken);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Check authorization - only BANK_ADMIN can change roles
    if (user.role !== 'BANK_ADMIN') {
      return NextResponse.json(
        { success: false, error: "Only BANK_ADMIN can change user roles" },
        { status: 403 }
      );
    }

    const userId = params.userId;

    // Cannot change own role
    if (userId === user.id) {
      return NextResponse.json(
        { success: false, error: "Cannot change your own role" },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validatedData = updateRoleSchema.parse(body);

    // Get target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      }
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Check if role is already set
    if (targetUser.role === validatedData.role) {
      return NextResponse.json({
        success: true,
        message: "User already has this role",
        user: {
          id: targetUser.id,
          email: targetUser.email,
          name: `${targetUser.firstName} ${targetUser.lastName}`,
          role: targetUser.role,
        }
      });
    }

    // Prevent demoting the last BANK_ADMIN
    if (targetUser.role === 'BANK_ADMIN' && validatedData.role !== 'BANK_ADMIN') {
      const bankAdminCount = await prisma.user.count({
        where: { role: 'BANK_ADMIN' }
      });

      if (bankAdminCount <= 1) {
        return NextResponse.json(
          { success: false, error: "Cannot remove the last BANK_ADMIN" },
          { status: 400 }
        );
      }
    }

    // Update user role
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        role: validatedData.role,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        updatedAt: true,
      }
    });

    // Log the role change
    console.log(
      `Role change: ${user.email} changed ${targetUser.email} from ${targetUser.role} to ${validatedData.role}` +
      (validatedData.reason ? ` - Reason: ${validatedData.reason}` : '')
    );

    // TODO: Send email notification to user about role change
    // TODO: Store audit log in database

    return NextResponse.json({
      success: true,
      message: `User role updated to ${validatedData.role}`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: `${updatedUser.firstName} ${updatedUser.lastName}`,
        previousRole: targetUser.role,
        newRole: updatedUser.role,
        updatedAt: updatedUser.updatedAt,
      },
      changedBy: {
        id: user.id,
        email: user.email,
      }
    });

  } catch (error) {
    console.error('Role update error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update user role"
      },
      { status: 500 }
    );
  }
}