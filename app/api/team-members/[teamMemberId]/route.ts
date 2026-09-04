import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/requireAuth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { checkCsrf } from "@/lib/csrf";

const updateProfileSchema = z.object({
  profilePhotoUrl: z.string().url().optional().or(z.literal("")),
  profileVideoUrl: z.string().url().optional().or(z.literal("")),
  personalStory: z.string().optional(),
  position: z.string().optional(),
  grade: z.string().optional(),
  favoriteQuote: z.string().optional(),
  isProfilePublic: z.boolean().optional(),
});

/**
 * GET /api/team-members/[teamMemberId]
 * Get team member profile (requires auth)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { teamMemberId: string } }
) {
  try {
    // Verify authentication (throws if not authenticated)
    const user = await verifyAuth(req);

    const { teamMemberId } = params;

    const teamMember = await prisma.teamMember.findFirst({
      where: { id: teamMemberId, deletedAt: null },
      include: {
        campaign: {
          select: {
            slug: true,
            organizationName: true,
            teamName: true,
          },
        },
      },
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: "Team member not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (teamMember.userId !== user.id) {
      return NextResponse.json(
        { error: "You can only view your own profile" },
        { status: 403 }
      );
    }

    // Format response
    const response = {
      id: teamMember.id,
      name: teamMember.name,
      personalGoal: teamMember.personalGoal?.toString() || null,
      amountRaised: teamMember.amountRaised.toString(),
      profilePhotoUrl: teamMember.profilePhotoUrl,
      profileVideoUrl: teamMember.profileVideoUrl,
      personalStory: teamMember.personalStory,
      position: teamMember.position,
      grade: teamMember.grade,
      favoriteQuote: teamMember.favoriteQuote,
      isProfilePublic: teamMember.isProfilePublic,
      campaign: teamMember.campaign,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    // verifyAuth throws a NextResponse (401) on auth failure - return it as-is
    if (error instanceof NextResponse) {
      return error;
    }

    console.error("Failed to fetch team member:", error);
    return NextResponse.json(
      { error: "Failed to fetch team member" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/team-members/[teamMemberId]
 * Update team member profile
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { teamMemberId: string } }
) {
  try {
    // Check CSRF token
    const csrfCheck = checkCsrf(req);
    if (!csrfCheck.valid) {
      return csrfCheck.response!;
    }

    // Verify authentication (throws if not authenticated)
    const user = await verifyAuth(req);

    const { teamMemberId } = params;

    // Get team member
    const teamMember = await prisma.teamMember.findFirst({
      where: { id: teamMemberId, deletedAt: null },
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: "Team member not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (teamMember.userId !== user.id) {
      return NextResponse.json(
        { error: "You can only edit your own profile" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validatedData = updateProfileSchema.parse(body);

    // Update team member
    const updated = await prisma.teamMember.update({
      where: { id: teamMemberId },
      data: {
        profilePhotoUrl: validatedData.profilePhotoUrl || null,
        profileVideoUrl: validatedData.profileVideoUrl || null,
        personalStory: validatedData.personalStory,
        position: validatedData.position,
        grade: validatedData.grade,
        favoriteQuote: validatedData.favoriteQuote,
        isProfilePublic: validatedData.isProfilePublic,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Profile updated successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    // verifyAuth throws a NextResponse (401) on auth failure - return it as-is
    if (error instanceof NextResponse) {
      return error;
    }

    console.error("Failed to update team member:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
