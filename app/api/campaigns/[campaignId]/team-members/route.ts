import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

// Validation schema for adding team member
const addTeamMemberSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  personalGoal: z.number().positive().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    // Get token from cookie
    const sessionToken = req.cookies.get("sessionToken")?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Verify token and get user
    const user = await getUserFromToken(sessionToken);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const { campaignId } = params;

    // Check if campaign exists and user is authorized
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        guardians: {
          select: { id: true }
        }
      }
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Check authorization
    const isAuthorized =
      campaign.primaryLeaderId === user.id ||
      campaign.guardians.some(g => g.id === user.id);

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Not authorized to manage this campaign" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validatedData = addTeamMemberSchema.parse(body);

    // Check if user exists or create invitation
    let teamMemberUser = await prisma.user.findUnique({
      where: { email: validatedData.email }
    });

    // If user doesn't exist, create a pending user account
    if (!teamMemberUser) {
      // Generate a random password (they'll reset it when they sign up)
      const bcrypt = require('bcryptjs');
      const tempPassword = Math.random().toString(36).slice(-8);
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      teamMemberUser = await prisma.user.create({
        data: {
          email: validatedData.email,
          firstName: validatedData.name.split(' ')[0],
          lastName: validatedData.name.split(' ').slice(1).join(' ') || '',
          role: 'TEAM_MEMBER',
          passwordHash,
          emailVerified: false,
        }
      });
    }

    // Check if already a team member
    const existingMember = await prisma.teamMember.findFirst({
      where: {
        campaignId,
        userId: teamMemberUser.id,
      }
    });

    if (existingMember) {
      return NextResponse.json(
        { success: false, error: "This person is already a team member" },
        { status: 400 }
      );
    }

    // Create team member
    const personalGoalInCents = validatedData.personalGoal
      ? BigInt(Math.round(validatedData.personalGoal * 100))
      : null;

    const teamMember = await prisma.teamMember.create({
      data: {
        campaignId,
        userId: teamMemberUser.id,
        name: validatedData.name,
        personalGoal: personalGoalInCents,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    // Create referral code for this team member
    const referralCode = `${campaign.slug}-${teamMemberUser.id.slice(0, 8)}`;

    await prisma.referral.create({
      data: {
        campaignId,
        referrerId: teamMemberUser.id,
        referralCode,
      }
    });

    // Send invitation email
    try {
      const { sendTeamMemberInvitation } = await import('@/lib/email');
      const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login?email=${encodeURIComponent(validatedData.email)}`;

      await sendTeamMemberInvitation({
        toEmail: validatedData.email,
        toName: validatedData.name,
        campaignName: campaign.teamName,
        campaignOrg: campaign.organizationName,
        inviterName: `${user.firstName} ${user.lastName}`,
        inviteLink,
      });
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json(
      {
        success: true,
        teamMember: {
          id: teamMember.id,
          name: teamMember.name,
          email: teamMember.user.email,
          personalGoal: teamMember.personalGoal?.toString(),
          amountRaised: teamMember.amountRaised.toString(),
          referralCode,
          needsInvitation: !teamMemberUser.emailVerified,
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to add team member:", error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: error.errors.map(e => ({ field: e.path.join("."), message: e.message }))
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to add team member"
      },
      { status: 500 }
    );
  }
}

// GET all team members for a campaign
export async function GET(
  req: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
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

    const { campaignId } = params;

    // Get team members with their referral codes
    const teamMembers = await prisma.teamMember.findMany({
      where: { campaignId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            emailVerified: true,
          }
        }
      },
      orderBy: { amountRaised: 'desc' }
    });

    // Get referral codes
    const referrals = await prisma.referral.findMany({
      where: {
        campaignId,
        referrerId: { in: teamMembers.map(tm => tm.userId) }
      }
    });

    const referralMap = new Map(referrals.map(r => [r.referrerId, r]));

    const membersWithReferrals = teamMembers.map(tm => {
      const referral = referralMap.get(tm.userId);
      return {
        id: tm.id,
        userId: tm.userId,
        name: tm.name,
        email: tm.user.email,
        personalGoal: tm.personalGoal?.toString(),
        amountRaised: tm.amountRaised.toString(),
        emailVerified: tm.user.emailVerified,
        referralCode: referral?.referralCode,
        donationCount: referral?.donationCount || 0,
        clickCount: referral?.clickCount || 0,
        createdAt: tm.createdAt,
      };
    });

    return NextResponse.json(
      { success: true, teamMembers: membersWithReferrals },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to fetch team members:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch team members" },
      { status: 500 }
    );
  }
}
