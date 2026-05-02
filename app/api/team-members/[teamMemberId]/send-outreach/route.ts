import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { sendEmail } from '@/lib/services/email';
import { sendSMS, sendBulkSMS, sendVideoSMS } from '@/lib/services/sms';

const sendOutreachSchema = z.object({
  type: z.enum(['email', 'sms', 'both']),
  recipients: z.array(z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  })).min(1),
  subject: z.string().optional(),
  message: z.string().min(1),
  videoUrl: z.string().url().optional(),
  schedule: z.string().datetime().optional(), // For future scheduling feature
});

/**
 * POST /api/team-members/[teamMemberId]/send-outreach
 * Send personalized outreach messages (email/SMS) to contacts
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { teamMemberId: string } }
) {
  try {
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

    const { teamMemberId } = params;
    const body = await request.json();
    const validatedData = sendOutreachSchema.parse(body);

    // Get team member and verify ownership
    const teamMember = await prisma.teamMember.findUnique({
      where: { id: teamMemberId },
      include: {
        campaign: {
          select: {
            id: true,
            teamName: true,
            organizationName: true,
            slug: true,
          }
        }
      }
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      );
    }

    // Check authorization (must be the team member or campaign leader)
    if (teamMember.userId !== user.id) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: teamMember.campaignId },
        select: { primaryLeaderId: true }
      });

      if (campaign?.primaryLeaderId !== user.id) {
        return NextResponse.json(
          { error: 'Not authorized to send messages for this team member' },
          { status: 403 }
        );
      }
    }

    // Build fundraising link
    const fundraisingLink = `${process.env.NEXT_PUBLIC_BASE_URL}/raise/${teamMember.campaign.slug}/player/${teamMember.fundLinkCode}`;

    // Track results
    const emailResults: Array<{ to: string; success: boolean; error?: string }> = [];
    const smsResults: Array<{ to: string; success: boolean; error?: string }> = [];

    // Send emails
    if (validatedData.type === 'email' || validatedData.type === 'both') {
      for (const recipient of validatedData.recipients) {
        if (!recipient.email) continue;

        const personalizedMessage = validatedData.message.replace(
          '{name}',
          recipient.name || 'there'
        );

        const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px 30px;">
              <div style="white-space: pre-wrap; font-size: 16px; color: #374151; line-height: 1.6;">
${personalizedMessage}
              </div>

              ${validatedData.videoUrl ? `
              <div style="margin: 30px 0; text-align: center;">
                <video controls style="max-width: 100%; border-radius: 8px;" poster="">
                  <source src="${validatedData.videoUrl}" type="video/mp4">
                  Your browser doesn't support video playback.
                </video>
              </div>
              ` : ''}

              <div style="margin-top: 40px; text-align: center;">
                <a href="${fundraisingLink}" style="display: inline-block; background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Support ${teamMember.name} →
                </a>
              </div>

              <p style="margin-top: 30px; font-size: 14px; color: #9ca3af; text-align: center;">
                ${teamMember.campaign.teamName} - ${teamMember.campaign.organizationName}
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                Sent via Rally Fundraising Platform
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `;

        const result = await sendEmail({
          to: recipient.email,
          subject: validatedData.subject || `${teamMember.name} needs your support!`,
          html: htmlBody,
          text: `${personalizedMessage}\n\nSupport ${teamMember.name}: ${fundraisingLink}`,
          replyTo: user.email,
        });

        emailResults.push({
          to: recipient.email,
          success: result.success,
          error: result.error,
        });

        // Save to outreach log
        if (recipient.email) {
          const existingContact = await prisma.contact.findFirst({
            where: {
              teamMemberId: teamMember.id,
              email: recipient.email,
            }
          });

          if (existingContact) {
            await prisma.contact.update({
              where: { id: existingContact.id },
              data: {
                emailsSent: { increment: 1 },
                lastContactedAt: new Date(),
              }
            });
          } else {
            await prisma.contact.create({
              data: {
                teamMemberId: teamMember.id,
                firstName: recipient.name?.split(' ')[0],
                lastName: recipient.name?.split(' ').slice(1).join(' '),
                email: recipient.email,
                phone: recipient.phone,
                source: 'MANUAL_IMPORT',
                emailsSent: 1,
                lastContactedAt: new Date(),
              }
            });
          }
        }
      }
    }

    // Send SMS
    if (validatedData.type === 'sms' || validatedData.type === 'both') {
      const smsMessages = validatedData.recipients
        .filter(r => r.phone)
        .map(recipient => {
          const personalizedMessage = validatedData.message.replace(
            '{name}',
            recipient.name || 'there'
          );

          return {
            to: recipient.phone!,
            message: `${personalizedMessage}\n\nSupport me here: ${fundraisingLink}`,
            mediaUrl: validatedData.videoUrl ? [validatedData.videoUrl] : undefined,
          };
        });

      if (smsMessages.length > 0) {
        const bulkResult = await sendBulkSMS(smsMessages);
        smsResults.push(...bulkResult.results);

        // Save to outreach log
        for (const recipient of validatedData.recipients) {
          if (recipient.phone) {
            const existingContact = await prisma.contact.findFirst({
              where: {
                teamMemberId: teamMember.id,
                phone: recipient.phone,
              }
            });

            if (existingContact) {
              await prisma.contact.update({
                where: { id: existingContact.id },
                data: {
                  smsSent: { increment: 1 },
                  lastContactedAt: new Date(),
                }
              });
            } else {
              await prisma.contact.create({
                data: {
                  teamMemberId: teamMember.id,
                  firstName: recipient.name?.split(' ')[0],
                  lastName: recipient.name?.split(' ').slice(1).join(' '),
                  email: recipient.email,
                  phone: recipient.phone,
                  source: 'MANUAL_IMPORT',
                  smsSent: 1,
                  lastContactedAt: new Date(),
                }
              });
            }
          }
        }
      }
    }

    // Calculate summary
    const emailSuccess = emailResults.filter(r => r.success).length;
    const emailFailed = emailResults.filter(r => !r.success).length;
    const smsSuccess = smsResults.filter(r => r.success).length;
    const smsFailed = smsResults.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      summary: {
        email: {
          sent: emailSuccess,
          failed: emailFailed,
          total: emailResults.length,
        },
        sms: {
          sent: smsSuccess,
          failed: smsFailed,
          total: smsResults.length,
        }
      },
      results: {
        email: emailResults,
        sms: smsResults,
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error sending outreach:', error);
    return NextResponse.json(
      { error: 'Failed to send messages' },
      { status: 500 }
    );
  }
}
