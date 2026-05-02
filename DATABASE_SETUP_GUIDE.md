# Database Setup Guide
**Estimated Time:** 30-40 minutes
**Difficulty:** Easy
**Goal:** Fix database connection and unblock all testing

---

## Quick Start (For Those Who Know What They're Doing)

```bash
# 1. Go to https://supabase.com and create new project
# 2. Copy DATABASE_URL from Settings > Database > Connection string (Pooler mode)
# 3. Update .env file
nano .env  # Update DATABASE_URL line

# 4. Push schema to database
npx prisma db push

# 5. Seed test data
node seed-test-data.mjs

# 6. Verify connection
npx prisma studio  # Should open database browser
```

---

## Detailed Step-by-Step Instructions

### Step 1: Create Supabase Account & Project (10 minutes)

1. **Go to Supabase**
   - Visit: https://supabase.com
   - Click "Start your project"

2. **Sign Up (if needed)**
   - Use GitHub, Google, or email
   - Free tier is perfect for development
   - No credit card required

3. **Create New Project**
   - Click "New Project"
   - **Organization:** Choose or create one (e.g., "Rally Development")
   - **Project Name:** `rally-fundraising` (or your choice)
   - **Database Password:**
     - Click "Generate a password" button
     - **IMPORTANT:** Copy and save this password somewhere safe!
     - You'll need it if you ever access the database directly
   - **Region:** Choose closest to you (e.g., "US West (Oregon)")
   - **Pricing Plan:** Free (25MB database, 500MB bandwidth)

4. **Wait for Project to Initialize**
   - Takes about 2 minutes
   - You'll see a progress indicator
   - Dashboard will load when ready

---

### Step 2: Get Database Connection String (5 minutes)

1. **Navigate to Database Settings**
   - In your project dashboard
   - Click the ⚙️ Settings icon in the left sidebar
   - Click "Database" in the settings menu

2. **Find Connection Strings**
   - Scroll down to "Connection string" section
   - You'll see several tabs:
     - ✅ **Connection pooling** ← Use this one!
     - Connection string
     - Direct connection
     - JDBC

3. **Copy Connection Pooling URL**
   - Click the "Connection pooling" tab
   - Click "Copy" next to the connection string
   - Format looks like:
     ```
     postgresql://postgres.[ref]:[password]@[region].pooler.supabase.com:5432/postgres
     ```
   - The `[password]` placeholder will be replaced with your actual password

4. **Replace Password in URL**
   - If you see `[YOUR-PASSWORD]` in the URL:
     - Replace it with the password you saved earlier
   - If password is already in the URL:
     - You're good to go!

---

### Step 3: Update Environment Variables (2 minutes)

1. **Open .env file**
   ```bash
   cd /workspaces/rally
   nano .env
   ```

2. **Find DATABASE_URL line**
   - Look for: `DATABASE_URL="postgresql://..."`
   - It's currently broken (old Supabase instance)

3. **Replace with your new connection string**
   - Delete the old URL
   - Paste your new Supabase connection pooling URL
   - **Make sure it's in quotes!**

   Example:
   ```env
   DATABASE_URL="postgresql://postgres.abc123:MySecurePass123@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
   ```

4. **Save and exit**
   - Press `Ctrl + O` to save
   - Press `Enter` to confirm
   - Press `Ctrl + X` to exit

---

### Step 4: Push Database Schema (5 minutes)

This creates all the tables, relationships, and indexes.

1. **Run Prisma DB Push**
   ```bash
   npx prisma db push
   ```

2. **What You'll See:**
   ```
   Environment variables loaded from .env
   Prisma schema loaded from prisma/schema.prisma
   Datasource "db": PostgreSQL database "postgres"

   🚀 Your database is now in sync with your schema.
   ```

3. **If You See Errors:**

   **Error: "Can't reach database server"**
   - Check DATABASE_URL is correct
   - Make sure password doesn't have special characters that need escaping
   - Try pinging the host: `ping aws-0-us-west-1.pooler.supabase.com`

   **Error: "P1001: Can't reach database server"**
   - Firewall might be blocking port 5432
   - Try connection string tab instead of pooling tab

   **Error: "Authentication failed"**
   - Password is wrong
   - Go back to Supabase, reset database password
   - Update .env with new password

4. **Verify Tables Were Created**
   ```bash
   npx prisma studio
   ```
   - Opens a web interface at http://localhost:5555
   - You should see all your tables in the left sidebar:
     - User
     - Campaign
     - TeamMember
     - Donation
     - BankingAccount
     - etc.
   - Close with `Ctrl + C` when done

---

### Step 5: Seed Test Data (5 minutes)

This creates sample campaigns, users, and team members for testing.

1. **Run Seed Script**
   ```bash
   node seed-test-data.mjs
   ```

2. **What You'll See:**
   ```
   🌱 Starting database seed...

   👤 Creating users...
   ✅ Admin user created
   ✅ Campaign leader created
   ✅ Player created

   🏆 Creating campaigns...
   ✅ Campaign 1 created: Eagles 2024
   ✅ Campaign 2 created: Warriors Basketball

   👥 Adding team members...
   ✅ 20 team members added to Eagles 2024
   ✅ 15 team members added to Warriors Basketball

   ✅ Seed complete!
   ```

3. **If Seed Fails:**
   - Check database connection is working
   - Run `npx prisma db push` again
   - Check for any error messages
   - Look in seed-test-data.mjs for specific issues

---

### Step 6: Verify Everything Works (3 minutes)

1. **Check Database Has Data**
   ```bash
   npx prisma studio
   ```
   - Open User table - should see 3+ users
   - Open Campaign table - should see 2+ campaigns
   - Open TeamMember table - should see 35+ members

2. **Test API Connection**
   ```bash
   # Dev server should still be running
   # If not: npm run dev

   # Test health check (in another terminal)
   curl http://localhost:3000
   # Should return HTML (not error)
   ```

3. **Check Logs**
   - Look at dev server terminal
   - Should NOT see database errors
   - Should see "Ready in X ms"

---

## Common Issues & Solutions

### Issue: "Error querying the database"

**Cause:** Connection string is incorrect

**Solution:**
1. Double-check DATABASE_URL in .env
2. Make sure password is correct
3. Verify no extra spaces or quotes
4. Try regenerating connection string from Supabase

---

### Issue: "Tenant or user not found"

**Cause:** Old/invalid Supabase instance

**Solution:**
- This is why you're setting up a NEW project
- Don't try to recover old instance
- Just create fresh one

---

### Issue: "Connection timeout"

**Cause:** Network/firewall issue

**Solution:**
1. Check internet connection
2. Try non-pooling connection string
3. Check if port 5432 is blocked
4. Try from different network

---

### Issue: "Too many connections"

**Cause:** Connection pooling limit reached

**Solution:**
1. Close all `npx prisma studio` instances
2. Restart dev server
3. Use connection pooling (not direct connection)

---

### Issue: Seed script fails with "Unique constraint violation"

**Cause:** Data already exists

**Solution:**
1. Reset database: `npx prisma migrate reset --force`
2. Or delete data manually in Prisma Studio
3. Run seed again

---

## What Gets Created

### Tables (20+ total):
- **User** - User accounts (admin, coaches, players)
- **Campaign** - Fundraising campaigns
- **TeamMember** - Players/team members
- **Donation** - All donations
- **BankingAccount** - Campaign banking info
- **DisbursementRequest** - Fund withdrawal requests
- **Transaction** - Financial transaction history
- **RefreshToken** - Auth refresh tokens
- **EmailVerificationToken** - Email verification tokens
- **PasswordResetToken** - Password reset tokens
- **Contact** - Imported contacts
- **ContactList** - Contact list groupings
- **OutreachCampaign** - Outreach campaign tracking
- **SMSMessage** - SMS message log
- **Guardian** - Parent/guardian info
- **PlatformSettings** - Global settings
- **ActivityLog** - Audit trail

### Seed Data Created:
- 3 Users:
  - Admin (admin@rally.com / password123)
  - Campaign Leader (coach@example.com / password123)
  - Player (player@example.com / password123)
- 2 Campaigns:
  - Eagles 2024 (slug: eagles-2024)
  - Warriors Basketball (slug: warriors-2024)
- 35+ Team Members
  - With unique fundraising links
  - With individual goals
- Banking accounts for each campaign

---

## Verification Checklist

After completing all steps, verify:

- ✅ Can connect to Supabase (dashboard loads)
- ✅ `npx prisma db push` succeeds
- ✅ `npx prisma studio` shows tables with data
- ✅ Dev server runs without database errors
- ✅ Can visit http://localhost:3000 (no errors)
- ✅ Seed script completed successfully
- ✅ At least 2 campaigns exist in database
- ✅ At least 3 users exist in database

---

## Next Steps After Database Setup

Once database is working, you can:

1. **Run Stripe E2E Tests**
   ```bash
   node test-e2e-donation.mjs
   node test-3d-secure.mjs
   node test-failed-payments.mjs
   ```

2. **Test Admin Dashboard**
   - Visit http://localhost:3000/admin
   - Log in with admin@rally.com / password123
   - Should see real data (not errors)

3. **Test Donation Flow**
   - Visit http://localhost:3000/raise/eagles-2024
   - Click on a team member
   - Try making a test donation
   - Use card: 4242 4242 4242 4242

4. **Continue Week 1 Roadmap**
   - All remaining tasks can now be completed
   - No more blockers!

---

## Pro Tips

### Save Your Connection String
```bash
# Create a backup of your working .env
cp .env .env.backup

# If you ever need to recover it
cp .env.backup .env
```

### Quick Database Reset
```bash
# If you need to start fresh
npx prisma migrate reset --force
node seed-test-data.mjs
```

### View Database in Supabase Dashboard
1. Go to Supabase dashboard
2. Click "Table Editor" in left sidebar
3. Browse tables visually
4. Can edit data directly

### Monitor Database Activity
1. Supabase dashboard
2. Click "Database" in left sidebar
3. Click "Roles & Permissions"
4. See connection count, query performance

---

## Cost Information

**Supabase Free Tier Includes:**
- 500 MB database space (plenty for testing)
- 1 GB file storage
- 50 MB bandwidth per day
- Unlimited API requests
- Automatic backups (7 days retention)
- SSL encryption

**When You'll Need to Upgrade:**
- 10,000+ donations (approaching 500 MB)
- Production launch (for better performance)
- Need more than 7 days backup retention
- High traffic (>50 MB/day bandwidth)

**Paid Tiers:**
- Pro: $25/month (8 GB database, 250 GB bandwidth)
- Team: $599/month (Unlimited database, 1 TB bandwidth)

For MVP testing, **free tier is perfect**.

---

## Security Notes

### ⚠️ Important:
- **Never commit .env file** to git (already in .gitignore)
- **Database password is sensitive** - don't share publicly
- **Use connection pooling** for better security
- **Enable Row Level Security** in production (Supabase feature)
- **Rotate passwords** before production launch

### Good Practices:
- Use different databases for dev/staging/production
- Keep backups of production database
- Monitor database logs in Supabase
- Set up database alerts
- Use environment-specific credentials

---

## Help & Support

### If You Get Stuck:
1. Check Supabase docs: https://supabase.com/docs
2. Check Prisma docs: https://www.prisma.io/docs
3. Review error messages carefully
4. Check network/firewall settings
5. Try creating a new project

### Contact Information:
- Supabase Support: https://supabase.com/support
- Supabase Discord: https://discord.supabase.com
- Prisma Discord: https://pris.ly/discord

---

**Estimated Total Time:** 30-40 minutes
**Success Rate:** 95% (straightforward process)
**Next:** Run E2E tests and continue roadmap!

---

Good luck! Once database is set up, you're unblocked and can test everything. 🚀
