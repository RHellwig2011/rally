# Boba Fundraising Platform - Wireframes & UI/UX Flows

## Design Principles

### Visual Identity
- **Modern & Trustworthy**: Clean lines, professional typography, confidence-inspiring for handling money
- **Youth-Focused**: Energetic colors, engaging animations, game-like elements for rewards
- **Accessible**: WCAG 2.1 AA compliant, high contrast, keyboard navigation, screen reader friendly
- **Custom**: No generic stock photos or templates—authentic team photos and illustrations

### Color Palette
```
Primary: #0EA5E9 (Sky Blue) - Trust, clarity, professionalism
Secondary: #10B981 (Emerald Green) - Growth, success, achievement
Accent: #06B6D4 (Cyan Blue) - Energy, calls-to-action
Success: #22C55E (Green) - Goals met, positive actions
Warning: #EF4444 (Red) - Attention needed, critical alerts

Dark Shades:
  Gray-900: #111827 (Near Black) - Primary text, headers
  Gray-800: #1F2937 - Secondary text, subheadings
  Gray-700: #374151 - Tertiary text, labels

Mid Shades:
  Gray-600: #4B5563 - Muted text
  Gray-500: #6B7280 - Placeholder text, disabled states
  Gray-400: #9CA3AF - Icons, subtle text

Light Shades:
  Gray-300: #D1D5DB - Borders, dividers
  Gray-200: #E5E7EB - Input backgrounds
  Gray-100: #F3F4F6 - Light backgrounds, hover states
  Gray-50:  #F9FAFB - Page background

Pure Tones:
  White:    #FFFFFF - Primary background, cards, surfaces
  Black:    #000000 - Deep shadows, high contrast text (use sparingly)

Blue Shades (for charts, data visualization):
  Blue-700: #0369A1 - Dark data points
  Blue-500: #0EA5E9 - Primary blue (main)
  Blue-300: #7DD3FC - Light data points, highlights

Green Shades (for success states, progress):
  Green-700: #15803D - Dark success
  Green-500: #22C55E - Primary green (main)
  Green-300: #86EFAC - Light success, backgrounds
```

### Typography
- Headings: Inter Bold (modern, friendly)
- Body: Inter Regular
- Numbers/Data: JetBrains Mono (monospace for financial data)

---

## Wireframes

### 1. Landing Page (Public - Not Logged In)

```
┌────────────────────────────────────────────────────────────┐
│  [Logo] Boba          Features  Pricing  Login  [Sign Up] │
└────────────────────────────────────────────────────────────┘

         ┌───────────────────────────────────────┐
         │                                       │
         │   Fundraising Reimagined for Youth    │
         │   Teams, Clubs, and School Groups     │
         │                                       │
         │   Integrated banking • Real-time      │
         │   tracking • Automated outreach       │
         │                                       │
         │   [Start Your Campaign] [See How It Works]
         │                                       │
         └───────────────────────────────────────┘

┌──────────────┬──────────────┬──────────────┬──────────────┐
│  🎯 Set Goal │  💳 Raise    │  📊 Track    │  💰 Spend    │
│              │              │              │              │
│  Create your │  Automated   │  Real-time   │  Built-in    │
│  campaign in │  outreach +  │  dashboard   │  banking for │
│  minutes     │  referrals   │  & reports   │  easy payouts│
└──────────────┴──────────────┴──────────────┴──────────────┘

             Why Teams Choose Boba
    ┌─────────────────────────────────────┐
    │  "Raised $15K in 3 weeks. The       │
    │   banking dashboard made spending   │
    │   transparent for parents."         │
    │   - Sarah T., Volleyball Coach      │
    └─────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  Live Campaigns                                            │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                     │
│  │ Team │ │ Team │ │ Team │ │ Team │ [View All Campaigns]│
│  │ Card │ │ Card │ │ Card │ │ Card │                     │
│  └──────┘ └──────┘ └──────┘ └──────┘                     │
└────────────────────────────────────────────────────────────┘

Footer: About • Privacy • Transparent Pricing • Support
```

---

### 2. Campaign Page (Public - Donor View)

```
┌────────────────────────────────────────────────────────────┐
│  [Logo] Boba     [Search]                  [Start Campaign]│
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│                     [Banner Image]                         │
│                                                            │
│        [Team Logo]  Lincoln High Robotics Team            │
│                     Building the Future, One Bot at a Time │
└────────────────────────────────────────────────────────────┘

┌─────────────────────────────────┬──────────────────────────┐
│                                 │  ┌────────────────────┐  │
│  About the Campaign             │  │  $8,450 raised     │  │
│                                 │  │  of $12,000 goal   │  │
│  Our robotics team is raising   │  │  ████████░░░ 70%   │  │
│  funds to compete in the        │  │                    │  │
│  National FIRST Robotics        │  │  142 donors        │  │
│  Championship. Your support     │  │  12 days left      │  │
│  helps us cover:                │  └────────────────────┘  │
│                                 │                          │
│  • Competition registration     │  [Donate Now]            │
│  • Travel and lodging          │                          │
│  • Parts and materials         │  Or donate:              │
│  • Team uniforms               │  [$25] [$50] [$100]     │
│                                 │  [Custom Amount]         │
│  Every dollar brings us closer  │                          │
│  to our dream!                 │  ⭐ Tax-deductible      │
│                                 │                          │
│  [Read Full Story]             │  [Share Campaign]        │
│                                 │  📱 💬 📧              │
└─────────────────────────────────┴──────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  Recent Donors                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  👤 Jennifer M.     donated $100    2 hours ago           │
│     "Go Robotics Team! So proud of you all!"              │
│                                                            │
│  👤 Anonymous       donated $50     5 hours ago           │
│                                                            │
│  👤 David & Sarah K. donated $75    1 day ago             │
│     "Can't wait to see you compete!"                      │
│                                                            │
│  [View All Donors]                                        │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  Cheer Wall 📣                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  💬 "You've got this team! Build something amazing!"      │
│     - Mark T.                                             │
│                                                            │
│  💬 "So excited to support local STEM education!"         │
│     - Anonymous                                           │
│                                                            │
│  [Leave a Message]                                        │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  Campaign Updates                                          │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  📸 "We finished our robot design!"          3 days ago    │
│  🎉 "Reached 50% of our goal!"               1 week ago    │
│  📝 "Meet the Team: Student Spotlight"       2 weeks ago   │
└────────────────────────────────────────────────────────────┘
```

---

### 3. Donation Flow

**Step 1: Amount Selection**
```
┌────────────────────────────────────────────────────────────┐
│  ← Back to Campaign                                        │
│                                                            │
│         Support Lincoln High Robotics Team                │
│                                                            │
│  Choose your donation amount:                             │
│                                                            │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────────────┐         │
│  │ $25  │  │ $50  │  │ $100 │  │ Custom: $___  │         │
│  └──────┘  └──────┘  └──────┘  └──────────────┘         │
│    Most     Avg       Popular                             │
│   common   donation                                        │
│                                                            │
│  ✨ Supporting Team Member? (Optional)                    │
│  [Select team member ▼]  (for referral tracking)         │
│                                                            │
│  Amount Breakdown:                                        │
│  ┌──────────────────────────────────────────────┐         │
│  │  Your donation:          $100.00             │         │
│  │  Platform fee (10%):      $10.00             │         │
│  │  Processing fee (~3%):     $3.00             │         │
│  │  ─────────────────────────────────            │         │
│  │  Total charged:          $100.00             │         │
│  │  To campaign:             $87.00             │         │
│  │                                               │         │
│  │  ℹ️  100% of your donation minus fees        │         │
│  │     goes directly to the team.               │         │
│  └──────────────────────────────────────────────┘         │
│                                                            │
│  [Continue to Payment]                                    │
└────────────────────────────────────────────────────────────┘
```

**Step 2: Payment Details**
```
┌────────────────────────────────────────────────────────────┐
│  ← Back                                                    │
│                                                            │
│         Complete Your $100 Donation                       │
│                                                            │
│  Your Information:                                        │
│  ┌────────────────────────────────────────────┐           │
│  │  Name:  [_____________________________]    │           │
│  │  Email: [_____________________________]    │           │
│  │  Phone: [_____________________________]    │ (optional)│
│  └────────────────────────────────────────────┘           │
│                                                            │
│  Payment Method:                                          │
│  ○ Credit/Debit Card   ○ Bank Account (ACH)              │
│                                                            │
│  ┌────────────────────────────────────────────┐           │
│  │  Card Number:  [____________________]  💳  │           │
│  │  Expiry: [__/__]  CVV: [___]               │           │
│  │  ZIP Code: [_____]                         │           │
│  └────────────────────────────────────────────┘           │
│                                                            │
│  Leave a message (optional):                              │
│  ┌────────────────────────────────────────────┐           │
│  │  "Go team! You've got this!"               │           │
│  │  ________________________________           │           │
│  └────────────────────────────────────────────┘           │
│                                                            │
│  ☐ Make my donation anonymous                            │
│  ☐ Cover processing fees ($3) so 100% goes to team       │
│  ☑️ Email me campaign updates                             │
│                                                            │
│  [Donate $100.00] 🔒 Secure                               │
│                                                            │
│  By donating, you agree to our Terms & Privacy Policy     │
└────────────────────────────────────────────────────────────┘
```

**Step 3: Confirmation**
```
┌────────────────────────────────────────────────────────────┐
│                      ✅ Thank You!                         │
│                                                            │
│      Your $100 donation to Lincoln High Robotics          │
│               Team was successful!                         │
│                                                            │
│  Receipt #DON-2024-123456                                 │
│  Confirmation email sent to: you@email.com                │
│                                                            │
│  ┌──────────────────────────────────────────┐             │
│  │  Total charged:      $100.00             │             │
│  │  To campaign:         $87.00             │             │
│  │  Platform fee:        $10.00             │             │
│  │  Processing fee:       $3.00             │             │
│  │                                           │             │
│  │  Tax-deductible: Yes ✓                   │             │
│  │  [Download Receipt]                      │             │
│  └──────────────────────────────────────────┘             │
│                                                            │
│  Help Spread the Word:                                    │
│  [Share on Facebook] [Share on Twitter] [Copy Link]       │
│                                                            │
│  Make it recurring?                                       │
│  Support this team monthly: [Set Up Monthly Donation]     │
│                                                            │
│  [Back to Campaign] [Explore Other Campaigns]             │
└────────────────────────────────────────────────────────────┘
```

---

### 4. Campaign Dashboard (Campaign Leader View)

```
┌────────────────────────────────────────────────────────────┐
│  [Logo] Boba                              Alex T. ▼        │
│                                           Campaign Leader   │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  Lincoln High Robotics Team                    ⚙️ Settings │
│  [View Public Page] [Share Campaign] [Send Update]         │
└────────────────────────────────────────────────────────────┘

┌─── 📊 Overview ────────────────────────────────────────────┐
│                                                            │
│  ┌──────────────┬─────────────┬─────────────┬───────────┐ │
│  │ Total Raised │ Platform Fee│  Available  │ Disbursed │ │
│  │   $8,450     │   $845      │   $6,800    │  $805     │ │
│  │   ↑ 12% 7d   │   (10%)     │   Balance   │  Total    │ │
│  └──────────────┴─────────────┴─────────────┴───────────┘ │
│                                                            │
│  ┌──────────────┬─────────────┬─────────────┬───────────┐ │
│  │    Goal      │   Donors    │  Avg Gift   │ Days Left │ │
│  │  $12,000     │    142      │    $59      │    12     │ │
│  │   70% 🎯     │   +8 today  │             │           │ │
│  └──────────────┴─────────────┴─────────────┴───────────┘ │
└────────────────────────────────────────────────────────────┘

┌─── 📈 Fundraising Progress ────────────────────────────────┐
│                                                            │
│  [Daily] [Weekly] [Monthly]                  [Export CSV] │
│                                                            │
│   $                                                        │
│   │                                              ●         │
│   │                                        ●               │
│   │                                  ●                     │
│   │                            ●                           │
│   │                      ●                                 │
│   │                ●                                       │
│   │          ●                                             │
│   │    ●                                                   │
│   └────────────────────────────────────────────────────    │
│     Week 1  Week 2  Week 3  Week 4  Week 5  Week 6        │
│                                                            │
│  🎯 Projected to reach $12,450 (103% of goal) by end date │
└────────────────────────────────────────────────────────────┘

┌─── 💰 Banking & Funds ─────────────────────────────────────┐
│                                                            │
│  Available Balance: $6,800.00                             │
│  Bank Account: •••• 1234 ✓ Verified                       │
│                                                            │
│  [Request Disbursement] [View All Transactions]           │
│                                                            │
│  Pending Requests:                                        │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ ⏳ $500 - Travel Deposit                              │ │
│  │    Awaiting guardian approval                        │ │
│  │    Requested 2 hours ago                             │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Recent Activity:                                         │
│  ✅ $150 - Team Uniforms (Completed 3 days ago)           │
│  ✅ $655 - Robot Parts (Completed 1 week ago)             │
└────────────────────────────────────────────────────────────┘

┌─── 🎁 Recent Donations ────────────────────────────────────┐
│  [All] [Today] [This Week]                    [Export]    │
│                                                            │
│  Jennifer M.       $100.00      2 hours ago   Card ****   │
│  "Go Robotics Team! So proud of you all!"                 │
│                                                            │
│  Anonymous         $50.00       5 hours ago   Card ****   │
│                                                            │
│  David & Sarah K.  $75.00       1 day ago     ACH         │
│  "Can't wait to see you compete!"                         │
│                                                            │
│  [View All 142 Donors]                                    │
└────────────────────────────────────────────────────────────┘

┌─── 🔗 Referral Tracking ───────────────────────────────────┐
│                                                            │
│  Top Performers:                                          │
│  1. 🏆 Emma S.     $1,245 raised  •  18 donations         │
│  2. 🥈 Jake M.     $1,100 raised  •  15 donations         │
│  3. 🥉 Sofia R.    $890 raised    •  12 donations         │
│                                                            │
│  [View Full Leaderboard] [Send Encouragement]             │
└────────────────────────────────────────────────────────────┘

Sidebar Navigation:
📊 Dashboard (active)
🎨 Customize Campaign
💰 Banking & Payouts
👥 Team & Donors
📧 Outreach & Updates
📈 Analytics
⚙️ Settings
```

---

### 5. Disbursement Request Modal

```
┌────────────────────────────────────────────────────────────┐
│  Request Fund Disbursement                           ✕     │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Available Balance: $6,800.00                             │
│                                                            │
│  Amount to Request: *                                     │
│  ┌────────────────────────────────────────────┐           │
│  │  $ [___________]                           │           │
│  └────────────────────────────────────────────┘           │
│                                                            │
│  Purpose: *                                               │
│  ┌────────────────────────────────────────────┐           │
│  │  [Select purpose ▼]                        │           │
│  │  • Competition Registration                │           │
│  │  • Travel & Lodging                        │           │
│  │  • Equipment & Supplies                    │           │
│  │  • Team Apparel                            │           │
│  │  • Other (specify below)                   │           │
│  └────────────────────────────────────────────┘           │
│                                                            │
│  Description:                                             │
│  ┌────────────────────────────────────────────┐           │
│  │  Provide details about this expense...     │           │
│  │  ____________________________________       │           │
│  │  ____________________________________       │           │
│  └────────────────────────────────────────────┘           │
│                                                            │
│  Upload Receipts/Invoices (Optional):                    │
│  ┌────────────────────────────────────────────┐           │
│  │  📎 Drag files here or [Browse]            │           │
│  └────────────────────────────────────────────┘           │
│                                                            │
│  Expected Expense Date:                                   │
│  ┌────────────────────────────────────────────┐           │
│  │  [MM/DD/YYYY] 📅                           │           │
│  └────────────────────────────────────────────┘           │
│                                                            │
│  ⚠️ This request requires guardian approval               │
│  (Threshold: $500+)                                       │
│                                                            │
│  Payout Method:                                           │
│  ○ Bank Account (•••• 1234) - 1-2 business days          │
│  ○ Debit Card (•••• 5678) - Instant (1% fee)             │
│                                                            │
│  After Approval, Remaining Balance: $6,300.00             │
│                                                            │
│  [Cancel]                    [Submit Request]             │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

### 6. Guardian Approval Dashboard

```
┌────────────────────────────────────────────────────────────┐
│  [Logo] Boba                           Patricia T. ▼       │
│                                        Guardian             │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  Campaigns You're Overseeing                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Lincoln High Robotics Team                          │  │
│  │  Campaign Leader: Alex T.                            │  │
│  │  Total Raised: $8,450  •  Available: $6,800          │  │
│  │  [View Details]                                      │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘

┌─── ⚠️ Pending Approvals (1) ───────────────────────────────┐
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Request #DR-2024-00123                              │ │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │ │
│  │                                                      │ │
│  │  Amount: $500.00                                     │ │
│  │  Purpose: Travel Deposit                            │ │
│  │  Requested by: Alex T. (Campaign Leader)            │ │
│  │  Requested: 2 hours ago                             │ │
│  │                                                      │ │
│  │  Description:                                        │ │
│  │  "Hotel deposit for National Championship in        │ │
│  │   Detroit. Need to secure rooms by Friday."         │ │
│  │                                                      │ │
│  │  Expected Date: March 15, 2024                      │ │
│  │                                                      │ │
│  │  Attachments:                                        │ │
│  │  📎 hotel-quote.pdf (125 KB)                        │ │
│  │                                                      │ │
│  │  Current Balance: $6,800                            │ │
│  │  After Disbursement: $6,300                         │ │
│  │                                                      │ │
│  │  ┌──────────────────────────────────────────┐       │ │
│  │  │  Approval Comments (Optional):           │       │ │
│  │  │  ______________________________           │       │ │
│  │  └──────────────────────────────────────────┘       │ │
│  │                                                      │ │
│  │  [❌ Reject]           [✅ Approve & Process]        │ │
│  │                                                      │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘

┌─── ✅ Recently Approved ───────────────────────────────────┐
│                                                            │
│  $150 - Team Uniforms                    Approved 3d ago  │
│  Status: Completed • Paid to vendor                       │
│                                                            │
│  $655 - Robot Parts                      Approved 1w ago  │
│  Status: Completed • Paid to supplier                     │
└────────────────────────────────────────────────────────────┘

┌─── 📊 Financial Overview ──────────────────────────────────┐
│                                                            │
│  Lifetime Raised: $8,450                                  │
│  Total Disbursed: $805                                    │
│  Platform Fees: $845                                      │
│  Available: $6,800                                        │
│                                                            │
│  [Download Full Report] [View All Transactions]           │
└────────────────────────────────────────────────────────────┘
```

---

### 7. Campaign Creation Wizard

**Step 1: Organization Details**
```
┌────────────────────────────────────────────────────────────┐
│  Create Your Campaign                           Step 1 of 5│
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Tell us about your team or organization                  │
│                                                            │
│  Organization Name: *                                     │
│  ┌────────────────────────────────────────────┐           │
│  │  Lincoln High School                       │           │
│  └────────────────────────────────────────────┘           │
│                                                            │
│  Team/Group Name: *                                       │
│  ┌────────────────────────────────────────────┐           │
│  │  Robotics Team                             │           │
│  └────────────────────────────────────────────┘           │
│                                                            │
│  Category: *                                              │
│  ┌────────────────────────────────────────────┐           │
│  │  [Select category ▼]                       │           │
│  │  • Sports                                  │           │
│  │  • Arts & Music                            │           │
│  │  • STEM/Academics                          │           │
│  │  • Community Service                       │           │
│  │  • Other                                   │           │
│  └────────────────────────────────────────────┘           │
│                                                            │
│  Campaign URL:                                            │
│  boba.co/raise/[lincoln-high-robotics]                    │
│  ┌────────────────────────────────────────────┐           │
│  │  lincoln-high-robotics                     │ ✓ Available│
│  └────────────────────────────────────────────┘           │
│                                                            │
│  Fundraising Goal: *                                      │
│  ┌────────────────────────────────────────────┐           │
│  │  $ [___________]                           │           │
│  └────────────────────────────────────────────┘           │
│                                                            │
│  Campaign Duration:                                       │
│  ┌─────────────────────┬──────────────────────┐           │
│  │ Start: [MM/DD/YYYY] │ End: [MM/DD/YYYY]    │           │
│  └─────────────────────┴──────────────────────┘           │
│                                                            │
│  [Cancel]                               [Next: Customize] │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Step 2: Customize Your Campaign**
```
┌────────────────────────────────────────────────────────────┐
│  Create Your Campaign                           Step 2 of 5│
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Make your campaign stand out                             │
│                                                            │
│  Logo:                                                    │
│  ┌────────────────────────────────────────────┐           │
│  │         ┌──────────┐                       │           │
│  │         │  [LOGO]  │  [Upload Logo]        │           │
│  │         │  Preview │                       │           │
│  │         └──────────┘                       │           │
│  │  Recommended: Square, 500x500px minimum    │           │
│  └────────────────────────────────────────────┘           │
│                                                            │
│  Banner Image:                                            │
│  ┌────────────────────────────────────────────┐           │
│  │  ┌──────────────────────────────────────┐  │           │
│  │  │    [Team Photo Preview]              │  │           │
│  │  │                                       │  │           │
│  │  └──────────────────────────────────────┘  │           │
│  │  [Upload Banner] [Remove]                  │           │
│  │  Recommended: 1200x400px, authentic team   │           │
│  │  photo (no stock images!)                  │           │
│  └────────────────────────────────────────────┘           │
│                                                            │
│  Brand Colors:                                            │
│  Primary:   [🎨 #6366F1] [Color Picker]                  │
│  Secondary: [🎨 #F59E0B] [Color Picker]                  │
│                                                            │
│  Campaign Story: *                                        │
│  ┌────────────────────────────────────────────┐           │
│  │  Our robotics team is raising funds to     │           │
│  │  compete in the National FIRST Robotics    │           │
│  │  Championship...                           │           │
│  │  ____________________________________       │           │
│  │  [B] [I] [Link] [Image]   1,245/5,000      │           │
│  └────────────────────────────────────────────┘           │
│                                                            │
│  Preview: [View Your Campaign Page]                       │
│                                                            │
│  [← Back]                         [Next: Banking Setup]   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Step 3: Banking Setup**
```
┌────────────────────────────────────────────────────────────┐
│  Create Your Campaign                           Step 3 of 5│
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Set up secure fund management                            │
│                                                            │
│  🔒 Your funds will be held securely in your campaign's   │
│     banking account and can be withdrawn at any time.     │
│                                                            │
│  Link Your Bank Account or Debit Card:                    │
│  ┌────────────────────────────────────────────┐           │
│  │  [🏦 Connect with Plaid]                   │           │
│  │  Secure instant verification                          │
│  │                                             │           │
│  │  Or [Enter Manually]                       │           │
│  └────────────────────────────────────────────┘           │
│                                                            │
│  Campaign Leader Verification (Required): *               │
│  To comply with financial regulations, we need to         │
│  verify your identity.                                    │
│                                                            │
│  Legal Name:                                              │
│  ┌─────────────────────┬──────────────────────┐           │
│  │ First: [_________]  │ Last: [___________]  │           │
│  └─────────────────────┴──────────────────────┘           │
│                                                            │
│  Date of Birth:                                           │
│  ┌────────────────────────────────────────────┐           │
│  │  [MM/DD/YYYY] 📅                           │           │
│  └────────────────────────────────────────────┘           │
│                                                            │
│  Last 4 of SSN:                                           │
│  ┌────────────────────────────────────────────┐           │
│  │  [____]  🔒 Encrypted & secure             │           │
│  └────────────────────────────────────────────┘           │
│                                                            │
│  Add Guardian Oversight (Optional but Recommended):       │
│  ┌────────────────────────────────────────────┐           │
│  │  Guardian Email: [___________________]     │           │
│  │  Guardian Name:  [___________________]     │           │
│  │                                             │           │
│  │  ☑️ Require guardian approval for          │           │
│  │     disbursements over $[500]              │           │
│  └────────────────────────────────────────────┘           │
│                                                            │
│  [← Back]                         [Next: Team & Outreach] │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

### 8. Mobile App Screens

**Home Screen (Mobile)**
```
┌─────────────────────────┐
│ ≡  Boba          🔔  👤 │
├─────────────────────────┤
│                         │
│  Your Campaign          │
│  ┌───────────────────┐  │
│  │ Lincoln High      │  │
│  │ Robotics          │  │
│  │                   │  │
│  │ $8,450 / $12,000  │  │
│  │ ████████░░░ 70%   │  │
│  │                   │  │
│  │ 142 donors        │  │
│  │ 12 days left      │  │
│  └───────────────────┘  │
│                         │
│  Quick Actions          │
│  ┌─────┬─────┬─────┐   │
│  │Share│Update│Funds│   │
│  └─────┴─────┴─────┘   │
│                         │
│  Recent Activity        │
│  ━━━━━━━━━━━━━━━━━━━   │
│  💰 $100 - Jennifer M.  │
│      2 hours ago        │
│                         │
│  💰 $50 - Anonymous     │
│      5 hours ago        │
│                         │
│  📊 View Full Dashboard │
│                         │
└─────────────────────────┘
```

**Banking Screen (Mobile)**
```
┌─────────────────────────┐
│ ← Banking      ⚙️        │
├─────────────────────────┤
│                         │
│  Available Balance      │
│  $6,800.00              │
│                         │
│  ┌───────────────────┐  │
│  │ Request Payout    │  │
│  └───────────────────┘  │
│                         │
│  Overview               │
│  ┌─────────┬─────────┐  │
│  │ Raised  │Platform │  │
│  │ $8,450  │Fee $845 │  │
│  └─────────┴─────────┘  │
│  ┌─────────┬─────────┐  │
│  │Disbursed│ Pending │  │
│  │  $805   │  $500   │  │
│  └─────────┴─────────┘  │
│                         │
│  Pending Requests       │
│  ⏳ $500 Travel Deposit │
│     Awaiting approval   │
│     [View Details]      │
│                         │
│  Recent Activity        │
│  ✅ $150 Uniforms       │
│     3 days ago          │
│                         │
│  ✅ $655 Robot Parts    │
│     1 week ago          │
│                         │
│  [View All Transactions]│
│                         │
└─────────────────────────┘
```

---

## Interaction Patterns

### Real-Time Updates
- **Dashboard**: Auto-refresh every 30 seconds
- **Donation notifications**: Toast notification on new donation
- **Progress bar**: Animated fill on goal progress
- **Confetti animation**: When milestones reached (25%, 50%, 75%, 100%)

### Microinteractions
- **Donation button**: Pulse animation to draw attention
- **Share buttons**: Haptic feedback on mobile
- **Amount selection**: Highlight + scale up selected amount
- **Form validation**: Inline error messages with shake animation
- **Success states**: Checkmark animation + green glow

### Accessibility
- **Keyboard navigation**: Full support, visible focus states
- **Screen reader**: ARIA labels on all interactive elements
- **Color contrast**: Minimum 4.5:1 for text, 3:1 for UI components
- **Font size**: Minimum 16px, scalable up to 200%
- **Alt text**: All images and icons

### Loading States
- **Skeleton screens**: For dashboard data loading
- **Shimmer effect**: On loading cards
- **Progress indicators**: For multi-step processes
- **Optimistic UI**: Immediate feedback, rollback on error

---

## Responsive Breakpoints

```
Mobile:   < 640px  (single column, touch-optimized)
Tablet:   641px - 1024px (two columns, hybrid)
Desktop:  > 1024px (full dashboard, multi-column)
```

### Mobile-First Considerations
- Large touch targets (min 44x44px)
- Sticky CTAs (donation button always visible)
- Swipe gestures (navigate between tabs)
- Bottom navigation (easier thumb reach)
- Native share sheet integration

---

## Next Steps for Design Implementation

1. **Create design system in Figma**:
   - Component library (buttons, inputs, cards)
   - Color palette and typography scale
   - Icon set (custom + Heroicons)

2. **High-fidelity mockups**:
   - All screens in mobile, tablet, desktop
   - Dark mode variants
   - Error and empty states

3. **Prototype**:
   - Interactive flows (donation, disbursement)
   - Animation specs
   - User testing scripts

4. **Developer handoff**:
   - Figma-to-code plugins (Figma Tokens)
   - Design tokens JSON
   - Component Storybook

Ready to bring this to life!
