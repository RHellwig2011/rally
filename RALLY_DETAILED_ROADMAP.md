# Rally - Detailed Development Roadmap

## Comprehensive Task Breakdown with Implementation Details

---

# PHASE 1: Foundation & Core Infrastructure (Weeks 1-2)

## 1.1 Database Schema Design

### Task 1.1.1: Design User Authentication Tables
**Estimated Time**: 4 hours
**Priority**: Critical

**Detailed Requirements**:
- Create `users` table as base table for all user types
  - Fields: id (UUID), email (unique), password_hash, email_verified (boolean), created_at, updated_at
  - Index on email for fast lookups
  - Soft delete capability (deleted_at field)

- Create `coaches` table
  - Fields: id, user_id (FK to users), first_name, last_name, phone, school_id (FK), bio, profile_image_url
  - Relationship: one-to-one with users
  - Relationship: many-to-one with schools

- Create `players` table
  - Fields: id, user_id (FK to users), first_name, last_name, phone, email, coach_id (FK), campaign_id (FK), jersey_number, grade_level, profile_image_url, video_url, personal_story (text), status (enum: invited, active, inactive)
  - Relationship: one-to-one with users
  - Relationship: many-to-one with coaches
  - Index on campaign_id and status

- Create `admins` table
  - Fields: id, user_id (FK to users), first_name, last_name, role (enum: super_admin, support, finance), permissions (JSONB)
  - Relationship: one-to-one with users

**Technical Considerations**:
- Use UUID for all primary keys to prevent enumeration attacks
- Implement row-level security policies
- Add triggers for updated_at timestamps
- Plan for future role expansion (parents, donors with accounts)

**Acceptance Criteria**:
- [ ] All tables created with proper foreign key constraints
- [ ] Migration files created and tested
- [ ] Rollback migrations tested
- [ ] Database diagram generated
- [ ] Seed data created for testing

---

### Task 1.1.2: Create Organization/School Hierarchy Structure
**Estimated Time**: 3 hours
**Priority**: Critical

**Detailed Requirements**:
- Create `schools` table
  - Fields: id, name, district, city, state, zip_code, phone, email, logo_url, primary_color (hex), secondary_color (hex), status (enum: pending, active, inactive, suspended), onboarding_completed (boolean), created_at, updated_at
  - Index on status and state

- Create `programs` table (sports teams/clubs)
  - Fields: id, school_id (FK), name, sport_type (enum: football, basketball, soccer, etc.), season (enum: fall, winter, spring, summer), coach_id (FK to coaches - primary coach), description, created_at
  - Relationship: many-to-one with schools
  - Relationship: multiple coaches can be associated via join table

- Create `program_coaches` join table
  - Fields: id, program_id (FK), coach_id (FK), role (enum: head_coach, assistant_coach, coordinator), created_at
  - Composite unique index on (program_id, coach_id)

- Create `districts` table (optional for grouping schools)
  - Fields: id, name, state, contact_email, created_at

**Technical Considerations**:
- Design for multi-program support per school
- Allow schools to have multiple active campaigns
- Consider hierarchical queries for reporting
- Plan for franchise/multi-school organizations

**Acceptance Criteria**:
- [ ] Hierarchical structure supports: District → School → Program → Coach → Players
- [ ] Cascade delete rules properly configured
- [ ] Sample data representing 3 schools with multiple programs
- [ ] Queries optimized for common access patterns

---

### Task 1.1.3: Set Up Fundraising Campaign Tables
**Estimated Time**: 5 hours
**Priority**: Critical

**Detailed Requirements**:
- Create `campaigns` table
  - Fields: id, program_id (FK), coach_id (FK - creator), name, description, goal_amount (decimal), start_date, end_date, status (enum: draft, active, paused, completed, cancelled), funds_distributed (boolean), distribution_date, created_at, updated_at
  - Calculated field: total_raised (computed from donations)
  - Index on status and end_date

- Create `campaign_settings` table
  - Fields: id, campaign_id (FK - one-to-one), allow_anonymous_donations (boolean), minimum_donation_amount (decimal), suggested_donation_amounts (JSONB array), enable_recurring_donations (boolean), custom_thank_you_message (text), poster_template_id (FK), created_at, updated_at

- Create `player_campaigns` table (associates players with campaigns)
  - Fields: id, player_id (FK), campaign_id (FK), unique_link_code (string, unique, indexed), fundraising_goal (decimal), personal_message (text), status (enum: invited, active, inactive), joined_at, created_at
  - Calculated field: total_raised (from donations)
  - Composite unique index on (player_id, campaign_id)

- Create `campaign_milestones` table
  - Fields: id, campaign_id (FK), milestone_type (enum: goal_percentage, dollar_amount, player_count), threshold_value (decimal), achieved (boolean), achieved_at, notification_sent (boolean)

**Technical Considerations**:
- Generate unique, shareable link codes (8-12 characters, URL-safe)
- Store monetary values as DECIMAL(10,2) to avoid floating-point errors
- Index on unique_link_code for fast player page lookups
- Plan for campaign cloning/templates

**Acceptance Criteria**:
- [ ] Campaign lifecycle states properly enforced
- [ ] Unique link generation tested for collisions
- [ ] Date range validation (end_date > start_date)
- [ ] Goal amounts must be positive
- [ ] Sample campaigns created with various states

---

### Task 1.1.4: Design Donation Tracking and Transaction Tables
**Estimated Time**: 6 hours
**Priority**: Critical

**Detailed Requirements**:
- Create `donations` table
  - Fields: id, campaign_id (FK), player_campaign_id (FK - nullable for team donations), donor_name, donor_email, donor_phone (optional), amount (decimal), is_anonymous (boolean), message_to_player (text), donation_date, status (enum: pending, completed, failed, refunded), payment_method (enum: card, bank_transfer, other), created_at, updated_at
  - Index on campaign_id, player_campaign_id, status, donation_date
  - Partial index on is_anonymous = false for donor lookups

- Create `transactions` table (financial ledger)
  - Fields: id, donation_id (FK - nullable), transaction_type (enum: donation_received, platform_fee, payout_to_program, refund, chargeback), amount (decimal), currency (default: USD), stripe_payment_intent_id (unique), stripe_charge_id, stripe_payout_id, status (enum: pending, succeeded, failed), rally_account_balance_impact (decimal), program_account_balance_impact (decimal), processed_at, created_at, updated_at
  - Index on stripe_payment_intent_id, status, processed_at
  - This is the source of truth for reconciliation

- Create `program_balances` table
  - Fields: id, program_id (FK - unique), available_balance (decimal), pending_balance (decimal), lifetime_raised (decimal), last_payout_date, last_payout_amount (decimal), next_payout_scheduled, updated_at
  - Updated via database triggers on transaction inserts

- Create `rally_master_balance` table (singleton table)
  - Fields: id (always 1), total_balance (decimal), total_payouts (decimal), total_fees_collected (decimal), last_reconciliation_date, updated_at

- Create `recurring_donations` table
  - Fields: id, donor_email, player_campaign_id (FK), amount (decimal), frequency (enum: weekly, monthly), stripe_subscription_id, status (enum: active, paused, cancelled), next_charge_date, created_at, cancelled_at

**Technical Considerations**:
- All money stored as DECIMAL(10,2) for precision
- Implement double-entry accounting principles
- Every donation creates multiple transaction records (incoming, fee, allocation)
- Use database transactions (ACID) for all money operations
- Store Stripe IDs for reconciliation and dispute handling
- Implement idempotency keys to prevent duplicate charges

**Acceptance Criteria**:
- [ ] Test donation flow creates proper transaction chain
- [ ] Balance calculations are accurate to the penny
- [ ] Concurrent donation handling tested (race conditions)
- [ ] Refund flow properly reverses all transactions
- [ ] Audit trail is complete and immutable
- [ ] Sample data with 100+ donations across multiple players

---

### Task 1.1.5: Build Player Profile Tables
**Estimated Time**: 3 hours
**Priority**: High

**Detailed Requirements**:
- Create `player_media` table
  - Fields: id, player_id (FK), media_type (enum: photo, video), file_url (S3 URL), thumbnail_url, file_size_bytes, mime_type, duration_seconds (for videos), upload_date, moderation_status (enum: pending, approved, rejected), moderated_by (FK to admins - nullable), moderated_at, display_order (integer), is_primary (boolean)
  - Index on player_id and moderation_status
  - Unique constraint on (player_id, is_primary) where is_primary = true

- Create `player_contacts` table
  - Fields: id, player_id (FK), contact_type (enum: email, phone, parent_email, parent_phone), contact_value, is_verified (boolean), is_primary (boolean), created_at
  - Index on player_id
  - Validation on contact_value format

- Extend `players` table with profile fields
  - Additional fields: about_me (text, max 500 chars), fundraising_why (text - why they're raising money), thank_you_message_template (text)

**Technical Considerations**:
- Implement file size limits (photos: 10MB, videos: 100MB)
- Generate thumbnails for videos automatically
- Store original filename for download purposes
- Plan for CDN integration for media delivery
- Implement content hash to detect duplicate uploads
- Add EXIF data stripping for privacy

**Acceptance Criteria**:
- [ ] Multiple media items per player supported
- [ ] Primary photo selection enforced (only one)
- [ ] Moderation queue functional
- [ ] File upload size validations in place
- [ ] Orphaned file cleanup strategy defined

---

### Task 1.1.6: Create Poster Template and Generation Metadata Tables
**Estimated Time**: 4 hours
**Priority**: Medium

**Detailed Requirements**:
- Create `poster_templates` table
  - Fields: id, name, description, template_type (enum: coach_signup, player_fundraising, campaign_general), layout_config (JSONB - coordinates, fonts, colors), preview_image_url, is_active (boolean), created_by (FK to admins), created_at, updated_at
  - JSONB structure example:
    ```json
    {
      "dimensions": {"width": 1080, "height": 1350},
      "elements": [
        {"type": "text", "field": "player_name", "x": 100, "y": 50, "fontSize": 48, "fontFamily": "Arial Bold", "color": "#000000"},
        {"type": "image", "field": "player_photo", "x": 0, "y": 200, "width": 1080, "height": 800},
        {"type": "qr_code", "field": "donation_link", "x": 900, "y": 1200, "size": 150}
      ]
    }
    ```

- Create `generated_posters` table
  - Fields: id, poster_template_id (FK), entity_type (enum: player, coach, campaign), entity_id (integer - polymorphic), generated_file_url, qr_code_data, generation_date, downloaded_count, last_downloaded_at, created_at
  - Index on (entity_type, entity_id)

- Create `poster_customizations` table
  - Fields: id, campaign_id (FK), custom_logo_url, custom_headline (text), custom_description (text), background_color (hex), text_color (hex), accent_color (hex), created_at, updated_at

**Technical Considerations**:
- JSONB allows flexible template configurations without schema changes
- QR codes link to unique player URLs or coach signup pages
- Templates should support variable data injection
- Consider template versioning for future updates
- Store poster generation metadata for analytics

**Acceptance Criteria**:
- [ ] At least 3 default templates created
- [ ] JSONB validation schema in place
- [ ] Template preview generation working
- [ ] QR code generation library integrated
- [ ] Poster regeneration capability (when player info updates)

---

## 1.2 Authentication & Authorization System

### Task 1.2.1: Implement Multi-Role Authentication
**Estimated Time**: 8 hours
**Priority**: Critical

**Detailed Requirements**:
- Set up NextAuth.js with credentials provider
  - Configure session strategy (JWT vs database sessions - recommend database for audit trail)
  - Create custom sign-in page with Rally branding
  - Implement remember me functionality (extended session duration)

- Create authentication API endpoints:
  - POST `/api/auth/register` - New user registration
    - Accept: email, password, role (coach/player), invitation_code (for players)
    - Validate email format and domain (optional school domain whitelist)
    - Hash password with bcrypt (salt rounds: 12)
    - Send verification email
    - Return user object (without password) and session token

  - POST `/api/auth/login` - User login
    - Accept: email, password, remember_me
    - Validate credentials
    - Check email_verified status
    - Create session with appropriate expiration
    - Log login attempt (IP, user agent, success/failure)
    - Return session token and user profile

  - POST `/api/auth/logout` - Session termination
    - Invalidate current session token
    - Clear cookies
    - Log logout event

  - GET `/api/auth/session` - Get current user session
    - Return user object with role and permissions
    - Used for client-side route protection

- Create `sessions` table
  - Fields: id, user_id (FK), token (hashed, unique), ip_address, user_agent, created_at, expires_at, last_activity_at
  - Index on token and expires_at
  - Cleanup job for expired sessions

- Create `login_attempts` table (security audit)
  - Fields: id, email, ip_address, user_agent, success (boolean), failure_reason (enum: invalid_email, invalid_password, account_locked, email_not_verified), attempted_at
  - Implement rate limiting (5 failures = 15 min lockout)

**Technical Considerations**:
- Never store passwords in plain text
- Use timing-safe comparison for password checks
- Implement CSRF tokens for all POST requests
- Set secure, httpOnly cookies
- Consider OAuth integration (Google, Microsoft) for future

**Acceptance Criteria**:
- [ ] Users can register with unique email
- [ ] Password requirements enforced (min 8 chars, 1 uppercase, 1 number, 1 special)
- [ ] Login successful with correct credentials
- [ ] Login fails with incorrect credentials
- [ ] Sessions persist across browser refresh
- [ ] Logout clears session completely
- [ ] Rate limiting prevents brute force attacks

---

### Task 1.2.2: Set Up Role-Based Access Control (RBAC)
**Estimated Time**: 6 hours
**Priority**: Critical

**Detailed Requirements**:
- Create `roles` table
  - Fields: id, name (enum: admin, coach, player), description, created_at
  - Seed with three base roles

- Create `permissions` table
  - Fields: id, resource (string - e.g., "campaigns", "players", "donations"), action (enum: create, read, update, delete, approve, export), description
  - Examples:
    - campaigns:create, campaigns:read, campaigns:update, campaigns:delete
    - players:invite, players:read, players:update
    - donations:read, donations:export, donations:refund
    - posters:generate, posters:download
    - analytics:view_all, analytics:view_own

- Create `role_permissions` join table
  - Fields: id, role_id (FK), permission_id (FK)
  - Define permission sets:
    - **Admin**: ALL permissions
    - **Coach**: campaigns:*, players:*, posters:generate, analytics:view_own, donations:read (own campaigns only)
    - **Player**: players:update (own profile only), posters:download (own only), analytics:view_own

- Create middleware functions:
  ```typescript
  // Protect API routes
  withAuth(handler) // Requires any authenticated user
  withRole(['coach', 'admin']) // Requires specific role
  withPermission('campaigns:create') // Requires specific permission

  // Check resource ownership
  canAccessCampaign(userId, campaignId) // Checks if coach owns campaign
  canAccessPlayer(userId, playerId) // Checks if player owns profile or coach manages them
  ```

- Implement permission checking service:
  - `hasPermission(userId, permission)` - Check if user has permission
  - `hasAnyPermission(userId, permissions[])` - Check if user has any of permissions
  - `hasAllPermissions(userId, permissions[])` - Check if user has all permissions
  - `canAccessResource(userId, resourceType, resourceId)` - Check ownership/access

**Technical Considerations**:
- Cache permission checks in session to reduce DB queries
- Implement hierarchical permissions (admin inherits all)
- Plan for custom roles in future
- Use middleware on ALL protected API routes
- Implement both route-level and data-level security

**Acceptance Criteria**:
- [ ] Each role has distinct permission set
- [ ] API routes protected with appropriate middleware
- [ ] Unauthorized access returns 403 Forbidden
- [ ] Coaches can only access their own campaigns/players
- [ ] Players can only update their own profiles
- [ ] Admins have unrestricted access
- [ ] Permission checks are performant (<10ms)

---

### Task 1.2.3: Build Email Verification System
**Estimated Time**: 5 hours
**Priority**: Critical

**Detailed Requirements**:
- Create `email_verification_tokens` table
  - Fields: id, user_id (FK), token (unique, indexed), created_at, expires_at (24 hours from creation), verified_at
  - Auto-delete tokens after 30 days

- Create verification API endpoints:
  - POST `/api/auth/send-verification-email`
    - Accept: user_id or email
    - Generate unique token (crypto.randomBytes(32).toString('hex'))
    - Store token with expiration
    - Send email with verification link: `https://rally.com/verify-email?token={token}`
    - Rate limit: 1 email per 5 minutes per user

  - GET `/api/auth/verify-email?token={token}`
    - Validate token exists and not expired
    - Mark user.email_verified = true
    - Mark token.verified_at = now
    - Redirect to success page or login
    - Log verification event

- Create verification email template:
  - Subject: "Verify your Rally account"
  - Include: User's name, verification link (button), link expiration notice
  - Fallback: Plain text version
  - Branding: Rally logo and colors

- Add verification gate to login flow:
  - If email not verified, show "Please verify your email" message
  - Provide "Resend verification email" button
  - Allow grace period (optional: 24 hours to use app before enforcing)

**Technical Considerations**:
- Use cryptographically secure random tokens
- Implement token expiration and cleanup
- Handle already-verified users gracefully
- Consider magic link authentication as alternative
- Rate limit to prevent email spam

**Acceptance Criteria**:
- [ ] New users receive verification email immediately
- [ ] Verification link successfully verifies email
- [ ] Expired tokens show appropriate error
- [ ] Invalid tokens show appropriate error
- [ ] Resend functionality works with rate limiting
- [ ] Verified users can log in, unverified cannot (or have limited access)
- [ ] Email delivery confirmed in test environment

---

### Task 1.2.4: Implement Password Reset Functionality
**Estimated Time**: 4 hours
**Priority**: High

**Detailed Requirements**:
- Create `password_reset_tokens` table
  - Fields: id, user_id (FK), token (unique, indexed), created_at, expires_at (1 hour), used_at
  - Auto-delete after 7 days

- Create password reset API endpoints:
  - POST `/api/auth/forgot-password`
    - Accept: email
    - Validate email exists (don't reveal if it doesn't for security)
    - Generate unique token
    - Send password reset email
    - Rate limit: 1 request per 5 minutes per email
    - Always return success to prevent email enumeration

  - POST `/api/auth/reset-password`
    - Accept: token, new_password, confirm_password
    - Validate token exists and not expired
    - Validate passwords match and meet requirements
    - Hash new password
    - Update user.password_hash
    - Mark token.used_at = now
    - Invalidate all existing sessions for security
    - Send confirmation email
    - Return success

- Create password reset email template:
  - Subject: "Reset your Rally password"
  - Include: Reset link (button), expiration notice (1 hour)
  - Warning: "Didn't request this? Ignore this email"

- Create password reset pages:
  - `/forgot-password` - Form to enter email
  - `/reset-password?token={token}` - Form to enter new password
  - Success/error states for both

**Technical Considerations**:
- Never reveal whether email exists in system
- Invalidate all sessions after password reset
- Send confirmation email after successful reset
- Implement same password requirements as registration
- Log all password reset attempts

**Acceptance Criteria**:
- [ ] User receives reset email when requesting password reset
- [ ] Reset link successfully changes password
- [ ] Expired tokens cannot reset password
- [ ] Used tokens cannot be reused
- [ ] Invalid tokens show appropriate error
- [ ] User can log in with new password
- [ ] Old password no longer works
- [ ] Confirmation email sent after reset

---

### Task 1.2.5: Set Up Session Management
**Estimated Time**: 3 hours
**Priority**: Critical

**Detailed Requirements**:
- Configure NextAuth.js session handling:
  - Session duration: 30 days (with remember me) or 7 days (without)
  - Refresh token rotation enabled
  - Absolute session timeout: 90 days

- Implement session middleware for API routes:
  ```typescript
  export async function getSession(req) {
    // Extract token from cookie or Authorization header
    // Validate token
    // Check expiration
    // Refresh session if near expiration
    // Return user object with role and permissions
  }
  ```

- Implement session refresh mechanism:
  - Update `last_activity_at` on each authenticated request
  - Extend expiration if within 24 hours of expiry
  - Issue new token when old one is >50% expired (rolling sessions)

- Create session management endpoints:
  - GET `/api/auth/sessions` - List all active sessions for user
    - Return: list of sessions with IP, device, location (from IP), last activity
  - DELETE `/api/auth/sessions/:sessionId` - Revoke specific session
  - DELETE `/api/auth/sessions/all` - Revoke all sessions (except current)

- Implement client-side session handling:
  - Create React context for auth state
  - Automatically refresh token before expiration
  - Handle session expiration gracefully (redirect to login)
  - Show session expiration warning (5 minutes before)

**Technical Considerations**:
- Store session tokens in httpOnly, secure cookies
- Implement CSRF protection with double-submit cookies
- Consider Redis for session storage at scale
- Implement session fixation prevention
- Log all session creation/destruction events

**Acceptance Criteria**:
- [ ] Sessions persist across browser refresh
- [ ] Sessions expire after configured duration
- [ ] Session activity extends expiration
- [ ] Users can view active sessions
- [ ] Users can revoke individual sessions
- [ ] Logout invalidates current session
- [ ] Concurrent sessions supported
- [ ] Session hijacking mitigations in place

---

## 1.3 Development Environment

### Task 1.3.1: Configure Database
**Estimated Time**: 3 hours
**Priority**: Critical

**Detailed Requirements**:
- Set up PostgreSQL database:
  - Install PostgreSQL 15+ locally or use Docker
  - Create development database: `rally_development`
  - Create test database: `rally_test`
  - Create production database (managed service): AWS RDS or Supabase

- Configure Prisma ORM:
  - Install: `npm install prisma @prisma/client`
  - Initialize: `npx prisma init`
  - Create `schema.prisma` with all models from tasks 1.1.1-1.1.6
  - Configure connection string in `.env`:
    ```
    DATABASE_URL="postgresql://user:password@localhost:5432/rally_development"
    ```

- Create database migration strategy:
  - Use Prisma Migrate for schema changes
  - Name migrations descriptively: `npx prisma migrate dev --name add_users_table`
  - Create rollback scripts for each migration
  - Document breaking changes

- Set up database seeding:
  - Create `prisma/seed.ts` script
  - Generate sample data:
    - 3 schools with different configurations
    - 10 coaches across schools
    - 50 players across coaches
    - 5 active campaigns
    - 200 sample donations
  - Run: `npx prisma db seed`

- Configure database backup strategy:
  - Daily automated backups
  - Point-in-time recovery enabled
  - Test restoration procedure

**Technical Considerations**:
- Use connection pooling (PgBouncer or Prisma's built-in)
- Enable query logging in development
- Set up database monitoring (slow query log)
- Configure SSL for production connections
- Implement read replicas for scaling

**Acceptance Criteria**:
- [ ] Database accessible from application
- [ ] All migrations run successfully
- [ ] Seed script generates realistic data
- [ ] Rollback migrations tested
- [ ] Connection pooling configured
- [ ] Query performance monitoring enabled
- [ ] Backup and restore procedure documented

---

### Task 1.3.2: Set Up API Structure and Routing
**Estimated Time**: 4 hours
**Priority**: Critical

**Detailed Requirements**:
- Configure Next.js API routes structure:
  ```
  /api
    /auth
      /register.ts
      /login.ts
      /logout.ts
      /verify-email.ts
      /forgot-password.ts
      /reset-password.ts
    /campaigns
      /index.ts (GET, POST)
      /[id].ts (GET, PUT, DELETE)
      /[id]/players.ts
      /[id]/donations.ts
      /[id]/analytics.ts
    /players
      /index.ts (GET)
      /[id].ts (GET, PUT)
      /[id]/media.ts (POST, DELETE)
      /invite.ts (POST)
    /donations
      /create.ts (POST)
      /[id]/refund.ts (POST)
    /posters
      /generate.ts (POST)
      /[id]/download.ts (GET)
    /admin
      /schools.ts
      /users.ts
      /transactions.ts
      /analytics.ts
    /webhooks
      /stripe.ts (POST)
  ```

- Create API utilities and middleware:
  - `lib/api/handler.ts` - Wraps handlers with error handling
  - `lib/api/validate.ts` - Request validation using Zod
  - `lib/api/response.ts` - Standardized response formats
  - `lib/api/errors.ts` - Custom error classes

- Implement standardized response format:
  ```typescript
  // Success response
  {
    success: true,
    data: {...},
    meta: {
      page: 1,
      total: 100,
      // pagination info
    }
  }

  // Error response
  {
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Invalid email format",
      details: {...}
    }
  }
  ```

- Create request validation schemas (Zod):
  ```typescript
  // Example: Campaign creation
  const createCampaignSchema = z.object({
    name: z.string().min(3).max(100),
    description: z.string().max(1000),
    goal_amount: z.number().positive(),
    start_date: z.string().datetime(),
    end_date: z.string().datetime(),
    program_id: z.string().uuid()
  });
  ```

- Implement error handling middleware:
  - Catch all unhandled errors
  - Log errors with context (user, endpoint, params)
  - Return appropriate HTTP status codes
  - Hide internal errors from clients (production)
  - Send error notifications for critical failures

**Technical Considerations**:
- Use HTTP method-based routing (GET, POST, PUT, DELETE)
- Implement request validation before processing
- Use consistent naming conventions
- Version API if needed (/api/v1/)
- Implement request/response logging

**Acceptance Criteria**:
- [ ] All API routes follow RESTful conventions
- [ ] Request validation prevents invalid data
- [ ] Error responses are consistent and helpful
- [ ] Authentication required on protected routes
- [ ] CORS configured correctly
- [ ] API documentation generated (optional: use Swagger)

---

### Task 1.3.3: Configure Environment Variables
**Estimated Time**: 2 hours
**Priority**: Critical

**Detailed Requirements**:
- Create `.env.example` file with all required variables:
  ```env
  # Database
  DATABASE_URL=postgresql://user:password@localhost:5432/rally_development

  # Authentication
  NEXTAUTH_URL=http://localhost:3000
  NEXTAUTH_SECRET=generate-random-secret-here
  JWT_SECRET=generate-another-secret-here

  # Stripe
  STRIPE_SECRET_KEY=sk_test_xxx
  STRIPE_PUBLISHABLE_KEY=pk_test_xxx
  STRIPE_WEBHOOK_SECRET=whsec_xxx
  STRIPE_CONNECTED_ACCOUNT_ID=acct_xxx

  # AWS S3
  AWS_ACCESS_KEY_ID=xxx
  AWS_SECRET_ACCESS_KEY=xxx
  AWS_REGION=us-east-1
  AWS_S3_BUCKET=rally-media

  # Email (SendGrid)
  SENDGRID_API_KEY=SG.xxx
  FROM_EMAIL=noreply@rally.com

  # SMS (Twilio)
  TWILIO_ACCOUNT_SID=xxx
  TWILIO_AUTH_TOKEN=xxx
  TWILIO_PHONE_NUMBER=+1xxx

  # Application
  NODE_ENV=development
  NEXT_PUBLIC_APP_URL=http://localhost:3000

  # Feature Flags
  ENABLE_SMS_NOTIFICATIONS=false
  ENABLE_RECURRING_DONATIONS=true

  # Monitoring
  SENTRY_DSN=https://xxx@sentry.io/xxx
  ```

- Create `.env.local` for local development (git ignored)
- Create `.env.production` template
- Create `.env.test` for testing environment

- Implement environment variable validation:
  ```typescript
  // lib/env.ts
  import { z } from 'zod';

  const envSchema = z.object({
    DATABASE_URL: z.string().url(),
    NEXTAUTH_SECRET: z.string().min(32),
    STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
    // ... all variables
  });

  export const env = envSchema.parse(process.env);
  ```

- Document each environment variable:
  - Purpose
  - Where to obtain the value
  - Required vs optional
  - Default values

**Technical Considerations**:
- Never commit `.env.local` or `.env.production`
- Use strong random secrets (32+ characters)
- Rotate secrets regularly in production
- Use different Stripe keys for test/production
- Implement secret management (AWS Secrets Manager, Vercel, etc.)

**Acceptance Criteria**:
- [ ] All required environment variables documented
- [ ] Validation catches missing variables at startup
- [ ] Development environment loads correctly
- [ ] Test environment isolated from development
- [ ] .env files properly gitignored
- [ ] Team members can set up environment from .env.example

---

### Task 1.3.4: Set Up Testing Framework
**Estimated Time**: 5 hours
**Priority**: High

**Detailed Requirements**:
- Install testing dependencies:
  ```bash
  npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event
  npm install --save-dev @testing-library/react-hooks
  npm install --save-dev supertest # API testing
  npm install --save-dev @faker-js/faker # Generate test data
  ```

- Configure Jest (`jest.config.js`):
  ```javascript
  module.exports = {
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    moduleNameMapper: {
      '^@/(.*)$': '<rootDir>/$1',
    },
    collectCoverageFrom: [
      'app/**/*.{js,jsx,ts,tsx}',
      'lib/**/*.{js,jsx,ts,tsx}',
      '!**/*.d.ts',
    ],
  };
  ```

- Create test utilities:
  - `tests/utils/db.ts` - Database test helpers (setup, teardown, reset)
  - `tests/utils/auth.ts` - Create authenticated test sessions
  - `tests/utils/factories.ts` - Test data factories
  - `tests/utils/api.ts` - API request helpers

- Example factory pattern:
  ```typescript
  // tests/utils/factories.ts
  export async function createTestCoach(overrides = {}) {
    return await prisma.coach.create({
      data: {
        user: {
          create: {
            email: faker.internet.email(),
            password_hash: await hash('password123'),
            email_verified: true,
          }
        },
        first_name: faker.person.firstName(),
        last_name: faker.person.lastName(),
        ...overrides
      }
    });
  }
  ```

- Set up test database:
  - Use separate test database
  - Reset database before each test suite
  - Use transactions for test isolation

- Create npm scripts:
  ```json
  {
    "scripts": {
      "test": "jest",
      "test:watch": "jest --watch",
      "test:coverage": "jest --coverage",
      "test:e2e": "playwright test"
    }
  }
  ```

- Write example tests for each type:
  - Unit test (utility function)
  - Integration test (API endpoint)
  - Component test (React component)

**Technical Considerations**:
- Isolate tests from each other (no shared state)
- Use transactions for database tests (rollback after test)
- Mock external services (Stripe, SendGrid)
- Use factories to generate test data
- Aim for 80%+ code coverage

**Acceptance Criteria**:
- [ ] Jest configured and running
- [ ] Test database separate from development
- [ ] Example tests for each layer (unit, integration, component)
- [ ] Test utilities created and documented
- [ ] Tests can run in parallel
- [ ] Coverage reports generated
- [ ] CI/CD pipeline can run tests

---

### Task 1.3.5: Configure File Upload System
**Estimated Time**: 6 hours
**Priority**: High

**Detailed Requirements**:
- Set up AWS S3 bucket:
  - Create bucket: `rally-media-{environment}`
  - Configure CORS for direct uploads
  - Set up lifecycle rules (delete unattached files after 7 days)
  - Create folders: `/player-photos/`, `/player-videos/`, `/posters/`, `/school-logos/`
  - Configure CloudFront CDN for fast delivery

- Install AWS SDK:
  ```bash
  npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
  ```

- Create upload API endpoint:
  ```typescript
  // /api/upload/presigned-url
  // Returns presigned URL for direct browser upload to S3
  POST {
    file_name: string,
    file_type: string, // mime type
    file_size: number,
    upload_type: 'player_photo' | 'player_video' | 'poster' | 'school_logo'
  }

  Response: {
    upload_url: string, // Presigned URL
    file_url: string, // Final URL after upload
    expires_in: number // Seconds
  }
  ```

- Implement file upload client component:
  ```typescript
  // components/FileUpload.tsx
  // Features:
  // - Drag and drop
  // - File type validation
  // - File size validation
  // - Progress bar
  // - Image preview
  // - Video thumbnail generation
  ```

- Create file processing service:
  - Image processing (resize, compress, generate thumbnails)
    - Use Sharp library: `npm install sharp`
    - Generate sizes: thumbnail (200x200), medium (800x800), original
  - Video processing (generate thumbnail from first frame)
    - Use FFmpeg or cloud service
    - Extract metadata (duration, dimensions)
  - File validation (mime type, actual file type, virus scan)

- Implement file size limits:
  - Player photos: 10MB max
  - Player videos: 100MB max
  - School logos: 5MB max
  - Posters: Generated PDFs only

- Create file cleanup job:
  - Scan for orphaned files (no database reference)
  - Delete files older than 7 days with no associations
  - Run daily via cron job

**Technical Considerations**:
- Use presigned URLs for security (no public write access)
- Implement virus scanning (ClamAV or AWS S3 Malware Protection)
- Generate unique file names (UUID + original extension)
- Store file metadata in database
- Implement rate limiting on uploads
- Consider costs (S3 storage, CloudFront bandwidth)

**Acceptance Criteria**:
- [ ] Images upload successfully to S3
- [ ] Videos upload successfully to S3
- [ ] File size limits enforced
- [ ] File type validation prevents malicious uploads
- [ ] Thumbnails generated automatically
- [ ] Progress indicator shows during upload
- [ ] Files accessible via CDN
- [ ] Orphaned files cleaned up automatically

---

# PHASE 2: Coach Portal (Weeks 3-5)

## 2.1 Coach Dashboard

### Task 2.1.1: Build Coach Registration and Onboarding Flow
**Estimated Time**: 8 hours
**Priority**: High

**Detailed Requirements**:

- Create coach registration page (`/coach/register`):
  - **Step 1: Account Creation**
    - Fields: email, password, confirm password
    - Email validation (format, uniqueness)
    - Password strength indicator
    - Terms of service checkbox
    - CAPTCHA to prevent bots

  - **Step 2: Personal Information**
    - Fields: first_name, last_name, phone
    - Phone number formatting and validation
    - Optional: profile photo upload

  - **Step 3: School/Organization**
    - Option A: Select existing school from dropdown (searchable)
    - Option B: Request new school
      - Fields: school_name, district, city, state, zip_code
      - Upload school logo
      - Sets status to 'pending' for admin approval
    - Sport/Program selection or creation

  - **Step 4: Verification**
    - Send email verification
    - Optional: SMS verification for phone
    - "Check your email" confirmation screen

- Create onboarding wizard (`/coach/onboarding`) - shows after first login:
  - **Welcome screen**: Platform introduction video
  - **Tour**: Highlight key features (campaigns, player invites, tracking)
  - **First Campaign Setup**: Guided campaign creation
  - **Invite Players**: Bulk invite interface
  - **Completion**: Checklist with next steps

- Create coach profile completion tracking:
  - Database field: `coaches.onboarding_completed` (boolean)
  - Show progress indicator (e.g., "Profile 75% complete")
  - Prompt to complete missing information

- Implement school approval workflow:
  - New school requests go to admin approval queue
  - Email admin when new school requested
  - Email coach when school approved/rejected
  - Allow coach limited access while pending

**Technical Considerations**:
- Multi-step form state management (React Hook Form)
- Form validation on client and server
- Progressive saving (save each step)
- Allow skipping optional steps
- Analytics tracking (where users drop off)

**Acceptance Criteria**:
- [ ] Coach can complete registration in <5 minutes
- [ ] Email verification required before full access
- [ ] New schools properly submitted for approval
- [ ] Onboarding wizard introduces all features
- [ ] Profile completion prompts shown
- [ ] Mobile-responsive registration flow
- [ ] Form validation prevents invalid data

---

### Task 2.1.2: Create Campaign Creation Interface
**Estimated Time**: 10 hours
**Priority**: High

**Detailed Requirements**:

- Create campaign creation page (`/coach/campaigns/new`):

  - **Basic Information Section**:
    - Campaign name (required, max 100 chars)
    - Program/Team selection (dropdown from coach's programs)
    - Sport type (auto-filled from program, editable)
    - Season (dropdown: Fall, Winter, Spring, Summer)
    - Description (rich text editor, max 1000 chars)
      - Support: bold, italic, lists, links
      - Preview mode

  - **Goals & Dates Section**:
    - Fundraising goal amount (required, min $100)
      - Display suggested goals based on team size
      - Show examples: "$10,000 for new uniforms"
    - Start date (date picker, must be future or today)
    - End date (date picker, must be after start date)
    - Duration auto-calculated and displayed

  - **Donation Settings Section**:
    - Minimum donation amount (default $10)
    - Suggested donation amounts (array of 3-5 amounts)
      - Default: [$25, $50, $100, $250, $500]
      - Custom amounts allowed
    - Allow anonymous donations (checkbox, default true)
    - Enable recurring donations (checkbox)
    - Custom thank you message (textarea, max 500 chars)

  - **Player Settings Section**:
    - Individual player goal (optional)
    - Allow players to customize their page (checkbox)
    - Require coach approval for player media (checkbox)
    - Enable player leaderboard (checkbox)

  - **Poster Customization Section**:
    - Select poster template (visual picker)
    - Upload custom campaign logo (optional)
    - Custom headline (text input)
    - Background color picker
    - Text color picker
    - Preview generated poster in real-time

  - **Review & Launch Section**:
    - Summary of all settings
    - "Save as Draft" button
    - "Launch Campaign" button
    - Campaign URL preview: `rally.com/c/{unique-code}`

- Create campaign draft functionality:
  - Auto-save form every 30 seconds
  - "Save as Draft" creates campaign with status='draft'
  - Drafts accessible from campaigns list
  - Resume editing drafts

- Implement campaign validation:
  - Server-side validation of all fields
  - Business rule: end_date > start_date
  - Goal amount must be positive
  - Coach can only create campaigns for their programs

- Create success screen after launch:
  - Confirmation message
  - Campaign URL (shareable)
  - Next steps: "Invite Players" button
  - Download coach signup poster button

**Technical Considerations**:
- Form state management (React Hook Form + Zod validation)
- Real-time poster preview (debounced updates)
- Image upload and preview
- Rich text editor (Tiptap or similar)
- Date picker with timezone handling
- Mobile-responsive design

**Acceptance Criteria**:
- [ ] Coach can create campaign in <10 minutes
- [ ] All required fields validated
- [ ] Draft campaigns saveable and resumable
- [ ] Poster preview updates in real-time
- [ ] Campaign URL generated upon creation
- [ ] Success confirmation shown
- [ ] Campaign appears in coach's campaign list

---

### Task 2.1.3: Build Team/Player Roster Management
**Estimated Time**: 8 hours
**Priority**: High

**Detailed Requirements**:

- Create roster management page (`/coach/campaigns/[id]/roster`):

  - **Player List View**:
    - Table with columns:
      - Player name (with profile photo thumbnail)
      - Email
      - Phone
      - Status (Invited, Active, Inactive)
      - Amount raised
      - Donors count
      - Last activity date
      - Actions (View, Edit, Remove)
    - Sortable by any column
    - Filterable by status
    - Search by name or email
    - Pagination (20 per page)
    - Bulk actions:
      - Select multiple players
      - Send reminder email
      - Remove from campaign
      - Export selected

  - **Add Players Section**:
    - Two methods:
      - **Manual Entry**: Form to add one player at a time
        - Fields: first_name, last_name, email, phone, jersey_number (optional)
      - **Bulk Upload**: CSV import
        - Download CSV template
        - Upload CSV file
        - Preview imported data
        - Validate emails (format, duplicates)
        - Confirm import
    - Both methods trigger invitation emails

  - **Player Cards View** (alternative to table):
    - Grid of player cards
    - Each card shows:
      - Profile photo
      - Name
      - Amount raised (progress bar)
      - Number of donors
      - Quick action buttons
    - Visual status indicators

  - **Roster Statistics** (top of page):
    - Total players invited
    - Active players (accepted invitation)
    - Total raised by all players
    - Average per player
    - Top fundraiser (spotlight)

- Create individual player detail modal:
  - Player information (editable by coach)
  - Fundraising statistics
  - Recent donations list
  - Personal fundraising page link
  - Activity log (joined, uploaded photo, shared link, etc.)
  - Approve/reject player media
  - Send individual message

- Implement player invitation workflow:
  - Generate unique invitation link per player
  - Send email with:
    - Campaign details
    - Invitation link
    - Instructions to join
    - Coach's personal message (optional)
  - Track invitation status:
    - Sent
    - Opened (email tracking)
    - Clicked link
    - Completed signup
  - Resend invitation option

- Create CSV import functionality:
  - Template format:
    ```csv
    first_name,last_name,email,phone,jersey_number
    John,Smith,john@email.com,(555) 123-4567,12
    ```
  - Validate CSV structure
  - Check for duplicate emails
  - Preview before confirming
  - Show import results (success/errors)

**Technical Considerations**:
- Efficient table rendering for large rosters (virtual scrolling)
- CSV parsing library (Papa Parse)
- Email validation and sanitization
- Prevent duplicate player invitations
- Track invitation metrics

**Acceptance Criteria**:
- [ ] Coach can view all players in campaign
- [ ] Table sorting and filtering work correctly
- [ ] Manual player addition sends invitation
- [ ] CSV bulk upload successfully imports valid data
- [ ] CSV import shows clear error messages for invalid data
- [ ] Player detail modal shows comprehensive information
- [ ] Bulk actions work on selected players
- [ ] Invitation links are unique and secure
- [ ] Resend invitation works with rate limiting

---

### Task 2.1.4: Display Aggregate Fundraising Metrics
**Estimated Time**: 6 hours
**Priority**: High

**Detailed Requirements**:

- Create campaign dashboard overview (`/coach/campaigns/[id]`):

  - **Hero Stats Section** (large cards):
    - **Total Raised**
      - Large prominent number: $XX,XXX
      - Percentage of goal: 67% (progress bar)
      - Trend indicator: "+$500 today" (green up arrow)
    - **Number of Donors**
      - Total unique donors
      - Average donation amount
      - Trend: "+12 donors this week"
    - **Active Players**
      - Number of players fundraising
      - Percentage of invited players
      - Players yet to join
    - **Days Remaining**
      - Countdown to campaign end
      - If ended: "Campaign ended X days ago"

  - **Visual Progress Indicators**:
    - Goal progress bar (animated)
    - Milestones markers (25%, 50%, 75%, 100%)
    - "You're XX% to your goal!" message

  - **Recent Activity Feed**:
    - Last 10 donations (real-time updates)
    - Show: donor name, amount, player name, time ago
    - "John D. donated $50 to Sarah's page - 5 minutes ago"
    - Filter by: All activity, Donations, Player joins, Shares

  - **Fundraising Timeline Chart**:
    - Line graph showing donations over time
    - X-axis: dates, Y-axis: cumulative amount
    - Toggle views: Daily, Weekly, Cumulative
    - Goal line overlay
    - Predict completion date based on trend

  - **Donor Demographics** (optional):
    - Pie chart: donation size ranges
      - <$25, $25-$50, $50-$100, $100-$250, $250+
    - Map: donor locations (if zip code collected)

  - **Top Performers Section**:
    - Top 5 fundraising players (podium style)
    - Show: rank, name, photo, amount raised, donors
    - Motivational message: "Great work, team!"

- Create campaign comparison view:
  - Compare current campaign to coach's past campaigns
  - Metrics: total raised, donors, player participation rate
  - Show what's working better/worse

- Implement real-time updates:
  - Use WebSocket or polling for live donation updates
  - Show notification when new donation received
  - Update stats without page refresh

- Create exportable reports:
  - "Export Report" button
  - Generate PDF with:
    - Campaign summary
    - All statistics
    - Charts and graphs
    - Player performance table
  - Also available as CSV for custom analysis

**Technical Considerations**:
- Use charting library (Recharts, Chart.js)
- Implement efficient data aggregation (database queries)
- Cache frequently accessed metrics
- Real-time updates (WebSocket or Server-Sent Events)
- Responsive design for mobile viewing
- Consider time zones for date-based analytics

**Acceptance Criteria**:
- [ ] Dashboard loads in <2 seconds
- [ ] All stats display accurately
- [ ] Charts render correctly on all screen sizes
- [ ] Real-time updates work (new donations appear)
- [ ] Export to PDF generates readable report
- [ ] Progress bar animates smoothly
- [ ] Mobile view is usable and readable

---

### Task 2.1.5: Show Individual Player Performance Tracking
**Estimated Time**: 5 hours
**Priority**: High

**Detailed Requirements**:

- Create player performance view within campaign (`/coach/campaigns/[id]/players`):

  - **Player Leaderboard**:
    - Ranked list of all players
    - Columns:
      - Rank (#1, #2, etc.)
      - Player name + photo
      - Amount raised
      - Number of donors
      - Average donation
      - Progress to personal goal (if set)
      - Link clicks (how many people visited their page)
      - Conversion rate (donors / link clicks)
    - Color-coded performance tiers:
      - Gold (top 10%)
      - Silver (top 25%)
      - Bronze (top 50%)
      - Standard (rest)
    - Sort options: Amount raised, Donor count, Conversion rate

  - **Performance Filters**:
    - View by: All players, Top performers, Needs encouragement (low/no donations)
    - Status filter: Active, Invited (not joined), Inactive

  - **Individual Player Stats Card** (drill-down):
    - Click player to see detailed breakdown:
      - Total raised timeline chart
      - Donors list with amounts and dates
      - Link sharing activity (when/where shared)
      - Page views over time
      - Engagement metrics:
        - Profile completeness (photo uploaded, story written, etc.)
        - Social shares count
        - Email sends count
    - Compare to team average
    - Suggestions for improvement

  - **Team Performance Overview**:
    - Total team raised
    - Average per player
    - Median per player
    - Distribution graph (how many players in each $ range)
    - Participation rate (% who have joined and are active)

- Implement performance alerts for coach:
  - Player hasn't joined after 3 days: "Remind Sarah to join"
  - Player joined but no donations yet: "Encourage John to share his link"
  - Player approaching goal: "Alex is 90% to goal! Send congrats"
  - Top performer recognition: "Emma is #1! Celebrate her success"

- Create motivational messaging system:
  - Coach can send messages to players:
    - Individual messages
    - Group messages (to top performers, to those needing encouragement)
  - Template messages:
    - "Great job reaching X donors!"
    - "Keep pushing! You're close to your goal"
    - "Don't forget to share your link!"

**Technical Considerations**:
- Efficient sorting and filtering for large rosters
- Real-time metric updates
- Responsive table design (mobile: card view)
- Performance optimization for analytics calculations
- Gamification elements to motivate players

**Acceptance Criteria**:
- [ ] Leaderboard ranks players accurately
- [ ] Sorting by different columns works correctly
- [ ] Player detail view shows comprehensive stats
- [ ] Performance tiers visually distinct
- [ ] Coach can identify underperforming players easily
- [ ] Alerts surface actionable insights
- [ ] Mobile view is usable

---

### Task 2.1.6: Create Campaign Settings Management
**Estimated Time**: 4 hours
**Priority**: Medium

**Detailed Requirements**:

- Create campaign settings page (`/coach/campaigns/[id]/settings`):

  - **Basic Settings Tab**:
    - Edit campaign name
    - Edit description (rich text)
    - Edit goal amount (warning if lowering below current raised)
    - Edit start/end dates
      - Cannot set start date to past if campaign active
      - Warning if extending end date
    - Campaign status toggle:
      - Active: accepting donations
      - Paused: donations disabled, page shows "Campaign paused"
      - Ended: donations disabled, page shows "Campaign ended"
    - Save changes button

  - **Donation Settings Tab**:
    - Minimum donation amount
    - Suggested amounts (add/remove/edit)
    - Allow anonymous donations toggle
    - Enable recurring donations toggle
    - Custom thank you message
    - Donation receipt email template customization

  - **Player Settings Tab**:
    - Individual player goals (set default for all)
    - Require media approval by coach (toggle)
    - Allow players to edit their story (toggle)
    - Enable/disable player leaderboard visibility
    - Player invitation email template customization

  - **Poster & Branding Tab**:
    - Change poster template
    - Upload new campaign logo
    - Edit headline and description
    - Color scheme editor
    - Preview poster
    - Regenerate all player posters (if template changed)

  - **Notifications Tab**:
    - Email notification preferences for coach:
      - New donation (instant, daily digest, never)
      - New player joins (instant, daily digest)
      - Milestone reached (instant)
      - Campaign ending soon (7 days before, 3 days, 1 day)
    - SMS notifications (if enabled)

  - **Danger Zone**:
    - Pause campaign button (with confirmation)
    - End campaign early (with confirmation and explanation)
    - Delete campaign (only if no donations, requires password)

- Implement settings validation:
  - Cannot lower goal below amount already raised
  - Cannot set end date before current date
  - Cannot delete campaign with donations

- Create audit log for settings changes:
  - Track who changed what and when
  - Display in admin view
  - Example: "Coach John changed goal from $10,000 to $15,000 on 1/15/2025"

**Technical Considerations**:
- Tabbed interface for organization
- Form validation (client and server)
- Confirmation modals for destructive actions
- Real-time preview for poster changes
- Settings sync across all player pages
- Audit logging for compliance

**Acceptance Criteria**:
- [ ] Coach can update all campaign settings
- [ ] Changes save successfully
- [ ] Validation prevents invalid configurations
- [ ] Confirmation required for destructive actions
- [ ] Poster regeneration works when template changes
- [ ] Notification preferences respected
- [ ] Audit log captures all changes

---

## 2.2 Player Invitation System

### Task 2.2.1: Build Bulk Player Invitation via Email
**Estimated Time**: 6 hours
**Priority**: High

**Detailed Requirements**:

- Create bulk invitation interface (`/coach/campaigns/[id]/invite`):

  - **CSV Upload Section**:
    - Download CSV template button
      - Template includes: first_name, last_name, email, phone (optional), jersey_number (optional)
      - Example row included in template
    - File upload dropzone (drag and drop)
    - File validation:
      - CSV format only
      - Max 500 rows (prevents abuse)
      - Max file size: 1MB
    - Upload progress indicator

  - **Data Preview & Validation**:
    - Show parsed data in table
    - Validation checks:
      - Required fields present (first_name, last_name, email)
      - Email format validation
      - Duplicate emails within file
      - Duplicate emails with existing players in campaign
      - Invalid phone number format (if provided)
    - Show validation errors inline:
      - Red highlight for errors
      - Error message tooltip
      - "Fix errors before continuing" message
    - Allow editing data in preview table
    - Option to remove invalid rows

  - **Email Customization**:
    - Subject line (default: "{Coach Name} invited you to join {Campaign Name}")
    - Personal message from coach (textarea, optional)
      - Character limit: 500
      - Preview formatted email
    - Merge fields available:
      - {{player_name}}
      - {{coach_name}}
      - {{campaign_name}}
      - {{invitation_link}}

  - **Send Options**:
    - Send immediately (default)
    - Schedule for later (date/time picker)
    - Test send (to coach's email)

  - **Confirmation & Send**:
    - Summary: "You're about to invite X players"
    - Estimated send time
    - Cost estimate (if charged per email)
    - "Send Invitations" button
    - Loading state while sending

  - **Success Screen**:
    - "Invitations sent successfully!"
    - Summary: X invitations sent, Y failed (with reasons)
    - Download failed invitations CSV
    - Link to roster to track status

- Create invitation email template:
  ```html
  Subject: {coach_name} invited you to join {campaign_name}

  Hi {player_name},

  {coach_name} has invited you to participate in {campaign_name} for {school_name}.

  {personal_message_from_coach}

  Join now to:
  - Create your personal fundraising page
  - Upload your photo or video
  - Share with family and friends
  - Track your fundraising progress

  [Join Campaign Button - links to unique invitation URL]

  If you have any questions, contact {coach_name} at {coach_email}.

  Rally - Making fundraising simple
  ```

- Implement invitation API endpoint:
  ```typescript
  POST /api/campaigns/[id]/invite
  {
    players: [
      { first_name, last_name, email, phone, jersey_number }
    ],
    custom_message: string,
    send_at: datetime (optional)
  }

  // Creates player records, generates unique links, sends emails
  ```

- Create background job for sending emails:
  - Process invitations in batches (100 at a time)
  - Implement retry logic for failed sends
  - Track send status per invitation
  - Rate limiting to comply with email provider limits (SendGrid: 100 emails/second)

**Technical Considerations**:
- CSV parsing library (Papa Parse)
- Email validation (regex + DNS check)
- Prevent duplicate invitations
- Implement idempotency (don't resend on page refresh)
- Background job queue (Bull, BullMQ)
- Email deliverability (SPF, DKIM, DMARC configured)
- Handle email bounces and complaints

**Acceptance Criteria**:
- [ ] CSV file uploads and parses correctly
- [ ] Validation catches all error types
- [ ] Invalid rows can be edited or removed
- [ ] Custom message appears in email correctly
- [ ] Invitations send successfully
- [ ] Failed invitations reported with reasons
- [ ] Players receive unique invitation links
- [ ] Duplicate invitations prevented
- [ ] Scheduled sends work correctly

---

### Task 2.2.2: Create Unique Invitation Links/Codes
**Estimated Time**: 4 hours
**Priority**: High

**Detailed Requirements**:

- Implement unique invitation link generation:

  - **Link Structure**:
    - Format: `https://rally.com/join/{invitation_code}`
    - Invitation code requirements:
      - 12 characters long
      - URL-safe characters (alphanumeric, no special chars)
      - Unique across all invitations
      - Non-sequential (prevent enumeration)
      - Example: `rally.com/join/7aK9mPqR3xWz`

  - **Code Generation Algorithm**:
    ```typescript
    import crypto from 'crypto';

    function generateInvitationCode(): string {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
      let code = '';
      const bytes = crypto.randomBytes(12);

      for (let i = 0; i < 12; i++) {
        code += chars[bytes[i] % chars.length];
      }

      return code;
    }

    // Check for uniqueness before saving
    async function createUniqueInvitationCode() {
      let code = generateInvitationCode();
      while (await codeExists(code)) {
        code = generateInvitationCode();
      }
      return code;
    }
    ```

  - **Database Storage**:
    - Add to `player_campaigns` table:
      - `invitation_code` (string, unique, indexed)
      - `invitation_sent_at` (datetime)
      - `invitation_opened_at` (datetime - tracking)
      - `invitation_accepted_at` (datetime - when player joins)
      - `invitation_expires_at` (datetime - optional expiration)
    - Index on `invitation_code` for fast lookups

- Create invitation landing page (`/join/[code]`):
  - Validate invitation code exists
  - Show campaign information:
    - School/team name
    - Coach name + photo
    - Campaign description
    - Goal and current progress
    - Team photo/logo
  - Call-to-action:
    - If not logged in: "Create Account" button
    - If logged in as different player: "This invitation is for {name}"
    - If already accepted: "You've already joined this campaign"
  - Pre-fill registration form with player info from invitation

- Implement invitation validation:
  - Check code exists in database
  - Check invitation hasn't expired
  - Check campaign is still active
  - Check player hasn't already joined
  - Track invitation opens (first time code is accessed)

- Create QR code for invitation links:
  - Generate QR code for each invitation link
  - Include on coach signup posters
  - Players can scan to join quickly
  - Store QR code image URL in database

**Technical Considerations**:
- Use cryptographically secure random generation
- Implement collision detection (retry on duplicate)
- Index invitation_code for O(1) lookups
- Set appropriate expiration (optional: 30 days)
- Track invitation metrics (open rate, acceptance rate)
- Consider magic link authentication (click to join, no password needed)

**Acceptance Criteria**:
- [ ] Invitation codes are unique
- [ ] Codes are not sequential or guessable
- [ ] Landing page loads for valid codes
- [ ] Invalid codes show appropriate error
- [ ] Expired invitations handled gracefully
- [ ] QR codes generate correctly
- [ ] Invitation opens tracked accurately
- [ ] Registration form pre-filled with player info

---

### Task 2.2.3: Implement Invitation Status Tracking
**Estimated Time**: 5 hours
**Priority**: High

**Detailed Requirements**:

- Extend `player_campaigns` table with tracking fields:
  ```sql
  ALTER TABLE player_campaigns ADD COLUMN invitation_status ENUM(
    'pending',      -- Invitation created but not sent
    'sent',         -- Email sent
    'delivered',    -- Email delivered (webhook from email provider)
    'opened',       -- Player clicked link in email
    'bounced',      -- Email bounced
    'complained',   -- Player marked as spam
    'accepted'      -- Player completed signup
  );

  ADD COLUMN email_sent_at TIMESTAMP;
  ADD COLUMN email_opened_at TIMESTAMP;
  ADD COLUMN link_clicked_at TIMESTAMP;
  ADD COLUMN signup_completed_at TIMESTAMP;
  ```

- Implement email tracking:

  - **Send Tracking**:
    - Update status to 'sent' when email queued
    - Store `email_sent_at` timestamp
    - Store email provider message ID

  - **Delivery Tracking** (SendGrid webhooks):
    - Create webhook endpoint: `POST /api/webhooks/sendgrid`
    - Handle events:
      - `delivered`: Update status to 'delivered'
      - `open`: Update status to 'opened', track `email_opened_at`
      - `click`: Track `link_clicked_at`
      - `bounce`: Update status to 'bounced', log reason
      - `spamreport`: Update status to 'complained'
    - Verify webhook signature for security

  - **Link Click Tracking**:
    - Use tracking redirect: `rally.com/t/{tracking_id}` → `rally.com/join/{code}`
    - Record click event before redirecting
    - Track: timestamp, IP address, user agent, referrer

- Create invitation status dashboard for coach:

  - **Status Overview** (cards):
    - Total invitations sent
    - Delivered (XX%)
    - Opened (XX%)
    - Accepted (XX%)
    - Bounced (XX with reasons)

  - **Funnel Visualization**:
    ```
    Sent (100) → Delivered (98) → Opened (75) → Clicked (60) → Accepted (45)
    ```
    - Show drop-off at each stage
    - Industry benchmark comparison

  - **Detailed Status Table**:
    - Player name
    - Email
    - Invitation sent (date/time)
    - Status (badge with color coding)
    - Last activity (opened/clicked)
    - Actions:
      - Resend (if not accepted)
      - Copy invitation link
      - Mark as unable to reach
    - Filter by status
    - Sort by date sent, last activity

- Implement automated follow-up system:
  - **Reminder Rules** (configurable):
    - If 'delivered' but not 'opened' after 3 days → Send reminder 1
    - If 'opened' but not 'accepted' after 2 days → Send reminder 2
    - If no response after 7 days → Send final reminder
  - Coach can enable/disable auto-reminders
  - Coach can customize reminder messages
  - Maximum 3 reminders per player

- Create invitation analytics:
  - Open rate: (opened / delivered) * 100
  - Click rate: (clicked / opened) * 100
  - Acceptance rate: (accepted / sent) * 100
  - Time to accept: avg time from sent to accepted
  - Best send time analysis (day of week, time of day)

**Technical Considerations**:
- Webhook security (verify signatures)
- Handle duplicate webhook events (idempotency)
- Email tracking pixel (1x1 transparent image)
- UTM parameters for link tracking
- Privacy considerations (GDPR compliance)
- Soft delete bounced/invalid emails
- Unsubscribe handling

**Acceptance Criteria**:
- [ ] Invitation status updates in real-time
- [ ] Email opens tracked accurately
- [ ] Link clicks recorded
- [ ] Bounces detected and logged
- [ ] Coach can see detailed status for each invitation
- [ ] Status dashboard shows accurate metrics
- [ ] Automated reminders send at correct times
- [ ] Analytics provide actionable insights

---

### Task 2.2.4: Set Up Automated Reminder Emails
**Estimated Time**: 4 hours
**Priority**: Medium

**Detailed Requirements**:

- Create reminder email templates:

  - **Reminder 1** (3 days after initial invite, not opened):
    ```
    Subject: Don't miss out! Join {campaign_name}

    Hi {player_name},

    Just a friendly reminder that {coach_name} invited you to join {campaign_name}.

    Your teammates are already fundraising - join them today!

    [Join Now Button]

    Need help? Reply to this email.
    ```

  - **Reminder 2** (2 days after opening, not accepted):
    ```
    Subject: Complete your {campaign_name} signup

    Hi {player_name},

    We noticed you started joining {campaign_name} but didn't finish.

    Complete your profile in just 2 minutes:
    - Upload a photo
    - Write a short message
    - Start fundraising!

    [Complete Signup Button]
    ```

  - **Final Reminder** (7 days after initial, still not accepted):
    ```
    Subject: Last chance to join {campaign_name}

    Hi {player_name},

    This is your last reminder to join {campaign_name}. The team needs you!

    {coach_name} says: "We'd love to have you on board. Let me know if you need any help!"

    [Join Now Button]

    If you're not interested, you can ignore this email.
    ```

- Implement reminder scheduling system:

  - **Cron Job** (runs daily):
    ```typescript
    // Runs at 9 AM daily
    cron.schedule('0 9 * * *', async () => {
      // Find players eligible for Reminder 1
      const reminder1Candidates = await prisma.playerCampaign.findMany({
        where: {
          invitation_status: { in: ['delivered', 'sent'] },
          invitation_sent_at: {
            lte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
          },
          reminder_1_sent_at: null
        }
      });

      // Send Reminder 1
      for (const player of reminder1Candidates) {
        await sendReminderEmail(player, 'reminder_1');
        await updateReminderSent(player.id, 'reminder_1');
      }

      // Repeat for Reminder 2 and Final Reminder
    });
    ```

  - **Database Tracking**:
    - Add fields to `player_campaigns`:
      - `reminder_1_sent_at` (timestamp)
      - `reminder_2_sent_at` (timestamp)
      - `final_reminder_sent_at` (timestamp)
      - `auto_reminders_enabled` (boolean, default true)

- Create coach reminder configuration:

  - **Settings Page** (`/coach/campaigns/[id]/settings/reminders`):
    - Enable/disable automated reminders (toggle)
    - Customize reminder schedule:
      - Reminder 1: X days after invite (default 3)
      - Reminder 2: X days after opening (default 2)
      - Final reminder: X days after invite (default 7)
    - Customize reminder messages (textarea for each)
    - Preview reminder emails
    - Send test reminders to self

  - **Manual Reminders**:
    - From roster page, select players
    - "Send Reminder" button
    - Choose reminder type or custom message
    - Overrides automatic schedule

- Implement opt-out mechanism:
  - Include unsubscribe link in all reminders
  - Unsubscribe sets `auto_reminders_enabled = false`
  - Unsubscribe page: "You won't receive more reminders for this campaign"
  - Respect unsubscribe immediately
  - Track unsubscribe rate

- Create reminder performance analytics:
  - Reminder effectiveness:
    - % who accepted after Reminder 1
    - % who accepted after Reminder 2
    - % who never accepted (after final reminder)
  - Best performing reminder message (A/B test capability)
  - Optimal send time analysis

**Technical Considerations**:
- Cron job reliability (use job queue for resilience)
- Time zone handling (send at appropriate time for player's location)
- Email deliverability (avoid spam filters)
- Respect unsubscribe immediately (legal requirement)
- Rate limiting (don't send too many reminders)
- Idempotency (don't send duplicate reminders)

**Acceptance Criteria**:
- [ ] Reminders send automatically based on schedule
- [ ] Reminder timing is accurate
- [ ] Coach can customize reminder messages
- [ ] Coach can enable/disable reminders
- [ ] Manual reminders can be sent from roster
- [ ] Unsubscribe functionality works
- [ ] Reminder metrics tracked accurately
- [ ] No duplicate reminders sent
- [ ] Reminders stop after player accepts

---

### Task 2.2.5: Build Invitation Resend Functionality
**Estimated Time**: 3 hours
**Priority**: Medium

**Detailed Requirements**:

- Create resend invitation button in roster:
  - Show "Resend Invitation" button for players with status: sent, bounced, or no response
  - Hide for players who have accepted
  - Confirm before resending: "Resend invitation to {player_name}?"

- Implement resend API endpoint:
  ```typescript
  POST /api/campaigns/[campaignId]/players/[playerId]/resend-invitation

  // Checks:
  // - Player hasn't accepted yet
  // - Rate limit: 1 resend per 24 hours per player
  // - Campaign is still active

  // Actions:
  // - Generate new invitation code (if old one expired)
  // - Send invitation email
  // - Update invitation_sent_at
  // - Log resend event
  ```

- Handle different resend scenarios:

  - **Bounced Email**:
    - Prompt coach to verify email address
    - Allow editing email before resending
    - Show bounce reason from previous attempt

  - **Not Opened**:
    - Resend with same invitation code
    - Update sent timestamp

  - **Opened but Not Accepted**:
    - Resend with encouragement message
    - "We noticed you started but didn't finish - we'd love to have you!"

  - **Expired Invitation**:
    - Generate new invitation code
    - Extend expiration date

- Create bulk resend functionality:
  - Select multiple players from roster
  - "Resend to Selected" button
  - Confirmation: "Resend invitations to X players?"
  - Progress indicator while sending
  - Summary: "Invitations resent to X players, Y failed"

- Implement rate limiting:
  - Prevent spam: max 1 resend per player per 24 hours
  - Prevent abuse: max 50 resends per coach per day
  - Show error if limit reached: "You can resend to {player} again in {X} hours"

- Track resend metrics:
  - Number of resends per invitation
  - Success rate after resend
  - Average time to acceptance after resend
  - Display in coach analytics: "Resend improved acceptance by 15%"

- Create resend email variations:
  - Use different subject line: "Reminder: Join {campaign_name}"
  - Vary email content to avoid repetition
  - Optionally include coach's personal note: "Hey John, we really want you on the team!"

**Technical Considerations**:
- Rate limiting (Redis or database-based)
- Email deliverability (avoid spam reputation damage)
- Idempotency (prevent accidental double-send)
- Update all relevant timestamps
- Log all resend attempts for debugging
- Handle edge cases (email changed, player deleted)

**Acceptance Criteria**:
- [ ] Resend button appears for eligible players
- [ ] Single player invitation can be resent
- [ ] Bulk resend works for multiple players
- [ ] Rate limiting prevents excessive resends
- [ ] Bounced email addresses can be corrected before resending
- [ ] Resend updates invitation status correctly
- [ ] Resend metrics tracked accurately
- [ ] Email variations prevent spam detection

---

## 2.3 Player Link Tracking

### Task 2.3.1: Generate Unique Fundraising Links Per Player
**Estimated Time**: 4 hours
**Priority**: High

**Detailed Requirements**:

- Create unique player fundraising page URL structure:
  - Format: `https://rally.com/p/{player_link_code}`
  - Alternative (with player name): `https://rally.com/p/{player_link_code}/{player-name-slug}`
    - Example: `rally.com/p/9xK2mP7q/john-smith`
    - Name slug is optional, helps with SEO and sharing

- Implement player link code generation:
  ```typescript
  function generatePlayerLinkCode(): string {
    // 8 characters, URL-safe
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let code = '';
    const bytes = crypto.randomBytes(8);

    for (let i = 0; i < 8; i++) {
      code += chars[bytes[i] % chars.length];
    }

    return code;
  }

  // Ensure uniqueness
  async function createUniquePlayerLink(playerId: string, campaignId: string) {
    let code = generatePlayerLinkCode();
    while (await linkCodeExists(code)) {
      code = generatePlayerLinkCode();
    }

    // Generate name slug
    const player = await getPlayer(playerId);
    const nameSlug = slugify(`${player.first_name}-${player.last_name}`);

    // Store in database
    await prisma.playerCampaign.update({
      where: { player_id_campaign_id: { playerId, campaignId } },
      data: {
        link_code: code,
        link_slug: nameSlug,
        link_created_at: new Date()
      }
    });

    return {
      code,
      url: `https://rally.com/p/${code}/${nameSlug}`
    };
  }
  ```

- Store link data in database:
  - Add to `player_campaigns` table:
    - `link_code` (string, unique, indexed)
    - `link_slug` (string, for SEO-friendly URLs)
    - `link_created_at` (timestamp)
    - `link_active` (boolean, can be disabled)
    - `custom_link_code` (optional, for vanity URLs)

- Create player fundraising page (`/p/[code]` or `/p/[code]/[slug]`):
  - Look up player by link_code (slug is optional, just for pretty URLs)
  - Display player fundraising page (built in Phase 3)
  - Track page view
  - If link inactive or campaign ended, show appropriate message

- Implement link sharing helpers:
  - Copy link button (copies full URL to clipboard)
  - Pre-populated social sharing:
    - Facebook: Share link with player's story
    - Twitter: Tweet with campaign hashtag
    - Email: "mailto:" link with pre-filled subject/body
    - SMS: "sms:" link with pre-filled message (mobile only)
  - QR code generation for offline sharing (on player posters)

- Create vanity URL option (optional premium feature):
  - Allow players to customize their link
  - Example: `rally.com/p/team-sarah` instead of `rally.com/p/9xK2mP7q`
  - Check availability
  - Validate format (alphanumeric + hyphens only)
  - Reserve certain keywords (admin, api, login, etc.)

**Technical Considerations**:
- Ensure link codes are truly unique (check before saving)
- Make codes URL-safe (no special characters)
- Case-insensitive lookup (convert to lowercase)
- Slug is cosmetic only (lookup always by code)
- Consider short links for SMS character limits
- Implement link expiration (optional: after campaign ends)

**Acceptance Criteria**:
- [ ] Each player has a unique fundraising link
- [ ] Links are not sequential or guessable
- [ ] Links resolve to correct player page
- [ ] Slug variations of same code resolve to same page
- [ ] Invalid links show 404 page
- [ ] Link sharing buttons work correctly
- [ ] QR code generation works
- [ ] Vanity URLs (if implemented) are unique and validated

---

### Task 2.3.2: Track Clicks and Conversions by Player
**Estimated Time**: 6 hours
**Priority**: High

**Detailed Requirements**:

- Create `link_clicks` tracking table:
  ```sql
  CREATE TABLE link_clicks (
    id UUID PRIMARY KEY,
    player_campaign_id UUID REFERENCES player_campaigns(id),
    clicked_at TIMESTAMP NOT NULL,
    ip_address VARCHAR(45),  -- IPv6 compatible
    user_agent TEXT,
    referrer TEXT,  -- Where click came from
    referrer_source VARCHAR(50),  -- facebook, twitter, email, direct, other
    country_code VARCHAR(2),  -- From IP geolocation
    city VARCHAR(100),
    device_type VARCHAR(20),  -- mobile, tablet, desktop
    browser VARCHAR(50),
    operating_system VARCHAR(50),
    converted BOOLEAN DEFAULT FALSE,  -- Did this click result in donation?
    donation_id UUID REFERENCES donations(id),  -- If converted, which donation
    session_id VARCHAR(100)  -- Track unique visitors
  );

  CREATE INDEX idx_link_clicks_player ON link_clicks(player_campaign_id, clicked_at);
  CREATE INDEX idx_link_clicks_session ON link_clicks(session_id);
  ```

- Implement click tracking endpoint:
  ```typescript
  // GET /p/[code] - Player fundraising page
  export async function GET(req, { params }) {
    const { code } = params;

    // Find player by link code
    const playerCampaign = await prisma.playerCampaign.findUnique({
      where: { link_code: code }
    });

    if (!playerCampaign) {
      return notFound();
    }

    // Track click (async, don't block page load)
    trackLinkClick(playerCampaign.id, req);

    // Render player page
    return renderPlayerPage(playerCampaign);
  }

  async function trackLinkClick(playerCampaignId: string, req: Request) {
    // Parse user agent
    const ua = parseUserAgent(req.headers.get('user-agent'));

    // Get referrer source
    const referrer = req.headers.get('referer');
    const source = categorizeReferrer(referrer);

    // Get IP and geolocation
    const ip = getClientIP(req);
    const geo = await getGeolocation(ip);

    // Create or get session ID
    const sessionId = getOrCreateSessionId(req);

    // Check if this is a unique visit
    const existingClick = await prisma.linkClick.findFirst({
      where: {
        player_campaign_id: playerCampaignId,
        session_id: sessionId,
        clicked_at: { gte: new Date(Date.now() - 30 * 60 * 1000) } // Last 30 min
      }
    });

    if (!existingClick) {
      // Record new click
      await prisma.linkClick.create({
        data: {
          player_campaign_id: playerCampaignId,
          clicked_at: new Date(),
          ip_address: ip,
          user_agent: req.headers.get('user-agent'),
          referrer,
          referrer_source: source,
          country_code: geo.country,
          city: geo.city,
          device_type: ua.device.type,
          browser: ua.browser.name,
          operating_system: ua.os.name,
          session_id: sessionId
        }
      });

      // Increment click count (cached counter)
      await incrementClickCount(playerCampaignId);
    }
  }
  ```

- Implement conversion tracking:
  ```typescript
  // When donation is completed
  async function recordDonation(donationData) {
    const donation = await prisma.donation.create({ data: donationData });

    // Find recent click from same session
    const sessionId = getSessionId(req);
    const recentClick = await prisma.linkClick.findFirst({
      where: {
        player_campaign_id: donationData.player_campaign_id,
        session_id: sessionId,
        clicked_at: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
        converted: false
      },
      orderBy: { clicked_at: 'desc' }
    });

    if (recentClick) {
      // Mark click as converted
      await prisma.linkClick.update({
        where: { id: recentClick.id },
        data: {
          converted: true,
          donation_id: donation.id
        }
      });
    }

    return donation;
  }
  ```

- Create analytics queries:
  ```typescript
  // Get player link performance
  async function getPlayerLinkAnalytics(playerCampaignId: string) {
    const [clicks, conversions, totalRaised] = await Promise.all([
      // Total clicks
      prisma.linkClick.count({
        where: { player_campaign_id: playerCampaignId }
      }),

      // Unique visitors (distinct sessions)
      prisma.linkClick.groupBy({
        by: ['session_id'],
        where: { player_campaign_id: playerCampaignId }
      }).then(r => r.length),

      // Total donations and amount
      prisma.donation.aggregate({
        where: { player_campaign_id: playerCampaignId, status: 'completed' },
        _count: true,
        _sum: { amount: true }
      })
    ]);

    return {
      total_clicks: clicks,
      unique_visitors: conversions,
      total_donations: totalRaised._count,
      total_raised: totalRaised._sum.amount,
      conversion_rate: conversions > 0 ? (totalRaised._count / conversions) * 100 : 0
    };
  }
  ```

- Categorize referrer sources:
  ```typescript
  function categorizeReferrer(referrer: string | null): string {
    if (!referrer) return 'direct';

    if (referrer.includes('facebook.com')) return 'facebook';
    if (referrer.includes('twitter.com') || referrer.includes('t.co')) return 'twitter';
    if (referrer.includes('instagram.com')) return 'instagram';
    if (referrer.includes('linkedin.com')) return 'linkedin';
    if (referrer.includes('google.com')) return 'google';
    if (referrer.includes('mail.') || referrer.includes('outlook.') || referrer.includes('gmail.')) return 'email';

    return 'other';
  }
  ```

**Technical Considerations**:
- Don't block page load for tracking (async)
- Deduplicate clicks from same session (30-60 min window)
- Privacy: anonymize IP addresses (GDPR)
- Use session cookies (not local storage for accuracy)
- Implement bot detection (filter out bots from analytics)
- Consider performance: use counters cache for high traffic

**Acceptance Criteria**:
- [ ] Every page view is tracked
- [ ] Duplicate clicks from same session within short time are deduplicated
- [ ] Referrer source is categorized correctly
- [ ] Device type, browser, OS detected accurately
- [ ] Geolocation data captured (country, city)
- [ ] Conversions linked to original clicks
- [ ] Analytics queries are performant
- [ ] Privacy regulations complied with

---

*Due to the massive length of this document, I'll continue with the remaining phases in the same level of detail. Would you like me to continue with the next sections, or would you prefer this level of detail in a separate document for easier navigation?*

---

Let me continue with more critical sections to give you a comprehensive example of the depth:

# PHASE 4: Payment Processing & Fund Management (Weeks 9-11)

## 4.1 Payment Gateway Integration

### Task 4.1.1: Integrate Stripe Payment Processor
**Estimated Time**: 12 hours
**Priority**: Critical

**Detailed Requirements**:

- Set up Stripe account structure:
  - **Stripe Connect** for multi-party payments
  - Rally platform = Master Account (receives all funds)
  - Each school/program = Connected Account (receives payouts)
  - Use "Platform" model (Rally controls entire payment flow)

- Install Stripe dependencies:
  ```bash
  npm install stripe @stripe/stripe-js @stripe/react-stripe-js
  ```

- Configure Stripe API keys (environment variables):
  ```env
  STRIPE_SECRET_KEY=sk_test_xxxxx
  STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
  STRIPE_WEBHOOK_SECRET=whsec_xxxxx
  STRIPE_PLATFORM_ACCOUNT_ID=acct_xxxxx
  ```

- Create Stripe service layer (`lib/stripe/index.ts`):
  ```typescript
  import Stripe from 'stripe';

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16',
    typescript: true,
  });

  export async function createPaymentIntent(amount: number, metadata: any) {
    return await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata,
      application_fee_amount: calculatePlatformFee(amount), // Rally's fee
      on_behalf_of: metadata.connected_account_id, // School's connected account
    });
  }

  export async function createConnectedAccount(schoolData: any) {
    return await stripe.accounts.create({
      type: 'express', // Simplified onboarding
      country: 'US',
      email: schoolData.email,
      business_type: 'non_profit', // or 'company'
      business_profile: {
        name: schoolData.name,
        mcc: '8398', // Charitable and social service organizations
        url: schoolData.website,
      },
      metadata: {
        school_id: schoolData.id,
      }
    });
  }

  export async function createAccountLink(accountId: string, refreshUrl: string, returnUrl: string) {
    return await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });
  }
  ```

- Create payment API endpoints:

  - **Create payment intent**:
    ```typescript
    POST /api/donations/create-payment-intent

    Body: {
      amount: number,
      player_campaign_id: string,
      donor_email: string,
      donor_name: string,
      is_anonymous: boolean,
      message: string
    }

    Response: {
      client_secret: string,
      payment_intent_id: string
    }
    ```

  - **Confirm donation**:
    ```typescript
    POST /api/donations/confirm

    Body: {
      payment_intent_id: string,
      player_campaign_id: string,
      donor_details: {...}
    }

    // After Stripe confirms payment, create donation record
    ```

- Implement Connected Accounts onboarding for schools:

  - When school is approved by admin:
    1. Create Stripe Connected Account
    2. Send onboarding link to school admin
    3. School completes Stripe Express onboarding (bank details, verification)
    4. Receive webhook when onboarding complete
    5. Mark school as "ready for payouts"

  - Store Connected Account data:
    ```typescript
    // Add to schools table
    stripe_account_id: string;
    stripe_account_status: 'pending' | 'active' | 'restricted' | 'disabled';
    stripe_onboarding_completed: boolean;
    stripe_charges_enabled: boolean;
    stripe_payouts_enabled: boolean;
    ```

- Implement payment flow:

  1. **Donor visits player page and clicks "Donate"**
  2. **Client creates Payment Intent** (API call)
  3. **Stripe Elements form rendered** on client
  4. **Donor enters card details** (handled by Stripe securely)
  5. **Client confirms payment** (Stripe.js)
  6. **Webhook received** (payment_intent.succeeded)
  7. **Server creates donation record**
  8. **Funds held in Rally's account**
  9. **Scheduled payout** to school's connected account

- Create donation checkout component:
  ```typescript
  // components/DonationCheckout.tsx
  import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
  import { loadStripe } from '@stripe/stripe-js';

  const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

  export function DonationCheckout({ playerCampaignId, presetAmount }) {
    const [clientSecret, setClientSecret] = useState('');
    const [amount, setAmount] = useState(presetAmount || 50);

    // Create payment intent when component loads
    useEffect(() => {
      fetch('/api/donations/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, player_campaign_id: playerCampaignId })
      })
        .then(res => res.json())
        .then(data => setClientSecret(data.client_secret));
    }, [amount]);

    return (
      <Elements stripe={stripePromise} options={{ clientSecret }}>
        <CheckoutForm amount={amount} />
      </Elements>
    );
  }

  function CheckoutForm({ amount }) {
    const stripe = useStripe();
    const elements = useElements();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
      e.preventDefault();
      setLoading(true);

      const { error: submitError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/donation/success`,
        },
      });

      if (submitError) {
        setError(submitError.message);
        setLoading(false);
      }
    };

    return (
      <form onSubmit={handleSubmit}>
        <PaymentElement />
        <button type="submit" disabled={!stripe || loading}>
          {loading ? 'Processing...' : `Donate $${amount}`}
        </button>
        {error && <div className="error">{error}</div>}
      </form>
    );
  }
  ```

**Technical Considerations**:
- PCI compliance: Never handle raw card data (use Stripe Elements)
- Use Payment Intents (supports SCA/3D Secure)
- Implement idempotency keys (prevent duplicate charges)
- Handle all payment states (pending, succeeded, failed, refunded)
- Stripe Connect fees: 0.25% + standard Stripe fees (2.9% + 30¢)
- Test mode extensively before going live
- Implement comprehensive error handling

**Acceptance Criteria**:
- [ ] Stripe Connected Accounts created for schools
- [ ] School onboarding flow completed successfully
- [ ] Payment intent creation works
- [ ] Donation checkout form accepts payments
- [ ] Funds routed correctly (Rally account → school account)
- [ ] Payment failures handled gracefully
- [ ] All transactions logged in database
- [ ] Refund capability implemented
- [ ] Webhook processing is secure and reliable

---

This detailed roadmap continues for all remaining tasks across all 10 phases. Each task includes:
- Estimated time
- Priority level
- Detailed requirements with code examples
- Database schema changes
- API endpoint specifications
- UI/UX specifications
- Technical considerations
- Acceptance criteria

---

# Continuing with remaining phases...

## 2.3 Player Link Tracking (continued)

### Task 2.3.3: Display Real-Time Donation Amounts Per Player
**Estimated Time**: 4 hours
**Priority**: High

**Detailed Requirements**:

- Create player donation summary component:
  - Total amount raised (large, prominent display)
  - Progress bar toward personal goal
  - Number of individual donors
  - Recent donations feed (last 5-10)

- Implement real-time updates:
  ```typescript
  // Using WebSocket for real-time updates
  const socket = io();

  socket.on(`donation:${playerCampaignId}`, (donation) => {
    // Update total raised
    setTotalRaised(prev => prev + donation.amount);
    // Add to recent donations feed
    setRecentDonations(prev => [donation, ...prev.slice(0, 9)]);
    // Show celebration animation
    showDonationNotification(donation);
  });
  ```

- Display metrics on player fundraising page:
  - Hero section with total raised
  - Visual progress indicator
  - Donor count with avatars (if not anonymous)
  - Achievement badges (first donation, milestone reached, etc.)

- Create coach view of player donations:
  - Sortable table of all donations per player
  - Filters: date range, amount range, anonymous vs named
  - Export to CSV for reporting

**Acceptance Criteria**:
- [ ] Donation totals update in real-time
- [ ] Progress bars animate smoothly
- [ ] Recent donations appear immediately after payment
- [ ] Coach can view detailed donation breakdown
- [ ] Anonymous donations properly hidden

---

### Task 2.3.4: Create Leaderboard Functionality
**Estimated Time**: 5 hours
**Priority**: Medium

**Detailed Requirements**:

- Design leaderboard view (`/coach/campaigns/[id]/leaderboard`):
  - Top 10 players by amount raised
  - Podium display (1st, 2nd, 3rd with special styling)
  - Player rankings with profile photos
  - Amount raised and percentage of goal
  - Number of donors per player

- Implement multiple leaderboard types:
  - **By Total Raised**: Default view
  - **By Donor Count**: Most individual supporters
  - **By Average Donation**: Highest average per donor
  - **By Conversion Rate**: Best click-to-donation ratio

- Create public leaderboard page (optional):
  - Embedded on campaign page
  - Configurable visibility (coach can enable/disable)
  - Updates in real-time
  - Social sharing for top players

- Add gamification elements:
  - Badges for achievements:
    - "First to $100"
    - "10 Donors Club"
    - "Week's Top Fundraiser"
  - Movement indicators (up/down arrows)
  - Streak tracking (days with donations)

**Acceptance Criteria**:
- [ ] Leaderboard ranks players correctly
- [ ] Ties handled appropriately
- [ ] Real-time updates when new donations come in
- [ ] Multiple sorting options work
- [ ] Badges display correctly
- [ ] Coach can toggle leaderboard visibility

---

### Task 2.3.5: Build Export/Reporting Tools
**Estimated Time**: 4 hours
**Priority**: Medium

**Detailed Requirements**:

- Create export functionality for coaches:
  - **Player Performance Report** (CSV/Excel):
    - Columns: Name, Email, Amount Raised, Donors, Link Clicks, Conversion Rate, Last Activity
    - Sortable by any column
    - Filterable by date range, status

  - **Donation Report** (CSV/Excel):
    - Columns: Date, Donor Name, Donor Email, Player, Amount, Payment Method, Status
    - Include/exclude anonymous donors option
    - Filter by date range, player, amount range

  - **Analytics Summary** (PDF):
    - Campaign overview statistics
    - Charts and graphs
    - Player performance breakdown
    - Donor demographics
    - Generated with campaign branding

- Implement report API endpoints:
  ```typescript
  GET /api/campaigns/[id]/reports/players?format=csv
  GET /api/campaigns/[id]/reports/donations?format=csv&start_date=X&end_date=Y
  POST /api/campaigns/[id]/reports/summary (generates PDF)
  ```

- Create scheduled reports (optional):
  - Weekly email to coach with campaign summary
  - Daily digest of new donations
  - Milestone notifications

**Acceptance Criteria**:
- [ ] CSV exports download correctly
- [ ] All data accurately included in exports
- [ ] PDF reports are well-formatted
- [ ] Date range filters work correctly
- [ ] Large datasets export without timeout

---

# PHASE 3: Player Portal (Weeks 6-8)

## 3.1 Player Onboarding

### Task 3.1.1: Create Account Setup Flow via Invitation Link
**Estimated Time**: 6 hours
**Priority**: High

**Detailed Requirements**:

- Create player registration page (`/join/[invitationCode]`):

  - **Step 1: Welcome & Campaign Info**:
    - Show campaign details
    - Coach's welcome message
    - Current team progress
    - "Get Started" button

  - **Step 2: Create Account**:
    - Email (pre-filled from invitation)
    - Password
    - Confirm password
    - First/last name (pre-filled from invitation)
    - Phone number (optional)
    - Accept terms of service

  - **Step 3: Profile Setup**:
    - Upload profile photo (optional, can skip)
    - Write personal message (why raising money)
    - Set personal fundraising goal (optional)
    - Preview personal fundraising page

  - **Step 4: Learn to Share**:
    - Tutorial on how to share link
    - Pre-populated social media posts
    - Email template to send to family
    - Copy link button
    - "Start Fundraising" final CTA

- Pre-fill data from invitation:
  ```typescript
  const { invitation } = await getInvitation(code);
  const defaultValues = {
    email: invitation.email,
    first_name: invitation.first_name,
    last_name: invitation.last_name,
    phone: invitation.phone
  };
  ```

- Mark invitation as accepted:
  - Update invitation status to 'accepted'
  - Store signup_completed_at timestamp
  - Generate player fundraising link
  - Send welcome email

**Acceptance Criteria**:
- [ ] Player can complete signup in <3 minutes
- [ ] Form pre-filled with invitation data
- [ ] Password requirements enforced
- [ ] Profile photo upload works
- [ ] Player page generated immediately
- [ ] Welcome email sent upon completion

---

### Task 3.1.2: Build QR Code Scanning for Quick Registration
**Estimated Time**: 4 hours
**Priority**: Medium

**Detailed Requirements**:

- Create QR code scanner page (`/scan`):
  - Use device camera to scan QR codes
  - Detect invitation QR codes from posters
  - Automatically navigate to invitation landing page
  - Fallback: manual code entry

- Implement QR code library:
  ```bash
  npm install react-qr-reader qrcode
  ```

- Generate QR codes for invitations:
  ```typescript
  import QRCode from 'qrcode';

  async function generateInvitationQR(invitationCode: string) {
    const url = `https://rally.com/join/${invitationCode}`;
    const qrCodeDataUrl = await QRCode.toDataURL(url, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    return qrCodeDataUrl;
  }
  ```

- Include QR codes on:
  - Coach signup posters (links to campaign)
  - Player fundraising posters (links to donation page)
  - Email invitations (as embedded image)

- Handle camera permissions:
  - Request camera access
  - Show instructions if denied
  - Fallback to manual code entry
  - Works on iOS and Android

**Acceptance Criteria**:
- [ ] QR code scanner works on mobile devices
- [ ] Camera permissions requested correctly
- [ ] Valid codes redirect to correct pages
- [ ] Invalid codes show error message
- [ ] Manual fallback entry works
- [ ] QR codes readable by standard QR apps

---

### Task 3.1.3: Implement Email/Phone Number Collection
**Estimated Time**: 3 hours
**Priority**: High

**Detailed Requirements**:

- Add contact fields to player registration:
  - Email (required, unique per campaign)
  - Phone number (optional but encouraged)
  - Parent/guardian email (optional, for minors)
  - Parent/guardian phone (optional)

- Validate email and phone:
  ```typescript
  const playerSchema = z.object({
    email: z.string().email('Invalid email format'),
    phone: z.string().regex(/^\+?1?\d{10,14}$/, 'Invalid phone number').optional(),
    parent_email: z.string().email().optional(),
    parent_phone: z.string().regex(/^\+?1?\d{10,14}$/).optional()
  });
  ```

- Send verification for contact methods:
  - Email verification (required before fundraising)
  - SMS verification (optional, increases trust)
  - Store verification status in database

- Use contact info for:
  - Donation notifications
  - Milestone celebrations
  - Coach communications
  - Emergency contact (for minors)

- Privacy controls:
  - Never display contact info publicly
  - Only coach can see player contacts
  - Opt-in for notifications

**Acceptance Criteria**:
- [ ] Email validation works correctly
- [ ] Phone number formatting standardized
- [ ] Verification emails sent
- [ ] Contact info stored securely
- [ ] Privacy settings respected

---

### Task 3.1.4: Build Player Profile Setup
**Estimated Time**: 5 hours
**Priority**: High

**Detailed Requirements**:

- Create player profile editor (`/player/profile`):

  - **Basic Information**:
    - First and last name
    - Jersey number (optional)
    - Grade level (optional)
    - Position/role (optional)
    - Bio (max 200 characters)

  - **Fundraising Information**:
    - Why I'm fundraising (text area, max 500 chars)
    - Personal goal amount
    - Fundraising deadline
    - Thank you message template

  - **Media Uploads**:
    - Profile photo (recommended)
    - Action photo or video (optional)
    - Photo/video moderation (if required by coach)

  - **Social Links** (optional):
    - Twitter/Instagram handles
    - Used for social sharing

- Show profile completion percentage:
  - Calculate based on filled fields
  - "Your profile is 70% complete"
  - Suggest next steps

- Preview fundraising page:
  - "Preview" button shows what donors see
  - Live updates as player edits profile

**Acceptance Criteria**:
- [ ] All profile fields save correctly
- [ ] Profile completion percentage accurate
- [ ] Photo upload works
- [ ] Preview shows accurate representation
- [ ] Character limits enforced
- [ ] Changes save without page reload

---

### Task 3.1.5: Create Terms and Conditions Acceptance
**Estimated Time**: 2 hours
**Priority**: Critical

**Detailed Requirements**:

- Create terms of service page (`/terms`):
  - Platform usage terms
  - Fundraising guidelines
  - Privacy policy
  - Age requirements (13+ or parental consent)
  - Prohibited activities

- Implement acceptance tracking:
  ```typescript
  // Add to users table
  terms_accepted_at: timestamp
  terms_version: string
  ```

- Require acceptance before:
  - Account activation
  - Creating fundraising page
  - Receiving donations

- Handle minors (under 18):
  - Require parent/guardian email
  - Send parental consent form
  - Track consent in database
  - Coach must approve

**Acceptance Criteria**:
- [ ] Terms must be accepted to proceed
- [ ] Acceptance timestamp recorded
- [ ] Terms version tracked
- [ ] Minors require parental consent
- [ ] Terms displayed clearly

---

## 3.2 Player Profile & Media Upload

### Task 3.2.1: Design Profile Customization Interface
**Estimated Time**: 6 hours
**Priority**: High

**Detailed Requirements**:

- Create player dashboard (`/player/dashboard`):
  - **Header**: Profile photo, name, campaign name
  - **Stats Overview**:
    - Total raised (large, prominent)
    - Number of donors
    - Progress to goal
    - Days remaining
  - **Quick Actions**:
    - Share my link
    - Upload photo/video
    - Edit profile
    - View donations
  - **Recent Activity**:
    - Recent donations
    - Link clicks
    - Shares

- Profile editing interface:
  - Inline editing (click to edit)
  - Auto-save changes
  - Undo/redo capability
  - Character counters for text fields

- Theme customization (optional):
  - Choose background color
  - Choose accent color
  - Font selection
  - Layout options

- Mobile-first design:
  - Touch-friendly controls
  - Responsive layouts
  - Easy photo upload from phone

**Acceptance Criteria**:
- [ ] Dashboard loads in <2 seconds
- [ ] Stats update in real-time
- [ ] Inline editing works smoothly
- [ ] Mobile experience is excellent
- [ ] Changes auto-save
- [ ] Preview shows accurate page

---

### Task 3.2.2: Implement Photo Upload
**Estimated Time**: 5 hours
**Priority**: High

**Detailed Requirements**:

- Create photo upload component:
  - Drag and drop area
  - Click to browse
  - Multiple photo upload (up to 5)
  - Photo cropper for profile picture
  - Filters and adjustments (optional)

- File validation:
  ```typescript
  const validatePhoto = (file: File) => {
    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      throw new Error('Invalid file type');
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('File too large');
    }

    return true;
  };
  ```

- Image processing:
  - Resize to multiple sizes:
    - Thumbnail: 200x200px
    - Medium: 800x800px
    - Large: 1600x1600px (original preserved)
  - Compress to reduce file size
  - Strip EXIF data for privacy
  - Generate blurhash for placeholder

- Upload flow:
  1. User selects photo
  2. Client-side validation
  3. Get presigned S3 URL
  4. Upload directly to S3
  5. Notify server of upload completion
  6. Server processes image (resize, compress)
  7. Update player profile with URLs
  8. Display on fundraising page

**Acceptance Criteria**:
- [ ] Photos upload successfully
- [ ] Progress indicator shows during upload
- [ ] Image cropper works correctly
- [ ] Thumbnails generated automatically
- [ ] File size limits enforced
- [ ] Invalid files show clear errors

---

### Task 3.2.3: Build Video Upload Functionality
**Estimated Time**: 7 hours
**Priority**: Medium

**Detailed Requirements**:

- Create video upload component:
  - Drag and drop or browse
  - Video preview before upload
  - Duration limit indicator (max 2 minutes)
  - File size indicator (max 100MB)

- Supported formats:
  - MP4 (H.264)
  - MOV
  - WebM
  - AVI

- Video processing:
  - Generate thumbnail from first frame
  - Compress video for web playback
  - Create multiple quality versions:
    - 720p (HD)
    - 480p (SD)
    - 360p (mobile)
  - Extract metadata (duration, dimensions, codec)

- Use video processing service:
  - Option 1: AWS MediaConvert
  - Option 2: Cloudinary
  - Option 3: FFmpeg on server (self-hosted)

- Upload flow:
  1. User selects video
  2. Client validates (size, duration, format)
  3. Show upload progress
  4. Upload to S3 or video service
  5. Video processing job queued
  6. Player notified when processing complete
  7. Video appears on fundraising page

- Video player on fundraising page:
  - Responsive player
  - Play/pause controls
  - Volume control
  - Fullscreen option
  - Autoplay option (muted)

**Acceptance Criteria**:
- [ ] Videos upload successfully
- [ ] Progress bar shows upload/processing status
- [ ] Duration limits enforced
- [ ] File size limits enforced
- [ ] Thumbnails generated correctly
- [ ] Multiple quality versions available
- [ ] Video player works on all devices

---

### Task 3.2.4: Create Media Preview and Management
**Estimated Time**: 4 hours
**Priority**: Medium

**Detailed Requirements**:

- Create media library (`/player/media`):
  - Grid view of all uploaded photos/videos
  - Thumbnail previews
  - Upload date
  - File size
  - Actions: Set as primary, Delete, Download

- Media detail modal:
  - Full-size preview
  - Metadata display
  - Edit caption
  - Set as profile photo
  - Set as fundraising page hero
  - Delete confirmation

- Primary media selection:
  - Only one primary photo
  - Primary photo shows on fundraising page hero
  - Other photos in gallery below

- Media organization:
  - Drag and drop to reorder
  - Order saved and reflected on page
  - Archive unused media

- Storage management:
  - Show total storage used
  - Limit per player (e.g., 200MB)
  - Warning when approaching limit

**Acceptance Criteria**:
- [ ] All uploaded media visible
- [ ] Primary photo selection works
- [ ] Reordering saves correctly
- [ ] Delete removes media completely
- [ ] Storage limits enforced
- [ ] Media loads quickly

---

### Task 3.2.5: Add Personal Story/Message Text Editor
**Estimated Time**: 4 hours
**Priority**: High

**Detailed Requirements**:

- Create rich text editor for personal story:
  - Formatting options:
    - Bold, italic, underline
    - Bullet and numbered lists
    - Links
  - Character limit: 1000 characters
  - Live character counter
  - Save draft automatically

- Use editor library:
  ```bash
  npm install @tiptap/react @tiptap/starter-kit
  ```

- Story sections:
  - **Why I'm Fundraising**: Main story (required)
  - **What the Funds Will Support**: Specific use (optional)
  - **Thank You Message**: Shown to donors (optional)

- Story templates (optional):
  - Pre-written templates players can customize
  - Examples:
    - "Help me reach my fundraising goal!"
    - "Support our team's journey to [event]"
    - "Every donation makes a difference"

- Preview mode:
  - Switch between edit and preview
  - See exactly how story appears to donors
  - Mobile and desktop previews

**Acceptance Criteria**:
- [ ] Editor allows basic formatting
- [ ] Character limit enforced
- [ ] Auto-save works reliably
- [ ] Preview matches final display
- [ ] Templates available and customizable

---

### Task 3.2.6: Implement Content Moderation Queue for Coaches
**Estimated Time**: 6 hours
**Priority**: Medium

**Detailed Requirements**:

- Create moderation queue (`/coach/campaigns/[id]/moderation`):
  - List of pending media/content for approval
  - Filter by: Pending, Approved, Rejected
  - Sort by: Submission date, Player name

- Moderation item card:
  - Player name and photo
  - Submitted content (photo/video/text)
  - Submission date
  - Actions:
    - Approve (makes content live)
    - Reject (with reason)
    - Request changes
  - Notes field for coach feedback

- Approval flow:
  1. Player uploads photo/video or edits story
  2. If moderation enabled, content marked "pending"
  3. Coach receives notification
  4. Coach reviews content in moderation queue
  5. Coach approves or rejects
  6. Player notified of decision
  7. If approved, content goes live
  8. If rejected, player can edit and resubmit

- Auto-moderation rules (optional):
  - Inappropriate content detection (AI)
  - Flag for review if detected
  - Block obviously inappropriate content

- Coach notification settings:
  - Email when new content submitted
  - Daily digest of pending items
  - Instant notification for first submission

**Acceptance Criteria**:
- [ ] Moderation queue shows all pending items
- [ ] Approval makes content immediately visible
- [ ] Rejection notifies player
- [ ] Coach can provide feedback
- [ ] Players can resubmit after rejection

---

## 3.3 Player Fundraising Tools

### Task 3.3.1: Generate Personalized Fundraising Page
**Estimated Time**: 8 hours
**Priority**: Critical

**Detailed Requirements**:

- Create player fundraising page (`/p/[code]/[slug]`):

  - **Hero Section**:
    - Player profile photo or video (autoplay, muted)
    - Player name
    - Campaign name
    - Fundraising goal progress bar
    - Amount raised / Goal amount
    - "Donate Now" button (prominent CTA)

  - **Player Story Section**:
    - "Why I'm Fundraising" text
    - Formatted with player's rich text
    - Photo gallery (if multiple photos)

  - **Donation Form Section**:
    - Preset amounts ($25, $50, $100, custom)
    - Donor information form
    - Payment form (Stripe Elements)
    - Message to player (optional)
    - Anonymous donation checkbox

  - **Social Proof Section**:
    - Recent donors (if not anonymous)
    - Total donor count
    - Comments from donors
    - Team leaderboard (optional)

  - **Campaign Information**:
    - School/team name
    - Coach information
    - Campaign description
    - How funds will be used

  - **Share Section**:
    - Social share buttons
    - Copy link button
    - QR code for offline sharing

- Page personalization:
  - Player's chosen colors/theme
  - Custom background image
  - Custom header text
  - Campaign branding overlays

- SEO optimization:
  - Meta tags (title, description)
  - Open Graph tags (Facebook preview)
  - Twitter Card tags
  - Schema.org structured data

- Mobile-responsive design:
  - Optimized for phones (most traffic)
  - Fast loading (<2 seconds)
  - Easy donation on mobile
  - Touch-friendly buttons

**Acceptance Criteria**:
- [ ] Page loads in <2 seconds
- [ ] All player content displays correctly
- [ ] Donation form works on all devices
- [ ] Social sharing generates correct previews
- [ ] Progress bar animates smoothly
- [ ] SEO tags are present and accurate

---

This detailed roadmap continues through all remaining phases with the same level of specificity. Would you like me to continue with the complete expansion?
