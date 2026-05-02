# Getting Started with Bleacher Backers Development

This guide will help you quickly set up your development environment and start building Bleacher Backers.

## Quick Start (5 minutes)

### 1. Install Dependencies
```bash
npm install
```
✅ Already done! All packages installed.

### 2. Set Up Environment Variables
```bash
cp .env.example .env
```

For **local development without a database**, you can use these minimal settings in `.env`:
```env
# Minimal setup for UI development
DATABASE_URL="postgresql://user:password@localhost:5432/bleacherbackers?schema=public"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
PLATFORM_FEE_PERCENT="10"
```

### 3. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the landing page!

## Next Steps

### Option A: Continue UI Development (No Database Needed)
Perfect for designing pages and building components.

**What you can build:**
- Campaign pages (static)
- Donation flow UI
- Banking dashboard UI
- Campaign creation wizard

**Start here:**
- Create new pages in `app/` directory
- Build components in `components/` directory
- Use the existing UI components in `components/ui/`

**Example: Create a campaign page**
```bash
mkdir -p app/campaigns/[slug]
touch app/campaigns/[slug]/page.tsx
```

### Option B: Full Stack Development (Database Required)
To work with real data and test the banking system.

**Setup PostgreSQL:**

**Option 1: Local PostgreSQL**
```bash
# Install PostgreSQL (macOS)
brew install postgresql
brew services start postgresql

# Create database
createdb boba

# Update .env
DATABASE_URL="postgresql://localhost:5432/boba?schema=public"
```

**Option 2: Cloud Database (Recommended for quick start)**
1. Sign up for [Supabase](https://supabase.com) (free tier)
2. Create a new project
3. Copy the connection string to `.env`
4. Update `DATABASE_URL` in `.env`

**Push database schema:**
```bash
npm run db:push
```

**Open Prisma Studio to view/edit data:**
```bash
npm run db:studio
```

## Project Overview

### Key Files & Directories

```
📁 app/
  └── page.tsx           ← Landing page (DONE)
  └── layout.tsx         ← Root layout (DONE)
  └── globals.css        ← Styles (DONE)

📁 components/ui/
  └── button.tsx         ← Button component (DONE)
  └── card.tsx           ← Card component (DONE)
  └── progress.tsx       ← Progress bar (DONE)

📁 lib/
  └── prisma.ts          ← Database client (DONE)
  └── banking.ts         ← Banking logic (DONE)
  └── utils.ts           ← Utilities (DONE)

📁 prisma/
  └── schema.prisma      ← Database schema (DONE)

📄 ARCHITECTURE.md       ← System design doc
📄 WIREFRAMES.md         ← UI/UX specifications
```

### What's Already Built

✅ **Architecture**: Complete system design in ARCHITECTURE.md
✅ **Data Models**: Full Prisma schema with all tables
✅ **Banking Logic**: Core functions for donations, disbursements, fees
✅ **UI Foundation**: Landing page, components, styling
✅ **Utilities**: Formatting, validation, helper functions

### What to Build Next

🔨 **High Priority (MVP)**
1. Campaign creation wizard
2. Public campaign page with donation form
3. Banking dashboard
4. Donation processing (simulated payments)
5. Disbursement request flow

🎨 **Medium Priority (Engagement)**
6. Campaign update publishing
7. Cheer wall for donor messages
8. Email notifications
9. Referral tracking

🚀 **Lower Priority (Advanced)**
10. Real Stripe integration
11. SMS notifications
12. Mobile app (React Native)

## Building Your First Feature

Let's build a **public campaign page** as an example.

### Step 1: Create the page file
```bash
mkdir -p app/raise/[slug]
touch app/raise/[slug]/page.tsx
```

### Step 2: Add basic structure
```typescript
// app/raise/[slug]/page.tsx
import { notFound } from "next/navigation";

export default async function CampaignPage({
  params,
}: {
  params: { slug: string };
}) {
  // For now, show placeholder
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold">
          Campaign: {params.slug}
        </h1>
        <p className="mt-4 text-gray-600">
          This will be a full campaign page with donation form!
        </p>
      </div>
    </div>
  );
}
```

### Step 3: Test it
Visit [http://localhost:3000/raise/test-campaign](http://localhost:3000/raise/test-campaign)

### Step 4: Connect to database (when ready)
```typescript
import { prisma } from "@/lib/prisma";

export default async function CampaignPage({
  params,
}: {
  params: { slug: string };
}) {
  const campaign = await prisma.campaign.findUnique({
    where: { slug: params.slug },
    include: {
      primaryLeader: true,
      donations: {
        take: 10,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!campaign) {
    notFound();
  }

  return (
    // Render campaign data
  );
}
```

## Tips & Best Practices

### 1. Use the Architecture Docs
- **ARCHITECTURE.md**: Understand the system design
- **WIREFRAMES.md**: Follow the UI specifications
- Data models are already defined in `prisma/schema.prisma`

### 2. Leverage Existing Code
- Banking functions in `lib/banking.ts`
- Utility functions in `lib/utils.ts`
- UI components in `components/ui/`

### 3. Follow the Patterns
```typescript
// Format currency
import { formatCurrency } from "@/lib/utils";
const price = formatCurrency(10000); // "$100.00"

// Calculate donation fees
import { calculateDonationFees } from "@/lib/banking";
const fees = calculateDonationFees(10000); // grossAmount in cents

// Use components
import { Button } from "@/components/ui/button";
<Button variant="default">Donate Now</Button>
```

### 4. Keep Security in Mind
- Never expose sensitive data
- Validate all user inputs
- Use Prisma's type safety
- Follow the banking system's transaction patterns

## Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run start           # Start production server
npm run lint            # Lint code

# Database
npm run db:push         # Push schema to database
npm run db:studio       # Open Prisma Studio (GUI)
npm run db:generate     # Generate Prisma Client

# Useful during development
npm install <package>   # Install new package
npx prisma migrate dev  # Create migration (production)
```

## Debugging Tips

### Next.js not starting?
```bash
# Clear cache and reinstall
rm -rf .next node_modules
npm install
npm run dev
```

### Database connection errors?
- Check `DATABASE_URL` in `.env`
- Make sure PostgreSQL is running
- Try `npm run db:push` to sync schema

### TypeScript errors?
- Run `npm run db:generate` to update Prisma types
- Check imports are correct
- Restart your editor's TypeScript server

## Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com)

## Getting Help

If you're stuck:
1. Check ARCHITECTURE.md for system design questions
2. Check WIREFRAMES.md for UI/UX specifications
3. Review the Prisma schema for data model questions
4. Look at existing code patterns in `lib/` and `app/`

## Ready to Code!

You now have:
- ✅ Complete architecture and design
- ✅ Database schema ready
- ✅ Core banking logic implemented
- ✅ UI foundation set up
- ✅ Development environment configured

**Start building! The foundation is solid and ready for rapid feature development.**

### Suggested First Task
Build the **campaign page** following the wireframe in WIREFRAMES.md section "Campaign Page (Public - Donor View)". This will give you experience with:
- Next.js dynamic routes
- Prisma database queries
- Component composition
- Tailwind styling

Good luck! 🚀