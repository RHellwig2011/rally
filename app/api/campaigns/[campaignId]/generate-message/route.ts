import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import {
  generateEmailMessage,
  generateSMSMessage,
  generateVideoScript,
  type MessageOptions,
} from '@/lib/services/ai-message-generator';

const generateMessageSchema = z.object({
  type: z.enum(['email', 'sms', 'video']),
  teamMemberId: z.string().optional(),
  tone: z.enum(['friendly', 'professional', 'enthusiastic', 'heartfelt']).optional(),
  length: z.enum(['short', 'medium', 'long']).optional(),
  includeStats: z.boolean().optional(),
  includeCallToAction: z.boolean().optional(),
  videoDuration: z.number().min(15).max(120).optional(),
  customInstructions: z.string().optional(),
});

/**
 * POST /api/campaigns/[campaignId]/generate-message
 * Generate AI-powered fundraising messages
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { campaignId: string } }
) {
  try {
    // Check if AI features are enabled
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'AI message generation is not enabled on this server' },
        { status: 503 }
      );
    }

    // Authentication
    const sessionToken = request.cookies.get('sessionToken')?.value;
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = await getUserFromToken(sessionToken);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    const { campaignId } = params;
    const body = await request.json();
    const validatedData = generateMessageSchema.parse(body);

    // Get campaign data
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        primaryLeader: {
          select: { id: true }
        }
      }
    });

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    // If teamMemberId is provided, get team member data
    let teamMember = null;
    if (validatedData.teamMemberId) {
      teamMember = await prisma.teamMember.findUnique({
        where: { id: validatedData.teamMemberId },
        select: {
          id: true,
          name: true,
          position: true,
          grade: true,
          personalGoal: true,
          amountRaised: true,
          userId: true,
          campaignId: true,
        }
      });

      if (!teamMember) {
        return NextResponse.json(
          { error: 'Team member not found' },
          { status: 404 }
        );
      }

      // Check authorization
      if (
        teamMember.userId !== user.id &&
        campaign.primaryLeaderId !== user.id &&
        user.role !== 'ADMIN'
      ) {
        return NextResponse.json(
          { error: 'Not authorized' },
          { status: 403 }
        );
      }
    } else {
      // Check authorization for campaign-level messages
      if (campaign.primaryLeaderId !== user.id && user.role !== 'ADMIN') {
        return NextResponse.json(
          { error: 'Not authorized' },
          { status: 403 }
        );
      }
    }

    // Build context for AI
    const context = {
      campaignName: campaign.organizationName + ' ' + campaign.teamName,
      teamName: campaign.teamName,
      organizationName: campaign.organizationName,
      description: campaign.description || 'Support our fundraising campaign',
      goalAmount: teamMember?.personalGoal
        ? Number(teamMember.personalGoal)
        : Number(campaign.goalAmount),
      currentAmount: teamMember?.amountRaised
        ? Number(teamMember.amountRaised)
        : Number(campaign.currentAmount),
      playerName: teamMember?.name || user.firstName || 'Team',
      playerPosition: teamMember?.position || undefined,
      playerGrade: teamMember?.grade || undefined,
    };

    // Generate message based on type
    let result;

    switch (validatedData.type) {
      case 'email': {
        const options: MessageOptions = {
          tone: validatedData.tone || 'friendly',
          length: validatedData.length || 'medium',
          includeStats: validatedData.includeStats ?? true,
          includeCallToAction: validatedData.includeCallToAction ?? true,
          customInstructions: validatedData.customInstructions,
        };

        const message = await generateEmailMessage(context, options);
        result = { message };
        break;
      }

      case 'sms': {
        const options: MessageOptions = {
          tone: validatedData.tone || 'friendly',
          includeStats: validatedData.includeStats ?? false,
          customInstructions: validatedData.customInstructions,
        };

        const message = await generateSMSMessage(context, options);
        result = { message };
        break;
      }

      case 'video': {
        const duration = validatedData.videoDuration || 30;
        const script = await generateVideoScript(context, duration);
        result = { script };
        break;
      }

      default:
        return NextResponse.json(
          { error: 'Invalid message type' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      type: validatedData.type,
      ...result,
      context: {
        playerName: context.playerName,
        campaignName: context.campaignName,
        goalAmount: context.goalAmount,
        currentAmount: context.currentAmount,
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error generating message:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
