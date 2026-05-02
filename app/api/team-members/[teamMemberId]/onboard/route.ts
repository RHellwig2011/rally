import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

/**
 * POST /api/team-members/[teamMemberId]/onboard
 * Complete team member onboarding - add contact info and parent details
 * PUBLIC endpoint (uses invitation token for auth)
 */

const onboardingSchema = z.object({
  invitationToken: z.string().min(1, 'Invitation token is required'),

  // Player contact info
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),

  // Parent/Guardian 1
  parentFirstName: z.string().min(1, 'Parent first name is required'),
  parentLastName: z.string().min(1, 'Parent last name is required'),
  parentEmail: z.string().email('Invalid parent email address').optional().or(z.literal('')),
  parentPhone: z.string().optional().or(z.literal('')),

  // Parent/Guardian 2 (optional)
  secondParentFirstName: z.string().optional().or(z.literal('')),
  secondParentLastName: z.string().optional().or(z.literal('')),
  secondParentEmail: z.string().email('Invalid second parent email').optional().or(z.literal('')),
  secondParentPhone: z.string().optional().or(z.literal('')),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { teamMemberId: string } }
) {
  try {
    const { teamMemberId } = params;
    const body = await request.json();

    // Validate input
    const validatedData = onboardingSchema.parse(body);

    // Find team member by invitation token
    const teamMember = await prisma.teamMember.findFirst({
      where: {
        id: teamMemberId,
        invitationToken: validatedData.invitationToken,
      },
      include: {
        campaign: {
          select: {
            teamName: true,
            organizationName: true,
          },
        },
      },
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: 'Invalid invitation token or team member not found' },
        { status: 404 }
      );
    }

    // Check if already completed
    if (teamMember.onboardingCompletedAt) {
      return NextResponse.json(
        {
          error: 'Onboarding already completed',
          completedAt: teamMember.onboardingCompletedAt,
        },
        { status: 400 }
      );
    }

    // Validate that at least one parent has email or phone
    const hasParent1Contact = validatedData.parentEmail || validatedData.parentPhone;
    if (!hasParent1Contact) {
      return NextResponse.json(
        { error: 'At least one parent contact method (email or phone) is required' },
        { status: 400 }
      );
    }

    // Update team member with onboarding info
    const updatedTeamMember = await prisma.teamMember.update({
      where: { id: teamMemberId },
      data: {
        email: validatedData.email || null,
        phone: validatedData.phone || null,
        parentFirstName: validatedData.parentFirstName,
        parentLastName: validatedData.parentLastName,
        parentEmail: validatedData.parentEmail || null,
        parentPhone: validatedData.parentPhone || null,
        secondParentFirstName: validatedData.secondParentFirstName || null,
        secondParentLastName: validatedData.secondParentLastName || null,
        secondParentEmail: validatedData.secondParentEmail || null,
        secondParentPhone: validatedData.secondParentPhone || null,
        onboardingCompletedAt: new Date(),
      },
      include: {
        campaign: {
          select: {
            teamName: true,
            organizationName: true,
            slug: true,
          },
        },
      },
    });

    // Send welcome emails and SMS to parents
    const fundraisingLink = `${process.env.NEXT_PUBLIC_BASE_URL}/raise/${updatedTeamMember.campaign.slug}/player/${updatedTeamMember.fundLinkCode}`;

    // Send to Parent 1
    if (validatedData.parentEmail || validatedData.parentPhone) {
      const parentName = `${validatedData.parentFirstName} ${validatedData.parentLastName}`;

      // Send email
      if (validatedData.parentEmail) {
        try {
          const { sendParentWelcomeEmail } = await import('@/lib/services/email');
          await sendParentWelcomeEmail(
            validatedData.parentEmail,
            parentName,
            updatedTeamMember.name,
            updatedTeamMember.campaign.teamName,
            updatedTeamMember.campaign.organizationName,
            fundraisingLink
          );
        } catch (error) {
          console.error('Failed to send parent welcome email:', error);
        }
      }

      // Send SMS
      if (validatedData.parentPhone) {
        try {
          const { sendParentWelcomeSMS } = await import('@/lib/services/sms');
          await sendParentWelcomeSMS(
            validatedData.parentPhone,
            validatedData.parentFirstName,
            updatedTeamMember.name,
            updatedTeamMember.campaign.teamName,
            fundraisingLink
          );
        } catch (error) {
          console.error('Failed to send parent welcome SMS:', error);
        }
      }
    }

    // Send to Parent 2 (if provided)
    if (validatedData.secondParentFirstName && (validatedData.secondParentEmail || validatedData.secondParentPhone)) {
      const parentName = `${validatedData.secondParentFirstName} ${validatedData.secondParentLastName}`;

      if (validatedData.secondParentEmail) {
        try {
          const { sendParentWelcomeEmail } = await import('@/lib/services/email');
          await sendParentWelcomeEmail(
            validatedData.secondParentEmail,
            parentName,
            updatedTeamMember.name,
            updatedTeamMember.campaign.teamName,
            updatedTeamMember.campaign.organizationName,
            fundraisingLink
          );
        } catch (error) {
          console.error('Failed to send second parent welcome email:', error);
        }
      }

      if (validatedData.secondParentPhone) {
        try {
          const { sendParentWelcomeSMS } = await import('@/lib/services/sms');
          await sendParentWelcomeSMS(
            validatedData.secondParentPhone,
            validatedData.secondParentFirstName,
            updatedTeamMember.name,
            updatedTeamMember.campaign.teamName,
            fundraisingLink
          );
        } catch (error) {
          console.error('Failed to send second parent welcome SMS:', error);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Onboarding completed successfully! Your parents will be notified.',
      teamMember: {
        id: updatedTeamMember.id,
        name: updatedTeamMember.name,
        campaignSlug: updatedTeamMember.campaign.slug,
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error completing onboarding:', error);
    return NextResponse.json(
      { error: 'Failed to complete onboarding' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/team-members/[teamMemberId]/onboard?token=xxx
 * Get team member info for onboarding (verify token)
 * PUBLIC endpoint
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { teamMemberId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Invitation token is required' },
        { status: 400 }
      );
    }

    const teamMember = await prisma.teamMember.findFirst({
      where: {
        id: params.teamMemberId,
        invitationToken: token,
      },
      include: {
        campaign: {
          select: {
            id: true,
            teamName: true,
            organizationName: true,
            slug: true,
            logoUrl: true,
            primaryColor: true,
          },
        },
      },
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: 'Invalid invitation token or team member not found' },
        { status: 404 }
      );
    }

    // Return team member info (without sensitive data)
    return NextResponse.json({
      teamMember: {
        id: teamMember.id,
        name: teamMember.name,
        position: teamMember.position,
        grade: teamMember.grade,
        onboardingCompleted: !!teamMember.onboardingCompletedAt,
      },
      campaign: teamMember.campaign,
    });

  } catch (error) {
    console.error('Error fetching onboarding info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch onboarding information' },
      { status: 500 }
    );
  }
}
