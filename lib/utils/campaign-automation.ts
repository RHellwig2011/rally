/**
 * Campaign automation utilities
 * Functions for automatically managing campaign statuses based on conditions
 */

import prisma from "@/lib/prisma";
import { sendCampaignStatusChangeNotification } from "@/lib/email";
import { processScheduledOutreach } from "@/lib/outreach";
import { nextStretchGoalAmount } from "@/lib/stretch-goal";

/**
 * Check and auto-complete campaigns that have reached their end date
 * This should be run periodically (e.g., daily via cron job)
 */
export async function autoCompleteCampaignsAtEndDate(): Promise<{
  completed: number;
  errors: number;
}> {
  const now = new Date();
  const stats = { completed: 0, errors: 0 };

  try {
    // Find active campaigns that have passed their end date
    const expiredCampaigns = await prisma.campaign.findMany({
      where: {
        status: 'ACTIVE',
        endDate: {
          lte: now,
        },
      },
      include: {
        primaryLeader: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        guardians: {
          select: {
            id: true,
            email: true,
            firstName: true,
          },
        },
      },
    });

    console.log(`Found ${expiredCampaigns.length} campaigns to auto-complete`);

    // Process each expired campaign
    for (const campaign of expiredCampaigns) {
      try {
        // Update campaign status to COMPLETED
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: {
            status: 'COMPLETED',
            completedAt: now,
            updatedAt: now,
          },
        });

        console.log(`✅ Auto-completed campaign: ${campaign.organizationName} ${campaign.teamName}`);

        // Send notification emails
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const campaignUrl = `${appUrl}/dashboard/${campaign.id}`;
        const campaignName = `${campaign.organizationName} ${campaign.teamName}`;

        // Notify primary leader
        if (campaign.primaryLeader.email) {
          await sendCampaignStatusChangeNotification({
            toEmail: campaign.primaryLeader.email,
            toName: campaign.primaryLeader.firstName || 'Campaign Leader',
            campaignName,
            fromStatus: 'ACTIVE',
            toStatus: 'COMPLETED',
            reason: 'Campaign end date reached - automatically marked as complete',
            changedBy: 'Rally System (Automated)',
            campaignUrl,
          }).catch(err =>
            console.error('Failed to send notification to leader:', err)
          );
        }

        // Notify guardians
        for (const guardian of campaign.guardians) {
          if (guardian.email) {
            await sendCampaignStatusChangeNotification({
              toEmail: guardian.email,
              toName: guardian.firstName || 'Guardian',
              campaignName,
              fromStatus: 'ACTIVE',
              toStatus: 'COMPLETED',
              reason: 'Campaign end date reached - automatically marked as complete',
              changedBy: 'Rally System (Automated)',
              campaignUrl,
            }).catch(err =>
              console.error('Failed to send notification to guardian:', err)
            );
          }
        }

        stats.completed++;
      } catch (error) {
        console.error(`❌ Failed to auto-complete campaign ${campaign.id}:`, error);
        stats.errors++;
      }
    }

    return stats;
  } catch (error) {
    console.error('Error in autoCompleteCampaignsAtEndDate:', error);
    throw error;
  }
}

/**
 * Send reminders for campaigns ending soon (within 7 days)
 */
export async function sendCampaignEndingReminders(): Promise<{
  sent: number;
  errors: number;
}> {
  const now = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const stats = { sent: 0, errors: 0 };

  try {
    // Find active campaigns ending within 7 days
    const endingSoonCampaigns = await prisma.campaign.findMany({
      where: {
        status: 'ACTIVE',
        endDate: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
      include: {
        primaryLeader: {
          select: {
            email: true,
            firstName: true,
          },
        },
      },
    });

    console.log(`Found ${endingSoonCampaigns.length} campaigns ending soon`);

    // TODO: Send reminder emails
    // This would use a different email template for "campaign ending soon"
    // For now, just log them
    endingSoonCampaigns.forEach(campaign => {
      console.log(
        `Campaign ending soon: ${campaign.organizationName} ${campaign.teamName} - ` +
        `Ends: ${campaign.endDate?.toLocaleDateString()}`
      );
    });

    stats.sent = endingSoonCampaigns.length;
    return stats;
  } catch (error) {
    console.error('Error in sendCampaignEndingReminders:', error);
    throw error;
  }
}

/**
 * Check campaign health and generate warnings
 * Returns campaigns that need attention
 */
export async function checkCampaignHealth(): Promise<{
  warnings: Array<{
    campaignId: string;
    campaignName: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}> {
  const warnings: Array<{
    campaignId: string;
    campaignName: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
  }> = [];

  try {
    // Check 1: Active campaigns with passed end dates
    const overdueActiveCampaigns = await prisma.campaign.findMany({
      where: {
        status: 'ACTIVE',
        endDate: {
          lt: new Date(),
        },
      },
      select: {
        id: true,
        organizationName: true,
        teamName: true,
        endDate: true,
      },
    });

    overdueActiveCampaigns.forEach(campaign => {
      warnings.push({
        campaignId: campaign.id,
        campaignName: `${campaign.organizationName} ${campaign.teamName}`,
        issue: `Campaign end date passed (${campaign.endDate?.toLocaleDateString()}) but still active`,
        severity: 'high',
      });
    });

    // Check 2: Campaigns with insufficient balance for pending disbursements
    const campaignsWithPendingDisbursements = await prisma.campaign.findMany({
      where: {
        status: {
          in: ['ACTIVE', 'PAUSED', 'COMPLETED'],
        },
      },
      include: {
        bankingAccount: true,
      },
    });

    campaignsWithPendingDisbursements.forEach(campaign => {
      if (
        campaign.bankingAccount &&
        campaign.bankingAccount.pendingDisbursement > campaign.bankingAccount.availableBalance
      ) {
        warnings.push({
          campaignId: campaign.id,
          campaignName: `${campaign.organizationName} ${campaign.teamName}`,
          issue: `Insufficient balance for pending disbursements ($${
            (Number(campaign.bankingAccount.pendingDisbursement) -
              Number(campaign.bankingAccount.availableBalance)) / 100
          } short)`,
          severity: 'medium',
        });
      }
    });

    // Check 3: Draft campaigns older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const staleDraftCampaigns = await prisma.campaign.findMany({
      where: {
        status: 'DRAFT',
        createdAt: {
          lt: thirtyDaysAgo,
        },
      },
      select: {
        id: true,
        organizationName: true,
        teamName: true,
        createdAt: true,
      },
    });

    staleDraftCampaigns.forEach(campaign => {
      const daysOld = Math.floor(
        (Date.now() - campaign.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      warnings.push({
        campaignId: campaign.id,
        campaignName: `${campaign.organizationName} ${campaign.teamName}`,
        issue: `Draft campaign has been inactive for ${daysOld} days`,
        severity: 'low',
      });
    });

    console.log(`Campaign health check complete: ${warnings.length} warnings found`);
    return { warnings };
  } catch (error) {
    console.error('Error in checkCampaignHealth:', error);
    throw error;
  }
}

/**
 * Stretch goals on ACTIVE campaigns that opted into autoStretchGoal.
 *
 * Concurrent-tick safe: updateMany is keyed on the observed goalAmount, so a
 * second tick that still sees the old goal is a no-op.
 */
export async function applyAutoStretchGoals(): Promise<{
  stretched: number;
  errors: number;
}> {
  const stats = { stretched: 0, errors: 0 };

  const campaigns = await prisma.campaign.findMany({
    where: {
      status: "ACTIVE",
      autoStretchGoal: true,
    },
    select: {
      id: true,
      currentAmount: true,
      goalAmount: true,
      originalGoalAmount: true,
      stretchGoalPercent: true,
      stretchGoalTriggerPercent: true,
    },
  });

  for (const campaign of campaigns) {
    try {
      const next = nextStretchGoalAmount({
        currentAmount: campaign.currentAmount,
        goalAmount: campaign.goalAmount,
        originalGoalAmount: campaign.originalGoalAmount,
        stretchPercent: campaign.stretchGoalPercent,
        triggerPercent: campaign.stretchGoalTriggerPercent,
      });
      if (next === null) continue;

      const original = campaign.originalGoalAmount ?? campaign.goalAmount;
      const result = await prisma.campaign.updateMany({
        where: {
          id: campaign.id,
          goalAmount: campaign.goalAmount,
          autoStretchGoal: true,
          status: "ACTIVE",
        },
        data: {
          goalAmount: next,
          originalGoalAmount: original,
        },
      });
      if (result.count === 1) stats.stretched++;
    } catch (error) {
      console.error(`Failed to stretch goal for campaign ${campaign.id}:`, error);
      stats.errors++;
    }
  }

  return stats;
}

/**
 * Run all automated campaign checks
 * This is the main function to call from a cron job
 */
export async function runCampaignAutomation(): Promise<{
  autoCompleted: number;
  reminders: number;
  warnings: number;
  errors: number;
  outreachClaimed: number;
  outreachSent: number;
  outreachFailed: number;
  goalsStretched: number;
}> {
  console.log('🤖 Running campaign automation...');

  const results = {
    autoCompleted: 0,
    reminders: 0,
    warnings: 0,
    errors: 0,
    outreachClaimed: 0,
    outreachSent: 0,
    outreachFailed: 0,
    goalsStretched: 0,
  };

  try {
    // Auto-complete expired campaigns
    const completeResults = await autoCompleteCampaignsAtEndDate();
    results.autoCompleted = completeResults.completed;
    results.errors += completeResults.errors;

    // Send ending soon reminders
    const reminderResults = await sendCampaignEndingReminders();
    results.reminders = reminderResults.sent;
    results.errors += reminderResults.errors;

    // Check campaign health
    const healthResults = await checkCampaignHealth();
    results.warnings = healthResults.warnings.length;

    // Due SCHEDULED outreach — claim SCHEDULED→SENDING then deliver.
    const outreachResults = await processScheduledOutreach();
    results.outreachClaimed = outreachResults.claimed;
    results.outreachSent = outreachResults.sent;
    results.outreachFailed = outreachResults.failed;

    const stretchResults = await applyAutoStretchGoals();
    results.goalsStretched = stretchResults.stretched;
    results.errors += stretchResults.errors;

    console.log('✅ Campaign automation complete:', results);
    return results;
  } catch (error) {
    console.error('❌ Campaign automation failed:', error);
    throw error;
  }
}
