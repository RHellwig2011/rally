# Rally - Fresh API Keys Setup Tracker
**Started:** December 1, 2025

---

## ✅ Step 1: Secure Secrets (COMPLETED)
```bash
NEXTAUTH_SECRET="mvdL/jihgfUXjFhzxaCdZUCfYxxDlwLHd/W11nxi1Ko="
JWT_SECRET="t9OAW3NjTMcBKvt8CHEwjd7rlaWns8PfUOMhv0CwF24="
```

---

## 📧 Step 2: Resend (Email Service) - IN PROGRESS

**URL:** https://resend.com

### Steps:
1. [ ] Sign up with NEW email or GitHub account
2. [ ] Verify email
3. [ ] Click "API Keys" in sidebar
4. [ ] Create API Key (name: "Rally Production")
5. [ ] Copy API key (starts with `re_`)

### Credentials Needed:
```bash
RESEND_API_KEY="re_xxxxxxxxxxxxx"
EMAIL_FROM="noreply@yourdomain.com"  # Can be any email for now
```

**Status:** ⏳ Waiting for credentials

---

## 🗄️ Step 3: Supabase (Database) - PENDING

**URL:** https://supabase.com

### Steps:
1. [ ] Sign up with NEW GitHub account or email
2. [ ] Create organization: "Rally"
3. [ ] Create project: "rally-production"
4. [ ] Generate strong database password (SAVE IT!)
5. [ ] Wait for provisioning (~2 min)
6. [ ] Go to: Settings → Database
7. [ ] Find "Connection string" → "Connection pooling" tab
8. [ ] Copy URI and replace [YOUR-PASSWORD]

### Credentials Needed:
```bash
DATABASE_URL="postgresql://postgres.xxxxx:PASSWORD@xxx.pooler.supabase.com:5432/postgres"
```

**Status:** ⏳ Not started

---

## 💳 Step 4: Stripe (Payments) - PENDING

**URL:** https://stripe.com

### Steps:
1. [ ] Sign up with NEW email
2. [ ] Verify email
3. [ ] Complete business information (can skip some for testing)
4. [ ] Go to: Developers → API Keys
5. [ ] Make sure "Test mode" is ON (toggle top right)
6. [ ] Copy Publishable key (starts with `pk_test_`)
7. [ ] Reveal and copy Secret key (starts with `sk_test_`)

### Credentials Needed:
```bash
STRIPE_SECRET_KEY="sk_test_xxxxxxxxxxxxx"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_xxxxxxxxxxxxx"
STRIPE_WEBHOOK_SECRET="whsec_xxxxxxxxxxxxx"  # Will get this later with Stripe CLI
```

**Status:** ⏳ Not started

---

## 📱 Step 5: Twilio (SMS) - PENDING

**URL:** https://twilio.com

### Steps:
1. [ ] Sign up with NEW email
2. [ ] Verify phone number
3. [ ] Complete registration
4. [ ] Go to Console Dashboard
5. [ ] Copy Account SID (starts with `AC`)
6. [ ] Reveal and copy Auth Token
7. [ ] Buy a phone number (free with trial credit)

### Credentials Needed:
```bash
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="xxxxxxxxxxxxx"
TWILIO_PHONE_NUMBER="+1234567890"
```

**Status:** ⏳ Not started

---

## 📝 Final Steps

### Step 6: Install Dependencies
```bash
npm install --save-dev @types/bcryptjs
```

### Step 7: Update .env File
Replace all old credentials with new ones

### Step 8: Run Migrations
```bash
npx prisma db push
```

### Step 9: Test Build
```bash
npm run build
npm run dev
```

### Step 10: Test Everything
- [ ] User signup (tests email)
- [ ] Create campaign
- [ ] Make test donation (tests Stripe)
- [ ] Check SMS (optional)

---

## 🔐 Security Checklist
- [ ] All old credentials deleted/revoked
- [ ] New .env file never committed to git
- [ ] .env added to .gitignore
- [ ] Credentials saved in password manager
- [ ] 2FA enabled on all accounts

---

**Current Progress:** 1/5 services complete (20%)
