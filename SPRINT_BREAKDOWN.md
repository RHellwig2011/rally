s# Rally Sprint Planning - Detailed Weekly Breakdown

**Created**: November 21, 2025  
**Scope**: 12-week MVP Development Sprint  
**Target**: Production-ready fundraising platform

---

## Overview

This document provides **week-by-week implementation details** for the 12-week development sprint, building on the foundation completed in Phase 1. Each week includes:
- Specific tasks with hour estimates
- Daily focus areas
- Acceptance criteria
- Dependencies and blockers
- Testing requirements

---

## WEEKS 1-2: Campaign Management Foundation

### Week 1: Campaign Creation API & Core Roster

#### Daily Focus
- **Monday-Tuesday**: Campaign API validation layer
- **Wednesday**: Campaign database storage & retrieval
- **Thursday-Friday**: Campaign form frontend

#### Detailed Tasks

##### Campaign API Validation (8 hours)
**Owner**: Backend Lead  
**Files**: `app/api/campaigns/route.ts`, `lib/campaign-validation.ts` (new)

```typescript
// Validation requirements
POST /api/campaigns
{
  organizationName: string (required, 2-100 chars)
  teamName: string (required, 2-100 chars)
  slug: string (required, unique, 3-50 chars, lowercase, alphanumeric + hyphen)
  goalAmount: number (required, positive, decimal)
  startDate: Date (required, future)
  endDate: Date (required, after startDate)
  description: string (required, 10-1000 chars)
  primaryColor: string (hex color, required)
  secondaryColor: string (hex color, required)
}

Response:
{
  success: boolean
  campaignId: string (if success)
  errors: Record<string, string> (if errors)
}
```

**Checklist**:
- [ ] Create validation schema with Zod
- [ ] Test 50+ validation cases (invalid inputs)
- [ ] Test slug uniqueness constraint
- [ ] Test decimal precision for amounts
- [ ] Return clear error messages
- [ ] Log validation failures for debugging
- [ ] Rate limit: max 10 campaigns per user per day
- [ ] Test: authorized users only (middleware check)

##### Campaign Storage & Retrieval (6 hours)
**Owner**: Backend Lead  
**Files**: `app/api/campaigns/route.ts`, `prisma/schema.prisma`

```typescript
// Storage requirements
CREATE Campaign {
  id: string (UUID, primary key)
  slug: string (unique index)
  organizationName: string
  teamName: string
  goalAmount: Decimal
  startDate: DateTime
  endDate: DateTime
  description: string
  status: CampaignStatus (default: DRAFT)
  createdAt: DateTime
  updatedAt: DateTime
  campaignLeaderId: string (FK)
  
  // Calculated fields (views only)
  totalRaised: Decimal (from donations)
  donorCount: Int (from donations)
  teamMemberCount: Int (from team_members)
}
```

**Checklist**:
- [ ] Create database migration
- [ ] Test campaign creation in Prisma
- [ ] Test slug uniqueness constraint
- [ ] Get campaign by ID query
- [ ] Get campaign by slug query (for public pages)
- [ ] List campaigns by leader
- [ ] Update campaign (partial fields)
- [ ] Index slug and status for performance
- [ ] Test with 100+ campaigns

##### Campaign Form UX (6 hours)
**Owner**: Frontend Lead  
**Files**: `app/create-campaign/page.tsx`

**Current State Assessment**:
- ✅ 4-step form structure exists
- ✅ Form validation UI partially done
- 🟡 API integration incomplete
- 🟡 Error handling missing

**Implementation Tasks**:
- [ ] Add real-time slug validation
  - Show "Available" / "Already taken" indicator
  - Fetch from API as user types
  - Debounce API calls (500ms)
  
- [ ] Add step progress indicator
  - Show current step (e.g., "Step 2 of 4")
  - Show completed steps with checkmarks
  - Allow navigation back to previous steps
  
- [ ] Add field-level validation feedback
  - Show inline errors (red text)
  - Show helper text (gray, smaller font)
  - Disable submit until valid
  
- [ ] Add loading states
  - Show spinner during form submission
  - Disable all inputs while submitting
  - Show success message with campaign link
  
- [ ] Add error recovery
  - Display API errors clearly
  - Allow retry of failed submission
  - Pre-fill form with previous data
  
- [ ] Mobile optimization
  - Test on iPhone 12, Pixel 5
  - Ensure touch targets 44px minimum
  - Ensure form fits without horizontal scroll
  - Test on slow 3G connection

**Acceptance Criteria**:
- [ ] User can complete all 4 steps
- [ ] Form validates before submission
- [ ] Slug uniqueness checked in real-time
- [ ] Success redirects to dashboard
- [ ] Mobile fully responsive
- [ ] All error cases tested

---

#### Week 1 Testing (3 hours)

**Unit Tests** (add to test suite):
```typescript
// campaign-validation.test.ts
describe("Campaign Validation", () => {
  it("accepts valid campaign data")
  it("rejects invalid slug format")
  it("rejects goal amount <= 0")
  it("rejects end date before start date")
  it("rejects duplicate slug")
  it("returns clear error messages")
  it("rate limits to 10/day per user")
})
```

**Integration Tests**:
```typescript
// campaign-api.test.ts
describe("Campaign API", () => {
  it("creates campaign with valid data")
  it("retrieves campaign by ID")
  it("retrieves campaign by slug")
  it("lists all campaigns for user")
  it("returns 400 for invalid input")
  it("returns 409 for duplicate slug")
  it("requires authentication")
})
```

**Manual Testing Checklist**:
- [ ] Create campaign as authenticated user
- [ ] Try invalid slug (shows error)
- [ ] Try duplicate slug (shows error)
- [ ] Try negative goal amount (shows error)
- [ ] Try end date before start date (shows error)
- [ ] Create campaign successfully
- [ ] Verify campaign appears in database
- [ ] Retrieve campaign by slug on public page

---

### Week 2: Roster Management - Core Implementation

#### Daily Focus
- **Monday-Tuesday**: Roster API endpoints (add, list, update, delete)
- **Wednesday-Thursday**: CSV import functionality
- **Friday**: Roster UI components

#### Detailed Tasks

##### Roster API - Add & List (10 hours)
**Owner**: Backend Lead  
**Files**: `app/api/campaigns/[campaignId]/team-members/route.ts`

```typescript
// POST: Add team member
POST /api/campaigns/:campaignId/team-members
{
  name: string (required, 2-100 chars)
  email: string (required, valid email, unique per campaign)
  personalGoal: number (optional, positive decimal)
  position: string (optional, e.g., "Forward", "Goalkeeper")
  grade: string (optional, e.g., "12", "College")
  profilePhotoUrl: string (optional, URL)
}

Response (201):
{
  id: string
  campaignId: string
  name: string
  email: string
  personalGoal: number | null
  amountRaised: "0.00"
  invitationStatus: "PENDING"
  joinedAt: null
  uniqueFundraisingLink: string (base URL + code)
  fundLinkCode: string
  invitationSentAt: DateTime
}

// GET: List team members for campaign
GET /api/campaigns/:campaignId/team-members?page=1&limit=25&sortBy=amountRaised

Response (200):
{
  teamMembers: [
    {
      id: string
      name: string
      email: string
      personalGoal: number | null
      amountRaised: number
      invitationStatus: "PENDING" | "ACCEPTED" | "REJECTED"
      joinedAt: DateTime | null
      position: string | null
      grade: string | null
      profilePhotoUrl: string | null
    }
  ]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
```

**Implementation Checklist**:
- [ ] Generate unique fundraising link code (8 chars, URL-safe)
- [ ] Test collision avoidance for link codes (10,000 generated)
- [ ] Send invitation email on member creation
- [ ] Prevent duplicate emails per campaign
- [ ] Track invitation sent timestamp
- [ ] Index queries by campaignId and email for performance
- [ ] Validate email format
- [ ] Validate personalGoal (positive decimal)
- [ ] Test with 100+ team members
- [ ] Implement pagination for large rosters

##### Roster API - Update & Delete (6 hours)
**Owner**: Backend Lead  
**Files**: `app/api/campaigns/[campaignId]/team-members/[memberId]/route.ts`

```typescript
// PUT: Update team member
PUT /api/campaigns/:campaignId/team-members/:memberId
{
  name?: string
  personalGoal?: number | null
  position?: string | null
  grade?: string | null
  profilePhotoUrl?: string | null
  // NOTE: Email cannot be changed (for consistency)
}

// DELETE: Remove team member
DELETE /api/campaigns/:campaignId/team-members/:memberId
// Soft delete: mark deleted_at, preserve data for reporting
// Response: 204 No Content

// POST: Resend invitation
POST /api/campaigns/:campaignId/team-members/:memberId/resend-invite
Response:
{
  success: boolean
  message: string
  sentAt: DateTime
}
```

**Implementation Checklist**:
- [ ] Only campaign leader can update members
- [ ] Soft delete (set deletedAt, don't destroy data)
- [ ] Update timestamp on edit
- [ ] Prevent email changes
- [ ] Resend invitation email (max once per hour, prevent spam)
- [ ] Verify member still in PENDING status for resend
- [ ] Return proper 403 for unauthorized access
- [ ] Return proper 404 for non-existent member
- [ ] Test concurrency (multiple updates at once)

##### CSV Import (8 hours)
**Owner**: Backend Lead  
**Files**: `app/api/campaigns/[campaignId]/import-roster/route.ts`, `lib/csv-parser.ts` (new)

```typescript
// POST: Import roster from CSV
POST /api/campaigns/:campaignId/import-roster
Body: FormData with file field containing CSV

CSV Format (required headers):
name,email,personalGoal,position,grade
John Doe,john@example.com,500,Forward,12
Jane Smith,jane@example.com,250,Goalkeeper,12

Response (200):
{
  success: boolean
  summary: {
    totalRows: number
    successCount: number
    skipCount: number
    errorCount: number
  }
  results: {
    successful: [
      { row: number, name: string, email: string, reason: string }
    ]
    skipped: [
      { row: number, reason: string } // duplicate in campaign, invalid format, etc.
    ]
    errors: [
      { row: number, reason: string } // missing fields, invalid email, etc.
    ]
  }
}
```

**Implementation Checklist**:
- [ ] Parse CSV file (use fast-csv library)
- [ ] Validate headers (name, email required; others optional)
- [ ] Validate each row before importing any
- [ ] Prevent duplicates within import
- [ ] Prevent duplicates with existing campaign members
- [ ] Validate email format for each row
- [ ] Validate numeric fields (personalGoal if present)
- [ ] Return detailed error report (row numbers, reasons)
- [ ] Don't import any rows if errors found (atomic operation)
- [ ] Send invitation emails in bulk (background job)
- [ ] Max file size: 5 MB
- [ ] Max rows: 500 per import
- [ ] Rate limit: max 1 import per campaign per hour
- [ ] Test with:
  - [ ] Valid CSV with 100 rows
  - [ ] CSV with duplicate emails (should fail)
  - [ ] CSV with invalid emails (should fail specific rows)
  - [ ] CSV missing email column (should fail)
  - [ ] CSV with missing optional fields (should succeed)
  - [ ] Empty CSV file (should fail)
  - [ ] Very large CSV (5000 rows - should reject)

##### Roster UI Components (8 hours)
**Owner**: Frontend Lead  
**Files**: `app/dashboard/[campaignId]/roster/page.tsx`, `components/RosterUI.tsx` (new)

**Current State Assessment**:
- ✅ Roster page structure exists
- ✅ List table UI partially done
- 🟡 API integration incomplete
- ❌ CSV import UI missing

**Implementation Tasks**:
- [ ] Team member list table
  - Columns: Photo, Name, Email, Goal, Raised, Progress %, Status, Actions
  - Sortable by: Name, Amount Raised, Date Joined
  - Filterable by: Status (Pending/Accepted)
  - Search by: Name or Email
  - Pagination (25 per page)
  - Mobile: collapse columns, show essentials only
  
- [ ] Add member form
  - Inline form or modal
  - Fields: Name, Email, Personal Goal, Position, Grade
  - Phone number optional
  - Validation feedback (red borders, error text)
  - Submit button shows loading state
  - Success: toast notification + refresh list
  - Error: show error message with retry option
  
- [ ] CSV import UI
  - Drag-and-drop file upload area
  - "Choose file" button as fallback
  - Accept only CSV files
  - Show file name after selection
  - Preview: show first 5 rows before import
  - Import button (disabled until file selected)
  - Progress bar during import
  - Results screen showing:
    - Green: X successful imports
    - Orange: X skipped (duplicates, etc.)
    - Red: X errors with details
  - Option to download error report (CSV)
  
- [ ] Member actions menu
  - Edit member details
  - Resend invitation
  - Copy fundraising link (with tooltip "Copied!")
  - View member's donations (link to fundraiser page)
  - Remove member (with confirmation dialog)
  - Contact member (email template popup)
  
- [ ] Member detail view
  - Show full profile
  - Fundraising progress bar (Goal vs. Actual)
  - Recent donations list (last 5)
  - Invitation status and dates
  - Copy link button with QR code preview
  - Edit button
  - Delete button

**Acceptance Criteria**:
- [ ] Can add individual member
- [ ] Can import 50 members via CSV
- [ ] Can edit member details
- [ ] Can remove member
- [ ] Can resend invitation
- [ ] Can copy fundraising link
- [ ] Error cases handled gracefully
- [ ] Mobile fully responsive
- [ ] All actions require authorization

---

#### Week 2 Testing (3 hours)

**Unit Tests**:
```typescript
// roster-validation.test.ts
describe("Roster Validation", () => {
  it("validates email format")
  it("validates personalGoal is positive")
  it("rejects duplicate emails")
  it("validates CSV headers")
  it("parses CSV correctly")
  it("generates unique link codes")
})
```

**Integration Tests**:
```typescript
// roster-api.test.ts
describe("Roster API", () => {
  it("creates team member")
  it("lists team members for campaign")
  it("prevents duplicate emails in campaign")
  it("updates team member details")
  it("soft deletes team member")
  it("imports CSV with 100 rows")
  it("handles CSV import errors")
  it("resends invitation email")
})
```

**Manual Testing**:
- [ ] Add member one at a time
- [ ] Try adding duplicate email (should error)
- [ ] Import 50-row CSV successfully
- [ ] Import CSV with some invalid rows (should fail those rows only)
- [ ] Edit member personal goal
- [ ] Delete member (verify soft delete)
- [ ] Copy link, verify format
- [ ] Mobile: all fields visible and editable
- [ ] Mobile: file upload works

---

### Week 1-2 Summary

| Phase | Tasks | Hours | Status |
|-------|-------|-------|--------|
| Campaign API | Validation + Storage + Form | 20h | - |
| Roster API | Add/List + Update/Delete + CSV + UI | 32h | - |
| Testing | Unit + Integration + Manual | 6h | - |
| **Total** | **16 tasks across API + UI** | **58h** | - |

**Definition of Done**:
- [ ] Coaches can create campaigns
- [ ] Coaches can add team members individually
- [ ] Coaches can import rosters via CSV
- [ ] All API endpoints tested (> 90% pass rate)
- [ ] UI fully responsive on mobile
- [ ] 0 critical bugs

---

## WEEKS 3-4: Campaign Dashboard & Analytics

### Week 3: Dashboard API & Real-Time Data

#### Daily Focus
- **Monday-Tuesday**: Dashboard aggregation queries
- **Wednesday**: Real-time update mechanism
- **Thursday-Friday**: Caching layer implementation

#### Detailed Tasks

##### Dashboard API Endpoints (10 hours)
**Owner**: Backend Lead  
**Files**: `app/api/campaigns/[campaignId]/stats/route.ts` (new)

```typescript
// GET: Campaign overview data
GET /api/campaigns/:campaignId

Response:
{
  id: string
  name: string
  slug: string
  description: string
  goalAmount: number
  totalRaised: number
  donorCount: number
  teamMemberCount: number
  progress: number // percentage
  status: CampaignStatus
  startDate: DateTime
  endDate: DateTime
  daysRemaining: number
  primaryColor: string
  secondaryColor: string
  createdAt: DateTime
  updatedAt: DateTime
}

// GET: Detailed statistics
GET /api/campaigns/:campaignId/stats

Response:
{
  overview: {
    totalRaised: number
    goalAmount: number
    percentageComplete: number
    donationCount: number
    uniqueDonors: number
    averageDonation: number
    largestDonation: number
  }
  timeline: [
    {
      date: Date
      amount: number
      cumulativeAmount: number
      donationCount: number
    }
  ] // last 30 days, grouped by day
  topTeamMembers: [
    {
      id: string
      name: string
      position: string | null
      personalGoal: number | null
      amountRaised: number
      donationCount: number
      rank: number
    }
  ] // top 10
  recentDonors: [
    {
      id: string
      name: string | null
      amount: number
      date: DateTime
      message: string | null
    }
  ] // last 10 non-anonymous
}

// GET: Recent activity feed
GET /api/campaigns/:campaignId/activity

Response:
{
  activities: [
    {
      id: string
      type: "donation" | "member_joined" | "goal_milestone" | "update_posted"
      description: string
      relatedData: any
      timestamp: DateTime
    }
  ]
  pagination: { page, limit, total }
}
```

**Implementation Checklist**:
- [ ] Query total raised (sum of completed donations)
- [ ] Query donor count (unique non-anonymous donors)
- [ ] Query team member count
- [ ] Calculate progress percentage
- [ ] Query donations by day (last 30 days)
- [ ] Get top 10 team members by amount
- [ ] Get last 10 donations
- [ ] Optimize queries (add indexes):
  - [ ] Index on campaignId + status for donations
  - [ ] Index on campaignId + createdAt for activity timeline
  - [ ] Index on campaignId + amount for sorting
- [ ] Use database views or aggregation pipeline for complex queries
- [ ] Test performance: < 500ms response time with 1000+ donations
- [ ] Test performance: < 500ms response time with 100+ team members

##### Real-Time Updates (8 hours)
**Owner**: Backend Lead  
**Files**: `app/api/webhooks/donation-updated/route.ts` (new), `lib/realtime.ts` (new)

**Design Choice**: Use Server-Sent Events (SSE) for simplicity, or polling as fallback

```typescript
// Server-Sent Events endpoint
GET /api/campaigns/:campaignId/stream

Client connects and receives events:
event: donation
data: { id, amount, donor, teamMemberId, timestamp }

event: memberJoined
data: { id, name, email, timestamp }

event: goalReached
data: { amount, timestamp }
```

**Implementation Checklist**:
- [ ] Set up SSE endpoint for campaign updates
- [ ] Broadcast donation events to all connected clients
- [ ] Broadcast member joined events
- [ ] Broadcast milestone events (25%, 50%, 75%, 100% of goal)
- [ ] Handle client reconnection gracefully
- [ ] Implement fallback polling (every 30 seconds if SSE fails)
- [ ] Add heartbeat to keep connection alive
- [ ] Test with 100 concurrent connections
- [ ] Memory usage acceptable (< 10MB per 1000 connections)
- [ ] Disconnect clients after 30 min of inactivity

##### Caching Layer (6 hours)
**Owner**: Backend Lead  
**Files**: `lib/cache.ts` (new)

```typescript
// Use Redis for caching (or in-memory for MVP)
// Cache strategy:
// - Dashboard stats: 5 minute TTL
// - Recent donations: 1 minute TTL
// - Team member list: 5 minute TTL
// - Campaign overview: 5 minute TTL

// Invalidation:
// - On new donation: invalidate dashboard stats + recent donations
// - On new member: invalidate team member list
// - On update: invalidate campaign overview

Cache keys:
campaign:stats:{campaignId}
campaign:donations:recent:{campaignId}
campaign:members:{campaignId}:page:{page}
campaign:overview:{campaignId}
```

**Implementation Checklist**:
- [ ] Choose cache backend (Redis recommended, or node-cache for MVP)
- [ ] Implement cache decorator/wrapper
- [ ] Set up cache invalidation on mutations
- [ ] Add cache hit/miss metrics
- [ ] Test cache consistency (invalidate on update)
- [ ] Test with high load (1000+ requests/min)
- [ ] Implement cache warming on startup
- [ ] Monitor cache memory usage
- [ ] Set up cache eviction policy (LRU)

---

### Week 4: Dashboard UI & Mobile Optimization

#### Daily Focus
- **Monday-Tuesday**: Dashboard UI implementation
- **Wednesday**: Real-time integration (SSE/polling)
- **Thursday-Friday**: Mobile optimization + testing

#### Detailed Tasks

##### Dashboard UI (12 hours)
**Owner**: Frontend Lead  
**Files**: `app/dashboard/[campaignId]/page.tsx`

**Current State Assessment**:
- ✅ Page structure exists
- ✅ Charts library imported (recharts)
- 🟡 Data fetching incomplete
- 🟡 Real-time updates not hooked up

**Implementation Tasks**:
- [ ] Campaign header card
  - Campaign name and description
  - Logo/banner if provided
  - Goal vs. Total raised (large font)
  - Progress bar (color gradient)
  - Days remaining timer
  - Campaign status badge
  
- [ ] Key metrics cards
  - Total raised ($XXX)
  - Total donors (XX)
  - Team members (XX)
  - Average donation ($XX)
  - Largest donation ($XX)
  
- [ ] Fundraising progress chart
  - Line chart: cumulative $ raised over time
  - X-axis: last 30 days
  - Y-axis: dollar amount
  - Hover shows exact amount and date
  - Mobile: scrollable on small screens
  
- [ ] Top fundraisers leaderboard
  - Rank, name, position, goal, raised, % of goal
  - Sortable by: amount raised, % of goal
  - Show top 10 only
  - Expand button for "view all"
  
- [ ] Recent donations feed
  - Show last 10 donations
  - Format: "$100 from John (for Jane) - 2 hours ago"
  - Anonymous donations show "$100 from Anonymous"
  - Message preview (truncated)
  - Expand donation to see full details
  - Real-time: new donations appear at top
  
- [ ] Action buttons
  - Share campaign (social media)
  - Manage roster (link to roster page)
  - Request payout (if eligible)
  - Campaign settings (edit, pause, etc.)
  - Send update (post to donors/members)
  
- [ ] Campaign status badges
  - DRAFT: "This campaign is in draft mode"
  - ACTIVE: "Campaign is live!"
  - PAUSED: "Campaign is temporarily paused"
  - COMPLETED: "Campaign has ended"
  - Show relevant actions for each status

**Acceptance Criteria**:
- [ ] All data displays correctly
- [ ] Charts render properly
- [ ] Data updates in real-time (or every 30s)
- [ ] Mobile fully responsive
- [ ] Performance < 2s load time
- [ ] Accessibility: all sections have proper headings
- [ ] All links work

##### Real-Time Integration (6 hours)
**Owner**: Frontend Lead  
**Files**: `app/dashboard/[campaignId]/page.tsx`, `hooks/useDashboardStream.ts` (new)

```typescript
// Custom hook for real-time updates
const useDashboardStream = (campaignId: string) => {
  useEffect(() => {
    const eventSource = new EventSource(
      `/api/campaigns/${campaignId}/stream`
    );

    eventSource.addEventListener("donation", (event) => {
      const donation = JSON.parse(event.data);
      // Update state: add to recent donations, update totals
    });

    eventSource.addEventListener("memberJoined", (event) => {
      const member = JSON.parse(event.data);
      // Update state: increment member count, add to leaderboard
    });

    eventSource.addEventListener("goalReached", (event) => {
      // Update state: show celebration, update progress bar to 100%
    });

    return () => eventSource.close();
  }, [campaignId]);
};
```

**Implementation Checklist**:
- [ ] Set up EventSource connection on mount
- [ ] Parse incoming events
- [ ] Update React state for real-time changes
- [ ] Show celebration UI when milestone reached
- [ ] Reconnect if connection drops
- [ ] Show fallback polling indicator if SSE unavailable
- [ ] Close connection on unmount
- [ ] Test with slow network (throttle in DevTools)

##### Mobile Optimization (4 hours)
**Owner**: Frontend Lead  
**Files**: All dashboard files

**Testing Checklist**:
- [ ] Test on iPhone 12 (vertical)
- [ ] Test on iPhone 12 (horizontal)
- [ ] Test on Pixel 5 (vertical)
- [ ] Test on Pixel 5 (horizontal)
- [ ] Test on iPad (vertical)
- [ ] Charts readable on small screens
- [ ] All buttons/links have 44px touch targets
- [ ] No horizontal overflow
- [ ] Text size readable (min 16px on mobile)
- [ ] Use stack layout (vertical) on mobile, grid on desktop
- [ ] Collapse unnecessary elements on mobile
- [ ] Performance on slow 3G network
- [ ] Test with browser DevTools throttling

---

#### Week 3-4 Testing (4 hours)

**Integration Tests**:
```typescript
// dashboard.test.ts
describe("Dashboard", () => {
  it("displays correct campaign totals")
  it("displays correct team member count")
  it("displays correct donor count")
  it("shows recent donations")
  it("shows top team members")
  it("updates real-time on new donation")
  it("shows milestone celebration")
  it("handles missing data gracefully")
})
```

**Performance Tests**:
- [ ] Dashboard load time < 2s
- [ ] API response time < 500ms
- [ ] Chart render time < 500ms
- [ ] Real-time event processing < 100ms
- [ ] Mobile: Performance with slow 3G

**Manual Testing**:
- [ ] View campaign dashboard
- [ ] Make test donation, see update in real-time
- [ ] Add team member, see count increase
- [ ] Mobile responsiveness on all devices
- [ ] Chart interactivity (hover, zoom)
- [ ] All links/buttons work

---

### Weeks 3-4 Summary

| Phase | Tasks | Hours | Status |
|-------|-------|-------|--------|
| Dashboard API | Stats endpoints + Real-time + Caching | 24h | - |
| Dashboard UI | Components + Charts + Real-time integration | 22h | - |
| Testing | Integration + Performance + Manual | 4h | - |
| **Total** | **12 main features** | **50h** | - |

**Definition of Done**:
- [ ] Dashboard displays accurate data
- [ ] Real-time updates working
- [ ] Performance targets met
- [ ] Mobile fully responsive
- [ ] 0 critical bugs
- [ ] All integration tests pass

---

## WEEKS 5-9: Payment Processing (32 Hours/Week)

### Overview for Payment Weeks
Weeks 5-9 focus on implementing Stripe payment processing with full error handling, security, and compliance. This is the most critical phase for MVP success.

**Key Outcomes**:
- Donors can donate via Stripe
- Payments secure and PCI compliant
- Real-time balance updates
- Webhook processing working
- Error recovery implemented

**Sprint Duration**: 5 weeks = 160 total hours

---

### Week 5: Donation API & Stripe Integration

#### Daily Focus
- **Monday-Tuesday**: Donation API core endpoints
- **Wednesday-Thursday**: Stripe payment intent flow
- **Friday**: Error handling & webhook setup

#### Key Tasks

##### Donation API Endpoints (10 hours)
**Owner**: Backend Lead

```typescript
// POST: Create donation
POST /api/donations
{
  campaignId: string (required)
  teamMemberId?: string (optional - specific member or campaign-level)
  amount: number (required, positive, $1-$100,000)
  donorName: string (required if anonymous, optional if email provided)
  donorEmail: string (required)
  donorPhone?: string (optional)
  message?: string (optional, max 500 chars)
  isAnonymous: boolean (default: false)
}

Response:
{
  donationId: string
  clientSecret: string // for Stripe
  amount: number
  currency: "USD"
  status: "pending"
}

// GET: Donation status
GET /api/donations/:donationId

Response:
{
  id: string
  campaignId: string
  teamMemberId: string | null
  amount: number
  donorName: string
  donorEmail: string
  status: "pending" | "completed" | "failed" | "refunded"
  stripePaymentIntentId: string
  createdAt: DateTime
}

// POST: Verify donation (after client Stripe flow)
POST /api/donations/:donationId/verify
{
  stripePaymentIntentId: string (to verify against database)
}

Response:
{
  success: boolean
  status: "completed" | "failed"
  message: string
}
```

**Implementation Checklist**:
- [ ] Validate donation amount (positive, within limits)
- [ ] Validate email format
- [ ] Validate donorName if anonymous
- [ ] Check campaign is ACTIVE
- [ ] Check campaign end date hasn't passed
- [ ] Create donation record with status: "pending"
- [ ] Generate unique donation ID
- [ ] Return success with clientSecret
- [ ] Handle validation errors (400)
- [ ] Handle campaign not found (404)
- [ ] Rate limiting: max 20 donations per IP per hour
- [ ] Log all donation attempts for auditing

##### Stripe Integration - Payment Intent (12 hours)
**Owner**: Backend Lead  
**Files**: `lib/stripe.ts`

```typescript
// Initialize Stripe
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Create payment intent
async function createPaymentIntent(
  amount: number,
  campaignId: string,
  donationId: string
) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // convert to cents
    currency: "usd",
    payment_method_types: ["card"],
    metadata: {
      campaignId,
      donationId,
      platform: "rally",
    },
    // For SCA/3D Secure
    confirmation_method: "manual",
    confirm: false,
  });

  return paymentIntent;
}

// Confirm payment intent (after client-side token)
async function confirmPaymentIntent(
  paymentIntentId: string,
  paymentMethodId: string
) {
  const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
    payment_method: paymentMethodId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/donation-success`,
  });

  return paymentIntent;
}
```

**Implementation Checklist**:
- [ ] Initialize Stripe with secret key
- [ ] Create payment intent on donation creation
- [ ] Store Stripe payment intent ID in donation record
- [ ] Handle 3D Secure / SCA authentication
- [ ] Confirm payment intent after client token
- [ ] Update donation status based on payment intent status
- [ ] Handle payment decline (status: requires_payment_method)
- [ ] Handle payment success (status: succeeded)
- [ ] Store charge ID for refund processing
- [ ] Test with all Stripe test cards:
  - [ ] 4242 4242 4242 4242 (success)
  - [ ] 4000 0000 0000 0002 (decline)
  - [ ] 4000 0025 0000 3155 (3D Secure required)
  - [ ] 5555 5555 5555 4444 (Mastercard success)
- [ ] Test in test mode (don't hit production)
- [ ] Idempotency: prevent duplicate charges if request retried

##### Webhook Processing (8 hours)
**Owner**: Backend Lead  
**Files**: `app/api/webhooks/stripe/route.ts`

```typescript
// Stripe webhook endpoint
POST /api/webhooks/stripe

// Handle events:
1. payment_intent.succeeded
   - Find donation by paymentIntentId
   - Update donation status to "completed"
   - Update campaign total raised
   - Update team member amount raised
   - Send confirmation email
   - Trigger thank-you message

2. payment_intent.payment_failed
   - Find donation by paymentIntentId
   - Update donation status to "failed"
   - Log failure reason
   - Send error email to donor

3. charge.refunded
   - Find donation by chargeId
   - Update donation status to "refunded"
   - Reverse transaction
   - Update balances

4. charge.dispute.created
   - Find donation by chargeId
   - Create dispute record
   - Notify admin
   - Update donation status to "disputed"
```

**Implementation Checklist**:
- [ ] Verify webhook signature (prevent spoofing)
- [ ] Handle webhook signature verification error (403)
- [ ] Parse webhook body
- [ ] Extract data from event
- [ ] Find corresponding donation record
- [ ] Update donation status atomically
- [ ] Update campaign/member balances
- [ ] Send appropriate emails
- [ ] Log all webhook events
- [ ] Idempotent: handle duplicate webhooks safely
- [ ] Return 200 immediately (async processing)
- [ ] Implement webhook event queue if needed
- [ ] Test with Stripe CLI webhook simulation:
  ```bash
  stripe listen --forward-to localhost:3000/api/webhooks/stripe
  stripe trigger payment_intent.succeeded
  ```

---

#### Week 5 Testing (3 hours)

**Manual Testing Checklist**:
- [ ] Create donation with test card
- [ ] Donation appears with "pending" status
- [ ] Webhook received and processed
- [ ] Donation updates to "completed"
- [ ] Campaign total updated
- [ ] Team member total updated
- [ ] Confirmation email sent
- [ ] Declined card handled properly
- [ ] Duplicate webhook handled (not double-charged)

---

### Week 6: Donation Form UI & Error Handling

#### Daily Focus
- **Monday-Wednesday**: Complete donation form UI
- **Thursday-Friday**: Error handling & email confirmations

#### Key Tasks

##### Donation Form UI (12 hours)
**Owner**: Frontend Lead  
**Files**: `components/DonationForm.tsx`

**Current State Assessment**:
- 🟡 Component exists but incomplete
- ❌ Stripe Elements not integrated
- ❌ Real-time validation missing
- ❌ Error handling incomplete

**Implementation Tasks**:
- [ ] Form layout
  - Header: Campaign info (name, goal, progress)
  - Header: Team member info if applicable (photo, name, personal goal)
  - Step 1: Donation amount
  - Step 2: Donor details
  - Step 3: Payment method (Stripe card element)
  - Step 4: Confirmation
  
- [ ] Amount selection UI
  - Quick buttons: $25, $50, $100, $250
  - "Other amount" input field
  - Show platform fee calculation: "$X donation = $Y after fees"
  - Validation: amount > 0, < 100000, multiple of 0.01
  - Mobile: full-width buttons
  
- [ ] Donor details form
  - Full name (required, min 2 chars)
  - Email (required, valid format)
  - Phone (optional)
  - Message (optional, max 500 chars, live character count)
  - Anonymous checkbox (hides name on donor list)
  - Inline validation (red borders, error text)
  
- [ ] Stripe card element
  - Use @stripe/react-stripe-js
  - Styled to match Rally branding
  - CardElement with brand icon
  - Real-time validation as user types
  - Show error messages for invalid cards
  - Postal code optional
  
- [ ] Submission flow
  - Review step: show summary before payment
  - "Donate Now" button
  - Button shows loading spinner while processing
  - All fields disabled during submission
  - Show "Processing payment..." message
  
- [ ] Success screen
  - Confirmation number
  - Thank you message
  - Donation receipt option (email)
  - Social share buttons (Facebook, Twitter, WhatsApp)
  - "Back to campaign" button
  - Show message to team member if applicable
  
- [ ] Error screens
  - Card declined: show friendly message + reason
  - Network error: allow retry
  - 3D Secure required: show authentication flow
  - Session expired: show "Please reload and try again"
  - All errors have "Try again" button

**Acceptance Criteria**:
- [ ] Can complete full donation flow
- [ ] Card validation works
- [ ] Success/error states display properly
- [ ] Mobile fully responsive
- [ ] Accessibility: form properly labeled
- [ ] Performance < 2s load time

##### Error Handling & Recovery (8 hours)
**Owner**: Backend + Frontend Lead

**Error Scenarios to Handle**:

1. **Card Declined Errors**
   - Display: "Your card was declined. Please try another card or contact your bank."
   - Actions: Allow retry, suggest other payment method
   
2. **Network Errors**
   - Display: "Connection lost. Please check your internet and try again."
   - Actions: Retry button, save draft option
   
3. **3D Secure / SCA Required**
   - Display: "Please complete the additional security step to continue."
   - UI: Iframe for authentication
   - Actions: Continue after authentication
   
4. **Invalid Email**
   - Display: "Please enter a valid email address."
   - Actions: Clear field, allow re-entry
   
5. **Campaign Ended**
   - Display: "This campaign has ended. Thank you for your interest!"
   - Actions: Browse other campaigns
   
6. **Invalid Amount**
   - Display: "Please enter an amount between $1 and $100,000."
   - Actions: Clear field, allow re-entry
   
7. **Duplicate Prevention**
   - Server: Prevent double-submit via idempotency key
   - Client: Disable submit button after click
   - Message: "This donation is being processed..."
   
8. **Server Errors (500)**
   - Display: "We experienced an issue. Please try again later."
   - Log: Send error to Sentry
   - Actions: Retry, contact support

**Implementation Checklist**:
- [ ] Client-side validation (inline feedback)
- [ ] Server-side validation (all fields)
- [ ] Duplicate submission prevention
- [ ] Stripe error mapping to user-friendly messages
- [ ] Network timeout handling (30s timeout)
- [ ] Retry mechanism for transient failures
- [ ] Error logging to Sentry (client + server)
- [ ] User feedback: toast notifications
- [ ] All error messages clear and actionable

##### Donation Confirmation Email (4 hours)
**Owner**: Backend Lead  
**Files**: `lib/email.ts`

**Email Template Requirements**:
- Professional HTML design
- Rally branding (colors, logo)
- Donation details (amount, recipient, date)
- Receipt information
- Tax deduction info (if applicable)
- Link to view campaign
- Social sharing buttons
- Footer with support info

**Email Content**:
```
Subject: Your donation to [Campaign Name] - Thank you!

Body:
Dear [Donor Name],

Thank you for your generous donation of $[Amount] to [Campaign Name]!

Your contribution will help [Team] achieve their fundraising goal of $[Goal Amount].

Donation Details:
- Campaign: [Campaign Name]
- Amount: $[Amount]
- Date: [Date/Time]
- Recipient: [Team Member Name] (if specific member)
- Donation ID: [Unique ID] (for tracking)

Next Steps:
- View the campaign: [Link]
- Share with friends: [Social links]
- [Tax info if applicable]

Thank you for your support!

The Rally Team
```

**Implementation Checklist**:
- [ ] Email template created
- [ ] Sent immediately after payment confirmation
- [ ] Include donation ID for tracking
- [ ] Include tax deduction info
- [ ] Include unsubscribe link (if future communications)
- [ ] Test with multiple email providers
- [ ] Verify email arrives within 1 minute
- [ ] Mobile-responsive design
- [ ] All links clickable and working

---

#### Week 6 Testing (3 hours)

**Manual Testing**:
- [ ] Complete donation with valid card
- [ ] Try declined card (4000 0000 0000 0002)
- [ ] Try 3D Secure card (4000 0025 0000 3155)
- [ ] Invalid email (show error)
- [ ] Network error (simulate with DevTools, test retry)
- [ ] Successful donation email received
- [ ] Confirmation page displays correctly
- [ ] Mobile checkout works on iPhone and Android

---

### Weeks 7-9: Advanced Payment Features & Testing

**Duration**: 3 weeks  
**Focus**: Recurring donations, security hardening, comprehensive testing

**Key Deliverables**:
1. Recurring donation capability (optional but recommended)
2. PCI compliance verification
3. Comprehensive payment security tests
4. Integration testing of full donation flow
5. Production readiness validation

**Tasks Overview**:
- Week 7: Recurring donations API + UI
- Week 8: Payment security audit + testing
- Week 9: Integration testing + bug fixes

*(Detailed breakdowns follow in sprint planning documents)*

---

## WEEKS 10-12: Admin Dashboard & Disbursements

**Duration**: 3 weeks  
**Focus**: Campaign management, payout requests, admin controls

**Key Deliverables**:
1. Campaign status management
2. Disbursement request workflow
3. Admin dashboard with metrics
4. Banking details & ACH setup
5. Admin settings interface

*(Detailed breakdowns follow in sprint planning documents)*

---

## WEEKS 13-16: Testing, Security & Launch Prep

**Duration**: 4 weeks  
**Focus**: Comprehensive testing, security hardening, production deployment

**Key Deliverables**:
1. 100+ test cases (unit + integration + E2E)
2. Security audit completed
3. Performance optimization done
4. Documentation completed
5. Production environment ready

*(Detailed breakdowns provided in `CONTINUATION_ROADMAP.md` sections 5.1-5.4)*

---

## Quick Reference: Sprint Checklist

### End-of-Sprint Acceptance Criteria

**Sprint 1-2 (Campaign + Roster)**
- [ ] Create campaign works end-to-end
- [ ] Add team members (individual + CSV import)
- [ ] Campaign appears on dashboard
- [ ] All API endpoints tested
- [ ] Mobile responsive

**Sprint 3 (Dashboard)**
- [ ] Dashboard shows real-time data
- [ ] Charts render correctly
- [ ] Performance < 500ms
- [ ] Mobile optimized

**Sprint 4-5 (Payments)**
- [ ] End-to-end donation works
- [ ] Confirmation email sent
- [ ] Webhook processing works
- [ ] Error handling complete
- [ ] Stripe tests pass

**Sprint 6-7 (Admin)**
- [ ] Campaign management working
- [ ] Disbursement requests functional
- [ ] Admin dashboard displaying data
- [ ] Banking details secured

**Sprint 8-9 (Testing)**
- [ ] 60+ unit tests passing
- [ ] 40+ integration tests passing
- [ ] 20+ E2E scenarios working
- [ ] 0 critical bugs
- [ ] Performance targets met

**Sprint 10-12 (Launch Prep)**
- [ ] Security audit complete
- [ ] Documentation done
- [ ] Production environment ready
- [ ] CI/CD pipeline active
- [ ] Go-live approved

---

## Appendix: Technology Stack Reference

### Backend
- **Runtime**: Node.js
- **Framework**: Next.js API routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT + Refresh tokens
- **Real-time**: Server-Sent Events (or WebSockets)
- **Caching**: Redis (or node-cache for MVP)
- **Email**: Resend.com
- **SMS** (optional): Twilio

### Frontend
- **Framework**: Next.js 14 with React 18
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Components**: Shadcn/ui
- **Charts**: Recharts
- **State**: Zustand + React Query
- **Forms**: React Hook Form + Zod
- **Payments**: @stripe/react-stripe-js

### Infrastructure
- **Hosting**: Vercel (frontend) + AWS/Fly (backend)
- **Database**: AWS RDS PostgreSQL
- **File Storage**: AWS S3
- **CDN**: Cloudflare
- **Monitoring**: Sentry (errors) + Vercel Analytics
- **CI/CD**: GitHub Actions

### Tools & Services
- **Version Control**: GitHub
- **Task Management**: GitHub Projects
- **Payments**: Stripe
- **Email**: Resend
- **Testing**: Jest, Playwright
- **Documentation**: Markdown

---

*Last Updated: November 21, 2025*  
*Created for Rally MVP Development*
