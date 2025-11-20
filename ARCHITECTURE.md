# Boba Fundraising Platform - System Architecture

## Executive Summary
Next-generation fundraising platform for youth teams, clubs, and school groups with integrated banking, automated outreach, and transparent fund management.

**Key Differentiators:**
- Integrated banking system with secure fund holding and controlled distribution
- Transparent 10% platform fee visible in all reporting
- Automated donor engagement and referral systems
- Real-time analytics dashboard for fund tracking
- Guardian-led campaign support and digital rewards
- Unwavering privacy commitment

---

## Tech Stack Recommendations

### Frontend
- **Framework**: Next.js 14+ (App Router)
  - Server-side rendering for SEO and performance
  - Built-in API routes for backend integration
  - Excellent mobile responsiveness
  - TypeScript for type safety

- **Mobile**: React Native (sharing code with web via React)
  - Cross-platform iOS/Android
  - Native performance for smooth UX
  - Shared components with web app

- **UI Library**: Tailwind CSS + shadcn/ui
  - Custom, non-generic design
  - Accessible components out of box
  - Easy theming for campaign customization

- **State Management**: Zustand + React Query
  - Simple, performant state management
  - Server state caching with React Query
  - Real-time updates via polling/websockets

### Backend
- **Runtime**: Node.js with Express/Fastify
  - JavaScript/TypeScript consistency
  - Large ecosystem for integrations
  - Excellent async performance

- **Database**: PostgreSQL + Prisma ORM
  - ACID compliance for financial transactions
  - Complex queries for reporting
  - Type-safe database access
  - Easy migrations

- **Authentication**: Clerk or Auth0
  - Multi-factor authentication
  - Role-based access control (RBAC)
  - Guardian consent flows
  - OAuth integrations

- **File Storage**: AWS S3 or Cloudflare R2
  - Campaign images, logos, receipts
  - CDN for fast global delivery

### Banking & Payments
- **MVP (Simulated)**: Internal ledger system
  - PostgreSQL for transaction records
  - Simulated fund holding and distribution
  - Real logic, placeholder for actual money movement

- **Production**: Stripe Connect (Platform)
  - Escrow/marketplace model
  - Automated fee collection (10%)
  - Payout scheduling and controls
  - Bank account verification
  - Alternative: Dwolla or Modern Treasury

### Communication
- **Email**: SendGrid or Resend
  - Transactional emails (receipts, notifications)
  - Campaign update broadcasts
  - Drip campaigns for donor re-engagement

- **SMS**: Twilio
  - Donation confirmations
  - Campaign milestones
  - Urgent updates to guardians

### Analytics & Monitoring
- **Application Monitoring**: Sentry
  - Error tracking and alerts
  - Performance monitoring

- **Analytics**: PostHog or Mixpanel
  - User behavior tracking
  - Campaign performance metrics
  - A/B testing for conversion optimization

### Infrastructure
- **Hosting**: Vercel (frontend) + Railway/Render (backend)
  - Auto-scaling
  - Easy deployments
  - Built-in CI/CD

- **Caching**: Redis
  - Session management
  - Real-time dashboard data
  - Rate limiting

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Users Layer                              │
│  [Campaign Leaders] [Donors] [Guardians] [Bank Admins]          │
└───────────────┬─────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend Applications                         │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │   Web App        │  │  Mobile App      │                    │
│  │  (Next.js 14)    │  │  (React Native)  │                    │
│  └──────────────────┘  └──────────────────┘                    │
│         Campaign Pages • Banking Dashboard • Admin Panel        │
└───────────────┬─────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                           │
│              (Next.js API Routes / Express)                      │
│                   Authentication Middleware                      │
│                   Rate Limiting • Validation                     │
└───────────────┬─────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                          │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────────┐           │
│  │  Campaign   │ │   Banking    │ │   Outreach     │           │
│  │  Service    │ │   Service    │ │   Service      │           │
│  └─────────────┘ └──────────────┘ └────────────────┘           │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────────┐           │
│  │  Payment    │ │  Analytics   │ │  Notification  │           │
│  │  Service    │ │  Service     │ │  Service       │           │
│  └─────────────┘ └──────────────┘ └────────────────┘           │
└───────────────┬─────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                  │
│  ┌─────────────────────────────────────────────────────┐        │
│  │         PostgreSQL (Primary Database)               │        │
│  │  • Users & Roles  • Campaigns  • Transactions       │        │
│  │  • Banking Ledger • Donations  • Analytics          │        │
│  └─────────────────────────────────────────────────────┘        │
│  ┌─────────────────────────────────────────────────────┐        │
│  │         Redis (Cache & Real-time)                   │        │
│  │  • Session Store  • Dashboard Cache  • Queues       │        │
│  └─────────────────────────────────────────────────────┘        │
└───────────────┬─────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   External Services                              │
│  [Stripe API]  [SendGrid]  [Twilio]  [AWS S3]  [Sentry]        │
└─────────────────────────────────────────────────────────────────┘
```

---

## User Roles & Permissions

### 1. Campaign Leader (Primary Admin)
**Capabilities:**
- Create and manage campaigns
- Customize campaign pages (branding, images, messaging)
- View real-time dashboard and analytics
- Request fund distributions
- Invite co-leaders and guardians
- Send campaign updates to donors
- Export donor/transaction reports
- Manage team roster and digital rewards

**Permissions:**
- Full access to their campaigns
- Cannot access other campaigns
- Cannot approve own fund distribution requests (requires guardian/bank admin)
- Can view but not modify platform fee calculations

### 2. Guardian (Oversight Role)
**Capabilities:**
- Monitor campaign progress
- Approve or deny fund distribution requests
- View all transactions and reports
- Set spending limits and approval thresholds
- Receive alerts for major activities
- Add/remove campaign leaders

**Permissions:**
- Read-only access to campaign content
- Full control over fund distribution approvals
- Can override leader decisions for financial matters
- Receives all financial notifications

### 3. Donor (Public/Semi-Public)
**Capabilities:**
- Browse and donate to campaigns
- Track donation impact
- Leave messages on cheer wall
- Share referral links
- View campaign updates
- Download donation receipts

**Permissions:**
- Public view of active campaigns
- Access to own donation history
- Opt-in/out of communications
- Can remain anonymous or public

### 4. Bank Admin (Internal Platform Role)
**Capabilities:**
- Oversee all fund movements
- Process payout requests
- Handle disputed transactions
- Audit financial records
- Set platform-wide fee policies
- Flag suspicious activities

**Permissions:**
- Read-only access to all campaigns
- Approve/deny high-value distributions
- Access to complete audit logs
- Cannot modify campaign content
- Cannot initiate transfers (only approve)

### 5. Team Member (Limited)
**Capabilities:**
- View campaign they're part of
- See their individual fundraising stats
- Access referral links
- Receive digital rewards

**Permissions:**
- Read-only access to parent campaign
- Cannot modify settings or request funds
- Can view aggregated donor data (not PII)

---

## Data Models

### User
```typescript
interface User {
  id: string;
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
  role: 'CAMPAIGN_LEADER' | 'GUARDIAN' | 'DONOR' | 'BANK_ADMIN' | 'TEAM_MEMBER';
  createdAt: Date;
  updatedAt: Date;
  emailVerified: boolean;
  phoneVerified: boolean;
  kycStatus?: 'PENDING' | 'APPROVED' | 'REJECTED'; // For leaders receiving funds
}
```

### Campaign
```typescript
interface Campaign {
  id: string;
  organizationName: string;
  teamName: string;
  slug: string; // Unique URL: boba.co/raise/[slug]
  description: string;
  goalAmount: number; // In cents
  currentAmount: number; // In cents
  platformFeePercent: number; // Default 10%

  // Customization
  logoUrl?: string;
  bannerImageUrl?: string;
  primaryColor: string;
  secondaryColor: string;

  // Banking
  bankingAccountId: string; // Links to BankingAccount

  // Metadata
  startDate: Date;
  endDate?: Date;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
  category: 'SPORTS' | 'ARTS' | 'EDUCATION' | 'COMMUNITY' | 'OTHER';

  // Leadership
  primaryLeaderId: string;
  guardianIds: string[];

  createdAt: Date;
  updatedAt: Date;
}
```

### BankingAccount
```typescript
interface BankingAccount {
  id: string;
  campaignId: string;

  // Balances (all in cents)
  totalRaised: number;
  platformFeesCollected: number;
  availableBalance: number; // totalRaised - fees - disbursed
  disbursedTotal: number;
  pendingDisbursement: number;

  // External account for payouts (encrypted)
  payoutAccountType: 'BANK_ACCOUNT' | 'DEBIT_CARD';
  payoutAccountLast4?: string;
  payoutAccountVerified: boolean;

  // Stripe Connect account ID (when using Stripe)
  stripeConnectAccountId?: string;

  // Limits and controls
  dailyDisbursementLimit?: number;
  requiresGuardianApproval: boolean;
  approvalThreshold: number; // Amount requiring guardian approval

  createdAt: Date;
  updatedAt: Date;
}
```

### Donation
```typescript
interface Donation {
  id: string;
  campaignId: string;
  donorId?: string; // Null for guest donations

  // Amounts (in cents)
  grossAmount: number; // What donor paid
  platformFee: number; // 10% of gross
  netAmount: number; // Goes to campaign
  processingFee: number; // Stripe/payment processor fee

  // Donor info (for receipts, encrypted)
  donorEmail: string;
  donorName?: string;
  donorMessage?: string;
  isAnonymous: boolean;

  // Payment details
  paymentProvider: 'STRIPE' | 'SIMULATED';
  paymentIntentId?: string;
  paymentMethod: 'CARD' | 'ACH' | 'WALLET';
  paymentMethodLast4?: string;

  // Referral tracking
  referredByUserId?: string;
  referralCode?: string;
  utmSource?: string;

  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

  // Tax receipt
  taxReceiptUrl?: string;
  taxReceiptSentAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}
```

### Transaction (Internal Ledger)
```typescript
interface Transaction {
  id: string;
  bankingAccountId: string;

  type: 'DEPOSIT' | 'DISBURSEMENT' | 'FEE_COLLECTION' | 'REFUND' | 'ADJUSTMENT';
  amount: number; // In cents, positive for deposits, negative for disbursements

  // Running balance after this transaction
  balanceAfter: number;

  // References
  donationId?: string; // If related to a donation
  disbursementId?: string; // If related to a payout

  description: string;
  metadata?: Record<string, any>;

  createdAt: Date;
  createdBy: string; // User ID who initiated
}
```

### DisbursementRequest
```typescript
interface DisbursementRequest {
  id: string;
  bankingAccountId: string;
  campaignId: string;

  // Request details
  requestedAmount: number; // In cents
  purpose: string;
  receiptsUrls?: string[]; // Supporting documents

  // Approval flow
  requestedBy: string; // User ID
  requestedAt: Date;

  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';

  // Approval
  approvedBy?: string; // Guardian or Bank Admin ID
  approvedAt?: Date;
  rejectionReason?: string;

  // Completion
  disbursementDate?: Date;
  payoutTransactionId?: string;

  createdAt: Date;
  updatedAt: Date;
}
```

### CampaignUpdate
```typescript
interface CampaignUpdate {
  id: string;
  campaignId: string;
  authorId: string;

  title: string;
  content: string; // Rich text/markdown
  imageUrls?: string[];

  // Notifications
  notifyDonors: boolean;
  sentToEmails: number;
  sentToSms: number;

  publishedAt?: Date;
  status: 'DRAFT' | 'PUBLISHED';

  createdAt: Date;
  updatedAt: Date;
}
```

### CheerWallMessage
```typescript
interface CheerWallMessage {
  id: string;
  campaignId: string;
  donationId?: string; // Optional link to donation

  authorName: string; // Can be different from donor if anonymous
  message: string;
  isAnonymous: boolean;

  // Moderation
  isApproved: boolean;
  isFlagged: boolean;

  createdAt: Date;
}
```

### Referral
```typescript
interface Referral {
  id: string;
  campaignId: string;
  referrerId: string; // Team member or donor
  referralCode: string; // Unique code

  // Tracking
  clickCount: number;
  donationCount: number;
  totalRaised: number; // In cents

  // Rewards
  rewardType?: 'BADGE' | 'POINTS' | 'PRIZE';
  rewardValue?: number;
  rewardUnlockedAt?: Date;

  createdAt: Date;
}
```

---

## Banking System Architecture

### Core Principles
1. **Double-Entry Accounting**: Every transaction affects at least two accounts
2. **Immutable Ledger**: Transactions are never deleted, only reversed
3. **Atomic Operations**: All financial operations are database transactions
4. **Audit Trail**: Complete history of all money movements
5. **Reconciliation**: Regular checks against external payment processor

### Fund Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     DONATION FLOW                                │
└─────────────────────────────────────────────────────────────────┘

1. Donor makes donation: $100.00
   ↓
2. Platform processes payment:
   • Gross Amount: $100.00
   • Platform Fee (10%): $10.00
   • Processing Fee (~2.9%): $2.90
   • Net to Campaign: $87.10
   ↓
3. Ledger entries created:
   • DEPOSIT transaction: +$87.10 to campaign balance
   • FEE_COLLECTION: +$10.00 to platform revenue
   ↓
4. Campaign balance updated:
   • availableBalance += $87.10
   • platformFeesCollected += $10.00
   • totalRaised += $100.00
   ↓
5. Donor receives receipt showing:
   • Your donation: $100.00
   • To campaign: $87.10
   • Platform fee: $10.00
   • Processing fee: $2.90

┌─────────────────────────────────────────────────────────────────┐
│                  DISBURSEMENT FLOW                               │
└─────────────────────────────────────────────────────────────────┘

1. Campaign Leader requests disbursement: $500.00
   • Creates DisbursementRequest with purpose and receipts
   ↓
2. System validates:
   • Sufficient available balance?
   • Within daily limit?
   • Requires guardian approval?
   ↓
3a. If requires approval → Guardian notified
    • Guardian reviews request
    • Approves or rejects with reason
    ↓
3b. If auto-approved or after guardian approval:
    • DisbursementRequest status → APPROVED
    ↓
4. Bank Admin (or automated system) processes payout:
   • Initiates transfer to verified bank account
   • Creates DISBURSEMENT transaction: -$500.00
   ↓
5. Ledger updated:
   • availableBalance -= $500.00
   • disbursedTotal += $500.00
   ↓
6. Leader receives confirmation:
   • Funds deposited to account ending in XXXX
   • Expected arrival: 1-2 business days
   • Updated dashboard shows remaining balance
```

### Security Controls

1. **Multi-Factor Authentication**
   - Required for all financial operations
   - Biometric or authenticator app for mobile
   - Email/SMS verification for sensitive actions

2. **Approval Workflows**
   - Configurable thresholds (e.g., >$1000 requires guardian)
   - Cannot approve own requests
   - Time-based holds for large withdrawals

3. **Rate Limiting**
   - Maximum disbursements per day
   - Velocity checks for suspicious patterns
   - Manual review for first-time large requests

4. **Encryption**
   - PII encrypted at rest (AES-256)
   - Bank account details tokenized
   - TLS 1.3 for all data in transit

5. **Audit Logging**
   - All database queries logged
   - IP addresses and device fingerprints
   - Immutable append-only log storage

---

## API Design

### RESTful Endpoints

#### Authentication
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/verify-email
POST   /api/auth/verify-phone
GET    /api/auth/me
```

#### Campaigns
```
GET    /api/campaigns                    # List all public campaigns
POST   /api/campaigns                    # Create new campaign
GET    /api/campaigns/:slug              # Get campaign by slug
PUT    /api/campaigns/:id                # Update campaign
DELETE /api/campaigns/:id                # Archive campaign
GET    /api/campaigns/:id/analytics      # Real-time stats
POST   /api/campaigns/:id/updates        # Post campaign update
GET    /api/campaigns/:id/cheer-wall     # Get cheer messages
```

#### Donations
```
POST   /api/donations                    # Create donation
GET    /api/donations/:id                # Get donation details
POST   /api/donations/:id/refund         # Refund donation
GET    /api/campaigns/:id/donations      # List campaign donations
GET    /api/users/me/donations           # My donation history
```

#### Banking
```
GET    /api/banking/accounts/:id         # Get banking account
GET    /api/banking/accounts/:id/balance # Current balance
GET    /api/banking/accounts/:id/transactions  # Transaction history
POST   /api/banking/accounts/:id/verify-payout # Link bank account
```

#### Disbursements
```
POST   /api/disbursements                # Request disbursement
GET    /api/disbursements/:id            # Get disbursement details
PUT    /api/disbursements/:id/approve    # Approve request (guardian)
PUT    /api/disbursements/:id/reject     # Reject request
POST   /api/disbursements/:id/process    # Process payout (bank admin)
GET    /api/campaigns/:id/disbursements  # List all requests
```

#### Outreach
```
POST   /api/outreach/email               # Send email campaign
POST   /api/outreach/sms                 # Send SMS blast
GET    /api/outreach/templates           # Get message templates
POST   /api/outreach/schedule            # Schedule drip campaign
```

#### Referrals
```
GET    /api/referrals/my-codes           # Get my referral codes
POST   /api/referrals/track-click        # Track referral click
GET    /api/referrals/:code/stats        # Referral performance
```

---

## Wireframe & User Flow Descriptions

### 1. Campaign Creation Flow
```
Step 1: Organization Details
• Team/club name
• Category selection
• Description
• Fundraising goal

Step 2: Customization
• Upload logo
• Upload banner image
• Choose brand colors
• Preview campaign page

Step 3: Banking Setup
• Link bank account (Plaid or manual)
• Set approval thresholds
• Add guardian (optional)
• Verify identity (KYC)

Step 4: Team & Outreach
• Import team roster (CSV)
• Generate referral codes
• Customize email templates
• Set up SMS notifications

Step 5: Launch
• Review all settings
• Publish campaign
• Get shareable link
• Access dashboard
```

### 2. Donation Flow (Donor Perspective)
```
Step 1: Discover Campaign
• Browse campaigns or click shared link
• View campaign story, progress bar
• See cheer wall messages
• Check recent donors (if public)

Step 2: Choose Amount
• Suggested amounts ($25, $50, $100, Custom)
• See breakdown: donation, platform fee, total
• Optional: add to team member's referral

Step 3: Payment
• Enter card or ACH details
• Billing information
• Optional: leave message for cheer wall
• Checkbox: anonymous donation

Step 4: Confirmation
• Thank you message
• Donation receipt emailed
• Share buttons (social media)
• Option to set up recurring donation
```

### 3. Banking Dashboard (Campaign Leader)
```
Top Section: Overview Cards
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ Total Raised│ Platform Fee│  Available  │  Disbursed  │
│   $10,450   │   $1,045    │   $8,200    │   $1,205    │
│   ↑ 12%     │  (10%)      │             │             │
└─────────────┴─────────────┴─────────────┴─────────────┘

Middle Section: Recent Transactions
• Table showing donations, fees, disbursements
• Filters: date range, type, status
• Export to CSV

Bottom Section: Quick Actions
[Request Disbursement] [Send Campaign Update] [View Analytics]

Sidebar: Fund Distribution
• Pending requests (awaiting approval)
• Approved requests (in process)
• Completed disbursements
• Create new request button
```

### 4. Disbursement Request Flow
```
Step 1: Request Details
• Amount needed
• Purpose (dropdown + text)
• Expected expense date
• Upload receipts/invoices (optional)

Step 2: Review
• Current available balance
• Amount after this request
• Approval required? (Yes/No based on threshold)
• Estimated payout date

Step 3: Submit
• Confirm request
• Guardian notified (if applicable)
• Track status in dashboard

Guardian Approval Screen:
• View request details
• See requester and purpose
• Review receipts
• [Approve] or [Reject with reason]
```

### 5. Real-Time Analytics Dashboard
```
Graph Section:
• Donation timeline (daily/weekly/monthly)
• Donor acquisition funnel
• Referral performance
• Engagement metrics

Donor Insights:
• Top donors
• Average donation size
• Repeat donor rate
• Geographic distribution

Campaign Health:
• Days remaining
• Percentage to goal
• Velocity ($ per day)
• Predicted completion date

Team Performance:
• Individual fundraising leaderboard
• Referral code effectiveness
• Most engaging team members
```

---

## Privacy & Security Implementation

### Data Protection
1. **Minimal Data Collection**
   - Only collect what's necessary for service
   - Prompt for permission before optional data
   - Clear explanation of data usage

2. **Encryption**
   - All PII encrypted at rest (names, emails, phone, bank details)
   - Keys stored in secure vault (AWS KMS, HashiCorp Vault)
   - Automatic key rotation

3. **Access Controls**
   - Role-based access (RBAC)
   - Principle of least privilege
   - Audit all data access queries

4. **Data Retention**
   - Active campaigns: full data
   - Completed campaigns: anonymize donor PII after 7 years
   - Right to deletion: GDPR/CCPA compliant

### Privacy Policy Highlights
```
✓ Never sell or share donor data
✓ No third-party advertising
✓ Donors control communication preferences
✓ Transparent about platform fee usage
✓ Regular security audits
✓ Incident response plan
✓ Data portability on request
```

---

## Fee Transparency UX

### Donation Page
```
Your donation: $100.00
Platform fee (10%): $10.00
Processing fee: $2.90
───────────────────────
Total charged: $100.00
To campaign: $87.10

[i] Why do we charge a fee?
    • Secure banking infrastructure
    • Payment processing
    • Unlimited campaign updates
    • 24/7 support for campaigns
    • Platform development
```

### Campaign Dashboard
```
Total Raised: $10,450
├── Platform Fees (10%): $1,045
├── Processing Fees: $303
└── Net to Campaign: $9,102

Available Balance: $8,200
├── Already Disbursed: $1,205
└── Pending Requests: $697
```

### Donor Receipt Email
```
Thank you for your $100 donation to Lincoln High Robotics Team!

Donation Breakdown:
• Amount to campaign: $87.10
• Platform fee (10%): $10.00
• Payment processing: $2.90

Tax-deductible amount: $100.00*
Receipt #: DON-2024-123456

*If the organization is a registered 501(c)(3)
```

---

## MVP Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Set up monorepo structure (Turborepo)
- [ ] Initialize Next.js app with TypeScript
- [ ] Set up PostgreSQL + Prisma
- [ ] Implement authentication (Clerk)
- [ ] Design database schema and migrations
- [ ] Build basic UI components (shadcn/ui)

### Phase 2: Campaign Core (Week 3-4)
- [ ] Campaign creation flow
- [ ] Campaign customization (branding)
- [ ] Public campaign page
- [ ] Donation form with simulated payment
- [ ] Basic analytics dashboard
- [ ] Cheer wall implementation

### Phase 3: Banking System (Week 5-6)
- [ ] Banking account setup
- [ ] Internal ledger system
- [ ] Transaction recording
- [ ] Balance calculations
- [ ] Disbursement request flow
- [ ] Guardian approval workflow
- [ ] Banking dashboard UI

### Phase 4: Automation & Engagement (Week 7-8)
- [ ] Email notification system
- [ ] Campaign update publishing
- [ ] Referral code generation
- [ ] Referral tracking
- [ ] Automated thank-you emails
- [ ] SMS notifications (basic)

### Phase 5: Polish & Testing (Week 9-10)
- [ ] Mobile responsiveness
- [ ] Error handling and validation
- [ ] Security audit
- [ ] Performance optimization
- [ ] User testing with youth groups
- [ ] Documentation for users

### Phase 6: Investor Demo Ready (Week 11-12)
- [ ] Demo data and scenarios
- [ ] Pitch deck integration points
- [ ] Video demo production
- [ ] Public landing page
- [ ] Waitlist signup
- [ ] Metrics dashboard for business model

---

## Success Metrics

### Product Metrics
- Campaign creation completion rate
- Average donation size
- Donor return rate
- Referral conversion rate
- Time to first disbursement
- Dashboard engagement

### Business Metrics
- Total funds raised (GMV)
- Platform fee revenue
- Customer acquisition cost
- Campaign retention rate
- Net promoter score (NPS)

### Technical Metrics
- API response time (<200ms)
- Uptime (99.9%)
- Payment success rate (>98%)
- Zero data breaches
- Mobile performance score (>90)

---

## Next Steps

1. **Immediate**: Review and approve this architecture
2. **Set up development environment**: Install dependencies, configure database
3. **Begin Phase 1**: Initialize codebase structure
4. **Design mockups**: Create high-fidelity designs for key screens
5. **Build MVP**: Focus on campaign + banking core
6. **Test with real users**: Recruit 1-2 youth teams for beta
7. **Iterate**: Refine based on feedback
8. **Prepare pitch**: Use working MVP in investor meetings

---

## Questions to Resolve

1. **Legal**: Do you need to consult with a lawyer about:
   - Money transmitter licensing requirements
   - Tax receipt issuing (501c3 status)
   - Terms of service for minors
   - COPPA compliance for youth users

2. **Business Model**:
   - Is 10% fee competitive? (Snap! Raise charges more)
   - Tiered pricing for larger campaigns?
   - Additional revenue from premium features?

3. **Scope**:
   - Should MVP include mobile app or web-only first?
   - How robust should fraud detection be in MVP?
   - Multi-currency support needed?

Let's build something amazing!
