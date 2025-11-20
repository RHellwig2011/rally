# Rally - User Flow Diagrams

## Overview
This document describes the complete user journeys for all user types in the Rally platform, including decision points, actions, and system responses.

---

## 1. COACH USER FLOWS

### Flow 1.1: Coach Registration & Onboarding

```
START: Coach visits rally.com
│
├─> Click "For Coaches" or "Get Started"
│
▼
[Registration Page]
│
├─> Step 1: Create Account
│   ├─> Enter email
│   ├─> Create password
│   ├─> Accept terms
│   └─> Click "Continue"
│       └─> System: Create user account
│           └─> System: Send verification email
│
▼
├─> Step 2: Personal Information
│   ├─> Enter first name, last name
│   ├─> Enter phone number
│   ├─> Upload profile photo (optional)
│   └─> Click "Continue"
│
▼
├─> Step 3: School Selection
│   │
│   ├─> Option A: Select Existing School
│   │   ├─> Search school database
│   │   ├─> Select school from dropdown
│   │   └─> Select/Create program (sport/team)
│   │
│   └─> Option B: Add New School
│       ├─> Enter school name
│       ├─> Enter location (city, state, zip)
│       ├─> Upload school logo
│       ├─> Enter school colors
│       └─> Submit for admin approval
│           └─> System: Create pending school
│               └─> System: Notify admins
│
▼
├─> Step 4: Email Verification
│   ├─> Check email inbox
│   ├─> Click verification link
│   └─> System: Mark email as verified
│
▼
[Welcome to Dashboard]
│
▼
├─> Onboarding Wizard (optional skip)
│   ├─> Watch intro video
│   ├─> Tour of dashboard features
│   ├─> Quick campaign setup guide
│   └─> Invitation tutorial
│
▼
END: Coach Dashboard (ready to create campaign)
```

---

### Flow 1.2: Create First Campaign

```
START: Coach Dashboard
│
▼
Click "Create Campaign"
│
▼
[Campaign Creation Wizard]
│
├─> Step 1: Basic Information
│   ├─> Enter campaign name
│   ├─> Select program/team
│   ├─> Write description (rich text)
│   ├─> Select season
│   └─> Click "Next"
│
▼
├─> Step 2: Goals & Dates
│   ├─> Set fundraising goal ($)
│   │   └─> System: Show suggested goals based on team size
│   ├─> Select start date
│   ├─> Select end date
│   │   └─> System: Validate end_date > start_date
│   ├─> Preview campaign duration
│   └─> Click "Next"
│
▼
├─> Step 3: Donation Settings
│   ├─> Set minimum donation ($10 default)
│   ├─> Set suggested amounts ([$25, $50, $100, $250, $500])
│   ├─> Enable/disable anonymous donations
│   ├─> Enable/disable recurring donations
│   ├─> Write custom thank you message
│   └─> Click "Next"
│
▼
├─> Step 4: Player Settings
│   ├─> Set individual player goals (optional)
│   ├─> Toggle: Allow players to customize their pages
│   ├─> Toggle: Require coach approval for media
│   ├─> Toggle: Enable player leaderboard
│   └─> Click "Next"
│
▼
├─> Step 5: Poster Customization
│   ├─> Select poster template (visual picker)
│   ├─> Upload custom campaign logo (optional)
│   ├─> Enter custom headline
│   ├─> Choose background color
│   ├─> Choose text color
│   ├─> Preview poster in real-time
│   └─> Click "Next"
│
▼
├─> Step 6: Review & Launch
│   ├─> Review all settings
│   ├─> Preview campaign URL
│   │
│   ├─> Option A: Save as Draft
│   │   └─> System: Save campaign (status='draft')
│   │       └─> Return to dashboard
│   │
│   └─> Option B: Launch Campaign
│       └─> System: Create campaign (status='active')
│           └─> System: Generate unique campaign code
│               └─> System: Create poster template
│
▼
[Success Screen]
├─> Show campaign URL
├─> Show next steps
├─> Button: "Invite Players"
├─> Button: "Download Coach Poster"
│
▼
Decision: What next?
│
├─> Invite Players → Go to Flow 1.3
│
└─> View Campaign → Go to Campaign Dashboard
```

---

### Flow 1.3: Invite Players to Campaign

```
START: Campaign Dashboard
│
▼
Click "Invite Players"
│
▼
[Invitation Interface]
│
Decision: How to add players?
│
├─────────────────────────┬────────────────────────┐
│                         │                        │
▼                         ▼                        ▼
[Manual Entry]     [CSV Upload]          [From Previous Campaign]
│                         │                        │
│                         │                        │
├─> Enter player info     ├─> Download template    ├─> Select past campaign
│   - First name          ├─> Fill in CSV          ├─> Select players to invite
│   - Last name           ├─> Upload file          └─> Click "Invite Selected"
│   - Email               │                             │
│   - Phone (optional)    ▼                             │
│   - Jersey # (optional) [CSV Validation]              │
│                         │                             │
├─> Click "Add Player"    ├─> System: Parse CSV         │
│                         ├─> Show preview table        │
│                         ├─> Highlight errors:         │
│                         │   - Invalid emails          │
│                         │   - Duplicates              │
│                         │   - Missing required fields │
│                         │                             │
│                         ├─> Allow inline editing      │
│                         ├─> Option to remove rows     │
│                         └─> Click "Continue"          │
│                                                       │
└───────────────────────────┬───────────────────────────┘
                            │
                            ▼
                [Customize Invitation Email]
                            │
                ├─> Edit subject line
                ├─> Write personal message
                ├─> Preview email with merge fields
                ├─> Option: Test send to self
                │
                ▼
                Decision: When to send?
                │
                ├─> Send Now → Immediate
                │
                └─> Schedule → Select date/time
                │
                ▼
                Click "Send Invitations"
                │
                ▼
                [System Processing]
                │
                ├─> For each player:
                │   ├─> Create player record (if new)
                │   ├─> Create player_campaign record
                │   ├─> Generate unique invitation code
                │   ├─> Generate fundraising link code
                │   ├─> Queue invitation email
                │   └─> Set status to 'sent'
                │
                ▼
                [Success Screen]
                │
                ├─> Show summary:
                │   - X invitations sent successfully
                │   - Y failed (if any)
                │
                ├─> Download failed invitations (if any)
                ├─> Link to roster to track status
                │
                ▼
                [Email Sent to Players]
                │
                ├─> Player receives email
                ├─> Email contains:
                │   - Personal greeting
                │   - Campaign details
                │   - Unique invitation link
                │   - Coach's message
                │   - Call-to-action button
                │
                └─> System: Track email delivery
                    └─> Update invitation_status
                        - delivered
                        - opened (if clicked)
                        - bounced (if failed)
│
▼
END: Return to Roster (track invitation status)
```

---

### Flow 1.4: Monitor Campaign Progress

```
START: Coach Dashboard
│
▼
Select Campaign
│
▼
[Campaign Overview Dashboard]
│
├─> View in Real-Time:
│   │
│   ├─> Hero Stats (large cards)
│   │   ├─> Total Raised: $X,XXX (XX% of goal)
│   │   ├─> Number of Donors: XX
│   │   ├─> Active Players: XX of YY invited
│   │   └─> Days Remaining: XX
│   │
│   ├─> Progress Visualization
│   │   ├─> Animated progress bar
│   │   ├─> Milestone markers (25%, 50%, 75%, 100%)
│   │   └─> Trend indicator (+/- from yesterday)
│   │
│   ├─> Recent Activity Feed (real-time)
│   │   ├─> "John D. donated $50 to Sarah - 2 min ago"
│   │   ├─> "Emma joined the campaign - 15 min ago"
│   │   ├─> "Mike shared his link - 1 hour ago"
│   │   └─> Filter: All, Donations, Player Joins, Shares
│   │
│   ├─> Fundraising Timeline Chart
│   │   ├─> Line graph: donations over time
│   │   ├─> Toggle: Daily / Weekly / Cumulative
│   │   ├─> Goal line overlay
│   │   └─> Projected completion date
│   │
│   └─> Top Performers
│       ├─> Top 5 players (podium style)
│       ├─> Rank, photo, name, amount, donors
│       └─> Motivational messages
│
├─> Navigate to Sub-Sections:
│   │
│   ├─> Roster Tab → See Flow 1.5
│   ├─> Players Tab → See player leaderboard
│   ├─> Donations Tab → Detailed donation list
│   ├─> Analytics Tab → Deep-dive metrics
│   └─> Settings Tab → Edit campaign
│
├─> Quick Actions:
│   ├─> Invite More Players
│   ├─> Send Team Update Email
│   ├─> Download Report
│   ├─> Share Campaign Link
│   └─> Download Posters
│
└─> Receive Notifications:
    ├─> New donation
    ├─> Player joined
    ├─> Milestone reached
    ├─> Campaign ending soon
    └─> Player needs encouragement
│
▼
END: Continuous monitoring until campaign ends
```

---

### Flow 1.5: Manage Player Roster

```
START: Campaign Dashboard → Roster Tab
│
▼
[Roster Management Interface]
│
├─> View Player List (table or cards)
│   │
│   ├─> Columns:
│   │   - Profile photo + Name
│   │   - Email
│   │   - Phone
│   │   - Status (Invited, Active, Inactive)
│   │   - Amount Raised
│   │   - Donors Count
│   │   - Last Activity
│   │   - Actions
│   │
│   ├─> Roster Statistics (top of page)
│   │   - Total Players Invited: XX
│   │   - Active Players: XX
│   │   - Total Raised: $XX,XXX
│   │   - Average per Player: $XXX
│   │   - Top Fundraiser: [Name with spotlight]
│   │
│   └─> Filters & Sorting:
│       ├─> Filter by status
│       ├─> Search by name/email
│       ├─> Sort by: Name, Amount Raised, Donors, Last Activity
│       └─> Pagination (20 per page)
│
├─> Actions on Individual Players:
│   │
│   ├─> Click Player → Open Detail Modal
│   │   ├─> View full profile
│   │   ├─> See fundraising statistics
│   │   ├─> View recent donations
│   │   ├─> See activity log
│   │   ├─> Access personal fundraising page link
│   │   ├─> Approve/reject media (if pending)
│   │   ├─> Send individual message
│   │   └─> Remove from campaign
│   │
│   ├─> Resend Invitation
│   │   ├─> Click "Resend"
│   │   ├─> Confirm action
│   │   ├─> Optional: Edit email before sending
│   │   └─> System: Send invitation email
│   │       └─> Update invitation_sent_at
│   │
│   └─> Edit Player Info
│       ├─> Update name, email, phone
│       ├─> Update jersey number
│       └─> Save changes
│
├─> Bulk Actions (select multiple players):
│   │
│   ├─> Select Players (checkboxes)
│   │
│   ├─> Send Reminder Email
│   │   ├─> Choose reminder template or custom
│   │   ├─> Preview message
│   │   └─> Send to selected
│   │
│   ├─> Remove from Campaign
│   │   ├─> Confirm bulk removal
│   │   └─> System: Mark as inactive
│   │
│   └─> Export Selected
│       └─> Download CSV with player data
│
├─> View Invitation Status Dashboard
│   │
│   ├─> Status Overview (cards)
│   │   - Total Sent: 100
│   │   - Delivered: 98 (98%)
│   │   - Opened: 75 (76%)
│   │   - Accepted: 45 (45%)
│   │   - Bounced: 2 (2%)
│   │
│   ├─> Funnel Visualization
│   │   Sent (100) → Delivered (98) → Opened (75) → Clicked (60) → Accepted (45)
│   │
│   └─> Detailed Status Table
│       ├─> Player name, email
│       ├─> Invitation sent date/time
│       ├─> Status badge (color-coded)
│       ├─> Last activity (opened/clicked)
│       └─> Actions (resend, copy link)
│
└─> Approve Pending Media (if moderation enabled)
    │
    ├─> Navigate to Moderation Queue
    │
    ├─> View Pending Items:
│       ├─> Player photo/video
    │   ├─> Player story text
    │   └─> Submission date
    │
    ├─> For Each Item:
    │   │
    │   ├─> Preview content
    │   │
    │   ├─> Decision:
    │   │   │
    │   │   ├─> Approve
    │   │   │   └─> System: Update moderation_status = 'approved'
    │   │   │       └─> Content goes live on player page
    │   │   │           └─> Notify player
    │   │   │
    │   │   ├─> Reject
    │   │   │   ├─> Enter rejection reason
    │   │   │   └─> System: Update moderation_status = 'rejected'
    │   │   │       └─> Notify player with feedback
    │   │   │           └─> Player can edit and resubmit
    │   │   │
    │   │   └─> Request Changes
    │   │       ├─> Write specific feedback
    │   │       └─> Notify player
    │   │
    │   └─> Next item
    │
    └─> Notification: All items reviewed
│
▼
END: Return to Campaign Dashboard
```

---

## 2. PLAYER USER FLOWS

### Flow 2.1: Player Invitation to Account Creation

```
START: Player receives invitation email
│
▼
[Invitation Email]
│
├─> Email Contains:
│   - Personal greeting: "Hi [Player Name]"
│   - Coach's name and message
│   - Campaign details
│   - Team current progress
│   - Unique invitation link button
│   - Fallback: Manual code entry
│
▼
Player clicks invitation link
│
▼
System: Track email open & link click
│
▼
[Invitation Landing Page] /join/[code]
│
├─> Display:
│   - Campaign banner with school logo
│   - Coach's welcome video/message
│   - Campaign goal and current progress
│   - Team photo
│   - Benefits of joining:
│     • Create personal fundraising page
│     • Upload photo or video
│     • Track your progress
│     • Compete with teammates
│
├─> Call-to-Action: "Join Campaign" button
│
▼
Click "Join Campaign"
│
▼
Decision: Logged in?
│
├─> NO → Continue to Registration
│
└─> YES → Check if already joined
    │
    ├─> Already Joined
    │   └─> Redirect to Player Dashboard
    │
    └─> Not Joined
        └─> Link account to campaign
            └─> Go to Player Dashboard
│
▼
[Player Registration - Step 1: Account]
│
├─> Form Pre-filled from Invitation:
│   - Email: invitation.email
│   - First Name: invitation.first_name
│   - Last Name: invitation.last_name
│   - Phone: invitation.phone (if available)
│
├─> Player Enters:
│   - Password
│   - Confirm Password
│
├─> Player Actions:
│   - Review/edit pre-filled info
│   - Accept Terms of Service
│   - Optional: Parent/guardian email (if under 18)
│
└─> Click "Create Account"
    │
    ▼
    System Processing:
    │
    ├─> Validate all fields
    ├─> Check password requirements
    ├─> Create user account
    ├─> Send email verification
    ├─> Link to player record
    ├─> Update invitation status = 'accepted'
    ├─> Generate fundraising link code
    │
    ▼
    Auto-login and proceed
│
▼
[Player Registration - Step 2: Profile Setup]
│
├─> Upload Profile Photo (optional, can skip)
│   ├─> Drag & drop or browse
│   ├─> Crop photo
│   ├─> Preview
│   └─> Upload to S3
│
├─> Write Personal Message
│   ├─> "Why I'm Fundraising" (rich text, 500 chars)
│   ├─> Character counter
│   ├─> Optional: Use template
│   └─> Preview
│
├─> Set Personal Goal (optional)
│   ├─> Enter goal amount
│   └─> See recommended based on team average
│
├─> Preview Personal Fundraising Page
│   └─> See live preview of page
│
└─> Click "Continue" or "Skip for Now"
│
▼
[Player Registration - Step 3: Learn to Share]
│
├─> Tutorial: How to Share Your Link
│   ├─> Copy link demonstration
│   ├─> Social media sharing guide
│   ├─> Email template walkthrough
│
├─> Your Unique Fundraising Link
│   ├─> Display: rally.com/p/[code]/[name]
│   ├─> Copy link button
│   ├─> QR code display
│
├─> Quick Share Options:
│   ├─> Share on Facebook (pre-populated post)
│   ├─> Share on Twitter (pre-populated tweet)
│   ├─> Share on Instagram (copy caption + link)
│   ├─> Send via Email (template)
│   └─> Send via SMS (template)
│
└─> Click "Start Fundraising"
│
▼
[Welcome Screen]
│
├─> Celebration animation
├─> "You're all set, [Name]!"
├─> Quick stats:
│   - Your fundraising link is live
│   - Goal: $XXX
│   - Team progress: XX%
│
└─> Button: "Go to Dashboard"
│
▼
Redirect to Player Dashboard
│
▼
System: Send Welcome Email
│
├─> Email contains:
│   - Welcome message
│   - Fundraising tips
│   - Link to dashboard
│   - Link to fundraising page
│   - Share templates
│
▼
END: Player account created and active
```

---

### Flow 2.2: Player Customizes Fundraising Page

```
START: Player Dashboard
│
▼
Click "Edit Profile" or "Customize Page"
│
▼
[Profile Editor Interface]
│
├─> Tabs:
│   ├─> Basic Info
│   ├─> Story & Message
│   ├─> Photos & Videos
│   └─> Settings
│
├─> [Basic Info Tab]
│   ├─> Edit name
│   ├─> Edit jersey number
│   ├─> Edit grade level
│   ├─> Edit bio (200 chars)
│   └─> Changes auto-save
│
├─> [Story & Message Tab]
│   │
│   ├─> Rich Text Editor: "Why I'm Fundraising"
│   │   ├─> Formatting: Bold, Italic, Lists, Links
│   │   ├─> Character limit: 1000 chars
│   │   ├─> Live character counter
│   │   └─> Auto-save drafts
│   │
│   ├─> "What Funds Will Support" (optional)
│   │   └─> Specific use of donations
│   │
│   ├─> "Thank You Message" Template
│   │   └─> Shown to donors after donation
│   │
│   └─> Preview Button
│       └─> See how story appears to donors
│
├─> [Photos & Videos Tab]
│   │
│   ├─> View Media Library (grid)
│   │   ├─> All uploaded photos/videos
│   │   ├─> Thumbnail previews
│   │   ├─> Upload date
│   │   └─> Actions per item
│   │
│   ├─> Upload New Photo
│   │   ├─> Drag & drop or browse
│   │   ├─> File validation:
│   │   │   - Type: JPG, PNG, WebP
│   │   │   - Size: Max 10MB
│   │   ├─> Crop/adjust (optional)
│   │   ├─> Upload to S3 with progress bar
│   │   │
│   │   └─> If moderation required:
│   │       ├─> System: Set status = 'pending'
│   │       ├─> Notify coach for approval
│   │       └─> Show "Pending Approval" badge
│   │
│   ├─> Upload Video
│   │   ├─> Browse file
│   │   ├─> Validation:
│   │   │   - Format: MP4, MOV, WebM
│   │   │   - Size: Max 100MB
│   │   │   - Duration: Max 2 minutes
│   │   ├─> Preview before upload
│   │   ├─> Upload with progress bar
│   │   ├─> System: Process video
│   │   │   - Generate thumbnail
│   │   │   - Create multiple quality versions
│   │   └─> If moderation required:
│   │       └─> Pending approval workflow
│   │
│   ├─> Set Primary Photo
│   │   ├─> Click "Set as Primary" on photo
│   │   └─> System: Update is_primary = TRUE
│   │       └─> Appears on fundraising page hero
│   │
│   ├─> Reorder Media (drag & drop)
│   │   └─> Order reflected on fundraising page
│   │
│   └─> Delete Media
│       ├─> Click delete icon
│       ├─> Confirm deletion
│       └─> System: Remove from S3 and database
│
└─> [Settings Tab]
    ├─> Personal Goal
    │   └─> Update goal amount
    │
    ├─> Privacy Settings
    │   ├─> Show/hide on leaderboard
    │   └─> Display full name or first name only
    │
    └─> Notification Preferences
        ├─> Email on new donation
        ├─> Email on milestone reached
        └─> SMS notifications (if enabled)
│
▼
All Changes Auto-Saved
│
▼
Click "Preview Fundraising Page"
│
▼
[Preview Modal]
│
├─> Desktop preview
├─> Mobile preview
├─> Toggle between views
└─> "View Live Page" button
│
▼
Decision: Satisfied with changes?
│
├─> YES → Close editor
│   └─> Return to Dashboard
│
└─> NO → Continue editing
│
▼
If Moderation Required:
│
├─> System: Submit for approval
├─> Show notification: "Changes submitted for review"
├─> Coach notified
├─> Wait for approval
│   │
│   ├─> Approved
│   │   └─> Changes go live
│   │       └─> Player notified
│   │
│   └─> Rejected
│       └─> Player notified with feedback
│           └─> Can edit and resubmit
│
▼
END: Fundraising page updated
```

---

### Flow 2.3: Player Shares Fundraising Link

```
START: Player Dashboard
│
▼
[Dashboard Overview]
│
├─> Display Current Stats:
│   - Total Raised: $XX
│   - Number of Donors: XX
│   - Progress to Goal: XX%
│   - Days Remaining: XX
│
└─> Prominent "Share My Link" Section
│
▼
Click "Share My Link"
│
▼
[Sharing Interface]
│
├─> Your Fundraising Link
│   ├─> Display full URL: rally.com/p/[code]/[player-name]
│   ├─> "Copy Link" button
│   │   └─> Click → Copied to clipboard
│   │       └─> Show "Link copied!" confirmation
│   │
│   └─> QR Code
│       ├─> Display QR code image
│       ├─> Download QR code button
│       └─> "Share for offline posting"
│
├─> Social Media Sharing
│   │
│   ├─> Share on Facebook
│   │   ├─> Click Facebook button
│   │   ├─> Pre-populated post:
│   │   │   "I'm fundraising for [campaign name] with [school]!
│   │   │   Help me reach my goal of $XXX.
│   │   │   Every donation makes a difference! [link]"
│   │   ├─> Opens Facebook share dialog
│   │   ├─> Player can edit message
│   │   └─> Post to Facebook
│   │       └─> System: Track share event
│   │
│   ├─> Share on Twitter
│   │   ├─> Click Twitter button
│   │   ├─> Pre-populated tweet:
│   │   │   "Supporting [campaign]! Help me reach $XXX
│   │   │   Every donation counts! [link] #[campaign_hashtag]"
│   │   ├─> Opens Twitter compose
│   │   ├─> Player can edit (character limit: 280)
│   │   └─> Tweet
│   │       └─> System: Track share event
│   │
│   ├─> Share on Instagram
│   │   ├─> Click Instagram button
│   │   ├─> Copy caption to clipboard:
│   │   │   "I'm fundraising for [campaign]! Link in bio or
│   │   │   visit [short_link] to support. Goal: $XXX #[hashtag]"
│   │   ├─> Show instructions:
│   │   │   "1. Copy caption (done!)
│   │   │    2. Post your photo/video
│   │   │    3. Paste caption
│   │   │    4. Add link to bio"
│   │   └─> Button: "Download Story Template"
│   │       └─> Download branded Instagram story image
│   │
│   └─> Share on TikTok (optional)
│       └─> Similar to Instagram flow
│
├─> Email Sharing
│   │
│   ├─> Click "Share via Email"
│   │
│   ├─> Opens email template modal
│   │   │
│   │   ├─> Recipient Type:
│   │   │   ├─> Family Members
│   │   │   ├─> Friends
│   │   │   └─> Custom
│   │   │
│   │   ├─> Pre-written templates:
│   │   │   │
│   │   │   ├─> Template 1: Family
│   │   │   │   "Hi Family,
│   │   │   │   I'm participating in [campaign] and would love your support!
│   │   │   │   Our team is raising money for [purpose].
│   │   │   │   Any donation amount helps. Visit my page: [link]
│   │   │   │   Thank you! [Player Name]"
│   │   │   │
│   │   │   ├─> Template 2: Friends
│   │   │   │   "Hey! Supporting my team's fundraiser for [campaign].
│   │   │   │   Check out my page and donate if you can: [link]
│   │   │   │   Appreciate your support! [Player Name]"
│   │   │   │
│   │   │   └─> Custom Message
│   │   │       └─> Write own message
│   │   │
│   │   ├─> Edit template
│   │   ├─> Preview email
│   │   │
│   │   └─> Send Options:
│   │       │
│   │       ├─> Option A: Copy to Clipboard
│   │       │   └─> Paste into personal email client
│   │       │
│   │       └─> Option B: Rally Sends Email (if feature enabled)
│   │           ├─> Enter recipient emails (comma-separated)
│   │           ├─> Preview final email
│   │           └─> Send
│   │               └─> System: Send emails via SendGrid
│   │                   └─> Track sends
│   │
│   └─> Close modal
│
├─> SMS Sharing (Mobile Only)
│   │
│   ├─> Click "Share via Text"
│   │
│   ├─> Pre-populated message:
│   │   "Hi! I'm raising money for [campaign]. Can you help?
│   │   Even $10 makes a difference. My page: [short_link]
│   │   Thanks! - [Player Name]"
│   │
│   ├─> Opens device SMS app (iOS/Android)
│   ├─> Player selects contacts
│   ├─> Player can edit message
│   └─> Send text
│       └─> System: Track share event (on return to app)
│
├─> Direct Message / WhatsApp
│   └─> Similar to SMS flow
│
└─> View Sharing Stats
    │
    ├─> Clicks on your link: XX
    ├─> Shares from page: XX
    ├─> Most effective channel:
    │   └─> Show chart of donations by source
    │
    └─> Sharing Tips
        ├─> "Share in morning (more views!)"
        ├─> "Add personal story to posts"
        └─> "Follow up after 3 days"
│
▼
After Sharing:
│
├─> System: Track all share events
│   ├─> Increment share count
│   ├─> Record share channel (facebook, email, etc.)
│   └─> Track clicks from each share
│
└─> Encourage consistent sharing
    └─> Show reminder: "Share again tomorrow!"
│
▼
END: Link shared, await donations
```

---

### Flow 2.4: Player Monitors Progress

```
START: Player logs in
│
▼
[Player Dashboard]
│
├─> Header Section
│   ├─> Profile photo
│   ├─> "Welcome back, [Name]!"
│   ├─> Campaign name
│   └─> Days remaining: XX
│
├─> Stats Overview (Large Cards)
│   │
│   ├─> Total Raised
│   │   ├─> Large number: $XXX
│   │   ├─> Progress bar to goal
│   │   ├─> Percentage: XX% of $XXX goal
│   │   └─> Trend: "+$25 since yesterday" (green arrow)
│   │
│   ├─> Number of Donors
│   │   ├─> Count: XX donors
│   │   ├─> Donor avatars (if not anonymous)
│   │   └─> Trend: "+2 new donors today"
│   │
│   ├─> Link Activity
│   │   ├─> Link clicks: XXX
│   │   ├─> Conversion rate: XX%
│   │   └─> "Share again to get more views!"
│   │
│   └─> Team Rank
│       ├─> Your rank: #X of XX players
│       ├─> Top fundraiser: [Name] with $XXX
│       └─> Amount to next rank: $XX away from #X
│
├─> Recent Donations Feed (Real-Time)
│   │
│   ├─> Donation 1:
│   │   - Donor name (or "Anonymous")
│   │   - Amount: $XX
│   │   - Message: "Great job, [Name]!"
│   │   - Time: "5 minutes ago"
│   │   - Celebration animation on new donation
│   │
│   ├─> Donation 2:
│   │   - Details...
│   │
│   └─> View All Donations button
│       └─> Opens full donation history
│
├─> Achievements & Milestones
│   │
│   ├─> Badges Earned:
│   │   ├─> "First Donation" ✓
│   │   ├─> "10 Donors Club" ✓
│   │   └─> "Halfway There" (locked - 50% of goal)
│   │
│   └─> Next Milestone:
│       ├─> Progress to next badge
│       └─> "Raise $50 more to unlock 'Top 10 Fundraiser'"
│
├─> Fundraising Timeline Chart
│   ├─> Line graph: cumulative donations over time
│   ├─> Markers for each donation
│   ├─> Goal line overlay
│   └─> Projected completion date
│
├─> Quick Actions (Always Visible)
│   ├─> [Share My Link] → Flow 2.3
│   ├─> [View My Page] → Opens fundraising page
│   ├─> [Edit Profile] → Flow 2.2
│   ├─> [Download Poster] → Gets personalized poster PDF
│   └─> [Thank Donors] → Send thank you messages
│
├─> Motivational Content
│   │
│   ├─> Tips of the Day:
│   │   - "Share your link in 3 different places today!"
│   │   - "Thank your donors to encourage more giving"
│   │   - "Update your story with progress updates"
│   │
│   └─> Team Updates (from coach):
│       ├─> "Great job team! We're at 60% of our goal!"
│       └─> Coach announcements
│
└─> Notifications Center
    │
    ├─> New donation notification
    ├─> Milestone reached notification
    ├─> Coach message notification
    ├─> Reminder to share (if no shares in 3 days)
    └─> Campaign ending soon warning
│
▼
Player Interactions:
│
├─> Check Donation Details
│   ├─> Click "View All Donations"
│   ├─> See sortable table:
│   │   - Date/Time
│   │   - Donor Name
│   │   - Amount
│   │   - Message
│   │   - Source (how they found link)
│   ├─> Filter by date range
│   └─> Export to CSV
│
├─> View Team Leaderboard (if enabled)
│   ├─> See full team rankings
│   ├─> Compare stats:
│   │   - Amount raised
│   │   - Number of donors
│   │   - Average donation
│   │   - Conversion rate
│   └─> Competitive motivation
│
├─> Thank Donors
│   ├─> Select donors to thank
│   ├─> Choose thank you method:
│   │   ├─> Automated email (Rally sends)
│   │   └─> Personal video message
│   └─> Send thanks
│       └─> System: Deliver messages
│
└─> Download Poster
    ├─> Click "Download My Poster"
    ├─> System: Generate PDF with:
    │   - Player photo
    │   - Current progress
    │   - QR code to donation page
    │   - Campaign branding
    └─> Download PDF
        └─> Player can print and post
│
▼
Real-Time Updates:
│
├─> WebSocket Connection:
│   └─> Listen for donation events
│       │
│       ├─> New Donation Received
│       │   ├─> Show celebration animation
│       │   ├─> Update total raised (animated count-up)
│       │   ├─> Add to recent donations feed
│       │   ├─> Check if milestone unlocked
│       │   └─> Play success sound (optional)
│       │
│       └─> Milestone Reached
│           ├─> Show achievement popup
│           ├─> Confetti animation
│           └─> Share achievement option
│
└─> Auto-refresh every 30 seconds
    └─> Update stats without full reload
│
▼
END: Player actively engaged with progress
```

---

## 3. DONOR USER FLOWS

### Flow 3.1: Donor Discovers Fundraising Page

```
START: Donor receives player's link
│
├─> Sources:
│   ├─> Social media post (Facebook, Twitter, Instagram)
│   ├─> Email from player
│   ├─> Text message
│   ├─> Scanned QR code from poster
│   └─> Shared link from friend
│
▼
Donor clicks link
│
▼
System: Track click event
├─> Record: timestamp, IP, user agent, referrer
├─> Increment link click counter
└─> Store session ID
│
▼
[Player Fundraising Page Loads] /p/[code]/[name]
│
├─> Page Structure:
│   │
│   ├─> Hero Section (Above Fold)
│   │   ├─> Player photo or video (autoplay muted)
│   │   ├─> Player name (large, prominent)
│   │   ├─> Campaign name & school
│   │   ├─> Progress bar (animated)
│   │   ├─> "$XXX raised of $XXX goal"
│   │   ├─> "XX donors" with avatar gallery
│   │   └─> "Donate Now" button (large, contrasting color)
│   │
│   ├─> Player Story Section
│   │   ├─> "Why I'm Fundraising" heading
│   │   ├─> Player's personal message (rich text)
│   │   ├─> Photo gallery (if multiple photos)
│   │   └─> Campaign details (what funds support)
│   │
│   ├─> Recent Donors Section (Social Proof)
│   │   ├─> "Join XX supporters" heading
│   │   ├─> List of recent donors:
│   │   │   - Name (or "Anonymous Donor")
│   │   │   - Amount (or "donated")
│   │   │   - Message to player
│   │   │   - Time ago
│   │   └─> Shows last 10-20 donations
│   │
│   ├─> Team Information
│   │   ├─> School/team photo
│   │   ├─> Coach name & photo
│   │   ├─> Team leaderboard (top 5 if enabled)
│   │   └─> Total team progress
│   │
│   └─> Donate Section (Sticky/Always Visible)
│       └─> Scroll-to-donate button
│
│
▼
Donor Engagement:
│
├─> Reads player story
├─> Views photos/video
├─> Sees social proof (other donors)
├─> Emotional connection established
│
▼
Decision: Donate?
│
├─> NO → Exit page
│   ├─> System: Track bounce (no donation)
│   ├─> Possible retargeting (future feature)
│   └─> END
│
└─> YES → Scroll to donate or click "Donate Now"
│
▼
[Donation Form] (anchored or modal)
│
├─> Step 1: Choose Amount
│   │
│   ├─> Preset Amounts (buttons)
│   │   ├─> $25
│   │   ├─> $50
│   │   ├─> $100 (Suggested - highlighted)
│   │   ├─> $250
│   │   └─> $500
│   │
│   ├─> Custom Amount
│   │   ├─> Input field
│   │   └─> Minimum: $10 (enforced)
│   │
│   ├─> Show Impact (optional)
│   │   └─> "$50 provides [specific impact]"
│   │
│   └─> Recurring Donation Option (if enabled)
│       ├─> Checkbox: "Make this monthly"
│       └─> Frequency: Weekly, Monthly
│   │
│   └─> Click "Continue"
│
▼
├─> Step 2: Donor Information
│   │
│   ├─> Name
│   │   ├─> First name (required)
│   │   └─> Last name (required)
│   │
│   ├─> Email (required)
│   │   └─> For donation receipt
│   │
│   ├─> Phone (optional)
│   │
│   ├─> Anonymous Donation Checkbox
│   │   └─> "Don't display my name publicly"
│   │
│   ├─> Message to Player (optional)
│   │   ├─> Text area (max 500 chars)
│   │   └─> "Great job! Keep it up!"
│   │
│   └─> Click "Continue to Payment"
│
▼
├─> Step 3: Payment Information (Stripe Elements)
│   │
│   ├─> Order Summary (sidebar):
│   │   ├─> Amount: $XX.XX
│   │   ├─> Supporting: [Player Name]
│   │   ├─> Campaign: [Campaign Name]
│   │   └─> Payment processed by Rally
│   │
│   ├─> Stripe Payment Form:
│   │   ├─> Card number
│   │   ├─> Expiry date
│   │   ├─> CVC
│   │   ├─> ZIP code
│   │   └─> Secure badge (SSL, PCI compliant)
│   │
│   ├─> Alternative Payment Methods (if enabled):
│   │   ├─> Apple Pay
│   │   ├─> Google Pay
│   │   └─> Bank Transfer (ACH)
│   │
│   └─> Terms Acceptance:
│       └─> "By donating, I agree to Rally's terms"
│   │
│   └─> Click "Donate $XX.XX" button
│
▼
[Payment Processing]
│
├─> System: Create Payment Intent (Stripe)
│   ├─> Amount: $XX.XX
│   ├─> Currency: USD
│   ├─> Metadata: player, campaign, donor info
│   └─> Rally receives funds, school gets payout later
│
├─> Show processing indicator
│   └─> "Processing your donation..."
│
├─> Stripe: Validate payment method
│   │
│   ├─> Success → Continue
│   │
│   └─> Failure → Show error
│       ├─> "Card declined"
│       ├─> "Insufficient funds"
│       ├─> "Invalid card details"
│       └─> Option to retry with different card
│
├─> If 3D Secure Required:
│   ├─> Redirect to bank authentication
│   ├─> Donor completes verification
│   └─> Return to Rally
│
▼
Decision: Payment successful?
│
├─> NO → Error State
│   ├─> Show error message
│   ├─> Suggest fixing issue
│   ├─> Option: Try different payment method
│   ├─> Option: Contact support
│   └─> Log failed transaction
│       └─> END (no donation recorded)
│
└─> YES → Payment Successful
│
▼
[System Processing - Payment Success]
│
├─> Stripe: Confirm payment intent succeeded
│
├─> Database: Create donation record
│   ├─> donation_id (UUID)
│   ├─> player_campaign_id
│   ├─> campaign_id
│   ├─> donor_name (or "Anonymous")
│   ├─> donor_email
│   ├─> amount
│   ├─> is_anonymous
│   ├─> message_to_player
│   ├─> stripe_payment_intent_id
│   ├─> status = 'completed'
│   ├─> donation_date = NOW()
│
├─> Database: Create transaction records
│   ├─> Transaction 1: donation_received
│   │   - Rally account balance increase
│   ├─> Transaction 2: platform_fee (if applicable)
│   ├─> Transaction 3: program allocation
│   │   - Program pending balance increase
│
├─> Database: Update balances
│   ├─> program_balances.pending_balance += amount
│   ├─> program_balances.lifetime_raised += amount
│   ├─> rally_master_balance.total_balance += amount
│
├─> Analytics: Update metrics
│   ├─> player_campaign.total_raised += amount
│   ├─> campaign.total_raised += amount
│   ├─> Increment donor counts
│
├─> Link click to donation (conversion tracking)
│   ├─> Find recent click from same session
│   └─> Mark link_click.converted = TRUE
│       └─> link_click.donation_id = donation.id
│
├─> Check milestones
│   ├─> Player reached personal goal?
│   ├─> Campaign reached percentage milestone?
│   └─> Trigger notifications if milestone achieved
│
├─> Real-time notifications
│   ├─> WebSocket: Notify player (if online)
│   ├─> WebSocket: Notify coach (if online)
│   └─> Update live dashboards
│
└─> Email notifications
    ├─> Send receipt to donor
    ├─> Send notification to player
    └─> Send notification to coach
│
▼
[Success Page] /donation/success
│
├─> Celebration Elements:
│   ├─> Success animation (confetti)
│   ├─> Large checkmark icon
│   ├─> "Thank you for your donation!"
│
├─> Donation Summary:
│   ├─> Amount donated: $XX.XX
│   ├─> Supporting: [Player Name]
│   ├─> Campaign: [Campaign Name]
│   ├─> Receipt sent to: [donor_email]
│   ├─> Transaction ID: [stripe_charge_id]
│
├─> Social Proof:
│   ├─> "You're donor #XX for [Player]!"
│   ├─> Updated progress: "Now at $XXX of $XXX goal!"
│   └─> Impact message: "Your donation helps..."
│
├─> Call-to-Actions:
│   │
│   ├─> Share This Campaign
│   │   ├─> "Help us spread the word!"
│   │   ├─> Social share buttons
│   │   └─> Pre-populated message
│   │
│   ├─> Download Receipt
│   │   └─> PDF with donation details
│   │
│   └─> Make Another Donation
│       └─> Support another player or increase donation
│
└─> Return Links:
    ├─> View [Player]'s Page
    ├─> View Full Campaign
    └─> Rally Homepage
│
▼
[Email: Donation Receipt to Donor]
│
├─> Email Subject: "Thank you for your $XX donation!"
│
├─> Email Content:
│   ├─> Personal thank you from Rally
│   ├─> Donation details:
│   │   - Amount: $XX.XX
│   │   - Date: MM/DD/YYYY
│   │   - Player: [Name]
│   │   - Campaign: [Name]
│   │   - School: [Name]
│   ├─> Tax receipt information:
│   │   - Tax ID (if nonprofit)
│   │   - "This donation is tax-deductible"
│   │   - Receipt PDF attached
│   ├─> Payment method: Card ending in XXXX
│   ├─> Transaction ID: [id]
│   ├─> Link to view player's updated progress
│   └─> Contact support link
│
└─> PDF Receipt Attached
│
▼
[Email: Donation Notification to Player]
│
├─> Subject: "You received a $XX donation! 🎉"
│
├─> Content:
│   ├─> Celebration message
│   ├─> Donor name (or "Anonymous Donor")
│   ├─> Amount: $XX.XX
│   ├─> Donor's message (if provided)
│   ├─> Updated stats:
│   │   - Total raised: $XXX
│   │   - Progress: XX% of goal
│   │   - Number of donors: XX
│   ├─> Encouragement: "Share your link again!"
│   ├─> Link to dashboard
│   └─> Suggestion: "Thank your donor!"
│
▼
[Email: Donation Notification to Coach]
│
├─> Subject: "[Player Name] received a $XX donation"
│
├─> Content:
│   ├─> Player: [Name]
│   ├─> Amount: $XX.XX
│   ├─> Campaign progress update
│   ├─> Link to campaign dashboard
│   └─> Team summary
│
▼
END: Donation complete, all parties notified

Alternative Flow: Recurring Donation
│
├─> If recurring donation selected:
│   │
│   ├─> System: Create Stripe Subscription
│   │   ├─> Frequency: weekly or monthly
│   │   ├─> Amount: $XX.XX per period
│   │   ├─> First charge: immediate
│   │   ├─> Next charge: [date]
│   │
│   ├─> Database: Create recurring_donation record
│   │   ├─> donor_email
│   │   ├─> player_campaign_id
│   │   ├─> amount
│   │   ├─> frequency
│   │   ├─> stripe_subscription_id
│   │   ├─> status = 'active'
│   │   ├─> next_charge_date
│   │
│   ├─> Success page shows:
│   │   ├─> "Recurring donation set up!"
│   │   ├─> Frequency and amount
│   │   ├─> Next charge date
│   │   ├─> "You can cancel anytime"
│   │   ├─> Link to manage subscription
│   │
│   └─> Email includes:
│       ├─> Recurring donation details
│       ├─> Cancellation instructions
│       └─> Link to update payment method
│
└─> Future recurring charges:
    ├─> Stripe: Auto-charge on schedule
    ├─> System: Create new donation record each time
    ├─> Notifications sent for each donation
    └─> Until subscription cancelled
│
▼
END: Recurring donation active
```

---

## 4. ADMIN USER FLOWS

### Flow 4.1: Admin Approves New School

```
START: Admin Dashboard
│
▼
[Pending Schools Queue]
│
├─> Notification: "3 schools awaiting approval"
│
├─> View Pending Schools List:
│   │
│   ├─> School 1:
│   │   - Name: Lincoln High School
│   │   - Location: Springfield, IL
│   │   - Requested by: Coach John Smith
│   │   - Submitted: 2 days ago
│   │   - Status: Pending
│   │
│   ├─> School 2:
│   │   - Details...
│   │
│   └─> School 3:
│       - Details...
│
▼
Click on School to Review
│
▼
[School Detail View]
│
├─> School Information:
│   ├─> Name: Lincoln High School
│   ├─> District: Springfield USD
│   ├─> Location: Springfield, IL 62701
│   ├─> Contact Email: admin@lincoln.edu
│   ├─> Contact Phone: (555) 123-4567
│   ├─> Logo: [Image preview]
│   ├─> School Colors: Blue (#0000FF), Gold (#FFD700)
│
├─> Requesting Coach:
│   ├─> Name: John Smith
│   ├─> Email: jsmith@lincoln.edu
│   ├─> Phone: (555) 987-6543
│   ├─> Account created: 2 days ago
│   ├─> Email verified: Yes
│
├─> Program Information:
│   ├─> Program: Varsity Football
│   ├─> Season: Fall
│   ├─> Description: [Text]
│
└─> Admin Actions:
    ├─> Verify Information
    │   ├─> Check school exists (Google, NCES database)
    │   ├─> Verify coach email domain matches school
    │   ├─> Review logo for appropriateness
    │   └─> Check for duplicates in system
    │
    ├─> Decision:
    │   │
    │   ├─> APPROVE
    │   │   │
    │   │   ├─> Click "Approve School"
    │   │   │
    │   │   ├─> System Processing:
    │   │   │   ├─> Update school.status = 'active'
    │   │   │   ├─> Update school.onboarding_completed = TRUE
    │   │   │   ├─> Create Stripe Connected Account
    │   │   │   │   └─> Type: Express
    │   │   │   │   └─> Business type: Non-profit or Company
    │   │   │   ├─> Generate onboarding link
    │   │   │   ├─> Associate coach with school
    │   │   │   ├─> Create program record
    │   │   │   ├─> Log approval in audit trail
    │   │   │
    │   │   ├─> Email to Coach:
    │   │   │   ├─> Subject: "Lincoln High School approved on Rally!"
    │   │   │   ├─> Content:
    │   │   │   │   - School approved
    │   │   │   │   - Next steps: Complete Stripe onboarding
    │   │   │   │   - Link to Stripe Express onboarding
    │   │   │   │   - Deadline: 7 days
    │   │   │   │   - Link to create first campaign
    │   │   │   └─> Support contact info
    │   │   │
    │   │   └─> Notification to Admin:
    │   │       └─> "School approved successfully"
    │   │
    │   └─> REJECT
    │       │
    │       ├─> Click "Reject School"
    │       │
    │       ├─> Modal: Rejection Reason
    │       │   ├─> Select reason:
    │       │   │   - Duplicate school
    │       │   │   - Invalid information
    │       │   │   - Unable to verify school
    │       │   │   - Coach email doesn't match school domain
    │       │   │   - Other
    │       │   ├─> Additional notes (text area)
    │       │   └─> Click "Confirm Rejection"
    │       │
    │       ├─> System Processing:
    │       │   ├─> Update school.status = 'rejected'
    │       │   ├─> Store rejection_reason
    │       │   ├─> Log rejection in audit trail
    │       │
    │       └─> Email to Coach:
    │           ├─> Subject: "School approval status"
    │           ├─> Content:
    │           │   - Unable to approve school
    │           │   - Reason for rejection
    │           │   - Next steps / how to resubmit
    │           │   - Contact support for questions
    │           └─> Support contact info
    │
    └─> REQUEST MORE INFO
        │
        ├─> Click "Request Information"
        │
        ├─> Modal: Information Request
        │   ├─> Specify what's needed:
        │   │   - Verification of school email
        │   │   - Official school documentation
        │   │   - Corrected school name/address
        │   │   - Different logo (current inappropriate)
        │   ├─> Custom message to coach
        │   └─> Click "Send Request"
        │
        ├─> System Processing:
        │   ├─> Update school.status = 'info_requested'
        │   ├─> Store request details
        │   ├─> Set reminder for follow-up (5 days)
        │
        └─> Email to Coach:
            └─> Requesting additional information
                └─> Instructions on how to provide it
│
▼
[After Approval: Stripe Onboarding]
│
├─> Coach receives email with Stripe link
│
├─> Coach clicks "Complete Banking Setup"
│
├─> Redirect to Stripe Express Onboarding
│   │
│   ├─> Stripe Collects:
│   │   ├─> Business information
│   │   ├─> Tax ID (EIN for nonprofit)
│   │   ├─> Bank account details
│   │   │   - Routing number
│   │   │   - Account number
│   │   │   - Account type
│   │   ├─> Identity verification
│   │   └─> Payout schedule preference
│   │
│   ├─> Stripe Verifies:
│   │   ├─> Business legitimacy
│   │   ├─> Bank account (micro-deposits or instant verification)
│   │   └─> Identity documents
│   │
│   └─> Completion:
│       ├─> Stripe sends webhook: account.updated
│       │
│       └─> Rally System Updates:
│           ├─> school.stripe_onboarding_completed = TRUE
│           ├─> school.stripe_charges_enabled = TRUE
│           ├─> school.stripe_payouts_enabled = TRUE
│           └─> school.bank_account_verified = TRUE
│
├─> Email to Coach:
│   └─> "Banking setup complete! Ready to fundraise"
│
└─> Email to Admin:
    └─> "Lincoln High School completed Stripe onboarding"
│
▼
END: School fully approved and ready to receive funds
```

---

### Flow 4.2: Admin Processes Payout to School

```
START: Admin Dashboard → Payouts Tab
│
▼
[Payouts Management Interface]
│
├─> View Programs Ready for Payout:
│   │
│   ├─> Filters:
│   │   ├─> Has available balance > $0
│   │   ├─> Stripe account verified
│   │   ├─> No pending issues
│   │   └─> Payout not scheduled
│   │
│   ├─> Program List:
│   │   │
│   │   ├─> Lincoln HS - Football
│   │   │   - Available Balance: $8,432.50
│   │   │   - Pending Balance: $215.00
│   │   │   - Last Payout: 30 days ago
│   │   │   - Campaigns: 1 active, 2 completed
│   │   │   - Bank: verified ✓
│   │   │
│   │   ├─> Washington MS - Basketball
│   │   │   - Available Balance: $3,210.75
│   │   │   - Details...
│   │   │
│   │   └─> Jefferson HS - Band
│   │       - Available Balance: $12,550.00
│   │       - Details...
│   │
│   └─> Bulk Actions:
│       ├─> Select multiple programs
│       └─> "Create Batch Payout"
│
▼
Decision: Single or Batch Payout?
│
├────────────────────┬────────────────────┐
│                    │                    │
▼                    ▼                    ▼
[Single Payout]  [Batch Payout]   [Scheduled Auto-Payout]
│
│
▼ [Single Payout Flow]
│
Click on Program: "Lincoln HS - Football"
│
▼
[Payout Detail View]
│
├─> Program Information:
│   ├─> School: Lincoln High School
│   ├─> Program: Varsity Football
│   ├─> Coach: John Smith
│   ├─> Contact: jsmith@lincoln.edu
│
├─> Financial Summary:
│   ├─> Available Balance: $8,432.50
│   │   └─> Breakdown:
│   │       - Total Raised: $8,900.00
│   │       - Platform Fees (5%): -$445.00
│   │       - Stripe Fees (2.9% + 30¢): -$267.50
│   │       - Already Paid Out: $0.00
│   │       = Available: $8,432.50
│   │
│   ├─> Pending Balance: $215.00
│   │   └─> (Recent donations, not yet cleared)
│   │
│   └─> Lifetime Raised: $8,900.00
│
├─> Bank Account:
│   ├─> Bank: Chase Bank
│   ├─> Account Type: Checking
│   ├─> Account: ****1234
│   ├─> Status: Verified ✓
│   └─> Stripe Account ID: acct_xxxxx
│
├─> Payout History:
│   ├─> Previous Payouts: None
│   └─> This will be first payout
│
└─> Admin Actions:
    │
    ├─> Review Campaign Details
    │   ├─> View associated campaigns
    │   ├─> Check for refunds or chargebacks
    │   └─> Verify all donations completed
    │
    ├─> Enter Payout Amount
    │   ├─> Default: Full available balance
    │   ├─> Or custom amount (partial payout)
    │   ├─> Min: $100 (policy threshold)
    │   ├─> Max: Available balance
    │   └─> Amount: $8,432.50
    │
    ├─> Fee Options:
    │   ├─> Option A: Deduct fees from payout (already done)
    │   └─> Option B: Rally covers fees (if special case)
    │
    ├─> Payout Schedule:
    │   ├─> Immediate (default)
    │   ├─> Scheduled for specific date
    │   └─> Next batch (weekly batches)
    │
    ├─> Add Internal Notes:
    │   └─> "First payout for Fall campaign"
    │
    └─> Click "Initiate Payout"
│
▼
[Confirmation Modal]
│
├─> Payout Summary:
│   ├─> To: Lincoln High School - Football
│   ├─> Amount: $8,432.50
│   ├─> Bank: Chase ****1234
│   ├─> Estimated Arrival: 2-3 business days
│   ├─> Warning: "This action cannot be undone"
│
├─> Admin Re-Authentication:
│   └─> Enter password to confirm
│
└─> Click "Confirm Payout"
│
▼
[System Processing]
│
├─> Validate:
│   ├─> Sufficient balance in Rally master account
│   ├─> Stripe account is active
│   ├─> Bank account verified
│   ├─> No holds on account
│   └─> Amount ≤ available balance
│
├─> Create Payout via Stripe API:
│   │
│   ├─> Stripe Transfer to Connected Account:
│   │   ├─> Amount: $8,432.50
│   │   ├─> Destination: acct_xxxxx (Lincoln HS)
│   │   ├─> Description: "Rally payout for Fall Football campaign"
│   │   ├─> Metadata: program_id, payout_id, campaigns
│   │   └─> Response: transfer_id, status
│   │
│   └─> Stripe Payout to Bank Account:
│       ├─> Automatically created by Stripe
│       ├─> Stripe schedule: Next business day
│       └─> Response: payout_id, estimated_arrival
│
├─> Database: Create payout record
│   ├─> id (UUID)
│   ├─> program_id
│   ├─> amount: $8,432.50
│   ├─> fee_amount: $0 (already deducted)
│   ├─> net_amount: $8,432.50
│   ├─> status: 'processing'
│   ├─> stripe_transfer_id
│   ├─> stripe_payout_id
│   ├─> initiated_by: admin_id
│   ├─> initiated_at: NOW()
│   ├─> estimated_arrival: +2-3 business days
│
├─> Database: Create transaction record
│   ├─> transaction_type: 'payout_to_program'
│   ├─> amount: -$8,432.50
│   ├─> rally_account_balance_impact: -$8,432.50
│   ├─> program_account_balance_impact: -$8,432.50
│   ├─> status: 'succeeded'
│
├─> Database: Update balances
│   ├─> program_balances:
│   │   - available_balance -= $8,432.50 (now $0)
│   │   - last_payout_date = TODAY
│   │   - last_payout_amount = $8,432.50
│   │
│   └─> rally_master_balance:
│       - total_balance -= $8,432.50
│       - total_payouts += $8,432.50
│
├─> Log audit trail:
│   └─> "Admin [Name] initiated payout of $8,432.50 to Lincoln HS Football"
│
├─> Notifications:
│   │
│   ├─> Email to School/Coach:
│   │   ├─> Subject: "Payout on the way! $8,432.50"
│   │   ├─> Content:
│   │   │   - Payout amount: $8,432.50
│   │   │   - Bank account: ****1234
│   │   │   - Estimated arrival: [date]
│   │   │   - Tracking: [payout_id]
│   │   │   - Breakdown of funds (from which campaigns)
│   │   │   - Invoice/statement attached (PDF)
│   │   └─> PDF Statement includes:
│   │       - Campaign fundraising breakdown
│   │       - Gross donations: $8,900.00
│   │       - Platform fee: -$445.00
│   │       - Processing fee: -$267.50
│   │       - Net payout: $8,432.50
│   │       - Transaction details
│   │
│   └─> Notification to Other Admins:
│       └─> "Payout initiated to Lincoln HS: $8,432.50"
│
└─> Success Confirmation:
    └─> Show success message
        └─> "Payout initiated successfully"
            └─> Expected arrival: [date]
│
▼
[Monitoring Payout Status]
│
├─> Stripe Webhooks:
│   │
│   ├─> transfer.created
│   │   └─> Update payout.status = 'in_transit'
│   │
│   ├─> transfer.paid
│   │   └─> Update payout.status = 'in_transit_to_bank'
│   │
│   ├─> payout.paid
│   │   ├─> Update payout.status = 'completed'
│   │   ├─> Update payout.completed_at = NOW()
│   │   └─> Send confirmation email
│   │       ├─> To school: "Funds deposited!"
│   │       └─> To admin: "Payout completed"
│   │
│   └─> payout.failed
│       ├─> Update payout.status = 'failed'
│       ├─> Store failure_reason
│       ├─> Reverse balance changes
│       ├─> Alert admins immediately
│       └─> Email school with issue and next steps
│
├─> Admin Dashboard:
│   └─> Payout Status Tracking:
│       ├─> Processing → In Transit → Completed
│       ├─> Live status updates via webhooks
│       └─> Detailed logs
│
└─> Financial Reconciliation:
    ├─> Daily reconciliation report
    ├─> Match Stripe balance with database
    ├─> Flag any discrepancies
    └─> Admin review
│
▼
[2-3 Business Days Later]
│
├─> Stripe: Payout arrives in bank account
│
├─> System: Receive payout.paid webhook
│   └─> Update status to 'completed'
│
├─> Email to School:
│   ├─> Subject: "Funds deposited: $8,432.50"
│   ├─> "Check your bank account!"
│   └─> Thank you message
│
└─> Update dashboard:
    └─> Show in "Completed Payouts"
│
▼
END: Payout successfully delivered

---

Alternative Flow: Batch Payout
│
├─> Select Multiple Programs (checkboxes)
│   ├─> Lincoln HS Football: $8,432.50
│   ├─> Washington MS Basketball: $3,210.75
│   └─> Jefferson HS Band: $12,550.00
│
├─> Click "Create Batch Payout"
│
├─> Batch Summary:
│   ├─> Total Programs: 3
│   ├─> Total Amount: $24,193.25
│   ├─> Estimated Fees: $0 (already deducted)
│   └─> Expected Arrival: 2-3 business days
│
├─> Confirm Batch
│
├─> System: Process each payout individually
│   └─> Same steps as single payout
│       └─> But automated for all selected
│
├─> Show batch progress:
│   ├─> Lincoln HS: Processing...
│   ├─> Washington MS: Processing...
│   └─> Jefferson HS: Processing...
│
└─> Batch Complete:
    ├─> Summary: 3 of 3 successful
    ├─> Total paid out: $24,193.25
    └─> Emails sent to all schools
│
▼
END: Batch payout complete

---

Alternative Flow: Failed Payout
│
├─> Stripe: Payout fails (invalid bank account, insufficient Rally balance, etc.)
│
├─> System: Receive payout.failed webhook
│
├─> Update payout.status = 'failed'
├─> Store failure_reason
│
├─> Database: Reverse balance changes
│   ├─> program_balances.available_balance += amount
│   └─> rally_master_balance.total_balance += amount
│
├─> Alert Admins:
│   ├─> High-priority notification
│   ├─> Email: "Payout Failed - Action Required"
│   └─> Dashboard: Red alert badge
│
├─> Email to School:
│   ├─> Subject: "Payout Issue - Action Required"
│   ├─> Explain issue (e.g., "Bank account no longer valid")
│   ├─> Instructions to resolve:
│   │   - Update bank account info
│   │   - Contact support
│   └─> "We'll retry once resolved"
│
├─> Admin Actions:
│   ├─> Investigate failure reason
│   ├─> Contact school if needed
│   ├─> Update bank account (if issue)
│   └─> Retry payout manually
│
└─> Once Resolved:
    └─> Re-initiate payout
        └─> Follow normal payout flow
│
▼
END: Failed payout resolved and retried
```

---

## Summary: Total User Flows Documented

1. **Coach Flows** (5):
   - Registration & Onboarding
   - Create Campaign
   - Invite Players
   - Monitor Progress
   - Manage Roster

2. **Player Flows** (4):
   - Invitation to Account
   - Customize Page
   - Share Link
   - Monitor Progress

3. **Donor Flows** (1):
   - Discover to Donate

4. **Admin Flows** (2):
   - Approve Schools
   - Process Payouts

**Total**: 12 comprehensive user flows covering all major features

---

## Flow Diagram Conventions

```
Symbols Used:
│  = Flow direction
├─>  = Branch/Option
▼  = Next step
[  ] = Screen/Page
Decision: = Decision point
System: = Automated system action
END: = Flow terminus
```

---

## Additional Flows to Consider (Future)

- Refund Processing Flow
- Dispute Handling Flow
- Recurring Donation Management Flow
- Campaign Report Generation Flow
- Data Export Flow
- Password Reset Flow (detailed)
- Two-Factor Authentication Setup Flow
- Parent/Guardian Consent Flow
- Team Captain Features Flow
- Donor Account Creation Flow
- Campaign Update/Announcement Flow

These can be added as features expand.
