# Setting Up New Accounts for Rally Platform

**Created**: December 1, 2025
**Purpose**: Step-by-step guide to set up all fresh API keys and credentials

---

## 🚨 Critical: Do These First (Required for MVP)

### 1. Generate Secure Secrets (2 minutes)

```bash
# Generate NextAuth Secret
openssl rand -base64 32

# Generate JWT Secret (use a different one)
openssl rand -base64 32
```

Copy these values to your `.env` file under:
- `NEXTAUTH_SECRET=`
- `JWT_SECRET=`

---

### 2. Set Up Resend (Email Service) - **REQUIRED** (5 minutes)

**Why**: Needed for email verification, password resets, donation receipts

1. Go to: https://resend.com
2. Click "Sign Up" (use GitHub or email)
3. Verify your email
4. Click "API Keys" in dashboard
5. Click "Create API Key"
   - Name: "Rally Development"
   - Permission: "Sending access"
6. Copy the key (starts with `re_`)
7. Add to `.env`:
   ```
   RESEND_API_KEY="re_your_key_here"
   ```

**Free Tier**: 3,000 emails/month, 100/day

**For Production**: You'll need to verify your domain later

---

### 3. Create New Supabase Database (10 minutes)

**Why**: Your current database credentials are exposed

1. Go to: https://supabase.com
2. Sign up with GitHub or email
3. Create new organization: "Rally Fundraising"
4. Create new project:
   - Name: "rally-production" (or "rally-dev" for testing)
   - Database Password: (Generate strong password, save it!)
   - Region: Choose closest to your users (US West recommended)
5. Wait for project to provision (~2 minutes)
6. Go to: Project Settings > Database
7. Find "Connection string" section
8. Click "URI" tab
9. **Important**: Switch to "Connection pooling" mode
10. Copy the connection string (starts with `postgresql://`)
11. Replace `[YOUR-PASSWORD]` in the string with your actual password
12. Add to `.env`:
    ```
    DATABASE_URL="postgresql://postgres.xxx:your_password@xxx.supabase.co:5432/postgres"
    ```

**Next Step**: Run migrations
```bash
npx prisma db push
```

---

### 4. Create New Stripe Account (10 minutes)

**Why**: Your current Stripe keys are exposed

1. Go to: https://stripe.com
2. Click "Sign Up"
3. Create account:
   - Email: Your business email
   - Country: United States (or your country)
   - Business type: For now, choose "Individual" or "Company"
4. Verify email
5. Complete onboarding (can skip some steps for testing)
6. Go to: Developers > API Keys
7. **Test Mode** (make sure toggle says "Test mode"):
   - Copy "Publishable key" (starts with `pk_test_`)
   - Click "Reveal test key" for Secret key (starts with `sk_test_`)
8. Add to `.env`:
   ```
   STRIPE_SECRET_KEY="sk_test_your_key_here"
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_your_key_here"
   ```

**Set up Webhook** (after deploying or for local testing):
1. Go to: Developers > Webhooks
2. Click "Add endpoint"
3. For local testing: Use Stripe CLI (see below)
4. For production: Add your domain + `/api/webhooks/stripe`
5. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
   - `charge.dispute.created`
6. Copy "Signing secret" (starts with `whsec_`)
7. Add to `.env`:
   ```
   STRIPE_WEBHOOK_SECRET="whsec_your_secret_here"
   ```

**For Local Testing**:
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe  # macOS
# or download from: https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# This will give you a webhook secret starting with whsec_
```

---

### 5. Create New Twilio Account (10 minutes)

**Why**: Your current Twilio credentials are exposed

1. Go to: https://twilio.com
2. Click "Sign Up"
3. Complete registration:
   - Email, password
   - Verify phone number
   - Answer "How will you use Twilio?" - Choose "Marketing/Notifications"
4. Verify email
5. Go to Console Dashboard
6. Find "Account Info" section:
   - Copy "Account SID" (starts with `AC`)
   - Copy "Auth Token" (click eye icon to reveal)
7. Get a phone number:
   - Click "Phone Numbers" > "Manage" > "Buy a number"
   - Search for number in your country
   - Purchase number (free $15 trial credit)
8. Add to `.env`:
   ```
   TWILIO_ACCOUNT_SID="AC_your_sid_here"
   TWILIO_AUTH_TOKEN="your_auth_token_here"
   TWILIO_PHONE_NUMBER="+1234567890"
   ```

**Free Trial**: $15 credit (~500 SMS messages)

---

## ⚠️ Optional But Recommended

### 6. OpenAI (for AI Features) - Optional (5 minutes)

**Only if you want AI message generation**

1. Go to: https://platform.openai.com
2. Sign up with email or Google
3. Go to: API Keys
4. Click "Create new secret key"
   - Name: "Rally Development"
5. Copy key (starts with `sk-`)
6. Add to `.env`:
   ```
   OPENAI_API_KEY="sk-your_key_here"
   ```

**Cost**: Pay-as-you-go (~$0.002 per AI message)

---

### 7. Sentry (Error Tracking) - For Production (5 minutes)

**Set up before production launch**

1. Go to: https://sentry.io
2. Sign up with GitHub or email
3. Create organization: "Rally"
4. Create project:
   - Platform: "Next.js"
   - Name: "rally-production"
5. Copy DSN (looks like `https://...@sentry.io/...`)
6. Add to `.env`:
   ```
   SENTRY_DSN="your_dsn_here"
   NEXT_PUBLIC_SENTRY_DSN="your_dsn_here"
   ```

**Free Tier**: 5,000 errors/month

---

### 8. Vercel (Hosting) - For Production (5 minutes)

**Do this when ready to deploy**

1. Go to: https://vercel.com
2. Sign up with GitHub
3. Import your GitHub repository
4. Configure environment variables (copy from `.env`)
5. Deploy

**Free Tier**: Unlimited personal projects

---

## 📋 Quick Setup Checklist

Copy this and check off as you complete:

```
Priority 1 - Do Now:
[ ] Generate NEXTAUTH_SECRET
[ ] Generate JWT_SECRET
[ ] Sign up for Resend (email)
[ ] Create new Supabase database
[ ] Run database migrations
[ ] Create new Stripe account
[ ] Set up Stripe webhook (CLI for local)
[ ] Create new Twilio account

Priority 2 - Before Launch:
[ ] Verify custom domain for emails (Resend)
[ ] Switch Stripe to live mode
[ ] Set up Sentry error tracking
[ ] Deploy to Vercel
[ ] Configure production webhook URL
[ ] Set up database backups
[ ] Enable HTTPS only (production)

Optional:
[ ] Sign up for OpenAI (if using AI features)
[ ] Set up Upstash Redis (for caching)
[ ] Configure Google Analytics
```

---

## 🔐 Security Checklist

After setting up all accounts:

```
[ ] Never commit .env file to git
[ ] Keep all API keys secret
[ ] Use different keys for dev/staging/production
[ ] Rotate all keys every 90 days
[ ] Enable 2FA on all accounts (Stripe, Supabase, etc.)
[ ] Set up IP allowlists where possible
[ ] Monitor API usage/billing
[ ] Set up billing alerts
[ ] Document who has access to each account
[ ] Create a secure password manager entry for all credentials
```

---

## 💰 Cost Summary

| Service | Free Tier | When You'll Need to Pay |
|---------|-----------|------------------------|
| **Supabase** | 500MB database, 2GB bandwidth | After ~1,000 users |
| **Stripe** | Free (takes % of transactions) | Never - pay-per-transaction |
| **Resend** | 3,000 emails/month | After ~100 users |
| **Twilio** | $15 credit (~500 SMS) | After trial or ~500 messages |
| **Vercel** | Free personal projects | If need team features |
| **Sentry** | 5,000 errors/month | After ~1,000 errors/month |
| **OpenAI** | $5 credit (first time) | After ~2,500 AI requests |

**Estimated Monthly Cost (1,000 active users)**:
- Supabase: $0 (within free tier)
- Stripe: ~3% of revenue
- Resend: $0-20
- Twilio: $20-50
- Vercel: $0 (free tier)
- Sentry: $0 (free tier)
- **Total**: ~$40-70/month + Stripe fees

---

## 🚀 After Setup

Once you have all credentials:

1. Copy `.env.new` to `.env`:
   ```bash
   cp .env.new .env
   ```

2. Fill in all the values you just got

3. Install missing dependencies:
   ```bash
   npm install --save-dev @types/bcryptjs
   ```

4. Test the build:
   ```bash
   npm run build
   ```

5. Start development server:
   ```bash
   npm run dev
   ```

6. Test key features:
   - [ ] User signup (tests email)
   - [ ] Create campaign
   - [ ] Make test donation (tests Stripe)
   - [ ] Check dashboard updates

---

## 🆘 Need Help?

- **Stripe Issues**: https://stripe.com/docs
- **Supabase Issues**: https://supabase.com/docs
- **Resend Issues**: https://resend.com/docs
- **Twilio Issues**: https://www.twilio.com/docs

---

**Next Steps**: After completing this setup, refer to `IMPLEMENTATION_STATUS.md` for remaining development tasks.
