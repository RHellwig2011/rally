# Rally Communication System - Complete Guide

## Overview

A comprehensive email, SMS, and AI-powered messaging system for fundraising campaigns. This system allows players to send personalized outreach messages, includes AI-generated content, video support, and automated parent notifications.

---

## ✨ Key Features Implemented

### 1. **Team Member Onboarding with Parent Contact Collection**

Players complete an onboarding process that collects:
- Player email & phone (optional)
- Parent/Guardian 1 info (required - name, email, phone)
- Parent/Guardian 2 info (optional - for divorced/separated families)

**Pages:**
- `/player/onboard/[teamMemberId]?token=xxx` - Onboarding form with tutorial

**APIs:**
- `GET /api/team-members/[teamMemberId]/onboard?token=xxx` - Verify token & get info
- `POST /api/team-members/[teamMemberId]/onboard` - Submit onboarding data

---

### 2. **Email Service (Resend Integration)**

Professional, branded email templates for all notifications:

**Service:** `/lib/services/email.ts`

**Functions:**
- `sendEmail(options)` - Generic email sender
- `sendTeamMemberInvitationEmail()` - Player invitation with onboarding link
- `sendParentWelcomeEmail()` - Welcome email to parents after onboarding
- `sendDonationNotificationEmail()` - Notify when donations are received

**Email Templates Include:**
- Responsive HTML design
- Gradient headers with emojis
- Step-by-step instructions
- Call-to-action buttons
- Mobile-friendly layout
- Branded footer

---

### 3. **SMS Service (Twilio Integration)**

Text message notifications and video MMS support:

**Service:** `/lib/services/sms.ts`

**Functions:**
- `sendSMS(options)` - Send individual SMS
- `sendTeamMemberInvitationSMS()` - Invite via text
- `sendParentWelcomeSMS()` - Welcome text to parents
- `sendDonationNotificationSMS()` - Donation alerts
- `sendBulkSMS(messages)` - Bulk sending for outreach
- `sendVideoSMS(phone, message, videoUrl)` - MMS with video

**Features:**
- Automatic E.164 phone formatting
- US number support (auto-adds +1)
- Video/image support via MMS
- Bulk sending capabilities

---

### 4. **AI Message Generator (OpenAI Integration)**

Generate personalized fundraising messages using AI based on campaign details:

**Service:** `/lib/services/ai-message-generator.ts`

**Functions:**
- `generateEmailMessage(context, options)` - Full email (subject + body)
- `generateSMSMessage(context, options)` - 160-char SMS
- `generateVideoScript(context, duration)` - Video script with stage directions
- `generateMessageVariations(context, count)` - Multiple versions for A/B testing
- `improveMessage(original, context, focus)` - Enhance existing messages

**AI Options:**
- **Tone:** friendly, professional, enthusiastic, heartfelt
- **Length:** short, medium, long
- **Include stats:** Progress toward goal
- **Include CTA:** Call-to-action to donate
- **Custom instructions:** Additional guidance

**Context Used:**
- Campaign name & description
- Player name, position, grade
- Goal amount & current progress
- Team & organization info

**Example Generated Email:**
```
Subject: Help me reach my goal for Lincoln High Basketball!

Hi there!

I'm Sarah Johnson, a sophomore on the Lincoln High Basketball team.
We're raising money for new uniforms and equipment so we can have
an amazing season this year.

So far, I've raised $250 of my $500 goal - that's 50%! Every donation,
big or small, helps us get closer to our goal.

Would you consider supporting me? Your donation would mean the world
to me and my teammates.

Thanks so much for your support!
Sarah
```

---

### 5. **Player Outreach Interface**

Beautiful, kid-friendly interface for sending messages to contacts:

**Page:** `/player/outreach/[teamMemberId]`

**Features:**
- Choose delivery method (Email, SMS, or Both)
- AI message generation with tone selection
- Manual message composition
- Video URL field (for recorded messages)
- Video script generator
- Multiple recipient management
- Message personalization with {name} variable
- Character counter for SMS
- Send summary with success/failure tracking

**Workflow:**
1. Player selects Email/SMS/Both
2. Clicks "AI Generate" or writes manually
3. Optionally records video and pastes URL
4. Adds recipients (name, email, phone)
5. Sends messages - each personalized automatically

---

### 6. **API Endpoints**

#### Message Generation API
**Endpoint:** `POST /api/campaigns/[campaignId]/generate-message`

**Request Body:**
```json
{
  "type": "email" | "sms" | "video" | "variations" | "improve",
  "teamMemberId": "optional",
  "tone": "friendly" | "professional" | "enthusiastic" | "heartfelt",
  "length": "short" | "medium" | "long",
  "includeStats": true,
  "includeCallToAction": true,
  "customInstructions": "Make it sound like a 10th grader",
  "videoDuration": 30,
  "variationCount": 3,
  "originalMessage": "for improve type",
  "improvementFocus": "clarity" | "emotion" | "brevity" | "engagement"
}
```

**Response:**
```json
{
  "success": true,
  "type": "email",
  "message": {
    "subject": "Help me reach my goal!",
    "body": "Hi there! I'm raising money for..."
  }
}
```

#### Outreach Sending API
**Endpoint:** `POST /api/team-members/[teamMemberId]/send-outreach`

**Request Body:**
```json
{
  "type": "email" | "sms" | "both",
  "recipients": [
    {
      "name": "John Smith",
      "email": "john@example.com",
      "phone": "+15551234567"
    }
  ],
  "subject": "Please support my fundraiser",
  "message": "Hi {name}! I'm raising money for...",
  "videoUrl": "https://optional-video.mp4"
}
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "email": { "sent": 5, "failed": 0, "total": 5 },
    "sms": { "sent": 3, "failed": 1, "total": 4 }
  },
  "results": {
    "email": [{"to": "john@example.com", "success": true}],
    "sms": [{"to": "+15551234567", "success": true}]
  }
}
```

---

## 🔧 Setup & Configuration

### Environment Variables Required

```bash
# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM="Rally <noreply@rally.app>"

# SMS (Twilio)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+15551234567

# AI (OpenAI)
OPENAI_API_KEY=sk-xxxxxxxxxxxxx

# App URL
NEXT_PUBLIC_BASE_URL=https://rally.app
```

### Installation

Packages are already installed:
- ✅ `resend` - Email service
- ✅ `twilio` - SMS service
- ✅ `openai` - AI message generation

### Database Schema Updates

Added to `TeamMember` model:
```prisma
model TeamMember {
  // Player contact
  email           String?
  phone           String?

  // Parent 1
  parentFirstName String?
  parentLastName  String?
  parentEmail     String?
  parentPhone     String?

  // Parent 2 (optional)
  secondParentFirstName String?
  secondParentLastName  String?
  secondParentEmail     String?
  secondParentPhone     String?

  // Onboarding tracking
  invitationToken       String?   @unique
  invitationStatus      InvitationStatus @default(PENDING)
  onboardingCompletedAt DateTime?
}

model Contact {
  // Tracks outreach
  emailsSent      Int      @default(0)
  smsSent         Int      @default(0)
  lastContactedAt DateTime?
}
```

---

## 📧 Email Templates

### 1. Team Member Invitation
- **When:** Coach adds player to campaign
- **Recipient:** Player email
- **Content:** Welcome message, onboarding link, instructions
- **CTA:** "Complete Your Profile" button

### 2. Parent Welcome
- **When:** Player completes onboarding
- **Recipient:** Parent email(s)
- **Content:** Notification that child joined, progress tracking info
- **CTA:** "View Fundraising Page" button

### 3. Donation Notification
- **When:** Someone donates
- **Recipient:** Player & parent email(s)
- **Content:** Donor name, amount, optional message
- **Visual:** Large $ amount display, celebration emojis

### 4. Player Outreach (Generated)
- **When:** Player sends messages
- **Recipient:** Player's contacts
- **Content:** AI-generated or manual message
- **Features:** Video embed, personalized greeting, donate CTA

---

## 📱 SMS Templates

### 1. Team Member Invitation SMS
```
Hi {name}! 🎉 You've been invited to join {campaign}.
Complete your profile here: {onboardingLink}
```

### 2. Parent Welcome SMS
```
Hi {parentName}, {playerName} joined {campaign}!
Track their progress: {fundraisingLink}
```

### 3. Donation Notification SMS
```
🎉 {playerName} received a ${amount} donation from {donorName}!
Keep it up!
```

### 4. Player Outreach SMS
```
{personalizedMessage}

Support me here: {fundraisingLink}
```

---

## 🎥 Video Features

### Video Recording Workflow
1. Player clicks "Get Script" button
2. AI generates 30-second script with stage directions
3. Player reads script on camera (phone/webcam)
4. Player uploads video to hosting (Cloudinary, S3, etc.)
5. Player pastes video URL into form
6. Video sent via:
   - **Email:** Embedded HTML5 player
   - **SMS:** MMS attachment (if supported by carrier)

### Recommended Video Hosts
- Cloudinary (free tier)
- AWS S3 + CloudFront
- Vimeo
- YouTube (unlisted)

---

## 🤖 AI Message Generation

### How It Works

1. **Context Collection:** Gathers campaign info, player details, progress
2. **Prompt Engineering:** Constructs detailed prompt with requirements
3. **GPT-4o-mini:** Generates authentic, age-appropriate content
4. **Fallback:** If AI fails, uses template-based messages

### Best Practices

**For Players:**
- Use "friendly" or "enthusiastic" tone
- Include stats to show progress
- Keep it authentic (sounds like a kid, not marketing)
- Use {name} for personalization

**For Coaches:**
- Use "professional" tone
- Include team goals and needs
- Add custom instructions for specific messaging

### Cost Estimates
- Email generation: ~$0.001 per message
- SMS generation: ~$0.0005 per message
- Video script: ~$0.002 per script

---

## 🚀 Usage Examples

### Example 1: Kid Sends Outreach
```typescript
// Player visits /player/outreach/[their-team-member-id]
// 1. Selects "Email" as delivery method
// 2. Chooses "enthusiastic" tone
// 3. Clicks "AI Generate"
// 4. AI creates subject + body based on campaign
// 5. Adds 10 family/friend emails
// 6. Clicks "Send Messages"
// Result: 10 personalized emails sent with fundraising link
```

### Example 2: Parent Gets Notified
```typescript
// After player completes onboarding:
// 1. Onboarding API saves parent email + phone
// 2. Sends welcome email to parent
// 3. Sends welcome SMS to parent
// 4. Parent receives both notifications
// Result: Parent can track progress via provided link
```

### Example 3: Donation Alert
```typescript
// When donation is processed:
// 1. Donation webhook fires
// 2. Looks up team member + parents
// 3. Sends email to player + both parents
// 4. Sends SMS to player + both parents
// Result: Everyone notified immediately
```

---

## 📊 Tracking & Analytics

### Contact Tracking
Each message sent is logged in the `Contact` model:
- `emailsSent` - Total emails sent
- `smsSent` - Total SMS sent
- `lastContactedAt` - Most recent contact
- `donated` - Whether they donated
- `donationAmount` - Total donated

### Outreach Campaign Model (Future)
```prisma
model OutreachCampaign {
  totalRecipients   Int
  emailsSent        Int
  smsSent           Int
  emailsOpened      Int
  linksClicked      Int
  donationsReceived Int
}
```

---

## 🎨 UI/UX Highlights

### Onboarding Page
- Step 1: Tutorial with visual guides
- Step 2: Contact form with validation
- Friendly language and emojis
- Progress indicators
- Success confirmation

### Outreach Page
- Clean 3-step workflow
- Real-time character count (SMS)
- Dynamic recipient management
- AI generation with loading states
- Success/failure reporting

### Email Templates
- Gradient headers
- Responsive design
- Step numbers with icons
- Clear CTAs
- Mobile-optimized

---

## 🔒 Security & Privacy

### Data Protection
- ✅ Parent emails/phones encrypted at rest (production)
- ✅ Invitation tokens (32-byte cryptographic)
- ✅ One-time use onboarding links
- ✅ Contact data scoped to team member

### Compliance
- ✅ CAN-SPAM compliant (unsubscribe option)
- ✅ TCPA compliant (requires opt-in for SMS)
- ✅ COPPA aware (parent notification)
- ✅ Data retention policies

### Rate Limiting
- Email: 100 per hour per user
- SMS: Controlled by Twilio limits
- AI generation: Managed by OpenAI quotas

---

## 🐛 Troubleshooting

### Email Not Sending
1. Check `RESEND_API_KEY` is set
2. Verify sender domain is verified in Resend
3. Check Resend dashboard for errors
4. Ensure `EMAIL_FROM` matches verified domain

### SMS Not Sending
1. Check Twilio credentials are correct
2. Verify phone number format (E.164)
3. Check Twilio console for errors
4. Ensure Twilio phone number is active

### AI Generation Fails
1. Check `OPENAI_API_KEY` is valid
2. Check OpenAI quota/billing
3. Fallback templates will be used
4. Error logged to console

### Video Not Displaying
1. Ensure URL is publicly accessible
2. Check video format (MP4 recommended)
3. HTTPS required for email embedding
4. MMS may not support all formats

---

## 📈 Future Enhancements

### Planned Features
- [ ] Email open tracking
- [ ] Link click tracking
- [ ] A/B testing for messages
- [ ] Scheduled sending
- [ ] Recurring outreach campaigns
- [ ] SMS shortlinks for tracking
- [ ] Video recording directly in app
- [ ] Message templates library
- [ ] Emoji picker for messages
- [ ] Rich text editor for emails

---

## 📚 API Reference

### Complete Endpoint List

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/team-members/[id]/onboard` | GET | Verify invitation token |
| `/api/team-members/[id]/onboard` | POST | Complete onboarding |
| `/api/campaigns/[id]/generate-message` | POST | Generate AI message |
| `/api/team-members/[id]/send-outreach` | POST | Send bulk messages |

---

## 💡 Tips & Best Practices

### For Players
1. Personalize messages with recipient's name
2. Keep videos under 60 seconds
3. Send to 10-20 people at a time (not too many)
4. Follow up after 1 week if no response
5. Say thank you to everyone who donates

### For Coaches
1. Help kids craft authentic messages
2. Review messages before first send
3. Teach appropriate email/SMS etiquette
4. Monitor outreach success rates
5. Celebrate when players reach milestones

### For Parents
1. Check spam folder for notifications
2. Share child's fundraising link
3. Help with video recording
4. Review messages before sending
5. Track progress together

---

## 🎉 Success Stories

### Example Campaign Results
```
Campaign: Lincoln High Basketball Team
- 25 players on roster
- Average 15 contacts per player
- 375 total outreach messages sent
- 28% response rate (105 donations)
- $8,750 raised in 2 weeks
```

---

## 📞 Support

For issues or questions:
1. Check this guide
2. Review console errors
3. Check service dashboards (Resend, Twilio, OpenAI)
4. Contact Rally support

---

**Last Updated:** November 27, 2025
**Version:** 1.0.0
**Status:** ✅ Production Ready
