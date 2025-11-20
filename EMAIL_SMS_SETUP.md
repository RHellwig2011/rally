# Email & SMS Outreach Setup Guide

Rally now supports real email and SMS sending! Players can import their contacts and send personalized donation requests to friends and family.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Email Setup (Resend)](#email-setup-resend)
4. [SMS Setup (Twilio)](#sms-setup-twilio)
5. [Contact Management](#contact-management)
6. [Outreach Campaigns](#outreach-campaigns)
7. [API Reference](#api-reference)
8. [Best Practices](#best-practices)

---

## Overview

### Features

✅ **Real Email Sending** using Resend
✅ **Real SMS Sending** using Twilio
✅ **Contact Import** - Players can import email and phone contacts
✅ **Bulk Campaigns** - Send personalized messages to all contacts
✅ **Automatic Invitations** - Players get an email when added to roster
✅ **Message Templates** - Personalize with donor names and donation links
✅ **Tracking** - Monitor delivery, opens, and clicks

### Why Resend + Twilio?

**Resend:**
- Modern, developer-friendly API
- Free tier: 3,000 emails/month, 100/day
- Excellent deliverability
- Easy setup with domain verification

**Twilio:**
- Industry standard for SMS
- Free trial: $15 credit (~450 messages)
- Reliable delivery worldwide
- Great documentation

---

## Quick Start

### 1. Install Dependencies (Already Done ✅)

```bash
npm install resend twilio
```

### 2. Get Your API Keys

**Resend:**
1. Sign up at https://resend.com
2. Go to https://resend.com/api-keys
3. Create a new API key
4. Copy it (starts with `re_`)

**Twilio:**
1. Sign up at https://twilio.com
2. Go to https://console.twilio.com
3. Find your Account SID and Auth Token
4. Get a phone number from https://console.twilio.com/phone-numbers

### 3. Update Environment Variables

Edit `.env`:

```bash
# Email (Resend)
RESEND_API_KEY="re_your_actual_key"
EMAIL_FROM="noreply@yourdomain.com"

# SMS (Twilio)
TWILIO_ACCOUNT_SID="AC_your_actual_sid"
TWILIO_AUTH_TOKEN="your_actual_token"
TWILIO_PHONE_NUMBER="+1234567890"
```

### 4. Verify Your Domain (Resend)

For production emails, verify your domain in Resend:
1. Go to https://resend.com/domains
2. Add your domain
3. Add the DNS records they provide
4. Wait for verification (usually 5-10 minutes)

---

## Email Setup (Resend)

### Getting Started

1. **Sign up:** https://resend.com
2. **Create API Key:** https://resend.com/api-keys
3. **Add domain:** https://resend.com/domains (optional for dev)

### Free Tier Limits

- 3,000 emails per month
- 100 emails per day
- Full access to all features

### Domain Verification

For production, verify your domain to avoid spam filters:

```bash
# Add these DNS records (get from Resend dashboard)
TXT  _resend.yourdomain.com  value_from_resend
CNAME resend._domainkey.yourdomain.com  resend._domainkey.resend.com
```

### Test Email

```typescript
import { sendEmail } from '@/lib/email';

await sendEmail({
  to: 'test@example.com',
  subject: 'Test Email',
  html: '<h1>Hello World!</h1>',
  text: 'Hello World!',
});
```

### Email Templates

Rally includes pre-built email templates:
- Team member invitation
- Campaign update notification
- Donation receipt
- Custom outreach messages

---

## SMS Setup (Twilio)

### Getting Started

1. **Sign up:** https://twilio.com
2. **Get credentials:** https://console.twilio.com
3. **Get phone number:** https://console.twilio.com/phone-numbers

### Free Trial

- $15 credit (about 450 SMS messages)
- US/Canada: $0.0075 per message
- International varies

### Phone Number Setup

1. Buy a phone number in Twilio console
2. Choose a number with SMS capabilities
3. Copy the number (format: +1234567890)

### Test SMS

```typescript
import { sendSMS } from '@/lib/sms';

await sendSMS({
  to: '+1234567890',
  body: 'Hello from Rally!',
});
```

### Phone Number Format

Rally automatically formats phone numbers to E.164:
- `(123) 456-7890` → `+11234567890`
- `123-456-7890` → `+11234567890`
- `1234567890` → `+11234567890`

---

## Contact Management

### Import Contacts

Players can import contacts via the API:

```typescript
POST /api/contacts/import
{
  "teamMemberId": "tm_123",
  "source": "CSV_UPLOAD",
  "contacts": [
    {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "phone": "123-456-7890",
      "tags": ["friend", "vip"]
    }
  ]
}
```

### CSV Import Example

Players can upload a CSV file with:
```csv
firstName,lastName,email,phone
John,Doe,john@example.com,123-456-7890
Jane,Smith,jane@example.com,234-567-8901
```

### Contact Schema

Each contact can have:
- `firstName` (optional)
- `lastName` (optional)
- `email` (optional - but needs email OR phone)
- `phone` (optional - but needs email OR phone)
- `notes` (optional)
- `tags` (optional array)

### Duplicate Detection

The system automatically:
- Skips contacts with duplicate emails
- Skips contacts with duplicate phone numbers
- Returns count of imported vs skipped

---

## Outreach Campaigns

### Create a Campaign

```typescript
POST /api/outreach/campaigns
{
  "campaignId": "campaign_123",
  "name": "Opening Day Fundraiser",
  "type": "BOTH", // EMAIL, SMS, or BOTH
  "emailSubject": "Help us reach our goal!",
  "emailBody": "Hi {firstName}, can you help support our team? {donationLink}",
  "smsBody": "Hi {firstName}! Support our team: {donationLink}"
}
```

### Message Templates

Use these placeholders in your messages:
- `{firstName}` - Contact's first name
- `{donationLink}` - Personalized donation link with tracking

### Campaign Types

1. **EMAIL** - Send only emails (requires emailSubject + emailBody)
2. **SMS** - Send only SMS (requires smsBody)
3. **BOTH** - Send both email and SMS (requires all fields)

### Scheduling

Send immediately or schedule for later:

```typescript
{
  "scheduledFor": "2024-12-25T10:00:00Z" // ISO datetime
}
```

### Campaign Stats

Track campaign performance:
- Total recipients
- Emails sent
- SMS sent
- Emails opened
- Links clicked
- Donations received

---

## API Reference

### Endpoints

#### Import Contacts
```
POST /api/contacts/import
GET  /api/contacts/import?teamMemberId=xxx
```

#### Outreach Campaigns
```
POST /api/outreach/campaigns
GET  /api/outreach/campaigns?campaignId=xxx
```

### Example: Full Workflow

```typescript
// 1. Player imports contacts
const importResult = await fetch('/api/contacts/import', {
  method: 'POST',
  body: JSON.stringify({
    teamMemberId: 'tm_123',
    contacts: [/* ... */]
  })
});

// 2. Create outreach campaign
const campaign = await fetch('/api/outreach/campaigns', {
  method: 'POST',
  body: JSON.stringify({
    campaignId: 'camp_456',
    name: 'Ask for donations',
    type: 'BOTH',
    emailSubject: 'Support our team!',
    emailBody: 'Hi {firstName}, we need your help...',
    smsBody: 'Hi {firstName}! Support us: {donationLink}'
  })
});

// 3. Check campaign status
const status = await fetch('/api/outreach/campaigns?campaignId=camp_456');
```

---

## Best Practices

### Email Best Practices

1. **Personalize:** Always use {firstName} in messages
2. **Clear CTA:** Make the donation link prominent
3. **Mobile-friendly:** Keep emails short and scannable
4. **Avoid spam:** Don't use ALL CAPS, excessive exclamation marks
5. **Test first:** Send test emails before bulk sending
6. **Verify domain:** Use verified domain in production

### SMS Best Practices

1. **Keep it short:** SMS has 160 character limit
2. **Include link:** Always include {donationLink}
3. **Timing:** Send during daytime hours (9am-8pm)
4. **Frequency:** Don't spam - max 1-2 messages per week
5. **Opt-out:** Consider adding "Reply STOP to unsubscribe"
6. **Personal:** Use {firstName} when possible

### Legal Compliance

⚠️ **Important:** Make sure you have permission to contact people!

**Email (CAN-SPAM Act):**
- Only email people who opted in or have existing relationship
- Include physical address in footer
- Honor unsubscribe requests within 10 days
- Don't use deceptive subject lines

**SMS (TCPA):**
- Requires explicit written consent
- Must provide opt-out mechanism
- Don't call/text before 8am or after 9pm
- Keep records of consent

### Rate Limiting

To avoid hitting API limits:

**Resend:**
- Max 100 emails/day on free tier
- Add delays between bulk sends
- Consider upgrading for more volume

**Twilio:**
- Start with free trial credits
- Monitor usage in dashboard
- Add credits before running out

### Cost Optimization

**Free Tier Strategy:**
- Use Resend free tier (3,000/month)
- Twilio trial credits (~450 SMS)
- Target most engaged contacts first
- Use email for bulk, SMS for high-value

**Paid Strategy:**
- Resend: $20/month for 50,000 emails
- Twilio: Pay-as-you-go ($0.0075/SMS)
- Total monthly: ~$20-50 for small campaigns

---

## Troubleshooting

### Email Not Sending

1. **Check API key:** Make sure RESEND_API_KEY is set correctly
2. **Check logs:** Look for error messages in console
3. **Verify domain:** Make sure EMAIL_FROM uses verified domain
4. **Check spam:** Emails might be in spam folder
5. **Rate limits:** Check if you hit daily limit (100/day)

### SMS Not Sending

1. **Check credentials:** Verify TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN
2. **Check phone number:** Must be in E.164 format (+1234567890)
3. **Trial account:** With trial, can only send to verified numbers
4. **Credits:** Make sure you have Twilio credits
5. **Carrier blocks:** Some carriers block automated messages

### Common Errors

**"RESEND_API_KEY not configured"**
- Add RESEND_API_KEY to .env file
- Restart your dev server

**"Invalid phone number format"**
- Phone must have 10-11 digits
- Include country code for international

**"Daily send limit exceeded"**
- On Resend free tier (100/day)
- Wait until next day or upgrade

**"Insufficient funds"**
- Out of Twilio credits
- Add credits at https://console.twilio.com

---

## Example Use Cases

### 1. Player Import + Send Flow

```typescript
// Player logs in after being added to roster
// They see: "Import your contacts to start fundraising!"

// Step 1: Upload CSV
const contacts = parseCSV(file);

// Step 2: Import
await fetch('/api/contacts/import', {
  method: 'POST',
  body: JSON.stringify({
    teamMemberId,
    contacts,
    source: 'CSV_UPLOAD'
  })
});

// Step 3: Create campaign
await fetch('/api/outreach/campaigns', {
  method: 'POST',
  body: JSON.stringify({
    campaignId,
    name: 'My first ask',
    type: 'EMAIL',
    emailSubject: 'Help me reach my goal!',
    emailBody: `Hi {firstName}!

I'm raising money for our team and would love your support!

Every donation helps us get closer to our goal.

{donationLink}

Thanks!
- ${playerName}`
  })
});
```

### 2. Team Leader Bulk Campaign

```typescript
// Send to all team members' contacts
await fetch('/api/outreach/campaigns', {
  method: 'POST',
  body: JSON.stringify({
    campaignId,
    name: 'Final push - everyone!',
    type: 'BOTH',
    // Don't specify teamMemberIds = sends to all
    emailSubject: 'We're almost there!',
    emailBody: 'Hi {firstName}, we need your help...',
    smsBody: 'Hi {firstName}! Help us: {donationLink}'
  })
});
```

---

## Support

- **Resend Docs:** https://resend.com/docs
- **Twilio Docs:** https://www.twilio.com/docs
- **Resend Support:** support@resend.com
- **Twilio Support:** https://support.twilio.com

---

**Ready to start?** Get your API keys and update your `.env` file! 🚀
