# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Bleacher Backers (package name `bleacher-backers`, working dir `rally`) — a fundraising platform for
youth sports teams. Next.js 14 App Router + TypeScript + Prisma/PostgreSQL + Stripe. It moves real
money and stores minors' personal data, so the payment, auth, and outreach paths carry more
invariants than the code size suggests.

## Commands

```bash
npm run dev                  # dev server on :3000
npm run build                # prisma generate && next build
npm run lint                 # next lint
npx tsc --noEmit             # typecheck (no npm script for this)

npm test                     # jest — 9 suites, 274 tests
npx jest tests/api/campaigns.test.ts          # single file
npx jest -t "should create a donation"        # single test by name
npm run test:coverage
npm run test:security        # scripts/test-security-headers.mjs, needs a running server

npm run db:generate          # prisma generate
npm run db:push              # DEV ONLY — see the migration warning below
npm run db:studio
DATABASE_URL=... npx prisma migrate deploy    # the correct way to apply schema to a real DB

node seed-test-data.mjs                       # seeds coach@example.com / admin@example.com (password123)
DATABASE_URL=... node scripts/bootstrap-admin.mjs you@example.com   # promote an existing user to ADMIN
```

`DEPLOYMENT.md` is the authoritative first-deployment runbook (staged, test-mode before live-mode).
`DATABASE_SETUP_GUIDE.md` covers provisioning. The dozens of other root-level `*.md` files are
historical session/roadmap notes — they are not maintained and should not be trusted over the code.

## Non-obvious conventions

**Money is BigInt cents in the database, always.** `JSON.stringify` throws on BigInt, so every
response converts with `Number()` first.

**The API/DB unit boundary is a real trap.** `GET /api/campaigns/[campaignId]` returns **dollars**
(it divides by 100 on the way out) while the columns are **cents**. Fix consumers of that endpoint,
never the endpoint itself. There are also two different `formatCurrency`:

- `lib/utils.ts#formatCurrency(amountInCents)` — divides by 100
- `lib/utils/formatters.ts#formatCurrency(amount)` — expects dollars already

Check which one a file imports before changing a number that flows into it.

**No `@map` in the Prisma schema**, so raw SQL must quote camelCase identifiers: `"createdAt"`,
`"deletedAt"`.

**JWT is verified two different ways.** `jsonwebtoken` in Node route handlers (`lib/auth.ts`), `jose`
in Edge middleware (`lib/auth/edge.ts`). Both read the secret from `lib/jwt-secret.ts`, which throws
at startup in production if `JWT_SECRET` is missing rather than falling back to the dev default.

**`prisma db push` can silently regress a migration.** `TeamMember` uniqueness on
`(campaignId, email)` is a *partial* index (`WHERE "deletedAt" IS NULL`) created by raw SQL in
`prisma/migrations/00000000000001_.../migration.sql`, because Prisma's schema language cannot express
it. Do not add `@@unique([campaignId, email])` to the schema — `db push` would replace the partial
index with an unconditional one and re-break re-adding a soft-deleted player. Schema changes that
touch `TeamMember` should go through `prisma migrate`, not `db push`.

**Team members are soft-deleted only.** Every query filters `deletedAt: null`; "re-adding" a player
revives the existing row so their historical `amountRaised` stays attached.

## Architecture

**Auth and request gating happen in two layers.** `middleware.ts` (Edge) does global API rate
limiting, then decides public vs. protected from explicit `publicExactRoutes` / `publicRoutePrefixes`
lists, then role-gates `/admin` pages. Route handlers re-check authorization themselves — middleware
never grants access, it only denies. Several routes are listed as "public" in middleware precisely
because they authenticate a different way inside the handler: webhooks by signature, `/api/cron/*` by
`Authorization: Bearer ${CRON_SECRET}` (fails closed if unset), unsubscribe/contact-invite/onboarding
by an HMAC or one-time token in the URL, leaderboard/cheer-wall by re-checking the session for the
staff-scoped operations. If you add a route to those lists, the handler must carry the check.

**Authorization helpers** live in `lib/requireAuth.ts`: `requireAuth` / `requireRole` throw a
`NextResponse`, and `withAuth` / `withRole(role, handler)` wrap a handler and catch it. Roles are the
`UserRole` enum (`DONOR`, `PLAYER`, `TEAM_MEMBER`, `CAMPAIGN_LEADER`, `GUARDIAN`, `ADMIN`,
`BANK_ADMIN`).

**CSRF** is double-submit cookie. Cookie-authenticated mutating handlers call
`checkCsrf(req)` from `lib/csrf.ts` and return `csrfCheck.response` when invalid; clients fetch
`GET /api/csrf-token` and send `x-csrf-token`. Public-by-design mutations (auth, webhooks, cron,
token-based onboarding, public cheer-wall posts) deliberately skip it.

**The money path is the most constrained code in the repo.**

- `lib/banking.ts` — fee math (`calculateDonationFees`), donation processing, disbursement
  request/approve/reject/process. Every balance change also writes a `Transaction` ledger row
  (`DEPOSIT`, `FEE_COLLECTION`, …) with `balanceAfter`.
- `lib/donations.ts` — `runMoneyTransaction()` is the wrapper every money mutation must use. It runs
  at ReadCommitted (deliberately *not* Serializable — see the long comment there) with retry/backoff
  on P2034/40001/40P01, so **the callback must be replay-safe**: claim state changes with a
  conditional `updateMany({ where: { id, status: <expected> } })` and apply balances as relative
  `increment`/`decrement`, never read-then-write.
- `completeDonation()` is shared by both the client verify endpoint and the Stripe webhook, which
  race by design; the conditional PENDING→COMPLETED transition is what makes exactly one of them
  apply the credits.
- Fees: platform fee is `campaign.platformFeePercent` (default 10%), processing is 2.9% + $0.30.
  `lib/banking.ts` and `app/api/donations/route.ts` implement the same rounding on purpose — keep
  them in agreement.

**Data model shape.** `Program` (an organization/team that persists across years) → `Campaign` (one
season, has a unique `slug`, a `BankingAccount`, and `TeamMember`s) → `Donation` (optionally
attributed to a `TeamMember` via `teamMemberId`). Public player fundraising links resolve by
`fundLinkCode` *or* `id` — e.g. `app/api/team-members/[teamMemberId]/public/route.ts` matches
`OR: [{ id }, { fundLinkCode }]`, and the leaderboard emits `fundLinkCode || id` in its paths. Alumni are derived, not
stored: `lib/alumni.ts` aggregates `TeamMember` rows across a Program's seasons and dedupes on
normalized email/phone/name.

**Outreach** (`Contact`, `OutreachCampaign`, `OutreachLog`) goes through `lib/email.ts` (Resend) and
`lib/services/sms.ts` (Twilio). `lib/suppression.ts` is the compliance layer — opt-out records,
STOP-keyword matching, HMAC unsubscribe tokens, RFC 8058 `List-Unsubscribe` headers. Any new send
path must run recipients through `filterSuppressed` / `isSuppressed` first. `lib/services/email.ts`
is a compatibility re-export with no logic; import from `lib/email.ts` in new code.

**Rate limiting** (`lib/utils/rate-limiter.ts`) is in-memory and per-process — correct for a single
instance, and explicitly documented as needing a shared store before multi-instance production. It is
skipped entirely in development.

**Graceful degradation is intentional.** Missing `RESEND_API_KEY` / `OPENAI_API_KEY` / Twilio
credentials make those features log-and-continue rather than throw. That is not a bug to fix.

## Frontend

App Router with route groups: `app/(auth)` for login/signup, `app/dashboard/[campaignId]` for
campaign leaders, `app/admin/*` for platform staff, `app/raise/[slug]` and `app/contribute/[token]`
for public/donor flows, `app/player/*` for players. Components are shadcn/ui-style in
`components/ui`, feature components in `components/roster` etc.

Brand colors exist in two places that must be edited together: compiled Tailwind scales in
`tailwind.config.ts` (`primary`/`secondary`/`success`) and runtime shadcn surface CSS variables in
`app/globals.css`. Tailwind cannot read the CSS variables for the scales, so the two are kept in sync
by hand — both files carry comments explaining the split.

## Tests

Jest with `next/jest`, jsdom environment, `@/` → repo root. Suites live in `tests/` (`api/`,
`integration/`, `lib/`, `utils/`) plus any `__tests__/` directories. They do not hit a database —
integration suites assert workflow logic against mocked/inline data. `test-*.mjs` scripts in the repo
root are ad-hoc live-service probes (Stripe, SMS, load) and are gitignored; they are not part of
`npm test`.
