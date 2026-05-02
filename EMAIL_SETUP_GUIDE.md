# Email Delivery Setup Guide

Complete guide for configuring email delivery in the Rally fundraising platform using Resend.

## Table of Contents

1. [Overview](#overview)
2. [Current Status](#current-status)
3. [Email Templates](#email-templates)
4. [Resend Setup](#resend-setup)
5. [Environment Configuration](#environment-configuration)
6. [Testing](#testing)
7. [Production Deployment](#production-deployment)
8. [Troubleshooting](#troubleshooting)

---

## Overview

Rally uses [Resend](https://resend.com) for transactional email delivery. The email system is fully implemented and ready to use once Resend is configured.

### Email Service Files

- **`lib/email.ts`** - Main email service with fallback to console logging
- **`lib/services/email.ts`** - Alternative implementation with additional templates

### Email Types

1. **Donation Receipts** - Sent automatically when donations are processed
2. **Team Member Invitations** - Sent when coaches invite players
3. **Campaign Updates** - Notifications for campaign milestones
4. **Email Verification** - Account creation verification
5. **Password Reset** - Password recovery emails
6. **Parent Notifications** - Welcome emails for parents
7. **Donation Notifications** - Real-time donation alerts

---

## Current Status

✅ **Email System Implementation**: 100% Complete
✅ **Email Templates**: 7 templates ready
✅ **Webhook Integration**: Donation receipts sent automatically
⚠️ **Resend Configuration**: Placeholder API key (needs real key)

### What's Working

- Email sending logic is fully implemented
- HTML and plain-text templates are complete
- Graceful fallback when Resend not configured (logs to console)
- Integration with donation webhook (auto-sends receipts)

### What's Needed

- Valid Resend API key
- Verified sending domain (for production)
- Environment variables updated

---

## Email Templates

### 1. Donation Receipt

**Function**: `sendDonationReceipt()`
**Triggered**: Automatically when `payment_intent.succeeded` webhook received
**Location**: `lib/email.ts:253-342`

```typescript
await sendDonationReceipt({
  toEmail: 'donor@example.com',
  donorName: 'John Doe',
  campaignName: 'Lincoln High School Robotics',
  amount: 10000, // cents
  donationDate: new Date(),
  taxDeductible: true,
});
```

**Features**:
- Beautiful gradient header with thank you message
- Clear receipt details (campaign, amount, date)
- Tax deductibility notice
- Mobile-responsive design

### 2. Team Member Invitation

**Function**: `sendTeamMemberInvitation()`
**Triggered**: When coach adds team members
**Location**: `lib/email.ts:68-176`

```typescript
await sendTeamMemberInvitation({
  toEmail: 'player@example.com',
  toName: 'Jane Smith',
  campaignName: 'Basketball Tournament',
  campaignOrg: 'Central High School',
  inviterName: 'Coach Johnson',
  inviteLink: 'http://localhost:3000/player/onboard/abc123',
});
```

**Features**:
- Welcoming invitation design
- Clear call-to-action button
- Instructions for getting started
- Contact import feature highlighted

### 3. Campaign Update

**Function**: `sendCampaignUpdate()`
**Triggered**: When campaign milestones reached or manual updates posted
**Location**: `lib/email.ts:178-249`

### 4-7. Authentication & Notifications

- `sendEmailVerification()` - Account verification
- `sendPasswordResetEmail()` - Password recovery
- `sendParentWelcomeEmail()` - Parent onboarding
- `sendDonationNotificationEmail()` - Real-time donation alerts

---

## Resend Setup

### Step 1: Create Resend Account

1. Go to [https://resend.com](https://resend.com)
2. Sign up for a free account
   - **Free Tier**: 100 emails/day, 3,000 emails/month
   - **Pro Tier**: $20/month for 50,000 emails
3. Verify your email address

### Step 2: Get API Key

1. Log into Resend Dashboard
2. Navigate to **API Keys** section
3. Click **Create API Key**
4. **Name**: `Rally Production` (or `Rally Development`)
5. **Permission**: Full Access
6. Copy the API key (starts with `re_`)

**Important**: Save the API key immediately - you won't be able to see it again!

### Step 3: Domain Verification (Production Only)

For production use, verify your sending domain:

1. In Resend Dashboard, go to **Domains**
2. Click **Add Domain**
3. Enter your domain (e.g., `rallyraise.com`)
4. Add DNS records provided by Resend:
   - SPF record
   - DKIM record
   - DMARC record (optional but recommended)
5. Wait for verification (usually 5-30 minutes)

**For Development**: Use Resend's onboarding email (can send to yourself)

---

## Environment Configuration

### Development Setup

Update your `.env` file:

```bash
# Resend Configuration
RESEND_API_KEY=re_your_actual_api_key_here

# Email Settings
EMAIL_FROM="Rally <noreply@yourdomain.com>"

# Or for development (using your own email):
# EMAIL_FROM="Rally Dev <your-email@gmail.com>"
```

### Production Setup

```bash
# Resend Configuration
RESEND_API_KEY=re_live_production_key_here

# Email Settings (must use verified domain)
EMAIL_FROM="Rally <noreply@rallyraise.com>"
NEXT_PUBLIC_APP_URL=https://rallyraise.com
```

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `RESEND_API_KEY` | Yes | Resend API key | `re_123...` |
| `EMAIL_FROM` | No | Default sender email | `Rally <noreply@domain.com>` |
| `NEXT_PUBLIC_APP_URL` | No | App URL for links | `https://rallyraise.com` |

---

## Testing

### Test Script

Run the email delivery test:

```bash
node test-email-delivery.mjs
```

**Expected Output (Without Resend Configured)**:
```
⚠️  RESEND_API_KEY is not configured
✅ Emails were logged to console (see above)
```

**Expected Output (With Resend Configured)**:
```
✅ RESEND_API_KEY is configured
✅ Emails were sent via Resend
📬 Check the recipient inboxes to verify delivery
```

### Manual Testing

1. **Start development server**:
   ```bash
   npm run dev
   ```

2. **Start Stripe webhook listener**:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

3. **Make a test donation**:
   ```bash
   node test-e2e-donation.mjs
   ```

4. **Check for email**:
   - If Resend configured: Check donor's inbox
   - If not configured: Check console logs for email content

### Testing Checklist

- [ ] Run `node test-email-delivery.mjs`
- [ ] Verify donation receipt sent after test donation
- [ ] Check email formatting in Gmail
- [ ] Check email formatting in Outlook
- [ ] Verify links in email work correctly
- [ ] Check spam folder placement
- [ ] Test plain-text version displays correctly

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] Resend account created
- [ ] Domain verified in Resend
- [ ] Production API key generated
- [ ] Environment variables set in hosting platform
- [ ] `EMAIL_FROM` uses verified domain
- [ ] Test emails sent successfully
- [ ] Email deliverability tested (Gmail, Outlook, etc.)
- [ ] Spam score checked (use [Mail Tester](https://www.mail-tester.com))
- [ ] Unsubscribe links functional (if applicable)

### Deployment Steps

1. **Update Production Environment**:
   ```bash
   # On Vercel / your hosting platform
   RESEND_API_KEY=re_live_xxxxx
   EMAIL_FROM="Rally <noreply@rallyraise.com>"
   NEXT_PUBLIC_APP_URL=https://rallyraise.com
   ```

2. **Verify Domain DNS**:
   - Ensure all DNS records from Resend are added
   - Wait for verification checkmarks in Resend Dashboard

3. **Test in Production**:
   - Make a test donation with a real email
   - Verify receipt arrives within 30 seconds
   - Check formatting across email clients

4. **Monitor Deliverability**:
   - Check Resend Dashboard → Analytics
   - Monitor bounce rate
   - Monitor spam complaints
   - Set up alerts for delivery issues

### Email Deliverability Best Practices

1. **SPF, DKIM, DMARC**: All DNS records properly configured
2. **Sender Reputation**: Use dedicated sending domain
3. **List Hygiene**: Remove bounced/invalid emails
4. **Content Quality**: Avoid spam trigger words
5. **Unsubscribe**: Include clear unsubscribe link
6. **Engagement**: Monitor open/click rates

---

## Troubleshooting

### Common Issues

#### 1. API Key Invalid

**Error**: `API key is invalid`

**Solution**:
- Verify API key is correct in `.env`
- Ensure no extra spaces or quotes
- Regenerate key in Resend Dashboard if needed

#### 2. Domain Not Verified

**Error**: `Domain not verified` or `From address not allowed`

**Solution**:
- Complete domain verification in Resend
- Use `@resend.dev` email for testing
- Check DNS propagation (can take up to 48 hours)

#### 3. Emails Going to Spam

**Possible Causes**:
- Missing SPF/DKIM records
- Poor sender reputation
- Spam trigger words in content
- Too many links

**Solutions**:
- Verify all DNS records in Resend
- Use [Mail Tester](https://www.mail-tester.com) to check spam score
- Warm up sending domain with gradual volume increase
- Review email content for spam triggers

#### 4. Emails Not Sending

**Debugging Steps**:

1. Check console logs for errors
2. Verify Resend API key is set correctly
3. Check Resend Dashboard → Logs for delivery status
4. Ensure email addresses are valid
5. Check rate limits (100/day on free tier)

#### 5. Webhook Not Sending Emails

**Check**:
- Webhook is receiving events (check Stripe CLI logs)
- No errors in webhook handler logs
- Donation was successfully created in database
- Email sending didn't throw error (check logs)

### Debug Mode

Enable detailed logging:

```typescript
// lib/email.ts
export async function sendEmail(options: EmailOptions) {
  console.log('📧 Sending email:', {
    to: options.to,
    subject: options.subject,
    from: process.env.EMAIL_FROM,
  });
  // ... rest of function
}
```

---

## Resend Dashboard

### Key Metrics to Monitor

1. **Delivery Rate**: Should be >95%
2. **Bounce Rate**: Should be <5%
3. **Spam Complaints**: Should be <0.1%
4. **Open Rate**: Varies by email type (20-40% typical)

### Useful Features

- **Logs**: See every email sent, delivered, bounced
- **Analytics**: Track opens, clicks, deliverability
- **Webhooks**: Get notified of delivery events
- **Suppression List**: Automatically managed bounces/complaints

---

## Testing Results

### Test Execution: November 30, 2025

**Email Templates**: ✅ 7 templates implemented
**Email Service**: ✅ Fully functional
**Fallback Logging**: ✅ Works when Resend not configured
**Webhook Integration**: ✅ Donation receipts sent automatically

**Status**: Ready for Resend configuration and production use

---

## Support & Resources

- **Resend Documentation**: https://resend.com/docs
- **Resend API Reference**: https://resend.com/docs/api-reference
- **Resend Status**: https://status.resend.com
- **Email Testing Tool**: https://www.mail-tester.com
- **DNS Checker**: https://dnschecker.org

---

## Changelog

### 2025-11-30
- ✅ Email system fully implemented
- ✅ 7 email templates created
- ✅ Webhook integration for donation receipts
- ✅ Fallback logging for development
- ✅ Test script created
- ✅ Documentation complete
- ⏭️ Next: Add valid Resend API key for live testing

---

## Quick Start

**To start sending emails right now:**

1. Sign up at https://resend.com (2 minutes)
2. Get your API key
3. Update `.env`:
   ```bash
   RESEND_API_KEY=re_your_key_here
   EMAIL_FROM="Rally <your-email@gmail.com>"
   ```
4. Restart dev server: `npm run dev`
5. Run test: `node test-email-delivery.mjs`
6. Check your inbox!

**That's it!** 🎉
