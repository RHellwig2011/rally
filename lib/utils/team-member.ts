import crypto from 'crypto';
import prisma from '@/lib/prisma';

/**
 * Utility functions for team member operations
 * Week 2: Roster Management
 */

/**
 * Generate a unique fundraising link code
 * Requirements: 8 characters, URL-safe, unique per campaign
 */
export function generateFundraisingLinkCode(): string {
  // Use URL-safe characters (alphanumeric, no confusing chars like 0/O, l/1)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';

  for (let i = 0; i < 8; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    code += chars[randomIndex];
  }

  return code;
}

/**
 * Generate a unique fundraising link code with collision avoidance
 * Checks database to ensure uniqueness
 */
export async function generateUniqueFundraisingLinkCode(campaignId: string, maxAttempts = 10): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateFundraisingLinkCode();

    // Check if code already exists for this campaign
    const existing = await prisma.teamMember.findFirst({
      where: {
        campaignId,
        fundLinkCode: code,
      },
    });

    if (!existing) {
      return code;
    }
  }

  // If we couldn't generate a unique code after max attempts, add timestamp
  // This should never happen with 8-char codes from 33 chars (33^8 = 1.4 trillion possibilities)
  return generateFundraisingLinkCode() + Date.now().toString(36).slice(-4).toUpperCase();
}

/**
 * Format the full fundraising link URL
 */
export function formatFundraisingLink(campaignSlug: string, fundLinkCode: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rally.com';
  return `${baseUrl}/raise/${campaignSlug}/player/${fundLinkCode}`;
}

/**
 * Check if a team member limit has been reached
 * Max 100 team members per campaign as per roadmap
 */
export async function checkTeamMemberLimit(campaignId: string): Promise<boolean> {
  const count = await prisma.teamMember.count({
    where: {
      campaignId,
      deletedAt: null, // Don't count soft-deleted members
    },
  });

  return count >= 100;
}

/**
 * Check if email already exists in campaign
 */
export async function checkDuplicateEmail(campaignId: string, email: string, excludeMemberId?: string): Promise<boolean> {
  const existing = await prisma.teamMember.findFirst({
    where: {
      campaignId,
      email: email.toLowerCase(),
      deletedAt: null,
      ...(excludeMemberId && {
        NOT: {
          id: excludeMemberId
        }
      }),
    },
  });

  return !!existing;
}

/**
 * Send invitation email to team member
 */
export async function sendTeamMemberInvitation(
  memberEmail: string,
  memberName: string,
  campaignName: string,
  fundraisingLink: string,
  personalGoal?: number,
  onboardingLink?: string
): Promise<boolean> {
  try {
    // Import email service
    const { sendTeamMemberInvitationEmail } = await import('@/lib/email');

    // Extract team name from campaign name (if formatted as "Team - Organization")
    const teamName = campaignName.split(' - ')[0] || campaignName;

    if (!onboardingLink) {
      console.warn('No onboarding link provided, falling back to console log');
      console.log('Sending invitation email to:', memberEmail);
      console.log('Fundraising link:', fundraisingLink);
      return true;
    }

    const success = await sendTeamMemberInvitationEmail(
      memberEmail,
      memberName,
      campaignName,
      teamName,
      onboardingLink,
      fundraisingLink,
      personalGoal
    );

    return success;
  } catch (error) {
    console.error('Failed to send invitation email:', error);
    return false;
  }
}

/**
 * Calculate team member statistics
 */
export async function calculateTeamMemberStats(memberId: string) {
  const stats = await prisma.donation.aggregate({
    where: {
      teamMemberId: memberId,
      status: 'COMPLETED',
    },
    _sum: {
      grossAmount: true,
      netAmount: true,
    },
    _count: {
      id: true,
    },
  });

  return {
    totalRaised: Number(stats._sum.grossAmount || 0) / 100,
    netAmount: Number(stats._sum.netAmount || 0) / 100,
    donationCount: stats._count.id || 0,
  };
}

/**
 * Format team member response data
 */
export function formatTeamMemberResponse(member: any) {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    personalGoal: member.personalGoal ? Number(member.personalGoal) / 100 : null,
    amountRaised: Number(member.amountRaised) / 100,
    position: member.position,
    grade: member.grade,
    profilePhotoUrl: member.profilePhotoUrl,
    phoneNumber: member.phoneNumber,
    invitationStatus: member.invitationStatus,
    joinedAt: member.joinedAt,
    fundLinkCode: member.fundLinkCode,
    fundraisingLink: formatFundraisingLink(member.campaign?.slug || '', member.fundLinkCode),
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  };
}