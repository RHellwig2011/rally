# Rally - Database Entity Relationship Diagram

## Overview
This document describes the complete database schema for the Rally fundraising platform, including all tables, relationships, indexes, and constraints.

---

## Core Entity Diagram (Text-Based ERD)

```
┌─────────────────────┐
│       USERS         │
│─────────────────────│
│ id (PK, UUID)       │
│ email (UNIQUE)      │
│ password_hash       │
│ email_verified      │
│ created_at          │
│ updated_at          │
└─────────────────────┘
         │
         │ 1:1
         │
    ┌────┴────┬────────┬────────┐
    │         │        │        │
┌───▼───┐ ┌──▼──┐ ┌───▼───┐ ┌──▼──┐
│COACHES│ │PLAYER│ │ADMINS │ │DONORS│
│       │ │  S   │ │       │ │      │
└───┬───┘ └──┬──┘ └───────┘ └──────┘
    │        │
    │        │
    │        │ M:N (via player_campaigns)
    │        │
┌───▼──────────────────┐
│     CAMPAIGNS        │
│──────────────────────│
│ id (PK)              │
│ program_id (FK)      │
│ coach_id (FK)        │
│ name                 │
│ goal_amount          │
│ status               │
└──────┬───────────────┘
       │
       │ 1:M
       │
┌──────▼────────────────┐
│  PLAYER_CAMPAIGNS     │
│───────────────────────│
│ id (PK)               │
│ player_id (FK)        │
│ campaign_id (FK)      │
│ link_code (UNIQUE)    │
│ invitation_code       │
│ total_raised          │
└──────┬────────────────┘
       │
       │ 1:M
       │
┌──────▼─────────────┐
│    DONATIONS       │
│────────────────────│
│ id (PK)            │
│ player_campaign_id │
│ donor_name         │
│ amount             │
│ status             │
└────────────────────┘
```

---

## Detailed Table Specifications

### 1. User Management Tables

#### users
**Purpose**: Base authentication table for all user types

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique user identifier |
| email | VARCHAR(255) | UNIQUE, NOT NULL | User email address |
| password_hash | VARCHAR(255) | NOT NULL | Bcrypt hashed password |
| email_verified | BOOLEAN | DEFAULT FALSE | Email verification status |
| terms_accepted_at | TIMESTAMP | NULL | When user accepted terms |
| terms_version | VARCHAR(10) | NULL | Version of terms accepted |
| created_at | TIMESTAMP | DEFAULT NOW() | Account creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |
| deleted_at | TIMESTAMP | NULL | Soft delete timestamp |

**Indexes**:
- `idx_users_email` on (email)
- `idx_users_created_at` on (created_at)

**Relationships**:
- Has one: coach, player, admin, or donor

---

#### coaches
**Purpose**: Coach profile information

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique coach identifier |
| user_id | UUID | FK → users.id, UNIQUE | Reference to user account |
| school_id | UUID | FK → schools.id | Associated school |
| first_name | VARCHAR(100) | NOT NULL | Coach first name |
| last_name | VARCHAR(100) | NOT NULL | Coach last name |
| phone | VARCHAR(20) | NULL | Contact phone number |
| bio | TEXT | NULL | Coach biography |
| profile_image_url | VARCHAR(500) | NULL | Profile photo URL |
| onboarding_completed | BOOLEAN | DEFAULT FALSE | Completed onboarding |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes**:
- `idx_coaches_user_id` on (user_id)
- `idx_coaches_school_id` on (school_id)

**Relationships**:
- Belongs to: user (1:1)
- Belongs to: school (M:1)
- Has many: campaigns
- Has many: players

---

#### players
**Purpose**: Player profile information

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique player identifier |
| user_id | UUID | FK → users.id, UNIQUE | Reference to user account |
| first_name | VARCHAR(100) | NOT NULL | Player first name |
| last_name | VARCHAR(100) | NOT NULL | Player last name |
| email | VARCHAR(255) | NOT NULL | Player email |
| phone | VARCHAR(20) | NULL | Player phone |
| jersey_number | VARCHAR(10) | NULL | Jersey/uniform number |
| grade_level | VARCHAR(20) | NULL | Grade or year in school |
| profile_image_url | VARCHAR(500) | NULL | Profile photo URL |
| video_url | VARCHAR(500) | NULL | Profile video URL |
| personal_story | TEXT | NULL | Why fundraising |
| about_me | TEXT | NULL | Personal bio |
| thank_you_message_template | TEXT | NULL | Thank you to donors |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes**:
- `idx_players_user_id` on (user_id)
- `idx_players_email` on (email)

**Relationships**:
- Belongs to: user (1:1)
- Has many: player_campaigns
- Has many: player_media

---

#### admins
**Purpose**: Platform administrator accounts

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique admin identifier |
| user_id | UUID | FK → users.id, UNIQUE | Reference to user account |
| first_name | VARCHAR(100) | NOT NULL | Admin first name |
| last_name | VARCHAR(100) | NOT NULL | Admin last name |
| role | ENUM | NOT NULL | super_admin, support, finance |
| permissions | JSONB | NULL | Custom permissions |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes**:
- `idx_admins_user_id` on (user_id)
- `idx_admins_role` on (role)

**Relationships**:
- Belongs to: user (1:1)

---

### 2. Organization Tables

#### schools
**Purpose**: Schools and organizations running fundraisers

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique school identifier |
| name | VARCHAR(255) | NOT NULL | School name |
| district | VARCHAR(255) | NULL | School district |
| city | VARCHAR(100) | NOT NULL | City location |
| state | VARCHAR(2) | NOT NULL | State code (US) |
| zip_code | VARCHAR(10) | NOT NULL | Postal code |
| phone | VARCHAR(20) | NULL | School phone |
| email | VARCHAR(255) | NULL | School contact email |
| logo_url | VARCHAR(500) | NULL | School logo image |
| primary_color | VARCHAR(7) | NULL | Brand color (hex) |
| secondary_color | VARCHAR(7) | NULL | Secondary color (hex) |
| status | ENUM | DEFAULT 'pending' | pending, active, inactive, suspended |
| onboarding_completed | BOOLEAN | DEFAULT FALSE | Setup complete |
| stripe_account_id | VARCHAR(100) | NULL | Stripe Connected Account ID |
| stripe_account_status | VARCHAR(50) | NULL | Stripe account status |
| stripe_onboarding_completed | BOOLEAN | DEFAULT FALSE | Stripe setup complete |
| stripe_charges_enabled | BOOLEAN | DEFAULT FALSE | Can receive payments |
| stripe_payouts_enabled | BOOLEAN | DEFAULT FALSE | Can receive payouts |
| bank_account_last4 | VARCHAR(4) | NULL | Last 4 of bank account |
| bank_account_verified | BOOLEAN | DEFAULT FALSE | Bank verified |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes**:
- `idx_schools_status` on (status)
- `idx_schools_state` on (state)
- `idx_schools_stripe_account_id` on (stripe_account_id)

**Relationships**:
- Has many: programs
- Has many: coaches
- Has one: program_balance

---

#### programs
**Purpose**: Sports teams or clubs within schools

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique program identifier |
| school_id | UUID | FK → schools.id | Parent school |
| name | VARCHAR(255) | NOT NULL | Program name |
| sport_type | VARCHAR(100) | NOT NULL | Sport or activity type |
| season | ENUM | NULL | fall, winter, spring, summer |
| description | TEXT | NULL | Program description |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes**:
- `idx_programs_school_id` on (school_id)
- `idx_programs_sport_type` on (sport_type)

**Relationships**:
- Belongs to: school (M:1)
- Has many: campaigns
- Has many through: program_coaches

---

#### program_coaches
**Purpose**: Join table for programs and coaches

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| program_id | UUID | FK → programs.id | Associated program |
| coach_id | UUID | FK → coaches.id | Associated coach |
| role | ENUM | NOT NULL | head_coach, assistant_coach, coordinator |
| created_at | TIMESTAMP | DEFAULT NOW() | Assignment date |

**Indexes**:
- `idx_program_coaches_program` on (program_id)
- `idx_program_coaches_coach` on (coach_id)
- `unique_program_coach` UNIQUE (program_id, coach_id)

**Relationships**:
- Belongs to: program (M:1)
- Belongs to: coach (M:1)

---

### 3. Campaign Tables

#### campaigns
**Purpose**: Fundraising campaigns

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique campaign identifier |
| program_id | UUID | FK → programs.id | Associated program |
| coach_id | UUID | FK → coaches.id | Campaign creator |
| name | VARCHAR(255) | NOT NULL | Campaign name |
| description | TEXT | NULL | Campaign description |
| goal_amount | DECIMAL(10,2) | NOT NULL | Fundraising goal |
| start_date | DATE | NOT NULL | Campaign start date |
| end_date | DATE | NOT NULL | Campaign end date |
| status | ENUM | DEFAULT 'draft' | draft, active, paused, completed, cancelled |
| funds_distributed | BOOLEAN | DEFAULT FALSE | Funds paid out |
| distribution_date | DATE | NULL | When funds distributed |
| unique_code | VARCHAR(20) | UNIQUE | URL-safe campaign code |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes**:
- `idx_campaigns_program_id` on (program_id)
- `idx_campaigns_coach_id` on (coach_id)
- `idx_campaigns_status` on (status)
- `idx_campaigns_dates` on (start_date, end_date)
- `idx_campaigns_unique_code` on (unique_code)

**Relationships**:
- Belongs to: program (M:1)
- Belongs to: coach (M:1)
- Has one: campaign_settings
- Has many: player_campaigns
- Has many: donations

---

#### campaign_settings
**Purpose**: Configurable campaign options

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| campaign_id | UUID | FK → campaigns.id, UNIQUE | Parent campaign |
| allow_anonymous_donations | BOOLEAN | DEFAULT TRUE | Allow anonymous donors |
| minimum_donation_amount | DECIMAL(10,2) | DEFAULT 10.00 | Minimum donation |
| suggested_donation_amounts | JSONB | NULL | Array of suggested amounts |
| enable_recurring_donations | BOOLEAN | DEFAULT FALSE | Allow recurring |
| custom_thank_you_message | TEXT | NULL | Custom thank you |
| poster_template_id | UUID | FK → poster_templates.id | Poster template |
| require_media_approval | BOOLEAN | DEFAULT FALSE | Coach approves media |
| enable_player_leaderboard | BOOLEAN | DEFAULT TRUE | Show leaderboard |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes**:
- `idx_campaign_settings_campaign_id` on (campaign_id)

**Relationships**:
- Belongs to: campaign (1:1)
- Belongs to: poster_template (M:1)

---

#### player_campaigns
**Purpose**: Player participation in campaigns (join table with extras)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| player_id | UUID | FK → players.id | Associated player |
| campaign_id | UUID | FK → campaigns.id | Associated campaign |
| invitation_code | VARCHAR(20) | UNIQUE | Invitation code |
| invitation_status | ENUM | DEFAULT 'pending' | pending, sent, delivered, opened, bounced, accepted |
| invitation_sent_at | TIMESTAMP | NULL | When invitation sent |
| invitation_opened_at | TIMESTAMP | NULL | When invitation opened |
| invitation_accepted_at | TIMESTAMP | NULL | When player joined |
| invitation_expires_at | TIMESTAMP | NULL | Invitation expiration |
| link_code | VARCHAR(20) | UNIQUE | Fundraising page code |
| link_slug | VARCHAR(255) | NULL | SEO-friendly slug |
| link_created_at | TIMESTAMP | NULL | When link generated |
| link_active | BOOLEAN | DEFAULT TRUE | Link enabled |
| fundraising_goal | DECIMAL(10,2) | NULL | Personal goal |
| personal_message | TEXT | NULL | Player's message |
| status | ENUM | DEFAULT 'invited' | invited, active, inactive |
| joined_at | TIMESTAMP | NULL | When player joined |
| reminder_1_sent_at | TIMESTAMP | NULL | First reminder |
| reminder_2_sent_at | TIMESTAMP | NULL | Second reminder |
| final_reminder_sent_at | TIMESTAMP | NULL | Final reminder |
| auto_reminders_enabled | BOOLEAN | DEFAULT TRUE | Auto reminders on |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes**:
- `idx_pc_player_id` on (player_id)
- `idx_pc_campaign_id` on (campaign_id)
- `idx_pc_invitation_code` on (invitation_code)
- `idx_pc_link_code` on (link_code)
- `idx_pc_status` on (status)
- `unique_player_campaign` UNIQUE (player_id, campaign_id)

**Relationships**:
- Belongs to: player (M:1)
- Belongs to: campaign (M:1)
- Has many: donations
- Has many: link_clicks

---

### 4. Financial Tables

#### donations
**Purpose**: Individual donation transactions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique donation identifier |
| campaign_id | UUID | FK → campaigns.id | Associated campaign |
| player_campaign_id | UUID | FK → player_campaigns.id | Player receiving credit |
| donor_name | VARCHAR(255) | NULL | Donor name (if not anonymous) |
| donor_email | VARCHAR(255) | NULL | Donor email |
| donor_phone | VARCHAR(20) | NULL | Donor phone |
| amount | DECIMAL(10,2) | NOT NULL | Donation amount |
| is_anonymous | BOOLEAN | DEFAULT FALSE | Anonymous donation |
| message_to_player | TEXT | NULL | Message from donor |
| donation_date | TIMESTAMP | DEFAULT NOW() | When donated |
| status | ENUM | DEFAULT 'pending' | pending, completed, failed, refunded |
| payment_method | VARCHAR(50) | NULL | card, bank_transfer |
| stripe_payment_intent_id | VARCHAR(255) | UNIQUE | Stripe Payment Intent ID |
| stripe_charge_id | VARCHAR(255) | NULL | Stripe Charge ID |
| refunded_at | TIMESTAMP | NULL | Refund timestamp |
| refund_reason | TEXT | NULL | Reason for refund |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes**:
- `idx_donations_campaign_id` on (campaign_id)
- `idx_donations_player_campaign_id` on (player_campaign_id)
- `idx_donations_status` on (status)
- `idx_donations_date` on (donation_date)
- `idx_donations_stripe_pi` on (stripe_payment_intent_id)
- `idx_donations_donor_email` on (donor_email)

**Relationships**:
- Belongs to: campaign (M:1)
- Belongs to: player_campaign (M:1)
- Has many: transactions

---

#### transactions
**Purpose**: Financial ledger for all money movements

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique transaction identifier |
| donation_id | UUID | FK → donations.id, NULL | Related donation |
| transaction_type | ENUM | NOT NULL | donation_received, platform_fee, payout_to_program, refund, chargeback |
| amount | DECIMAL(10,2) | NOT NULL | Transaction amount |
| currency | VARCHAR(3) | DEFAULT 'USD' | Currency code |
| stripe_payment_intent_id | VARCHAR(255) | NULL | Stripe PI ID |
| stripe_charge_id | VARCHAR(255) | NULL | Stripe Charge ID |
| stripe_payout_id | VARCHAR(255) | NULL | Stripe Payout ID |
| stripe_transfer_id | VARCHAR(255) | NULL | Stripe Transfer ID |
| status | ENUM | DEFAULT 'pending' | pending, succeeded, failed |
| rally_account_balance_impact | DECIMAL(10,2) | DEFAULT 0.00 | Impact on Rally balance |
| program_account_balance_impact | DECIMAL(10,2) | DEFAULT 0.00 | Impact on program balance |
| program_id | UUID | FK → programs.id, NULL | Affected program |
| description | TEXT | NULL | Transaction description |
| metadata | JSONB | NULL | Additional data |
| processed_at | TIMESTAMP | NULL | When processed |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes**:
- `idx_transactions_donation_id` on (donation_id)
- `idx_transactions_program_id` on (program_id)
- `idx_transactions_type` on (transaction_type)
- `idx_transactions_status` on (status)
- `idx_transactions_processed_at` on (processed_at)
- `idx_transactions_stripe_pi` on (stripe_payment_intent_id)

**Relationships**:
- Belongs to: donation (M:1)
- Belongs to: program (M:1)

---

#### program_balances
**Purpose**: Current balance for each program

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| program_id | UUID | FK → programs.id, UNIQUE | Associated program |
| available_balance | DECIMAL(10,2) | DEFAULT 0.00 | Available for payout |
| pending_balance | DECIMAL(10,2) | DEFAULT 0.00 | Pending transactions |
| lifetime_raised | DECIMAL(10,2) | DEFAULT 0.00 | All-time total |
| last_payout_date | DATE | NULL | Most recent payout |
| last_payout_amount | DECIMAL(10,2) | NULL | Last payout amount |
| next_payout_scheduled | DATE | NULL | Next scheduled payout |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last balance update |

**Indexes**:
- `idx_program_balances_program_id` on (program_id)

**Relationships**:
- Belongs to: program (1:1)

---

#### rally_master_balance
**Purpose**: Platform-wide balance tracking (singleton)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, CHECK (id=1) | Always 1 |
| total_balance | DECIMAL(12,2) | DEFAULT 0.00 | Current Rally balance |
| total_payouts | DECIMAL(12,2) | DEFAULT 0.00 | All-time payouts |
| total_fees_collected | DECIMAL(12,2) | DEFAULT 0.00 | Platform fees |
| last_reconciliation_date | TIMESTAMP | NULL | Last reconciliation |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update |

**Note**: This table should only ever have one row (id=1)

---

#### bank_accounts
**Purpose**: Bank account information for schools/programs

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| school_id | UUID | FK → schools.id | Associated school |
| account_holder_name | VARCHAR(255) | NOT NULL | Account holder |
| bank_name | VARCHAR(255) | NOT NULL | Bank name |
| account_type | ENUM | NOT NULL | checking, savings |
| routing_number | VARCHAR(9) | NOT NULL | Bank routing number |
| account_number_last4 | VARCHAR(4) | NOT NULL | Last 4 of account |
| account_number_encrypted | TEXT | NOT NULL | Encrypted full account |
| is_primary | BOOLEAN | DEFAULT TRUE | Primary account |
| verified | BOOLEAN | DEFAULT FALSE | Verification status |
| verified_at | TIMESTAMP | NULL | When verified |
| verification_method | VARCHAR(50) | NULL | How verified |
| stripe_bank_account_id | VARCHAR(255) | NULL | Stripe ID |
| status | ENUM | DEFAULT 'pending' | pending, active, inactive |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes**:
- `idx_bank_accounts_school_id` on (school_id)
- `idx_bank_accounts_status` on (status)
- `unique_school_primary` UNIQUE (school_id, is_primary) WHERE is_primary = TRUE

**Relationships**:
- Belongs to: school (M:1)

---

#### payouts
**Purpose**: Track payouts to schools

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique payout identifier |
| program_id | UUID | FK → programs.id | Receiving program |
| bank_account_id | UUID | FK → bank_accounts.id | Destination account |
| amount | DECIMAL(10,2) | NOT NULL | Payout amount |
| fee_amount | DECIMAL(10,2) | DEFAULT 0.00 | Any fees deducted |
| net_amount | DECIMAL(10,2) | NOT NULL | Amount after fees |
| status | ENUM | DEFAULT 'pending' | pending, processing, completed, failed |
| stripe_payout_id | VARCHAR(255) | NULL | Stripe Payout ID |
| stripe_transfer_id | VARCHAR(255) | NULL | Stripe Transfer ID |
| initiated_by | UUID | FK → admins.id | Admin who initiated |
| initiated_at | TIMESTAMP | DEFAULT NOW() | When initiated |
| completed_at | TIMESTAMP | NULL | When completed |
| failed_at | TIMESTAMP | NULL | When failed |
| failure_reason | TEXT | NULL | Failure details |
| metadata | JSONB | NULL | Additional info |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes**:
- `idx_payouts_program_id` on (program_id)
- `idx_payouts_status` on (status)
- `idx_payouts_initiated_at` on (initiated_at)
- `idx_payouts_stripe_payout_id` on (stripe_payout_id)

**Relationships**:
- Belongs to: program (M:1)
- Belongs to: bank_account (M:1)
- Belongs to: admin (M:1)

---

### 5. Media & Content Tables

#### player_media
**Purpose**: Photos and videos uploaded by players

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique media identifier |
| player_id | UUID | FK → players.id | Owning player |
| media_type | ENUM | NOT NULL | photo, video |
| file_url | VARCHAR(500) | NOT NULL | S3 URL to file |
| thumbnail_url | VARCHAR(500) | NULL | Thumbnail URL |
| file_size_bytes | BIGINT | NOT NULL | File size |
| mime_type | VARCHAR(100) | NOT NULL | MIME type |
| duration_seconds | INTEGER | NULL | Video duration |
| upload_date | TIMESTAMP | DEFAULT NOW() | Upload timestamp |
| moderation_status | ENUM | DEFAULT 'pending' | pending, approved, rejected |
| moderated_by | UUID | FK → coaches.id, NULL | Who moderated |
| moderated_at | TIMESTAMP | NULL | When moderated |
| moderation_notes | TEXT | NULL | Moderation feedback |
| display_order | INTEGER | DEFAULT 0 | Display order |
| is_primary | BOOLEAN | DEFAULT FALSE | Primary photo |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes**:
- `idx_player_media_player_id` on (player_id)
- `idx_player_media_moderation_status` on (moderation_status)
- `idx_player_media_type` on (media_type)
- `unique_player_primary_photo` UNIQUE (player_id, is_primary) WHERE is_primary = TRUE AND media_type = 'photo'

**Relationships**:
- Belongs to: player (M:1)
- Belongs to: coach (M:1) via moderated_by

---

#### poster_templates
**Purpose**: Configurable poster designs

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique template identifier |
| name | VARCHAR(255) | NOT NULL | Template name |
| description | TEXT | NULL | Template description |
| template_type | ENUM | NOT NULL | coach_signup, player_fundraising, campaign_general |
| layout_config | JSONB | NOT NULL | Layout configuration |
| preview_image_url | VARCHAR(500) | NULL | Preview image |
| is_active | BOOLEAN | DEFAULT TRUE | Template active |
| is_default | BOOLEAN | DEFAULT FALSE | Default template |
| created_by | UUID | FK → admins.id, NULL | Creator |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update |

**Indexes**:
- `idx_poster_templates_type` on (template_type)
- `idx_poster_templates_active` on (is_active)

**Relationships**:
- Belongs to: admin (M:1)
- Has many: generated_posters

---

#### generated_posters
**Purpose**: Posters generated for campaigns/players

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| poster_template_id | UUID | FK → poster_templates.id | Template used |
| entity_type | ENUM | NOT NULL | player, coach, campaign |
| entity_id | UUID | NOT NULL | Player/coach/campaign ID |
| generated_file_url | VARCHAR(500) | NOT NULL | Generated PDF URL |
| qr_code_data | VARCHAR(500) | NOT NULL | QR code destination |
| qr_code_image_url | VARCHAR(500) | NULL | QR code image URL |
| generation_date | TIMESTAMP | DEFAULT NOW() | When generated |
| downloaded_count | INTEGER | DEFAULT 0 | Download count |
| last_downloaded_at | TIMESTAMP | NULL | Last download |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation |

**Indexes**:
- `idx_generated_posters_entity` on (entity_type, entity_id)
- `idx_generated_posters_template` on (poster_template_id)

**Relationships**:
- Belongs to: poster_template (M:1)

---

### 6. Analytics & Tracking Tables

#### link_clicks
**Purpose**: Track fundraising link clicks

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique click identifier |
| player_campaign_id | UUID | FK → player_campaigns.id | Clicked link |
| clicked_at | TIMESTAMP | DEFAULT NOW() | Click timestamp |
| ip_address | VARCHAR(45) | NULL | IPv4/IPv6 address |
| user_agent | TEXT | NULL | Browser user agent |
| referrer | TEXT | NULL | HTTP referrer |
| referrer_source | VARCHAR(50) | NULL | facebook, twitter, email, direct, other |
| country_code | VARCHAR(2) | NULL | Country from IP |
| city | VARCHAR(100) | NULL | City from IP |
| device_type | VARCHAR(20) | NULL | mobile, tablet, desktop |
| browser | VARCHAR(50) | NULL | Browser name |
| operating_system | VARCHAR(50) | NULL | OS name |
| converted | BOOLEAN | DEFAULT FALSE | Led to donation |
| donation_id | UUID | FK → donations.id, NULL | Resulting donation |
| session_id | VARCHAR(100) | NULL | Unique visitor ID |

**Indexes**:
- `idx_link_clicks_player_campaign` on (player_campaign_id, clicked_at)
- `idx_link_clicks_session` on (session_id)
- `idx_link_clicks_converted` on (converted)
- `idx_link_clicks_referrer_source` on (referrer_source)

**Relationships**:
- Belongs to: player_campaign (M:1)
- Belongs to: donation (M:1)

---

#### campaign_milestones
**Purpose**: Track campaign milestone achievements

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique milestone identifier |
| campaign_id | UUID | FK → campaigns.id | Associated campaign |
| milestone_type | ENUM | NOT NULL | goal_percentage, dollar_amount, player_count, donor_count |
| threshold_value | DECIMAL(10,2) | NOT NULL | Threshold to achieve |
| achieved | BOOLEAN | DEFAULT FALSE | Achieved status |
| achieved_at | TIMESTAMP | NULL | When achieved |
| notification_sent | BOOLEAN | DEFAULT FALSE | Notification sent |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation |

**Indexes**:
- `idx_milestones_campaign` on (campaign_id)
- `idx_milestones_achieved` on (achieved)

**Relationships**:
- Belongs to: campaign (M:1)

---

### 7. Communication Tables

#### email_verification_tokens
**Purpose**: Email verification tokens

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique token identifier |
| user_id | UUID | FK → users.id | User to verify |
| token | VARCHAR(255) | UNIQUE, NOT NULL | Verification token |
| created_at | TIMESTAMP | DEFAULT NOW() | Token creation |
| expires_at | TIMESTAMP | NOT NULL | Token expiration (24h) |
| verified_at | TIMESTAMP | NULL | Verification timestamp |

**Indexes**:
- `idx_ev_tokens_token` on (token)
- `idx_ev_tokens_user` on (user_id)
- `idx_ev_tokens_expires` on (expires_at)

**Relationships**:
- Belongs to: user (M:1)

---

#### password_reset_tokens
**Purpose**: Password reset tokens

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique token identifier |
| user_id | UUID | FK → users.id | User resetting password |
| token | VARCHAR(255) | UNIQUE, NOT NULL | Reset token |
| created_at | TIMESTAMP | DEFAULT NOW() | Token creation |
| expires_at | TIMESTAMP | NOT NULL | Token expiration (1h) |
| used_at | TIMESTAMP | NULL | When token used |

**Indexes**:
- `idx_pr_tokens_token` on (token)
- `idx_pr_tokens_user` on (user_id)
- `idx_pr_tokens_expires` on (expires_at)

**Relationships**:
- Belongs to: user (M:1)

---

#### sessions
**Purpose**: User session management

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique session identifier |
| user_id | UUID | FK → users.id | Session owner |
| token | VARCHAR(255) | UNIQUE, NOT NULL | Session token (hashed) |
| ip_address | VARCHAR(45) | NULL | Login IP |
| user_agent | TEXT | NULL | Browser/device info |
| created_at | TIMESTAMP | DEFAULT NOW() | Session creation |
| expires_at | TIMESTAMP | NOT NULL | Session expiration |
| last_activity_at | TIMESTAMP | DEFAULT NOW() | Last activity |

**Indexes**:
- `idx_sessions_token` on (token)
- `idx_sessions_user` on (user_id)
- `idx_sessions_expires` on (expires_at)

**Relationships**:
- Belongs to: user (M:1)

---

## Database Triggers

### Automatic Timestamp Updates
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at column
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_coaches_updated_at BEFORE UPDATE ON coaches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- (repeat for all tables)
```

### Balance Update Triggers
```sql
CREATE OR REPLACE FUNCTION update_program_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.transaction_type = 'donation_received' AND NEW.status = 'succeeded' THEN
        UPDATE program_balances
        SET
            pending_balance = pending_balance + NEW.program_account_balance_impact,
            lifetime_raised = lifetime_raised + NEW.program_account_balance_impact,
            updated_at = NOW()
        WHERE program_id = NEW.program_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transaction_update_balance
AFTER INSERT OR UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION update_program_balance();
```

---

## Common Queries

### Get campaign fundraising totals
```sql
SELECT
    c.id,
    c.name,
    c.goal_amount,
    COALESCE(SUM(d.amount), 0) as total_raised,
    COUNT(DISTINCT d.id) as donor_count,
    COUNT(DISTINCT pc.player_id) as player_count,
    (COALESCE(SUM(d.amount), 0) / c.goal_amount * 100) as percentage_of_goal
FROM campaigns c
LEFT JOIN donations d ON d.campaign_id = c.id AND d.status = 'completed'
LEFT JOIN player_campaigns pc ON pc.campaign_id = c.id AND pc.status = 'active'
WHERE c.id = $1
GROUP BY c.id, c.name, c.goal_amount;
```

### Get player performance in campaign
```sql
SELECT
    p.id,
    p.first_name,
    p.last_name,
    pc.link_code,
    COALESCE(SUM(d.amount), 0) as total_raised,
    COUNT(DISTINCT d.id) as donor_count,
    COUNT(DISTINCT lc.id) as link_clicks,
    CASE
        WHEN COUNT(DISTINCT lc.id) > 0
        THEN (COUNT(DISTINCT d.id)::float / COUNT(DISTINCT lc.id)::float * 100)
        ELSE 0
    END as conversion_rate
FROM players p
INNER JOIN player_campaigns pc ON pc.player_id = p.id
LEFT JOIN donations d ON d.player_campaign_id = pc.id AND d.status = 'completed'
LEFT JOIN link_clicks lc ON lc.player_campaign_id = pc.id
WHERE pc.campaign_id = $1
GROUP BY p.id, p.first_name, p.last_name, pc.link_code
ORDER BY total_raised DESC;
```

---

## Backup & Maintenance

### Recommended Backup Schedule
- **Daily**: Full database backup
- **Hourly**: Transaction table backup
- **Real-time**: WAL archiving for point-in-time recovery

### Index Maintenance
```sql
-- Reindex all tables weekly
REINDEX DATABASE rally_production;

-- Analyze query performance monthly
ANALYZE;
```

### Data Retention
- Keep completed campaign data: 7 years (tax purposes)
- Archive inactive player data: After 2 years
- Purge expired tokens: After 30 days
- Keep transaction logs: Indefinitely (audit trail)

---

## Total Table Count: 30 Tables

**Critical for Launch**: 25 tables
**Optional/Future**: 5 tables (recurring_donations, districts, etc.)

**Estimated Database Size** (after 1 year with 100 schools):
- Total rows: ~5 million
- Storage: ~50GB
- Indexes: ~20GB
- Total: ~70GB
