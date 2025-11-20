# Rally - Next-Generation Fundraising Platform

Made with Hack Club Spaces 💖 (Dont remove this for YSWS)

Rally is a revolutionary fundraising platform designed specifically for youth teams, clubs, and school groups. It combines intuitive campaign management with integrated banking, automated outreach, and transparent fund tracking.

## Key Features

- **Integrated Banking System**: Securely hold raised funds and control distribution with built-in approval workflows
- **Transparent Fee Structure**: Crystal-clear 10% platform fee shown in all reporting and donor receipts
- **Real-Time Dashboard**: Track donations, fees, expenses, and remaining balances instantly
- **Automated Outreach**: Email/SMS campaigns and referral links to boost donor engagement
- **Customizable Campaigns**: Personalize with logos, images, cheer walls, and live updates
- **Guardian Oversight**: Multi-level approval system for fund disbursements
- **Privacy-First**: Never sell or share user or donor data

## Tech Stack

### Frontend
- **Next.js 14+** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** + **shadcn/ui** for custom, accessible UI
- **Zustand** for state management
- **React Query** for server state

### Backend
- **Node.js** with Next.js API routes
- **PostgreSQL** database
- **Prisma ORM** for type-safe database access
- **Stripe Connect** (production) / Simulated (MVP) for payments

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd boba
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and configure:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - Other optional services (Stripe, SendGrid, etc.)

4. **Set up the database**
   ```bash
   npm run db:push
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
boba/
├── app/                    # Next.js app directory
│   ├── page.tsx           # Landing page
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── components/            # React components
│   └── ui/               # Reusable UI components
├── lib/                  # Utility functions
│   ├── prisma.ts        # Prisma client
│   ├── banking.ts       # Banking system logic
│   └── utils.ts         # Helper functions
├── prisma/              # Database schema and migrations
│   └── schema.prisma    # Prisma schema
├── public/              # Static assets
├── ARCHITECTURE.md      # Detailed system architecture
├── WIREFRAMES.md        # UI/UX wireframes and flows
└── README.md           # This file
```

## Core Banking System

The banking system is the heart of Boba. It provides:

### Double-Entry Ledger
Every transaction is recorded with:
- Transaction type (DEPOSIT, DISBURSEMENT, FEE_COLLECTION, REFUND)
- Amount and running balance
- References to related donations or disbursements
- Immutable audit trail

### Donation Flow
1. Donor makes donation ($100)
2. Platform calculates fees:
   - Platform fee: $10 (10%)
   - Processing fee: $3 (~3%)
   - Net to campaign: $87
3. Ledger transactions created
4. Campaign balance updated
5. Donor receives receipt

### Disbursement Flow
1. Campaign leader requests funds
2. System validates available balance
3. Guardian approval (if required)
4. Bank admin processes payout
5. Funds transferred to verified account
6. Ledger updated with disbursement

## Documentation

- **Architecture**: See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system design
- **Wireframes**: See [WIREFRAMES.md](./WIREFRAMES.md) for UI/UX flows and design specs

## Development Status

**Current Phase**: MVP Foundation - Architecture & Core Setup ✅

This is a solo founder project currently in the exploration/investor demo phase. The foundation is built and ready for rapid feature development.

---

**Built with ❤️ for youth teams, clubs, and school groups**

*Rally - Fundraising Reimagined*
