# Rally - Continuation Roadmap
## From Current State to Production-Ready MVP

**Last Updated**: November 21, 2025  
**Current Phase**: MVP Foundation - Auth & Schema Complete ✅  
**Target MVP Launch**: Q1 2026 (12-16 weeks from now)

---

## Executive Summary

The Rally platform has successfully completed **Phase 1** (Foundation & Core Infrastructure) with:
- ✅ Full Prisma database schema designed and implemented
- ✅ Comprehensive authentication system (email verification, password reset, RBAC)
- ✅ JWT + rotating refresh token security
- ✅ Basic UI structure for all user roles
- ✅ Stripe integration foundation
- ✅ Campaign and donation flow infrastructure

**This roadmap focuses on completing Phases 2-4 to achieve a production-ready MVP**, bringing the platform from 25% complete to 85% complete (launch-ready).

---

## Current Project State Assessment

### Infrastructure & Architecture
| Component | Status | Notes |
|-----------|--------|-------|
| Database Schema | ✅ Complete | Prisma schema fully designed with 20+ tables |
| Authentication | ✅ Complete | JWT, refresh tokens, email verification, password reset |
| RBAC System | ✅ Complete | 5 roles implemented with middleware protection |
| API Structure | ✅ Partial | Routes exist; need comprehensive error handling |
| Frontend Framework | ✅ Complete | Next.js 14, TypeScript, Tailwind CSS |
| UI Components | ✅ Partial | Shadcn/ui components in place; need more polish |

### Core Features Implemented
| Feature | Status | % Complete |
|---------|--------|------------|
| User Registration | ✅ | 100% |
| User Login | ✅ | 100% |
| Email Verification | ✅ | 100% |
| Password Reset | ✅ | 100% |
| Campaign Creation | 🟡 | 70% (UI done, API validation incomplete) |
| Campaign Dashboard | 🟡 | 60% (UI frame, data fetching incomplete) |
| Donation Form | 🟡 | 50% (UI done, Stripe integration partial) |
| Roster Management | 🟡 | 40% (UI done, API incomplete) |
| Stripe Integration | 🟡 | 30% (framework only) |
| Disbursements | ❌ | 5% (UI only) |
| Admin Dashboard | ❌ | 10% (placeholder) |

---

## Phase 2: Campaign & Roster Management (Weeks 1-4)
### Goal: Enable coaches to create and manage campaigns with team rosters

### 2.1 Campaign Creation Flow - Complete Implementation
**Priority**: 🔴 CRITICAL  
**Estimated Time**: 16 hours  
**Owner**: Full-stack engineer

#### Tasks
- [ ] **2.1.1 Campaign API Validation**
  - Add comprehensive validation to `POST /api/campaigns`
  - Fields: organizationName, teamName, slug, goalAmount, startDate, endDate, description
  - Validate slug uniqueness (no duplicates)
  - Validate goal amount (must be positive)
  - Validate date ranges (endDate > startDate)
  - Test with 50+ test cases
  - Return 400/422 with clear error messages

- [ ] **2.1.2 Campaign Storage & Retrieval**
  - Implement campaign creation in database
  - Generate unique campaign ID
  - Store campaign settings (colors, description, etc.)
  - Test retrieval by ID and slug
  - Add proper error handling for duplicate slugs

- [ ] **2.1.3 Campaign Form UX Polish**
  - Add real-time slug generation/validation
  - Add progress indicators (step 1/4, 2/4, etc.)
  - Add field-level validation feedback
  - Add loading states during submission
  - Add success confirmation screen
  - Test on mobile and desktop

- [ ] **2.1.4 Acceptance Tests**
  - Coach can create campaign with all fields
  - Invalid inputs show helpful error messages
  - Unique slug enforcement works
  - Redirects to dashboard after creation
  - Mobile form responsive and usable

---

### 2.2 Campaign Dashboard - Data Layer
**Priority**: 🔴 CRITICAL  
**Estimated Time**: 12 hours  
**Owner**: Full-stack engineer

#### Tasks
- [ ] **2.2.1 Dashboard API Endpoints**
  - `GET /api/campaigns/:campaignId` - Full campaign data with aggregations
    - Return: campaign details, total raised, donor count, team member count, fundraising progress
    - Include real-time calculations
    - Test data accuracy
  
  - `GET /api/campaigns/:campaignId/stats` - Time-series fundraising data
    - Return: donations by day for last 30 days
    - Return: top 10 players by amount
    - Return: donor metrics (new, repeat, total)
  
  - `GET /api/campaigns/:campaignId/recent-donations` - Recent activity feed
    - Return: last 20 donations with donor name (if not anonymous), amount, time

- [ ] **2.2.2 Dashboard Data Calculations**
  - Implement accurate aggregations in database queries
  - Test calculation accuracy with sample data (100+ donations)
  - Add caching layer for expensive queries (update every 5 minutes)
  - Performance test: responses < 500ms

- [ ] **2.2.3 Dashboard UI Integration**
  - Connect dashboard page to new API endpoints
  - Display real-time campaign stats
  - Show fundraising progress bar
  - Display recent donation feed
  - Show member leaderboard
  - Add refresh button and auto-refresh every 30 seconds

- [ ] **2.2.4 Acceptance Tests**
  - Dashboard shows correct totals
  - Data updates in real-time
  - Performance acceptable on slow connections
  - Mobile view properly responsive
  - Coach can only see own campaigns

---

### 2.3 Team Roster Management - Complete Implementation
**Priority**: 🔴 CRITICAL  
**Estimated Time**: 20 hours  
**Owner**: Full-stack engineer

#### Tasks
- [ ] **2.3.1 Roster API - Add Team Members**
  - `POST /api/campaigns/:campaignId/team-members` - Add new member
    - Accept: name, email, personalGoal, position, grade, profilePhotoUrl
    - Generate unique fundraising link code (8 chars, URL-safe)
    - Send invitation email to team member
    - Return created member with link code
    - Test duplicate email handling

  - Validation:
    - Email must be valid format
    - Name required (2-100 chars)
    - Personal goal must be positive or null
    - Max 100 team members per campaign

- [ ] **2.3.2 Roster API - Member Management**
  - `GET /api/campaigns/:campaignId/team-members` - List all members
    - Return: name, email, personal goal, amount raised, invitation status, join date
    - Sort by amount raised (descending)
    - Include pagination (25 per page)
  
  - `PUT /api/campaigns/:campaignId/team-members/:memberId` - Update member
    - Allow: name, personal goal, position, grade
    - Prevent: email changes (for consistency)
  
  - `DELETE /api/campaigns/:campaignId/team-members/:memberId` - Remove member
    - Soft delete (preserve data for reporting)
  
  - `POST /api/campaigns/:campaignId/team-members/:memberId/resend-invite` - Resend invitation
    - Resend invitation email if member hasn't signed up

- [ ] **2.3.3 Roster Import - CSV Bulk Upload**
  - `POST /api/campaigns/:campaignId/import-roster` - CSV import
    - Accept CSV with columns: name, email, personalGoal, position, grade
    - Validate all rows before importing
    - Return: success count, error count, detailed error list
    - Send invitations only to valid entries
    - Test with 100-row CSV
    
  - CSV Validation:
    - Header row required with correct columns
    - All rows must have name and email
    - Invalid rows reported with line number and reason
    - Emails must be unique within import
    - Rate limiting: max 500 members per campaign

- [ ] **2.3.4 Roster UI - Complete Interface**
  - List view showing all team members with:
    - Photo (if available)
    - Name and email
    - Personal goal vs. amount raised (progress bar)
    - Invitation status (pending, accepted, rejected)
    - Actions: edit, resend invite, remove, view fundraising page
  
  - Add member form:
    - Name, email, personal goal, position, grade
    - Submit button shows loading state
    - Success toast notification
    - Error handling with helpful messages
  
  - CSV import interface:
    - Drag-and-drop file upload
    - Preview rows before import
    - Show import progress
    - Display results (imported, skipped, errors)
  
  - Member detail view:
    - Show full profile
    - Copy unique fundraising link
    - View recent donations to this member
    - Contact member button (sends email)

- [ ] **2.3.5 Acceptance Tests**
  - Add individual member via form
  - Import 50 members via CSV
  - View all members with sorting
  - Edit member details
  - Remove member (soft delete)
  - Resend invitation email
  - Member fundraising link works
  - CSV import error handling works

---

### 2.4 Mobile-First UI Optimization (Phase 2)
**Priority**: 🟡 HIGH  
**Estimated Time**: 8 hours  
**Owner**: Frontend engineer

#### Tasks
- [ ] Test all Phase 2 pages on mobile (iOS Safari, Chrome Android)
- [ ] Fix responsive layout issues
- [ ] Optimize touch targets (min 44px)
- [ ] Ensure forms work on mobile
- [ ] Test file upload on mobile
- [ ] Performance audit (mobile connection speed)

---

## Phase 3: Donations & Payment Processing (Weeks 5-9)
### Goal: Enable donors to give money with full Stripe integration

### 3.1 Donation Form - Stripe Integration
**Priority**: 🔴 CRITICAL  
**Estimated Time**: 24 hours  
**Owner**: Full-stack engineer

#### Tasks
- [ ] **3.1.1 Donation API Endpoints**
  - `POST /api/donations` - Create donation
    - Accept: teamMemberId (or null for campaign donation), amount, donorName, donorEmail, donorPhone, message, isAnonymous
    - Create donation record with status: "pending"
    - Return donation ID and client secret for Stripe
    - Test with various amounts and donor types

  - `GET /api/donations/:donationId` - Fetch donation status
    - Return: current status, amount, donor info, team member
  
  - `POST /api/donations/:donationId/verify` - Verify Stripe payment
    - Called after client-side Stripe flow completes
    - Verify payment intent status with Stripe
    - Update donation status to "completed" or "failed"
    - Trigger success email to donor
    - Update team member and campaign totals

- [ ] **3.1.2 Stripe Payment Intent Flow**
  - Create Stripe payment intent on donation form load
  - Store payment intent ID in donation record
  - Handle 3D Secure / SCA authentication
  - Implement payment success/failure handlers
  - Store Stripe charge ID for reconciliation
  - Test with test card: 4242 4242 4242 4242 (success)
  - Test with test card: 4000 0000 0000 0002 (decline)

- [ ] **3.1.3 Donation Form UI - Complete**
  - Display team member info (photo, name, personal goal, progress)
  - Display campaign info (goal, total raised, end date)
  - Suggested donation amounts: $25, $50, $100, $250, custom
  - Donor details form:
    - Full name (required)
    - Email (required)
    - Phone (optional)
    - Message to team member (optional, max 500 chars)
    - Anonymous donation toggle
  - Stripe card element with styling
  - Processing state with spinner
  - Success screen with:
    - Confirmation number
    - Receipt option (email)
    - Share button (Facebook, Twitter)
    - Back to campaign button

- [ ] **3.1.4 Donation Confirmation Email**
  - Professional email template
  - Donation amount and recipient
  - Tax receipt info (if applicable)
  - Link to donation receipt
  - Social sharing buttons
  - FAQ link

- [ ] **3.1.5 Error Handling & Recovery**
  - Network error: allow retry
  - Card declined: show helpful message with reason
  - Expired session: clear form and show login prompt
  - Duplicate donation prevention (prevent double-submit)
  - Test all error scenarios

- [ ] **3.1.6 Acceptance Tests**
  - Complete donation flow with test card
  - Card declined properly handled
  - Donation appears on team member page
  - Confirmation email sent
  - Amount updates on campaign dashboard
  - Anonymous donations hide donor name
  - Mobile checkout works

---

### 3.2 Donation Feed & Notifications
**Priority**: 🟡 HIGH  
**Estimated Time**: 12 hours  
**Owner**: Frontend engineer

#### Tasks
- [ ] **3.2.1 Donation Display Components**
  - Recent donations on campaign page (last 20)
  - Recent donations on team member page (last 10)
  - Donation item shows: donor name (or "Anonymous"), amount, time, message (if any)
  - Format: "$100 from John Doe - 2 hours ago"

- [ ] **3.2.2 Real-Time Donation Updates**
  - Implement WebSocket connection for real-time updates (or polling as fallback)
  - New donations appear immediately on dashboard
  - Totals update in real-time
  - Test with multiple concurrent donations

- [ ] **3.2.3 Donor Communication**
  - Allow team member to send thank-you email to donor
  - Donation response notifications
  - Share update notifications (email to subscribers)

---

### 3.3 Recurring Donations (Optional - Nice to Have)
**Priority**: 🟢 NICE TO HAVE  
**Estimated Time**: 16 hours  
**Owner**: Full-stack engineer

#### Tasks
- [ ] Design recurring donation UI (monthly, weekly options)
- [ ] Implement Stripe subscription management
- [ ] Handle subscription cancellation
- [ ] Implement pause functionality
- [ ] Send renewal receipts
- [ ] Handle failed recurring charges

---

### 3.4 Payment Security & Compliance
**Priority**: 🔴 CRITICAL  
**Estimated Time**: 12 hours  
**Owner**: Backend engineer + Security

#### Tasks
- [ ] **3.4.1 PCI Compliance**
  - No card data stored in database (use Stripe tokens only)
  - Use HTTPS for all payment pages
  - Implement CSRF tokens on payment forms
  - Audit: verify no card data in logs
  - Security: validate all payment endpoints
  - Test: penetration test payment flow

- [ ] **3.4.2 Stripe Webhook Handling**
  - `POST /api/webhooks/stripe` - Webhook endpoint
    - Handle: payment_intent.succeeded, payment_intent.payment_failed
    - Verify webhook signature
    - Update donation status based on webhook
    - Handle: charge.dispute.created (for chargebacks)
    - Idempotency: prevent duplicate processing

- [ ] **3.4.3 Fraud Prevention**
  - Implement rate limiting: max 10 donations per IP per hour
  - Implement velocity checks: max 5 failed transactions per card per day
  - Log all transactions for auditing
  - Implement dispute handling process

- [ ] **3.4.4 Acceptance Tests**
  - Webhook processing works
  - Duplicate webhook calls handled
  - Invalid signatures rejected
  - Failed payments properly recorded

---

### 3.5 Testing - Donation Flow
**Priority**: 🔴 CRITICAL  
**Estimated Time**: 8 hours  
**Owner**: QA engineer

#### Test Scenarios
- [ ] Successful donation with test card
- [ ] Declined donation with proper error handling
- [ ] Anonymous donation
- [ ] Donation to specific team member
- [ ] Campaign-level donation (no specific member)
- [ ] Partial success (webhook delayed, reconciliation works)
- [ ] Duplicate prevention (same donation submitted twice)
- [ ] Mobile checkout flow
- [ ] Email receipts sent correctly
- [ ] Dashboard totals update accurately

---

## Phase 4: Admin Dashboard & Disbursements (Weeks 10-12)
### Goal: Enable program admins to manage campaigns and request payouts

### 4.1 Admin Campaign Management
**Priority**: 🔴 CRITICAL  
**Estimated Time**: 16 hours  
**Owner**: Full-stack engineer

#### Tasks
- [ ] **4.1.1 Campaign Status Management**
  - `PUT /api/campaigns/:campaignId/status` - Change campaign status
    - Statuses: DRAFT → ACTIVE → PAUSED → COMPLETED → ARCHIVED
    - Only CAMPAIGN_LEADER can change status
    - DRAFT campaigns not visible to public
    - COMPLETED campaigns locked (no new donations)
    - Archive old campaigns

  - API Validation:
    - Can't move backwards (can't go from COMPLETED to ACTIVE)
    - ACTIVE campaigns must have end date in future
    - COMPLETED campaigns must have end date in past

- [ ] **4.1.2 Campaign Settings UI**
  - Update campaign name, description, goal amount
  - Extend end date (if active)
  - Pause/resume campaign
  - Archive campaign
  - Delete draft campaigns
  - Disable future edits after campaign goes active

- [ ] **4.1.3 Campaign Admin UI**
  - List all campaigns with statuses
  - Search by name, organization, date range
  - Filter by status (ACTIVE, DRAFT, COMPLETED)
  - Sort by: date created, amount raised, status
  - Bulk actions: archive multiple, pause multiple
  - Inline editing for basic fields

---

### 4.2 Disbursement Requests - Complete Implementation
**Priority**: 🔴 CRITICAL  
**Estimated Time**: 24 hours  
**Owner**: Full-stack engineer

#### Tasks
- [ ] **4.2.1 Disbursement Request API**
  - `POST /api/campaigns/:campaignId/disbursements` - Create disbursement request
    - Accept: amount, purpose, description, bankingDetails
    - Amount must be ≤ available balance
    - Create request with status: "PENDING"
    - Notify BANK_ADMIN of new request
    - Return request ID

  - `GET /api/campaigns/:campaignId/disbursements` - List requests for campaign
    - Return: all requests with status and dates
  
  - `GET /api/admin/disbursements` - Admin view (BANK_ADMIN only)
    - Return: all disbursements across all campaigns
    - Filter by status, date range, campaign
    - Sort by amount, date requested

  - `PUT /api/admin/disbursements/:requestId/approve` - Approve disbursement
    - Only BANK_ADMIN can approve
    - Change status to "APPROVED"
    - Store approver ID and timestamp
    - Notify campaign leader of approval
    - Trigger ACH transfer to bank account

  - `PUT /api/admin/disbursements/:requestId/reject` - Reject disbursement
    - Only BANK_ADMIN can reject
    - Change status to "REJECTED"
    - Store reason and rejecter ID
    - Return funds to campaign balance
    - Notify campaign leader

  - `PUT /api/admin/disbursements/:requestId/complete` - Mark as completed
    - After ACH transfer succeeds
    - Change status to "COMPLETED"
    - Record bank transaction ID
    - Update program lifetime payout total

- [ ] **4.2.2 Banking Details Management**
  - `POST /api/campaigns/:campaignId/banking` - Set banking details
    - Accept: bankAccountName, bankAccountNumber, routingNumber
    - Validate bank account (optional verification microdeposit)
    - Encrypt sensitive data (don't store plaintext)
    - Return success/error

  - `GET /api/campaigns/:campaignId/banking` - Retrieve banking details (masked)
    - Return: last 4 digits of account, bank name, routing number
    - Don't return full account number to client

  - `PUT /api/campaigns/:campaignId/banking` - Update banking details

- [ ] **4.2.3 Disbursement Workflow**
  - Campaign leader requests disbursement with:
    - Amount (≤ available balance)
    - Purpose (e.g., "Equipment purchase", "Travel")
    - Description (details of expense)
    - Bank account info (if not saved)
  
  - Status flow: PENDING → APPROVED → COMPLETED
  - Or: PENDING → REJECTED
  
  - Admin approval process:
    - Review request with all details
    - Verify bank account information
    - Verify program KYC/verification status
    - Approve or reject with optional comment
  
  - Automated ACH transfer (if integrated with banking API)
    - Initiate transfer to verified bank account
    - Update status to COMPLETED
    - Record transfer ID for reconciliation

- [ ] **4.2.4 Campaign Balance Tracking**
  - Update campaign balance after each donation
  - Show available vs. pending balance
  - Available balance = Total raised - Platform fees - Pending disbursements
  - Pending balance = Disbursements in APPROVED state (awaiting ACH)
  - Completed balance = Disbursements successfully transferred

- [ ] **4.2.5 Disbursement History**
  - Show all past disbursements on campaign dashboard
  - Export disbursement history (CSV/PDF)
  - Show: date, amount, status, notes
  - Filter by date range, status

---

### 4.3 Admin Dashboard - Main Page
**Priority**: 🔴 CRITICAL  
**Estimated Time**: 16 hours  
**Owner**: Frontend engineer

#### Tasks
- [ ] **4.3.1 Admin Dashboard Layout**
  - Top metrics: Total campaigns, Total donations, Total raised, Total disbursed, Active users
  - Recent activity feed: Recent donations, recent disbursements, new campaigns
  - Dashboard by day charts (last 30 days):
    - Total donations by day
    - Total amount by day
    - New campaigns created
  
  - Quick actions:
    - View pending disbursements (with badge count)
    - View new campaigns (with badge count)
    - View all campaigns
    - User management

- [ ] **4.3.2 Campaigns Table**
  - Show all campaigns with: name, organization, status, funds raised, goal, progress %, end date
  - Search by name, organization
  - Filter by status, date range
  - Sort by amount raised, date created, status
  - Inline actions: view, pause, archive
  - Pagination (50 per page)

- [ ] **4.3.3 Users Table**
  - Show all users: name, email, role, campaigns created, total donated
  - Search by name, email
  - Filter by role, registration date
  - Inline actions: view profile, suspend, messaging

- [ ] **4.3.4 Financial Summary**
  - Total platform revenue (platform fees collected)
  - Total disbursements made
  - Platform balance
  - Breakdown by campaign, by program
  - Export reports

---

### 4.4 Admin Controls & Settings
**Priority**: 🟡 HIGH  
**Estimated Time**: 12 hours  
**Owner**: Backend engineer

#### Tasks
- [ ] **4.4.1 Platform Settings (BANK_ADMIN only)**
  - Platform fee percentage (default 5%)
  - Minimum donation amount (default $1)
  - Suggested donation amounts
  - Max file upload sizes
  - Terms of service & privacy policy URLs
  - Contact email for support
  - Save/update endpoints with validation

- [ ] **4.4.2 User Management (BANK_ADMIN only)**
  - `GET /api/admin/users` - List all users
  - `PUT /api/admin/users/:userId/role` - Change user role
  - `PUT /api/admin/users/:userId/suspend` - Suspend user (soft delete)
  - `PUT /api/admin/users/:userId/reactivate` - Reactivate user
  - Log all admin actions for audit

- [ ] **4.4.3 Financial Reconciliation**
  - `GET /api/admin/reconciliation` - Generate reconciliation report
    - Compare database totals vs. Stripe totals
    - Flag discrepancies
    - Export report
  
  - Manual transaction adjustment (if needed)
    - Log all adjustments for audit
    - Require 2-factor approval for large adjustments

---

### 4.5 Testing - Admin & Disbursements
**Priority**: 🔴 CRITICAL  
**Estimated Time**: 12 hours  
**Owner**: QA engineer

#### Test Scenarios
- [ ] Campaign leader can create and submit disbursement request
- [ ] Admin receives notification of pending disbursement
- [ ] Admin can approve disbursement
- [ ] Admin can reject disbursement with reason
- [ ] Campaign balance updates correctly after donation
- [ ] Campaign balance decreases after disbursement approval
- [ ] Bank account verification works
- [ ] ACH transfer initiated on approval
- [ ] Unauthorized users can't access admin dashboard
- [ ] Reports generate correctly
- [ ] Platform fee calculated correctly

---

## Weeks 13-16: Testing, Bug Fixes, & Production Prep
### Goal: Stabilize platform for launch

### 5.1 Comprehensive Testing (Week 13-14)
**Priority**: 🔴 CRITICAL

#### Test Coverage Required
- [ ] **Unit Tests** (60+ tests)
  - Auth functions (token generation, verification)
  - Validation functions (email, phone, currency)
  - Utility functions (formatting, calculations)
  - RBA C logic

- [ ] **Integration Tests** (40+ tests)
  - Campaign creation to dashboard
  - Donation flow (form to payment confirmation)
  - Disbursement workflow (request to completion)
  - User authentication flows

- [ ] **End-to-End Tests** (20+ scenarios)
  - Complete user journeys:
    - Coach: register → create campaign → manage roster → view dashboard
    - Donor: browse campaign → donate → receive receipt
    - Admin: review disbursement → approve → track payout

- [ ] **Performance Tests**
  - Page load time (target: < 3s)
  - API response time (target: < 500ms)
  - Dashboard with 1000 donations (should still be fast)
  - Concurrent user load (100 simultaneous users)

- [ ] **Security Tests**
  - SQL injection attempts blocked
  - XSS attempts blocked
  - CSRF token validation works
  - Rate limiting works
  - Unauthorized access blocked
  - Penetration testing (hire professional if possible)

- [ ] **Cross-Browser Testing**
  - Chrome, Firefox, Safari, Edge (latest 2 versions)
  - Mobile: iOS Safari 13+, Chrome Android 80+
  - Test all major flows on each browser

- [ ] **Mobile Testing**
  - iOS (iPhone 12, 14, Pro Max)
  - Android (Samsung Galaxy S20+, Pixel)
  - Test: campaign pages, donation form, dashboard, roster

---

### 5.2 Bug Fixes & Performance Optimization (Week 14-15)
**Priority**: 🔴 CRITICAL

#### Focus Areas
- [ ] Fix all critical bugs found in testing
- [ ] Database query optimization (N+1 query issues)
- [ ] Implement caching for expensive queries
- [ ] Optimize image/media loading (lazy loading)
- [ ] Minify JavaScript and CSS
- [ ] Enable gzip compression
- [ ] Set up CDN for static assets
- [ ] Reduce Time to First Byte (TTFB)
- [ ] Fix all accessibility issues (WCAG 2.1 AA compliance)

#### Performance Targets
| Metric | Target | Current |
|--------|--------|---------|
| Largest Contentful Paint | < 2.5s | TBD |
| First Input Delay | < 100ms | TBD |
| Cumulative Layout Shift | < 0.1 | TBD |
| Mobile Page Speed | > 90 | TBD |
| Desktop Page Speed | > 95 | TBD |

---

### 5.3 Security Hardening (Week 15)
**Priority**: 🔴 CRITICAL

#### Security Checklist
- [ ] Update all dependencies to latest versions
- [ ] Run security audit: `npm audit`
- [ ] Enable HTTPS everywhere (enforce in production)
- [ ] Set security headers:
  - Content-Security-Policy
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - Strict-Transport-Security (HSTS)
  - Referrer-Policy
- [ ] Implement rate limiting on all API endpoints
- [ ] Encrypt sensitive data in transit and at rest
- [ ] Mask sensitive data in logs
- [ ] Set up error tracking (Sentry) with error sampling
- [ ] Enable database backups (daily)
- [ ] Test backup restoration process
- [ ] Document security procedures

---

### 5.4 Documentation & Deployment Prep (Week 16)
**Priority**: 🟡 HIGH

#### Documentation Required
- [ ] **User Documentation**
  - Coach onboarding guide (5 minutes to first campaign)
  - Donor FAQ (how to donate, tax receipts, etc.)
  - Team member guide (how to share fundraising page)
  - Admin manual (managing campaigns, approving disbursements)

- [ ] **Developer Documentation**
  - API documentation (endpoints, parameters, responses)
  - Database schema documentation (updated from COMPLETE_PROJECT_DOCUMENTATION.md)
  - Setup guide (new developer onboarding)
  - Deployment procedure
  - Troubleshooting guide

- [ ] **Technical Documentation**
  - Architecture overview (update ARCHITECTURE.md)
  - Deployment checklist
  - Monitoring & alerting setup
  - Backup & recovery procedures
  - Scaling strategy

#### Deployment Prep
- [ ] Set up production environment
  - Domain name and SSL certificate
  - Production database (PostgreSQL on AWS RDS or similar)
  - Production file storage (S3)
  - Environment variables configured
  - Secrets management (GitHub Secrets or similar)

- [ ] Set up monitoring & alerting
  - Uptime monitoring (Statuspage.io or similar)
  - Error tracking (Sentry)
  - Performance monitoring (Vercel Analytics)
  - Database monitoring (AWS CloudWatch or similar)
  - Alert setup: email/Slack notifications

- [ ] Set up CI/CD pipeline
  - GitHub Actions (tests on every PR)
  - Automated deployment on merge to main
  - Staging environment for testing
  - Database migration strategy

- [ ] Create deployment guide
  - Step-by-step deployment process
  - Rollback procedure
  - Data migration procedure
  - Monitoring during deployment

---

## Sprint Breakdown (12 Weeks Total)

### Sprint 1-2: Campaign Management (Weeks 1-2)
**Goal**: Coaches can create and manage campaigns with teams

| Task | Time | Owner | Status |
|------|------|-------|--------|
| Campaign API validation | 6h | Backend | - |
| Campaign storage & retrieval | 4h | Backend | - |
| Campaign form UX | 4h | Frontend | - |
| Roster API - Core | 10h | Backend | - |
| Roster import - CSV | 8h | Backend | - |
| Roster UI | 8h | Frontend | - |
| Mobile optimization | 4h | Frontend | - |
| Testing & bugs | 4h | QA | - |
| **Sprint Total** | **48h** | - | - |

**Definition of Done**:
- [ ] Coaches can create campaigns
- [ ] Coaches can add team members
- [ ] Coaches can import roster via CSV
- [ ] Dashboard shows basic campaign stats
- [ ] Mobile responsive
- [ ] 5+ test cases pass

---

### Sprint 3: Dashboard & Analytics (Weeks 3)
**Goal**: Coaches can see real-time campaign performance

| Task | Time | Owner | Status |
|------|------|-------|--------|
| Dashboard API endpoints | 10h | Backend | - |
| Data aggregation & caching | 6h | Backend | - |
| Dashboard UI integration | 8h | Frontend | - |
| Real-time updates | 6h | Backend | - |
| Mobile optimization | 4h | Frontend | - |
| Testing & bugs | 4h | QA | - |
| **Sprint Total** | **38h** | - | - |

**Definition of Done**:
- [ ] Dashboard shows real-time stats
- [ ] Data updates every 30 seconds
- [ ] Performance < 500ms response time
- [ ] Mobile responsive

---

### Sprint 4-5: Payment Processing (Weeks 4-5)
**Goal**: Donors can donate money via Stripe

| Task | Time | Owner | Status |
|------|------|-------|--------|
| Donation API endpoints | 10h | Backend | - |
| Stripe payment intent flow | 12h | Backend | - |
| Donation form UI | 12h | Frontend | - |
| Confirmation emails | 4h | Backend | - |
| Error handling | 6h | Backend | - |
| Mobile checkout | 6h | Frontend | - |
| Testing & bugs | 8h | QA | - |
| **Sprint Total** | **58h** | - | - |

**Definition of Done**:
- [ ] End-to-end donation works
- [ ] Receipts sent
- [ ] Amount updates on dashboard
- [ ] Stripe webhook processing works
- [ ] Mobile checkout works

---

### Sprint 6: Real-Time & Advanced Features (Weeks 6)
**Goal**: Real-time notifications and advanced donation features

| Task | Time | Owner | Status |
|------|------|-------|--------|
| Real-time donation feed | 8h | Backend | - |
| WebSocket or polling | 6h | Backend | - |
| Donation notifications | 6h | Frontend | - |
| Recurring donations (optional) | 12h | Backend | - |
| PCI compliance review | 4h | Security | - |
| Fraud prevention | 6h | Backend | - |
| Testing & bugs | 6h | QA | - |
| **Sprint Total** | **48h** | - | - |

**Definition of Done**:
- [ ] Donations appear real-time on dashboard
- [ ] PCI compliance verified
- [ ] Rate limiting works
- [ ] Fraud tests pass

---

### Sprint 7-8: Admin Dashboard & Disbursements (Weeks 7-8)
**Goal**: Admins can manage campaigns and process payouts

| Task | Time | Owner | Status |
|------|------|-------|--------|
| Campaign management API | 8h | Backend | - |
| Disbursement API (full flow) | 12h | Backend | - |
| Banking details management | 6h | Backend | - |
| Balance tracking | 4h | Backend | - |
| Admin dashboard UI | 12h | Frontend | - |
| Disbursement approval UI | 8h | Frontend | - |
| Settings & controls | 6h | Backend | - |
| Testing & bugs | 8h | QA | - |
| **Sprint Total** | **64h** | - | - |

**Definition of Done**:
- [ ] Campaign leaders can request disbursements
- [ ] Admins can approve/reject
- [ ] Bank details saved securely
- [ ] ACH transfer initiated
- [ ] All role permissions working

---

### Sprint 9: Testing Sprint (Weeks 9)
**Goal**: Comprehensive testing of all features

| Task | Time | Owner | Status |
|------|------|-------|--------|
| Unit tests (60+) | 20h | QA/Backend | - |
| Integration tests (40+) | 16h | QA | - |
| E2E tests (20+ scenarios) | 12h | QA | - |
| Performance testing | 8h | QA | - |
| Security testing | 8h | QA/Security | - |
| Bug fixes from testing | 8h | Backend/Frontend | - |
| **Sprint Total** | **72h** | - | - |

**Definition of Done**:
- [ ] 60+ unit tests pass
- [ ] 40+ integration tests pass
- [ ] 20+ E2E scenarios pass
- [ ] 0 critical bugs
- [ ] Performance targets met

---

### Sprint 10: Performance & Optimization (Weeks 10)
**Goal**: Optimize performance and fix remaining bugs

| Task | Time | Owner | Status |
|------|------|-------|--------|
| Database query optimization | 12h | Backend | - |
| Caching implementation | 8h | Backend | - |
| Image/media optimization | 6h | Frontend | - |
| Code splitting & minification | 4h | Frontend | - |
| CDN setup | 4h | Infrastructure | - |
| Accessibility fixes | 6h | Frontend | - |
| Cross-browser testing | 8h | QA | - |
| Bug fixes | 8h | Backend/Frontend | - |
| **Sprint Total** | **56h** | - | - |

**Definition of Done**:
- [ ] LCP < 2.5s
- [ ] FID < 100ms
- [ ] CLS < 0.1
- [ ] WCAG 2.1 AA compliant
- [ ] 0 critical bugs

---

### Sprint 11: Security & Documentation (Weeks 11)
**Goal**: Harden security and complete documentation

| Task | Time | Owner | Status |
|------|------|-------|--------|
| Security hardening | 12h | Security | - |
| Dependency updates | 4h | Backend | - |
| API documentation | 10h | Backend | - |
| User documentation | 8h | Product | - |
| Developer documentation | 6h | Backend | - |
| Deployment guide | 6h | Infrastructure | - |
| Testing docs | 4h | QA | - |
| **Sprint Total** | **50h** | - | - |

**Definition of Done**:
- [ ] All dependencies updated
- [ ] Security headers configured
- [ ] API docs complete
- [ ] Deployment checklist created

---

### Sprint 12: Deployment Prep (Weeks 12)
**Goal**: Prepare for production launch

| Task | Time | Owner | Status |
|------|------|-------|--------|
| Production environment setup | 8h | Infrastructure | - |
| Database migration testing | 6h | Backend | - |
| Monitoring & alerting setup | 8h | Infrastructure | - |
| CI/CD pipeline setup | 8h | Infrastructure | - |
| Staging deployment | 4h | Infrastructure | - |
| Final testing in staging | 12h | QA | - |
| Launch checklist | 4h | Product | - |
| Backup & recovery test | 4h | Infrastructure | - |
| **Sprint Total** | **54h** | - | - |

**Definition of Done**:
- [ ] Production environment ready
- [ ] Monitoring active
- [ ] CI/CD pipeline working
- [ ] Backups verified
- [ ] Go-live approved

---

## Resource Requirements

### Team Composition (Full MVP)
- **1 Backend Engineer** (40 hours/week) - API, database, Stripe integration
- **1 Frontend Engineer** (40 hours/week) - UI/UX, React components
- **1 QA Engineer** (20 hours/week) - Testing, bug tracking
- **1 DevOps/Infrastructure** (10 hours/week) - Deployment, monitoring
- **1 Security Consultant** (5 hours/week) - Security review, compliance
- **1 Product Manager** (10 hours/week) - Requirements, prioritization

**Total**: 125 hours/week for 12 weeks = ~2,500 hours

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Stripe integration complexity | Medium | High | Start early, use Stripe test mode extensively |
| Payment processing delays | Low | Critical | Implement retry logic, webhook backups |
| Database performance | Medium | Medium | Query optimization from week 1, use indexes |
| Scope creep | High | High | Lock scope, defer nice-to-have features |
| Team member unavailability | Medium | High | Cross-train, document all processes |
| Security vulnerabilities | Medium | Critical | Regular security reviews, penetration testing |
| Cash flow issues | Low | Critical | Invoice donors correctly, track balance precisely |

---

## Success Criteria for MVP Launch

### Functional Requirements
- [ ] Users can register, verify email, and login
- [ ] Coaches can create campaigns with custom branding
- [ ] Coaches can add team members and import rosters
- [ ] Donors can donate via Stripe with no friction
- [ ] Campaign dashboards show real-time stats
- [ ] Campaign leaders can request fund disbursements
- [ ] Admins can approve disbursements and manage platform
- [ ] All transactions properly recorded in database

### Non-Functional Requirements
- [ ] Page load time < 3 seconds on 4G
- [ ] API response time < 500ms (95th percentile)
- [ ] 99.9% uptime SLA
- [ ] Support 1,000 concurrent users
- [ ] 0 known critical security vulnerabilities
- [ ] WCAG 2.1 AA compliance
- [ ] Mobile responsive (iOS & Android)

### Business Requirements
- [ ] Minimum viable feature set for MVP
- [ ] 5-10 beta schools onboarded
- [ ] $10,000+ in test donations processed
- [ ] Platform fees calculated correctly
- [ ] 100% fund reconciliation

---

## Post-Launch: Phase 5-6 Roadmap (Future)

### Phase 5: Analytics & Reporting (Weeks 13-14)
- Campaign performance dashboards
- Donor demographic reports
- Fundraising trend analysis
- Exportable reports (CSV/PDF)
- Custom report builder

### Phase 6: Communications (Weeks 15-16)
- Email campaign system
- SMS notifications (Twilio)
- In-app notification center
- Campaign update emails
- Donor thank-you automations

### Phase 7: Advanced Features (Weeks 17-20)
- Recurring donations
- Fundraiser teams/groups
- Fundraiser goals & milestones
- Peer-to-peer fundraising
- Mobile apps (iOS/Android)
- Referral system
- Loyalty rewards

---

## Appendix A: API Endpoints Summary

### Authentication
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
GET /api/auth/me
POST /api/auth/verify-email
POST /api/auth/resend-verification
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

### Campaigns
```
POST /api/campaigns
GET /api/campaigns/:id
PUT /api/campaigns/:id
GET /api/campaigns/:id/stats
GET /api/campaigns/:id/recent-donations
PUT /api/campaigns/:id/status
```

### Team Members
```
POST /api/campaigns/:campaignId/team-members
GET /api/campaigns/:campaignId/team-members
PUT /api/campaigns/:campaignId/team-members/:memberId
DELETE /api/campaigns/:campaignId/team-members/:memberId
POST /api/campaigns/:campaignId/team-members/:memberId/resend-invite
POST /api/campaigns/:campaignId/import-roster
```

### Donations
```
POST /api/donations
GET /api/donations/:id
POST /api/donations/:id/verify
GET /api/campaigns/:campaignId/donations
```

### Disbursements
```
POST /api/campaigns/:campaignId/disbursements
GET /api/campaigns/:campaignId/disbursements
GET /api/admin/disbursements
PUT /api/admin/disbursements/:id/approve
PUT /api/admin/disbursements/:id/reject
PUT /api/admin/disbursements/:id/complete
```

### Admin
```
GET /api/admin/dashboard
GET /api/admin/campaigns
GET /api/admin/users
PUT /api/admin/users/:id/role
GET /api/admin/settings
PUT /api/admin/settings
GET /api/admin/reconciliation
```

### Webhooks
```
POST /api/webhooks/stripe
```

---

**Next Steps**:
1. Review and approve this roadmap
2. Gather team and assign sprint leads
3. Set up development environment per GETTING_STARTED.md
4. Create detailed tickets for Sprint 1
5. Kick off development with Sprint 0 planning
6. Establish 2-week sprint cadence with weekly standups

---

*Document maintained by: Rally Product Team*  
*Last Updated: November 21, 2025*
