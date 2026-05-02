# Rally Fundraising Platform - Quick Start Guide

**Last Updated:** November 24, 2025
**Platform Status:** 70% Complete - Core Features Working

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- PostgreSQL database (or Supabase account)
- Stripe account (for payments)
- Resend account (for emails)

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# 3. Generate Prisma client
npm run db:generate

# 4. Push database schema
npm run db:push

# 5. Start development server
npm run dev
```

Server will be running at: http://localhost:3000

---

## 🔑 Environment Variables

### Required (Core Functionality)
```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/database"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
PLATFORM_FEE_PERCENT="10"
```

### Required (Payments - Critical)
```env
# Get from: https://dashboard.stripe.com/test/apikeys
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# Get from: https://dashboard.stripe.com/test/webhooks
STRIPE_WEBHOOK_SECRET="whsec_..."
```

### Required (Email - Critical)
```env
# Get from: https://resend.com/api-keys
RESEND_API_KEY="re_..."
EMAIL_FROM="noreply@yourdomain.com"
```

### Optional (SMS)
```env
# Get from: https://console.twilio.com
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_PHONE_NUMBER="+1..."
```

---

## 📋 User Roles

| Role | Permissions | Use Case |
|------|-------------|----------|
| **DONOR** | Make donations, view campaigns | Public users who donate |
| **PLAYER** | View personal fundraising page | Team members raising funds |
| **CAMPAIGN_LEADER** | Create campaigns, manage roster, request disbursements | Coaches, organizers |
| **ADMIN** | View all data, generate reports | Platform managers |
| **BANK_ADMIN** | Approve disbursements, manage users, change settings | Platform owner, finance team |

---

## 🔄 Common Workflows

### 1. Create a Campaign (Coach)
```
1. Register → /api/auth/register
2. Verify email → /api/auth/verify-email
3. Login → /api/auth/login
4. Create campaign → POST /api/campaigns
5. Add roster → POST /api/campaigns/[id]/import-roster (CSV)
6. Activate campaign → PUT /api/campaigns/[id]/status
```

### 2. Make a Donation (Donor)
```
1. Visit campaign page → /raise/[slug]
2. Click donate
3. Enter amount & details
4. Complete Stripe payment
5. Verify payment → POST /api/donations/[id]/verify
6. Receive email confirmation
```

### 3. Request Disbursement (Coach)
```
1. Login to dashboard
2. Navigate to campaign
3. Request disbursement → POST /api/campaigns/[id]/disbursements
4. Enter amount, purpose, banking details
5. Wait for admin approval
6. Receive funds via ACH
```

### 4. Approve Disbursement (Admin)
```
1. Login as BANK_ADMIN
2. View pending → GET /api/admin/disbursements?status=PENDING
3. Review request details
4. Approve → PUT /api/admin/disbursements/[id]/approve
5. System initiates transfer
6. Campaign leader notified
```

---

## 🧪 Testing

### Run Tests
```bash
# Run all tests
npm test

# Watch mode
npm test:watch

# Coverage report
npm test:coverage
```

### Test API Endpoints
```bash
# Test campaign dashboard APIs
node test-dashboard-apis.mjs

# Seed test data
node seed-test-data.mjs
```

### Stripe Test Cards
```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
3D Secure: 4000 0025 0000 3155
```

---

## 📊 Key API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Campaigns
- `POST /api/campaigns` - Create campaign
- `GET /api/campaigns/[id]` - Get campaign details
- `GET /api/campaigns/[id]/stats` - Get statistics
- `PUT /api/campaigns/[id]/status` - Change status

### Team Members
- `POST /api/campaigns/[id]/team-members` - Add member
- `POST /api/campaigns/[id]/import-roster` - Bulk CSV import
- `PUT /api/campaigns/[id]/team-members/[memberId]` - Update
- `DELETE /api/campaigns/[id]/team-members/[memberId]` - Remove

### Donations
- `POST /api/donations` - Create donation + payment intent
- `POST /api/donations/[id]/verify` - Verify payment
- `GET /api/campaigns/[id]/recent-donations` - Get feed

### Admin
- `GET /api/admin/stats` - Platform statistics
- `GET /api/admin/disbursements` - All disbursements
- `PUT /api/admin/disbursements/[id]/approve` - Approve
- `PUT /api/admin/disbursements/[id]/reject` - Reject
- `GET /api/admin/users` - List users
- `PUT /api/admin/users/[id]/role` - Change role

### Webhooks
- `POST /api/webhooks/stripe` - Stripe events

---

## 🐛 Troubleshooting

### Development Server Won't Start
```bash
# Kill any process on port 3000
lsof -ti:3000 | xargs kill -9

# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Database Connection Issues
```bash
# Test database connection
npx prisma db pull

# Regenerate Prisma client
npm run db:generate

# Reset database (WARNING: deletes data)
npx prisma db push --force-reset
```

### Stripe Webhook Testing
```bash
# Install Stripe CLI
# https://stripe.com/docs/stripe-cli

# Forward webhooks to local
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Copy webhook secret to .env
# STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## 📚 Documentation Files

- **CONTINUATION_ROADMAP.md** - Full 12-week roadmap
- **IMPLEMENTATION_STATUS.md** - Current phase-by-phase status
- **SESSION_SUMMARY_NOV_24.md** - Today's work summary
- **QUICK_START_GUIDE.md** - This file
- **prisma/schema.prisma** - Database schema
- **COMPLETE_PROJECT_DOCUMENTATION.md** - Original spec

---

## 🎯 Current Status

### What's Working ✅
- User authentication & authorization
- Campaign CRUD operations
- Team roster management with CSV import
- Real-time dashboard with analytics
- Donation API with Stripe integration
- Email notification system
- Disbursement request workflow
- Admin approval system
- Platform statistics

### What Needs Work ⏳
- Stripe configuration (need real test keys)
- Admin dashboard UI (APIs ready, UI partial)
- Comprehensive testing
- Mobile optimization
- Security hardening
- Production deployment

### Known Issues 🐛
- TeamMember.userId is required in schema but optional in usage
- ActivityLog model referenced but not in schema
- Settings need database table (currently in-memory)
- Need to test webhook delivery

---

## 💡 Pro Tips

1. **Use Prisma Studio** to inspect database:
   ```bash
   npm run db:studio
   ```

2. **Check server logs** in real-time:
   ```bash
   # Server is running in background
   # Check logs from dashboard or terminal
   ```

3. **Test with cURL**:
   ```bash
   # Create donation
   curl -X POST http://localhost:3000/api/donations \
     -H "Content-Type: application/json" \
     -d '{"campaignId":"...", "amount":50, ...}'
   ```

4. **Monitor database queries** - Enable Prisma query logging:
   ```typescript
   // In lib/prisma.ts
   const prisma = new PrismaClient({ log: ['query'] })
   ```

---

## 📞 Support

- **Issues:** Create issue in repository
- **Documentation:** See docs folder
- **API Reference:** See IMPLEMENTATION_STATUS.md

---

**Platform Version:** 0.7.0 (MVP in progress)
**Target Launch:** Q1 2026
**Ready for Beta Testing:** Estimated 2-3 weeks