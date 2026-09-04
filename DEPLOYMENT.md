# Deploying Bleacher Backers

A first-deployment runbook for an app that takes real money and stores minors' personal
information. It is written to be followed in order, under pressure, by someone who did not write the
code.

Every command here was checked against this repository. Where a step can fail, the runbook says what
the failure looks like and how to tell one cause from another.

## Read this first

The code is in good shape. `tsc` is clean, 274 tests pass, the production build succeeds, the payment
path is proven idempotent and race-safe, and every campaign-scoped API route refuses anonymous and
cross-tenant callers. None of that means the system is safe to *operate* yet, and this runbook exists
because those are different questions.

Three things are true at the same time, and holding all three is the point:

1. **Working credentials were published.** They were committed to a public GitHub repository. Assume
   they were scraped. Rotation — not deletion, not history rewriting — is what makes them harmless.
2. **Everything proven about payments was proven in Stripe test mode.** Those proofs do not transfer
   to live mode. A wrong webhook signing secret re-runs every one of them to zero.
3. **The obligations that come with minors' data and other people's money are not engineering
   problems** and cannot be closed by deploying carefully. Stage 7.5 lists them plainly.

## The stages

Do these in order. Each one assumes the previous is finished.

| Stage | What it does | Money at risk |
|---|---|---|
| **0** | Contain the credential exposure — rotate, then purge | none |
| **1** | Provision the production database, with backups | none |
| **2** | Deploy to Vercel, still in Stripe **test** mode | none |
| **3** | Wire Stripe and prove the money path in **test** mode | none |
| **4** | Turn on email and SMS | none |
| **5** | Make production observable | none |
| **6** | **Go live with real money** | real |
| **7** | Controlled go-live with one pilot team | real |

Stages 0–5 involve no real money at all. That is deliberate: by the time a real card is charged in
Stage 6, the deploy, the database, the migrations, the webhooks, email delivery and error tracking
have all been exercised for real.

## Quick reference

The whole runbook in one screen. Details are in the stage sections; do not use this list alone.

```
STAGE 0  rotate Twilio / Stripe / DB password / JWT_SECRET at each provider
         then purge .env, .env.new and the credential inventories from history
STAGE 1  create Postgres, get the pooled URL, enable backups + PITR, test a restore
         DATABASE_URL=... npx prisma migrate deploy      # 23 tables incl. _prisma_migrations
STAGE 2  import repo to Vercel, set every env var, TRUSTED_PROXY_HOPS=1
         curl https://APP/api/health                      # expect {"status":"ok"}
         sign up in the UI, then:
         DATABASE_URL=... node scripts/bootstrap-admin.mjs you@example.com
STAGE 3  register the TEST webhook, deploy that endpoint's signing secret
         test donation -> credited once -> refund -> reversed once
STAGE 4  add the 3 Resend DNS records, verify the domain, send a real email
         confirm TWILIO_PHONE_NUMBER is owned by the account, send a real SMS
STAGE 5  install Sentry, alert on failed webhooks and stuck PENDING donations
         point an uptime monitor at /api/health, name who is on call
STAGE 6  swap in live keys, register the LIVE webhook (separate secret)
         real $1 donation -> refund it -> Connect onboarding -> one real payout
STAGE 7  one pilot team you know personally, smoke-test, then decide go / no-go
```

## What you need before you start

- Admin access to the GitHub repository, and the ability to force-push to `main`
- The Stripe account, with permission to roll keys and create webhook endpoints
- The Twilio account and the Resend account
- Access to whatever manages DNS for your sending domain
- A password manager to hold the rotated secrets

---

## Stage 0 — Contain the credential exposure (do this first)

Working credentials for this project were committed to public git history at
`github.com/RHellwig2011/rally`: a Twilio auth token, a Stripe test key, a database password, and
an earlier `JWT_SECRET`. They reached history through two files, `.env` and `.env.new`. Treat all
of them as compromised and already in someone else's hands.

Do not start with the history purge. Rotation comes first. A purge only removes the values from
the copy of the repository that GitHub serves *today*; it does nothing about the clones, forks,
scraper databases, and caches that already exist. Rotation is what actually makes the leaked
strings worthless. Purging first, then rotating, leaves a window in which the secrets are still
live and you have lost the ability to see what was exposed.

Nothing else in this runbook — no migration, no Vercel env setup, no first deploy — should happen
until Stage 0 is complete.

### 1. Rotate every exposed credential at its source

First, read back exactly what was in those files so you rotate everything and not just what you
remember. From your existing clone:

```bash
cd /workspaces/rally
git log --all --full-history --oneline -- .env .env.new
git show <commit>:.env
git show <commit>:.env.new
```

Run `git show` for each commit the log prints. Write down every key you find. Anything in those
files gets rotated, including values not named above (`RESEND_API_KEY`, `OPENAI_API_KEY`,
`CRON_SECRET`) if they appear.

**1a. Twilio auth token.** In the Twilio Console, go to Account → API keys & tokens. Request a
secondary auth token, promote it to primary, then delete the old primary. If an API Key secret
(`SK…`) was also in the committed files, delete that key and create a new one; the secret is shown
once, at creation.

This project prefers API Key auth: the code uses `TWILIO_API_KEY_SID` and `TWILIO_API_KEY_SECRET`
when they are present, and only falls back to `TWILIO_AUTH_TOKEN` when no API key is configured.
So confirm `TWILIO_API_KEY_SID` and `TWILIO_API_KEY_SECRET` are set in the environment you are
about to rotate, and SMS keeps working straight through the revocation of the old auth token.

*What failure looks like:* SMS starts returning Twilio error 20003 (authenticate) right after you
delete the old token. That means the API key pair is not actually set in that environment — the
code fell back to the token you just killed. Fix by setting `TWILIO_API_KEY_SID` and
`TWILIO_API_KEY_SECRET`, or by setting the new `TWILIO_AUTH_TOKEN`. Also confirm
`TWILIO_ACCOUNT_SID` still matches the account holding the key, and that `TWILIO_PHONE_NUMBER` is
a number owned by that same account and is SMS-capable.

**1b. Stripe.** In the Stripe Dashboard, Developers → API keys → roll the exposed secret key. Roll
it even though it was a test key: a test key still exposes customer records, email addresses, and
payment metadata. Set the new value as `STRIPE_SECRET_KEY`.

`STRIPE_WEBHOOK_SECRET` is per-endpoint. If the committed value was a real `whsec_…`, delete that
webhook endpoint in the Dashboard and create a new one; the new signing secret is shown on the
endpoint's page. The webhook handler rejects unsigned and mis-signed payloads, so a stale
`STRIPE_WEBHOOK_SECRET` shows up as every Stripe delivery failing with a 400 in Developers →
Webhooks → attempt log, while ordinary donations still appear to start normally.

`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is public by design — it ships to the browser — so it needs no
rotation for secrecy. It does need to come from the same Stripe account and the same mode
(test/live) as `STRIPE_SECRET_KEY`. A mode mismatch fails at confirmation time with a "No such
payment_intent" style error, which is easy to misread as a code bug.

Before you leave the Dashboard, open Developers → Events and Developers → Logs and scan for API
calls you do not recognize since the date the key was committed.

**1c. Database password.** Rotate at the database provider, not in the connection string. Either
change the password on the application role or, better, create a new role with the same grants and
drop the old one — that also revokes any session already authenticated as the old role. Record the
new `DATABASE_URL` in your password manager and update your local `.env` and any CI. You will set it
in Vercel in Stage 2; if a Vercel project already exists, update it there now too.

Percent-encode special characters in the new password before putting it in `DATABASE_URL`. `@ : /
? # & %` all break URI parsing. A password like `P@ssw0rd` must be written `P%40ssw0rd`.

*What failure looks like:* `prisma migrate deploy` returns `P1013` (the provided database string is
invalid) for an encoding mistake, `P1000` (authentication failed) for a wrong password, and `P1001`
(can't reach database server) for a host, port, or network rule problem. These are three different
problems; read the code before changing anything.

While you are in the provider console, check whether the database accepts connections from the
public internet, and restrict it to the ranges you actually need. Then look for unfamiliar roles or
rows.

**1d. `JWT_SECRET`.** Generate a fresh one:

```bash
openssl rand -hex 32
```

Put the output straight into your password manager. Do not route it through chat, email, or a ticket
on the way. It gets set in Vercel in Stage 2, along with everything else.

Rotating `JWT_SECRET` invalidates every token signed with the old one, so every existing session is
signed out. That is the point, not a side effect. Anyone holding the leaked secret could mint a
valid token for any user id and role, so every token issued under it has to die.

*What failure looks like:* `lib/jwt-secret.ts` throws at startup in production if `JWT_SECRET` is
unset or still the development fallback. This is deliberate fail-fast. If the deployment crashes on
boot right after this step, the variable was set in the wrong environment (Preview instead of
Production), or the deployment predates the variable — environment changes only take effect on a
new deployment, so redeploy.

### 2. Only then, purge the files from git history

Install `git filter-repo` (it is not part of git):

```bash
pipx install git-filter-repo   # or: brew install git-filter-repo
git filter-repo --version
```

**The purge scope is wider than just the two `.env` files.** Secrets were also committed in ordinary
tracked files, which is easy to miss because nobody thinks of a `.md` or `.csv` as a secret store:

| File | What it held |
|---|---|
| `.env`, `.env.new` | Database DSN, Stripe key, Twilio auth token, `JWT_SECRET` |
| `scripts/quick-stripe-test.mjs` | A hardcoded Stripe secret key — **the one still in active use** |
| `NEW_CREDENTIALS_TRACKER.md` | Plaintext `JWT_SECRET`, `NEXTAUTH_SECRET`, a DSN with password |
| `API_KEYS_AND_STATUS.csv` | A DSN with password |
| `DATABASE_SETUP_GUIDE.md`, `SETUP_NEW_ACCOUNTS.md`, `WEEK_1_PROGRESS.md` | Supabase DSNs with passwords, in prose |

The working tree is already clean: the two inventory files are untracked and gitignored, the
hardcoded Stripe key now reads from the environment, and the DSNs in the guides are redacted. The
purge below removes the two inventory files from *history*. The others are left in history
deliberately — rewriting a file that still exists is more disruptive than it is worth, and rotation
is what actually neutralises the exposure. If you would rather scrub them too, add `--path` entries
for each; the `--replace-text` mode can also blank specific strings while keeping the files.

Work on a fresh mirror clone, never on your working copy:

```bash
cd /tmp
rm -rf rally-purge.git
git clone --mirror https://github.com/RHellwig2011/rally.git rally-purge.git
cd /tmp/rally-purge.git
git filter-repo --invert-paths \
  --path .env \
  --path .env.new \
  --path NEW_CREDENTIALS_TRACKER.md \
  --path API_KEYS_AND_STATUS.csv
```

Verify inside the mirror before pushing. This must print nothing:

```bash
git log --all --full-history --oneline -- .env .env.new
```

Then push the rewritten history back:

```bash
git remote add origin https://github.com/RHellwig2011/rally.git
git push --force --mirror origin
```

`git filter-repo` deliberately deletes the `origin` remote after rewriting, which is why you re-add
it. That is expected, not an error.

Things that go wrong here:

- **"Refusing to destructively overwrite repo history…"** — you ran filter-repo somewhere that is
  not a fresh clone. Delete the directory and re-clone rather than reaching for `--force`.
- **`! [remote rejected] main (protected branch hook declined)`** — branch protection blocks force
  pushes. Turn protection off in GitHub → Settings → Branches, push, turn it back on immediately.
- **`--force --mirror` deletes remote refs that do not exist in your mirror.** Any branch or tag
  created on the remote after you cloned will be erased. Clone immediately before you push, and
  make sure nobody else is pushing while you work.

After the push, every commit SHA changes. Every existing clone now has divergent history, and
pushing from one of them re-introduces the deleted files. Replace your working copy rather than
trying to rebase it:

```bash
cd /workspaces
mv rally rally-old
git clone https://github.com/RHellwig2011/rally.git rally
```

Move any uncommitted work across by hand, then delete `rally-old`. Check stashes specifically —
this repository has stash entries, and one of them (`stash@{1}: WIP on main`) contains `.env.new`.
Stashes are never pushed, so the purge does not touch them; they die with the old directory. Tell
every other person or machine with a clone to do the same.

### 3. Assume the old values were already harvested

The repository is public. Automated scrapers watch GitHub's public event firehose and pull new
commits within minutes of a push, specifically looking for `.env` files and key-shaped strings.
Leaked Twilio credentials in particular are harvested and used for SMS pumping fraud, which shows
up as a bill, not as an outage.

So the working assumption is: the old Twilio token, the old Stripe key, the old database password,
and the old `JWT_SECRET` are in strangers' hands. Do not skip rotation on the grounds that the
project is small, unlaunched, or that the Stripe key was only a test key.

Understand also what a purge does not do. It does not reach clones, forks, scraper archives, or
GitHub's own caches — rewritten commits often stay reachable by direct SHA URL until GitHub garbage
collects them, and forks keep the original objects regardless. If you need those cached views gone,
you have to ask GitHub Support to purge them, and even then you are only cleaning up the copy you
control.

### 4. If the repo has been public and widely cloned, start fresh instead

When the repository has been public long enough to be forked, starred, or cloned by people you
cannot contact, a history rewrite is theatre. The cheaper and more honest option is a brand-new
private repository with one initial commit of the current tree, and the old one archived or deleted:

```bash
cd /workspaces/rally
rm -rf .git
git init
git add -A
git commit -m "Initial commit"
gh repo create bleacher-backers --private --source=. --push
```

Be clear about the cost before you run that: you lose all history, blame, tags, issues, and pull
requests. And the Vercel project is connected to the old GitHub repository — after switching, go to
Vercel → Project → Settings → Git, disconnect the old repo and connect the new one, or deployments
silently stop happening. Deleting the old public repository also does not retract anything already
cloned; it only stops new copies.

Rotation from step 1 is still required either way. A new repository does not expire an old key.

### 5. Verify containment

Run these in the clone you will actually deploy from.

```bash
cd /workspaces/rally
git ls-files | grep -i env
```

Expected output is `.env.example` — plus `next-env.d.ts`, which is Next.js's generated TypeScript
shim and contains no secrets. If you want only the env-family files:

```bash
git ls-files | grep -i '\.env'
```

That must print exactly one line: `.env.example`. Anything else tracked means a secret file is
still in the tree.

Confirm history is clean (no output means clean):

```bash
git log --all --full-history --oneline -- .env .env.new
```

Confirm the ignore rules will hold going forward:

```bash
git check-ignore -v .env .env.new .env.local .env.production
git check-ignore -v .env.example    # prints nothing, exits 1 — correct
```

The first command should show `.gitignore:11:.env` and `.gitignore:12:.env.*` matching each file.
The second must print nothing: `.env.example` is intentionally un-ignored by the `!.env.example`
rule so the template stays in the repo. Keep it a template — placeholder values only, never a real
key.

Finally, spot-check that no credential is hardcoded outside the env files:

```bash
grep -rInE "sk_live|sk_test|rk_live|whsec_|SK[0-9a-f]{32}|AC[0-9a-f]{32}|re_[A-Za-z0-9]" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next .
```

Hits in `.env.example` are fine if they are obviously placeholders. Hits anywhere else are a finding.

**Stage 0 is done when:** the old Twilio token is deleted and SMS still sends on the API key pair;
the Stripe secret key is rolled and the webhook signing secret matches a live endpoint; the database
role has a new password and `DATABASE_URL` is updated everywhere; a fresh `JWT_SECRET` is set in
Vercel Production; `git ls-files | grep -i '\.env'` prints only `.env.example`; and
`git log --all --full-history -- .env .env.new` prints nothing. Only then continue to the next stage.


---

## Stage 1 — Provision the production database

Everything else in this runbook depends on a database that is migrated, backed up, and reachable from Vercel. Do this stage first, and do not point the app at it until step 1.9 passes.

Two facts about this repo drive the whole stage:

- `prisma/schema.prisma` declares exactly one datasource URL: `url = env("DATABASE_URL")`. There is no `directUrl` and no `shadowDatabaseUrl`. Every Prisma command — including `prisma migrate deploy` — talks to whatever `DATABASE_URL` is set to in the shell that runs it. You will use two different values for it: a **direct** URL when you run migrations by hand, and a **pooled** URL for the deployed app.
- `prisma/migrations/` contains exactly two migrations. The second one creates a partial unique index (`TeamMember_campaignId_email_live_key`) that Prisma's schema language cannot express. It must never be dropped, and you must never "repair" this database with `prisma db push` — `db push` would not recreate that index.

### 1.1 Pick a managed Postgres provider

Neon, Supabase, and Vercel Postgres all work. Pick on operational fit, not features:

- It must offer a **pooled (PgBouncer-style) connection string** in addition to a direct one. Serverless functions open a connection per instance; Prisma without a pooler will exhaust a small Postgres connection limit under normal traffic.
- It must offer **automated daily backups and point-in-time recovery (PITR)** on the plan you are actually paying for. On several providers PITR is a paid tier only. If PITR is not available on your plan, stop and upgrade before continuing — this database will hold real donation records and minors' contact details, and there is no second copy of that anywhere.
- Put the database in the region your Vercel functions run in. Cross-region round trips are charged to every request, and this app makes several queries per page.

Do not use a free tier that suspends or cold-starts the database on idle for the production instance. Suspension shows up as intermittent `P1001` errors from the app for the first request after a quiet period.

### 1.2 Collect both connection strings

From the provider dashboard, copy:

1. The **pooled** URL — usually labelled "pooled", "connection pooling", "transaction mode", or hosted on a `-pooler` hostname. This becomes `DATABASE_URL` in Vercel.
2. The **direct** URL — labelled "direct connection", "session mode", or simply the non-pooler hostname. This is used only for running migrations from your laptop.

Provider-specific notes that matter:

- Require TLS. If the provider does not already include it, append `?sslmode=require`.
- If the password contains `@ : / ? # [ ] %` or a space, URL-encode it. A raw `@` in the password produces `P1013 The provided database string is invalid` or an authentication failure against a nonsense hostname.
- On Supabase (PgBouncer in transaction mode), Prisma needs `?pgbouncer=true&connection_limit=1` appended to the **pooled** URL. Neon's pooled endpoint does not need `pgbouncer=true`.

Store both strings in a password manager. Never write them into a file in the repo. `.gitignore` blocks `.env` and `.env.*` (with `.env.example` as the only exception), but the safe habit here is to export them into your shell for the duration of this stage and nothing else. Credentials have already leaked from this repo once (see the rotation stage); treat a pasted connection string as burned.

### 1.3 Prepare the machine you will migrate from

Run migrations from a clean checkout of the exact commit you are deploying, on Node 20–22 (`engines: node >=20 <23`).

```bash
git clone https://github.com/RHellwig2011/rally.git
cd rally
git checkout <the-commit-or-tag-you-are-deploying>
node --version          # must be v20.x, v21.x, or v22.x
npm ci                  # postinstall runs `prisma generate`
```

If `npm ci` fails at `prisma generate`, fix that before touching the database. A stale or missing client will make every later verification step ambiguous.

### 1.4 Determine which case you are in: NEW database or EXISTING database

This is the single most important decision in this stage, and getting it wrong produces a half-migrated database. Point your shell at the **direct** URL and look:

```bash
export DATABASE_URL="postgresql://USER:PASSWORD@DIRECT-HOST:5432/DBNAME?sslmode=require"

psql "$DATABASE_URL" -c "
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name;"
```

No `psql` locally? Paste the same SQL into the provider's web SQL console.

- **Zero rows returned** → the database is empty. This is **Case A (new)**. Go to 1.5.
- **Rows returned, but no `_prisma_migrations` table** → the schema was created by `prisma db push`. This is **Case B (existing, unbaselined)**. Go to 1.6.
- **Rows returned including `_prisma_migrations`** → migrations have run here before. Run `npx prisma migrate status` and follow what it reports; do not baseline again. If it says both migrations are applied, skip to 1.7.

### 1.5 Case A — brand new empty database

```bash
npx prisma migrate deploy
```

Verified behaviour: this applies `00000000000000_init` (22 tables) then `00000000000001_teammember_partial_unique_and_backfills`, and finishes with the partial unique index in place. Expected output ends with `2 migrations found` and `All migrations have been successfully applied.`

Failure signatures:

- `P1001: Can't reach database server` — wrong host or port, or the provider's IP allowlist is blocking you. Check the allowlist first; it is the usual cause.
- `P1000: Authentication failed` — password wrong or not URL-encoded (see 1.2).
- `prepared statement "s0" already exists`, or a hang on an advisory lock — you are running migrations through the **pooled** URL. Stop, re-export `DATABASE_URL` with the direct URL, and rerun. Nothing is left half-applied by this failure, but re-check with `npx prisma migrate status` before retrying.

Then go to 1.7.

### 1.6 Case B — adopting a database that already has tables from `prisma db push`

The tables exist but Prisma has no record of them. If you run `prisma migrate deploy` now, it will try to run `00000000000000_init` from scratch and fail on the first `CREATE TABLE` with `ERROR: relation "User" already exists (42P07)`, leaving a failed row in `_prisma_migrations` that you then have to clean up. Baseline first.

**Before anything else, take a manual backup/snapshot from the provider console.** The second migration is not read-only: it soft-deletes duplicate live `TeamMember` rows (keeping the earliest per campaign+email), backfills `phoneNumber` from `phone`, and rewrites `joinedAt` / `invitationStatus` for players who completed onboarding. It runs inside a single `BEGIN`/`COMMIT`, so it either fully applies or fully rolls back — but the data changes it makes are permanent once committed.

1. Mark the initial migration as already applied (this only writes a bookkeeping row; it runs no SQL against your tables):

```bash
npx prisma migrate resolve --applied 00000000000000_init
```

2. Confirm the baseline took:

```bash
npx prisma migrate status
```

Expect it to report `00000000000000_init` as applied and one migration still pending.

3. Optional but recommended — see exactly how far the existing schema has drifted from what the code expects:

```bash
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

An empty script means the live schema already matches. Anything non-trivial (dropped columns, renamed tables) means the database was pushed from a different schema version and you should reconcile it by hand before continuing. Do not resolve drift with `npm run db:push` — that command is for local development only, and it will not create the partial unique index.

4. Apply the remaining migration:

```bash
npx prisma migrate deploy
```

Failure signatures specific to this path:

- `ERROR: column "onboardingCompletedAt" of relation "TeamMember" does not exist (42703)` — the existing database predates the current schema. The transaction rolls back; nothing is applied. Reconcile the drift from step 3, then rerun.
- `could not create unique index "TeamMember_campaignId_email_live_key" … Key ("campaignId", email) is duplicated` — should not happen, because the migration soft-deletes duplicates before creating the index, but if it does, the whole migration rolled back and you have a data problem to inspect manually.

### 1.7 Verify the schema, don't assume it

Two checks. Both should be run against the direct URL.

```bash
# Expect 23: the 22 application tables plus Prisma's own _prisma_migrations table.
psql "$DATABASE_URL" -c "
  SELECT count(*) FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"

# Expect exactly one row, and the definition must end with: WHERE ("deletedAt" IS NULL)
psql "$DATABASE_URL" -c "
  SELECT indexdef FROM pg_indexes
  WHERE indexname = 'TeamMember_campaignId_email_live_key';"
```

If the second query returns nothing, the partial index is missing. Do not proceed and do not attempt to add it with `db push`. Re-check `npx prisma migrate status`; the second migration did not apply.

Finally:

```bash
npx prisma migrate status
```

Must report that the database schema is up to date and both migrations are applied. Anything else — pending, failed, or drifted — is a stop.

### 1.8 Turn on backups and PITR now, and test a restore once

Do this while the database is still empty. Backup configuration applied after real donations exist does not retroactively protect the window before it.

1. In the provider console, enable automated daily backups and point-in-time recovery. Set retention to at least 7 days; 30 is better given this data includes financial records.
2. Write down, in this runbook, the retention window and the exact console path to trigger a restore. At 2am you will not want to go looking.
3. **Test the restore.** An untested backup is not a backup.

```bash
# 1. Put a known marker in the production database.
psql "$DATABASE_URL" -c "CREATE TABLE restore_probe (note text);"
psql "$DATABASE_URL" -c "INSERT INTO restore_probe VALUES ('probe-$(date +%s)');"
psql "$DATABASE_URL" -c "SELECT * FROM restore_probe;"   # note the value

# 2. Wait for the next automated backup, or trigger one manually in the console.
# 3. In the provider console, restore that backup into a NEW, SEPARATE database
#    (a branch, a fork, or a fresh instance) — never in place over production.
# 4. Point at the restored copy and confirm the marker and the schema survived.
export RESTORE_URL="postgresql://…restored-copy…?sslmode=require"
psql "$RESTORE_URL" -c "SELECT * FROM restore_probe;"
psql "$RESTORE_URL" -c "
  SELECT indexdef FROM pg_indexes
  WHERE indexname = 'TeamMember_campaignId_email_live_key';"
```

If the marker row and the partial index both come back, the restore path works. Delete the restored copy, then clean up the probe on production:

```bash
psql "$DATABASE_URL" -c "DROP TABLE restore_probe;"
```

If the restore does not produce a usable database, you have no recovery story. Fix that with the provider before any real donation is taken.

### 1.9 Give the app the pooled URL

Set `DATABASE_URL` in Vercel to the **pooled** connection string — not the direct one you just used for migrations.

```bash
# From the repo root, with the Vercel CLI linked to the project:
vercel env add DATABASE_URL production
# paste the POOLED url when prompted
```

Or set it in Vercel → Project → Settings → Environment Variables, scoped to Production. Environment variable changes only take effect on a new deployment; a redeploy is required.

Why this matters: Prisma opens a connection pool per function instance, and Vercel can run many instances concurrently. Against a direct connection that shows up as `FATAL: too many connections for role` / `53300` under load, or as `P2024 Timed out fetching a new connection from the connection pool` — often only during a traffic spike, which is exactly when a donation is in flight. On a transaction-mode pooler, also keep `connection_limit=1` on the URL so each instance holds a single connection.

Two follow-on notes to carry into later stages:

- Migrations are **not** run by the build. `"build": "prisma generate && next build"` generates the client only. Every future schema change requires you to run `npx prisma migrate deploy` yourself against the direct URL, before or immediately after the deploy that needs it.
- With no error tracking configured anywhere in this app (see the observability gap), a database problem in production is invisible until a user reports it. Until that gap is closed, check the provider's own metrics and Vercel's function logs manually after each deploy.

Unset the direct URL from your shell when you are done so a later command in this runbook cannot accidentally run against production:

```bash
unset DATABASE_URL RESTORE_URL
```


---

## Stage 2 — Deploy to Vercel (Stripe still in TEST mode)

This stage gets a working production deployment in front of a real domain with a real database, while Stripe stays in **test mode** for the entire stage. Nothing in Stage 2 can move real money. That is deliberate: you will exercise the build, the environment, the migrations, the cron, the admin bootstrap and the full donation path with test cards, and if any of it is wrong the cost is a broken page, not a lost donation.

Do not switch Stripe to live keys anywhere in this stage. Live-mode cutover is a later stage and has its own checklist.

Before you start, you need:

- A production PostgreSQL database, empty, with a connection string you can reach from your laptop.
- Rotated credentials from Stage 1. Every secret committed to public git history is compromised; do not reuse any of them here.
- Stripe **test** keys (`sk_test_…`, `pk_test_…`).
- A local checkout on Node 20, 21 or 22 (`package.json` sets `engines: node >=20 <23`).

---

### 1. Import the repository into Vercel

1. In the Vercel dashboard, choose **Add New → Project**, then **Import Git Repository**, and select the `rally` repo.
2. Leave **Framework Preset** as **Next.js**. Vercel detects it from `next.config.mjs`.
3. Leave **Root Directory** as the repository root.
4. **Do not override the Build Command.** `package.json` already has:

   ```
   "build": "prisma generate && next build"
   "postinstall": "prisma generate"
   ```

   Prisma Client is generated both at install and at build, which is exactly what Vercel's build cache requires. If you type anything into the Build Command override box, you will most likely drop `prisma generate` and the build will fail with `@prisma/client did not initialize yet`. Leave it empty.
5. Leave **Install Command** and **Output Directory** empty as well.
6. Set the Node.js version to 20.x or 22.x under **Settings → General → Node.js Version**. 23 and later is outside the supported range in `engines`.
7. **Do not deploy yet.** Add the environment variables first (step 2). A deploy without `JWT_SECRET` will fail, by design.

---

### 2. Set every environment variable

Go to **Settings → Environment Variables** and add all of the following for the **Production** environment.

Two rules before you paste anything:

- **`NEXT_PUBLIC_*` variables are compiled into the JavaScript bundle that ships to every browser.** They are public. Never put a secret key, an API secret, a database URL or a webhook signing secret in a `NEXT_PUBLIC_` variable. Only two exist in this codebase — NEXT_PUBLIC_APP_URL and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY — and both are safe to publish: the app's own URL and the Stripe *publishable* key.
- **`NEXT_PUBLIC_*` values are baked in at build time.** Changing one later requires a **redeploy**, not a restart. Server-side variables also only take effect on the next deployment.

#### Required — the app will not run without these

| Variable | Value |
|---|---|
| `DATABASE_URL` | Production Postgres connection string. If your provider requires TLS, keep `?sslmode=require`. |
| `JWT_SECRET` | A fresh 32-byte random hex value. Generate with `openssl rand -hex 32`. |
| `NEXT_PUBLIC_APP_URL` | The real deployed origin, no trailing slash — e.g. `https://bleacherbackers.vercel.app`. See step 5. |

`lib/jwt-secret.ts` **throws at startup in production** if `JWT_SECRET` is unset or still the development fallback value. That is intentional fail-fast behaviour — a missing signing secret would make every session token forgeable. If you see the build or the first request die complaining about `JWT_SECRET`, this is why; set a real value and redeploy.

There is no `NEXT_PUBLIC_BASE_URL`. That variable does not exist in this codebase; do not create it.

`NODE_ENV` is set to `production` by Vercel automatically. Do not add it manually.

#### Payments (test mode for this whole stage)

| Variable | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` from the Stripe **test** dashboard. Server-side secret. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from the **test-mode** webhook endpoint you create in step 7. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_…`. Public by design; this one is safe in the browser bundle. |

You will not have the webhook secret until step 7. Put a placeholder in now if you like, but you must come back and set the real value and redeploy, or every webhook will be rejected.

#### Email (Resend)

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | `re_…` |
| `EMAIL_FROM` | Display-name form, e.g. `Bleacher Backers <noreply@yourdomain.com>` |
| `MAILING_ADDRESS` | Your real CAN-SPAM postal address. There is a hardcoded fallback, so an unset value will not crash anything — it will just send the wrong address. Set it. |

Email will not actually reach anyone until the Resend domain DNS records are verified. That is a known open gap and it matters in step 8.

#### SMS (Twilio)

| Variable | Value |
|---|---|
| `TWILIO_ACCOUNT_SID` | `AC…`. Always required. |
| `TWILIO_API_KEY_SID` | `SK…`. **Preferred** auth method — scoped and independently revocable. |
| `TWILIO_API_KEY_SECRET` | The secret shown once when the API key was created. |
| `TWILIO_AUTH_TOKEN` | Fallback only. Used **only** when no API key is set. If you set an API key, you can leave this unset. |
| `TWILIO_PHONE_NUMBER` | E.164, e.g. `+15551234567`. Must be owned by that account and SMS-capable. |

The Twilio auth token that was committed to public git history is compromised. If you have not rotated it in Stage 1, stop and do that first.

#### Ops

| Variable | Value |
|---|---|
| `CRON_SECRET` | Random secret, e.g. `openssl rand -hex 24`. **Required.** `/api/cron/*` fails **closed** with a 503 when it is unset. |
| `TRUSTED_PROXY_HOPS` | **`1`** on Vercel. Use `2` only if Cloudflare sits in front of Vercel. |
| `ALLOW_UNSIGNED_WEBHOOKS` | **Leave unset.** Do not add this row at all. It is a development-only escape hatch that disables Stripe webhook signature verification. |

`TRUSTED_PROXY_HOPS` controls how the rate limiter reads `X-Forwarded-For`. Vercel appends the real client IP as the last hop, and a caller can prepend anything they like to the header. With `TRUSTED_PROXY_HOPS=1` the limiter counts one entry from the right and gets the address Vercel wrote. Without it the limiter refuses to trust the header at all, so every anonymous caller collapses into one shared bucket — a single noisy visitor can rate-limit the whole internet out of your donation form. Set it to `1`.

#### Optional

| Variable | Effect if unset |
|---|---|
| `OPENAI_API_KEY` | AI help chat and AI message generation degrade to templates. Everything else works. Safe to skip. |
| `REFRESH_TOKEN_EXPIRES_DAYS` | Defaults to `30`. |

#### A note on Preview environments

If you tick **Preview** while adding `DATABASE_URL`, every pull-request preview build will read and write your **production** database, including minors' PII. Either scope `DATABASE_URL` to Production only, or point Preview at a separate throwaway database. The same applies to `STRIPE_SECRET_KEY` and `RESEND_API_KEY`.

---

### 3. Deploy

Trigger the first deployment (**Deploy** on the import screen, or **Deployments → Redeploy**).

What a healthy build looks like: `npm install` runs `postinstall` → `prisma generate`, then `next build` runs `prisma generate` again and compiles. Expect a few minutes.

Failures you may see, and what they mean:

- `@prisma/client did not initialize yet` — the build command was overridden and lost `prisma generate`. Clear the override.
- An error naming `JWT_SECRET` — the variable is unset or still the dev fallback. Set a real one and redeploy.
- `Unsupported engine` / a Node version complaint — the project is pinned to Node 20.x–22.x.
- A Prisma error about being unable to reach the database — the build itself does not need the database, so this usually means a page is trying to query at build time. Check `DATABASE_URL` is correct and that your Postgres provider allows connections from Vercel's IPs.

The build succeeding does **not** mean the app works. The database is still empty. Any page that touches Postgres will 500 until step 4.

---

### 4. Run the first migration against the production database

`prisma/migrations/` contains exactly two migrations, and both are required:

```
00000000000000_init/                                      (22 tables)
00000000000001_teammember_partial_unique_and_backfills/
```

The second migration carries a **partial unique index** that Prisma's schema language cannot express:

```sql
"TeamMember_campaignId_email_live_key" ON "TeamMember"("campaignId", "email") WHERE "deletedAt" IS NULL
```

**Never delete that migration and never replace this step with `prisma db push`.** `db push` derives the schema from `schema.prisma`, which does not know about that index, so you would silently lose the constraint that stops duplicate live team members.

Run the migration from your laptop with the production connection string. Do not put the production `DATABASE_URL` in your local `.env` — pass it inline for the one command so it does not linger:

```bash
cd /path/to/rally
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require" \
  npx prisma migrate deploy
```

Expected output names both migrations and ends with something like `2 migrations applied`.

**If your provider gives you a pooled connection string** (pgBouncer, Supabase port 6543, Neon's `-pooler` host), use the **direct**, non-pooled string for this command. `prisma/schema.prisma` declares a single `url = env("DATABASE_URL")` and no `directUrl`, so there is no separate migration URL to configure — you simply point `DATABASE_URL` at the direct connection for the length of the migration. The running app can use the pooled one.

Verify the result before moving on:

```bash
DATABASE_URL="postgresql://…" npx prisma migrate status
```

You want `Database schema is up to date!`. To confirm the tables and the partial index actually landed, connect with `psql` and run:

```sql
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
SELECT indexdef FROM pg_indexes WHERE indexname = 'TeamMember_campaignId_email_live_key';
```

The first should return **23** — 22 application tables plus Prisma's own `_prisma_migrations`. The
second must return one row whose definition ends in `WHERE ("deletedAt" IS NULL)`. If the count is 23
but the index row is missing, the second migration did not run — re-run `prisma migrate deploy` and
read its output rather than guessing.

That index is not cosmetic. It is what makes email uniqueness on a roster ignore soft-deleted
players, so a coach can remove someone and re-add them later. Without it, re-adding a removed player
fails with a duplicate-key error and no way to recover through the UI.

Failure modes here are almost always network, not Prisma: a timeout means your database is not accepting connections from your IP (add it to the provider's allowlist), and `password authentication failed` means the rotated password did not make it into the string you pasted.

Nothing seeds automatically. There is no `seed` script and no `prisma.seed` block, so the database now has schema and no rows. That is the correct state.

Alternative: you *can* prefix the Vercel build command with `prisma migrate deploy` so migrations run on every deploy. Be aware of what you are buying — every preview build would then migrate whatever database it is pointed at, and two concurrent builds can race on the migration lock. Running it manually, once, from your laptop is the safer default and is what this runbook assumes.

---

### 5. Pin `NEXT_PUBLIC_APP_URL` to the real deployed URL

You now know the real origin — either `https://<project>.vercel.app` or your custom domain if you have already attached one.

1. Edit `NEXT_PUBLIC_APP_URL` in **Settings → Environment Variables** to that exact origin, `https://`, **no trailing slash**.
2. **Redeploy.** This is not optional. `NEXT_PUBLIC_*` values are inlined into the client bundle at build time, so the old value stays live until a fresh build replaces it.

Getting this wrong is quiet and nasty: the app keeps working while every link inside an email or SMS — verification links, donation receipts, team invitations — points at `http://localhost:3000` or at the wrong deployment. Check it by viewing source on the deployed homepage and searching for `localhost`.

If you plan to attach a custom domain, do it now rather than later, so you only pay this redeploy cost once.

---

### 6. Confirm the deployment is actually serving

Start with the health check. It round-trips a `SELECT 1`, so a 200 proves the app booted *and* reached
the database — which is the pair you actually care about:

```bash
curl -s -w '\nHTTP %{http_code}\n' https://your-app.vercel.app/api/health
```

Expect `HTTP 200` and `{"status":"ok","database":"ok"}`.

A `503` with `{"status":"degraded","database":"unreachable"}` means the app is running but cannot reach
Postgres — check `DATABASE_URL` in Vercel, and that the database allows connections from Vercel. A
connection error or a 500 instead means the app itself failed to boot; read the Runtime Logs, and
suspect a missing `JWT_SECRET` first, since `lib/jwt-secret.ts` deliberately throws at startup in
production when it is unset.

Then load these in a browser and confirm they render rather than 500:

- `/` (marketing home)
- the signup page
- a page that lists campaigns (proves the database connection works end to end)

Then check the security headers against the live deployment. The script takes a URL argument:

```bash
node scripts/test-security-headers.mjs https://your-app.vercel.app
```

You are looking for `strict-transport-security` with `max-age=63072000`, `x-frame-options: DENY`, `x-content-type-options: nosniff`, plus the Referrer-Policy and Permissions-Policy entries. These come from `next.config.mjs` and need no configuration on Vercel; the script is confirming the deployed build actually carries them.

One characteristic of this host to be aware of now rather than at 2am: **rate limiting is in-memory and per-instance.** On Vercel each serverless instance keeps its own counters, so the effective limit is roughly the configured limit multiplied by the number of live instances, and counters reset when an instance is recycled. The protection is real but softer here than the numbers suggest. Nothing to fix in this stage — just do not treat it as a hard ceiling.

---

### 7. Point Stripe's **test-mode** webhook at the deployment

Still in test mode. In the Stripe dashboard, with the **Test mode** toggle on:

1. **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://your-app.vercel.app/api/webhooks/stripe`
3. Select the events your donation flow uses, or start with "all events" in test mode and narrow later.
4. Copy the signing secret (`whsec_…`) into the `STRIPE_WEBHOOK_SECRET` environment variable in Vercel.
5. **Redeploy** so the new value is live.

The webhook handler rejects unsigned and mis-signed payloads: a valid signature returns 200, a forged one returns 400. If Stripe's dashboard shows 400s on every delivery, the secret in Vercel does not match the endpoint you created — the most common cause is copying the secret from the *live-mode* endpoint, or forgetting the redeploy.

Do not set `ALLOW_UNSIGNED_WEBHOOKS` to make the 400s go away. That variable disables signature verification, which means anyone who knows your URL can forge completed donations.

---

### 8. Bootstrap the first admin

This step is mandatory and it is easy to forget, because everything looks fine without it right up until you try to pay a team.

Public signup can only create `CAMPAIGN_LEADER`, `GUARDIAN` or `DONOR`. Changing a role requires an existing `BANK_ADMIN`. A fresh production database has no `BANK_ADMIN` and no in-app way to create one — so donations would work and payouts would be permanently unreachable. `scripts/bootstrap-admin.mjs` is the out-of-band fix.

**8a. Sign up through the deployed UI.** Go to `https://your-app.vercel.app`, register the account that will become the administrator, using the real email address you want to own the platform.

The script only promotes an account that already exists; it cannot create one and it never handles a password. That is intentional — the password goes through the app's normal hashing path.

> If the signup flow requires clicking an email verification link, and the Resend domain DNS records are not yet verified, that email never arrives and this step stalls with no visible error. Resend failing silently is a known open gap. Complete the Resend DNS verification before this step if you hit it.

**8b. Promote the account.** From your local checkout, with the production connection string:

```bash
cd /path/to/rally
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require" \
  node scripts/bootstrap-admin.mjs you@example.com
```

Success prints the before/after role, for example:

```
  ✓ you@example.com: CAMPAIGN_LEADER → BANK_ADMIN
    Sign out and back in — the role is carried in the session token.
```

Failures and what they mean:

- `No user with email "…"` — you have not completed step 8a, or the address does not match exactly. Sign up first, then re-run.
- `A BANK_ADMIN already exists (…)` — bootstrapping has already happened. This is a one-time operation. Promote any further admins through the app UI, which keeps an audit trail. `--force` overrides the guard and exists only for genuine recovery; if you are reaching for it on a first deploy, something else is wrong.
- `DATABASE_URL is not set` — the inline variable did not survive your shell. Re-run with the assignment on the same line as the command.
- `… is already BANK_ADMIN — nothing to do.` — safe; nothing changed.

**8c. Sign out and sign back in.** The role is carried inside the session token. Until you get a fresh token the browser still believes you are a `CAMPAIGN_LEADER` and every admin route will 403, even though the database is correct. Sign out fully, sign back in, and confirm the admin area is reachable.

Payouts and disbursement approval are `BANK_ADMIN`-gated. Confirm now that the admin area loads. Do **not** run a payout in this stage — the payout path (`app/api/stripe-connect/onboard`, `app/api/stripe-connect/payout`) has never been exercised with live money and is not part of a test-mode deploy.

---

### 9. Confirm the cron is scheduled and authenticated

`vercel.json` schedules one job:

```json
{ "path": "/api/cron/campaign-automation", "schedule": "0 * * * *" }
```

That is **hourly, on the hour**, with `maxDuration` raised to 60 seconds for that route.

Two things must be true for it to work:

1. **`CRON_SECRET` is set** in the Production environment. Vercel sends it to your cron path as `Authorization: Bearer <CRON_SECRET>`. The route fails **closed** — with `CRON_SECRET` unset it returns **503** to every caller including Vercel's scheduler, so the job runs, gets rejected, and campaigns are never auto-completed at their end date. The failure is silent from a user's perspective.
2. **Your Vercel plan permits this schedule and duration.** Cron frequency and function `maxDuration` limits differ by plan, and an hourly schedule with a 60-second ceiling is not available on every tier. Check **Settings → Cron Jobs** after deploying and confirm the job is listed with the hourly schedule you expect. If it shows a different cadence, your plan downgraded it.

After the first hour has rolled over, open **Deployments → the production deployment → Logs**, filter for `/api/cron/campaign-automation`, and confirm a **200**. A **503** means `CRON_SECRET` is unset or was set after the last deploy without a redeploy. A **401/403** means the value in Vercel does not match what the route expects.

You can also check it immediately without waiting for the hour:

```bash
curl -si -X GET https://your-app.vercel.app/api/cron/campaign-automation \
  -H "Authorization: Bearer YOUR_CRON_SECRET" | head -n 1
```

An unauthenticated request to the same URL should be rejected — that is the correct behaviour, and worth confirming:

```bash
curl -si https://your-app.vercel.app/api/cron/campaign-automation | head -n 1
```

---

### 10. Exercise the money path with test cards

Stripe is still in test mode, so this costs nothing and risks nothing. Walk the full loop in the deployed app:

1. Create a campaign as a `CAMPAIGN_LEADER`.
2. Make a donation using Stripe's test card `4242 4242 4242 4242`, any future expiry, any CVC.
3. Confirm the donation appears against the campaign and the total moves.
4. In the Stripe dashboard, open **Developers → Webhooks → your endpoint** and confirm the delivery returned **200**.

This path has been verified in test mode end to end — create → confirm → verify → webhook, idempotent under replay, exactly one credit under a concurrent verify-and-webhook race, refunds reversing all credits, ledger reconciling exactly. What you are testing here is not the logic; it is your environment: whether the keys, the URL, the webhook secret and the database are all wired to the same place.

If the payment form does not render, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is missing or was changed without a redeploy. If the donation completes in Stripe but never appears in the app, look at the webhook deliveries — a 400 there is a signing-secret mismatch, and a 404 is a wrong URL.

---

### Stage 2 exit criteria

Do not move to the live-money stage until all of these are true:

- [ ] Production build succeeds with no build-command override.
- [ ] Every required environment variable is set in Production; `ALLOW_UNSIGNED_WEBHOOKS` is absent; `TRUSTED_PROXY_HOPS=1`.
- [ ] `prisma migrate status` reports up to date, 23 tables exist (22 application tables plus _prisma_migrations), and `TeamMember_campaignId_email_live_key` exists with its `WHERE ("deletedAt" IS NULL)` clause.
- [ ] `NEXT_PUBLIC_APP_URL` matches the real origin and a redeploy has happened since it changed.
- [ ] Security headers verified against the live URL.
- [ ] Exactly one `BANK_ADMIN` exists, and that person has signed out and back in and can reach the admin area.
- [ ] The hourly cron returns 200 in the logs, and returns non-200 without the bearer token.
- [ ] A test-mode donation completed and its webhook delivered 200.

Two things are still true at the end of this stage and you should hold them in mind: there is **no error tracking of any kind** in this deployment, so a production failure after this point is invisible unless someone reports it or you go read Vercel's logs by hand; and **all transactional email silently fails** until the three pending Resend DNS records are verified. Neither blocks Stage 2, and both block taking real donations.

---

## Stage 3 — Wire Stripe and verify the money path in TEST mode

This stage connects Stripe to the deployed app and then proves, with real money, that money can move in and back out. Do it in the order written. Every step in test mode comes before every step in live mode, because a mistake in test mode costs nothing and the same mistake in live mode costs a real donor a real charge.

Read this before you start: **all existing proofs of correctness were obtained in Stripe TEST mode.** The idempotency proof, the concurrent verify-plus-webhook race proof, the refund-reversal proof, and the ledger reconciliation proof were all run against test keys and a test webhook secret. Live mode uses different API keys, a different webhook registration, a different signing secret, and a different Stripe event pipeline. None of those proofs carry over. The only thing you will know about live mode is what you personally observe in live mode. That is why Steps 10 through 19 exist.

Also note before you begin: the app has **no error tracking of any kind**. If something fails in production there is no Sentry, no alerting, and no aggregated error view. Your only evidence is the Stripe dashboard's event log, the Vercel function logs (Vercel project → **Logs**), and the numbers you can see in the app itself. Keep a Stripe dashboard tab and a Vercel Logs tab open for the whole of this stage.

### Preconditions

Do not start Stage 3 until all of these are true:

- The app is deployed and reachable at the domain in `NEXT_PUBLIC_APP_URL`, and that value is the exact public base URL including scheme and no trailing slash.
- `DATABASE_URL`, `JWT_SECRET`, and `NEXT_PUBLIC_APP_URL` are set in the Vercel Production environment and the app boots (a bad `JWT_SECRET` fails fast at startup by design).
- `TRUSTED_PROXY_HOPS` is set to `1` (Vercel alone) or `2` (Cloudflare in front of Vercel). Without it the rate limiter cannot identify the client IP and every anonymous donor falls into one shared bucket.
- `ALLOW_UNSIGNED_WEBHOOKS` is **unset** in Production. It is a dev-only escape hatch.
- You have run `scripts/bootstrap-admin.mjs` and there is at least one `BANK_ADMIN` account. Without it Step 18 is impossible — payouts are `BANK_ADMIN`-gated and there is no in-app way to create the first admin.
- At least one campaign exists with status `ACTIVE` and a known slug, so `https://YOUR_DOMAIN/raise/YOUR_SLUG/donate` loads.

Throughout, replace `YOUR_DOMAIN` with your real domain and `YOUR_SLUG` with the campaign's slug.

> **Do not run `scripts/quick-stripe-test.mjs`.** It has a Stripe secret key hard-coded in the file, and that key is one of the credentials that leaked to public git history. It must be rotated and the script should be deleted, not executed. `scripts/test-stripe-config.mjs` only ever accepts keys beginning `sk_test_`, so it will report failure once you are live; it is not a live-mode check.

---

### Step 1 — Confirm you are in TEST mode and the test keys are deployed

In the Stripe dashboard, make sure the test-mode toggle is ON. Then confirm the three Stripe variables in the Vercel Production environment are all test-mode values:

- `STRIPE_SECRET_KEY` starts with `sk_test_`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` starts with `pk_test_`
- `STRIPE_WEBHOOK_SECRET` starts with `whsec_` (you will replace this in Step 3)

They must all come from the **same** Stripe account. A publishable key from one account and a secret key from another produces confusing client-side errors that look like card failures.

Both `NEXT_PUBLIC_*` variables are inlined into the client JavaScript **at build time**. Changing either one and not redeploying leaves the old value in the shipped bundle. Any change to any environment variable in this stage requires a redeploy before it takes effect.

### Step 2 — Register the TEST-mode webhook endpoint

In the Stripe dashboard (test mode on): **Developers → Webhooks → Add endpoint**.

- Endpoint URL: `https://YOUR_DOMAIN/api/webhooks/stripe`
- Events to send — select exactly these two:
  - `payment_intent.succeeded`
  - `charge.refunded`

The handler also understands `payment_intent.payment_failed` (marks the donation `FAILED`) and `account.updated` (keeps Connect account state fresh). Subscribing to those two as well is optional but recommended; `account.updated` in particular is useful during Connect onboarding in Step 16. Any event type you subscribe to that is not handled is logged and acknowledged with a 200 — it is harmless, but do not subscribe to "all events", because it adds noise to the log you are about to use as your primary diagnostic.

Save the endpoint.

### Step 3 — Copy *that endpoint's* signing secret into `STRIPE_WEBHOOK_SECRET`

Open the endpoint you just created and reveal its signing secret (`whsec_…`). Copy that exact value.

**The signing secret is per-endpoint.** It is not per-account and not per-mode. Specifically:

- A `whsec_…` printed by `stripe listen` on your laptop belongs to the CLI's own temporary endpoint. It will **never** validate a webhook Stripe sends to your production URL.
- A secret from a different endpoint registration — even the same URL registered twice — will not validate either.
- The test-mode endpoint's secret will not validate live-mode events. You will register a second endpoint and get a second secret in Step 12.

Set it in Vercel Production:

```bash
vercel env rm STRIPE_WEBHOOK_SECRET production
vercel env add STRIPE_WEBHOOK_SECRET production
# paste the whsec_... value from THIS endpoint when prompted, then:
vercel --prod
```

(The Vercel dashboard → Project → Settings → Environment Variables does the same thing; either way you must redeploy afterwards.)

### Step 4 — Prove the endpoint is reachable and rejects unsigned traffic

Two curls, run against the deployed URL. Both must return `400`.

Missing signature header:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  -X POST https://YOUR_DOMAIN/api/webhooks/stripe \
  -H 'content-type: application/json' \
  -d '{}'
```

Forged signature header:

```bash
curl -sS -i \
  -X POST https://YOUR_DOMAIN/api/webhooks/stripe \
  -H 'content-type: application/json' \
  -H 'stripe-signature: t=1,v1=0000000000000000000000000000000000000000000000000000000000000000' \
  -d '{"id":"evt_forged","type":"payment_intent.succeeded"}'
```

How to read the results:

| Response | Meaning | Action |
| --- | --- | --- |
| `400 {"error":"Missing stripe-signature header"}` | Correct for the first curl. | Continue. |
| `400 {"error":"Invalid signature"}` | Correct for the second curl. | Continue. |
| `404` | The deployment does not have the route, or the domain points somewhere else. | Check the deployment actually built and that `YOUR_DOMAIN` resolves to it. |
| `500 {"error":"Webhook secret not configured"}` | `STRIPE_WEBHOOK_SECRET` is missing in the environment that served this request. | Re-do Step 3, including the redeploy. |
| `200 {"received":true}` on the **forged** request | Signature verification is being skipped. | Stop. `ALLOW_UNSIGNED_WEBHOOKS` is `true` and `NODE_ENV` is not `production`. Fix both before doing anything else. Do not proceed to live mode. |
| A Vercel authentication/SSO page instead of JSON | Deployment Protection is on, and Stripe cannot reach the endpoint either. | Disable protection for production, or the webhook will fail for every real event. |

### Step 5 — Make one TEST donation against the deployed URL

Open `https://YOUR_DOMAIN/raise/YOUR_SLUG/donate` in a normal browser window (not a Vercel preview URL — you are testing the production deployment and the webhook points at production).

Donate `$5` using Stripe's test card:

- Card `4242 4242 4242 4242`
- Any future expiry, any CVC, any postal code

The API rejects amounts below `$1`. Use `$5` here so the fee arithmetic in Step 9 is easy to read.

### Step 6 — Confirm the donation completed in the app

Check all three:

1. The donate page reports success.
2. `https://YOUR_DOMAIN/raise/YOUR_SLUG` shows the campaign total increased by the **gross** amount ($5).
3. If you donated through a specific player's link, that player's raised total also increased by the gross amount.

The campaign total moves by gross; the campaign's spendable balance moves by **net** (gross minus the 10% platform fee minus Stripe's 2.9% + $0.30). Those two numbers are supposed to differ. Do not read the difference as a bug.

### Step 7 — Confirm the webhook shows 200 in Stripe's event log

Stripe dashboard → **Developers → Webhooks** → click your endpoint → the attempts/events list. You are looking for a `payment_intent.succeeded` delivery with HTTP status **200**.

Failure readings:

- **400, response body `Invalid signature`** — `STRIPE_WEBHOOK_SECRET` does not match this endpoint. The most common cause is pasting a `stripe listen` secret, or pasting the right secret and not redeploying. Go back to Step 3.
- **500** — the handler threw. The donation may still have completed via the app's own verify call, so check the app numbers, then read the Vercel function logs for `/api/webhooks/stripe`.
- **No event at all** — the payment never succeeded, or you are looking at the wrong mode's event log. Check **Developers → Events** in test mode for the payment intent.
- **Timeouts / repeated retries** — Stripe retries failed deliveries with backoff. The completion path is idempotent, so retries are safe, but a persistently red endpoint means every donation depends on the app's verify call alone.

The donation completes through two independent paths — the browser's verify call after payment and this webhook — and only one of them may credit the campaign. Confirm the campaign total went up by exactly $5, not $10. That double-credit protection was verified previously in test mode; this is you confirming it in the deployed environment.

### Step 8 — Refund the test donation and confirm the reversal

Stripe dashboard (test mode) → **Payments** → open the $5 charge → **Refund** → refund the **full** amount.

> Refund in full, always. The handler reverses the **entire** donation whenever it receives `charge.refunded`, regardless of how much Stripe actually refunded. A partial refund therefore over-reverses: the app subtracts the whole donation while Stripe returned only part of it, and the two ledgers permanently disagree. There is no partial-refund support. If a partial refund is ever genuinely needed, it has to be reconciled by hand.

Then confirm:

1. The `charge.refunded` delivery shows **200** in the endpoint's event log.
2. The campaign total on `https://YOUR_DOMAIN/raise/YOUR_SLUG` has dropped back to its pre-donation value.
3. The player's raised total, if applicable, dropped back too.

If the campaign total did not move, the refund event either was not subscribed (Step 2) or failed signature verification (Step 3).

### Step 9 — Stop and take stock

You now have a green test-mode path: endpoint registered, signature verified, donation credited once, refund reversed cleanly. Everything after this point involves real money and real cards. If any of Steps 4 through 8 is not green, fix it before continuing — every one of those failures gets more expensive in live mode, not less.

---

### What you should have at the end of Stage 3

- A test-mode webhook endpoint registered against the deployed URL, with *that endpoint's* signing
  secret deployed as `STRIPE_WEBHOOK_SECRET`.
- Green `200` deliveries for `payment_intent.succeeded` and `charge.refunded` in the test event log,
  and a `400` for a forged signature.
- One test donation observed to credit the campaign exactly once, and one refund observed to reverse
  it exactly once.

Everything here used test cards. No real money has moved yet, and it must not until Stages 4 and 5
are done — email has to work before a donor can get a receipt, and you have to be able to see a
failure before you can be trusted to take a real card. The live cutover is Stage 6.


---

## Stage 4 — Turn on email and SMS

Everything the product does after a click depends on this stage: donation receipts, email verification at signup, password resets, team-member invitations, the parent welcome email, and outreach texts. None of it retries on failure, and there is no error tracking in this codebase (see the known gaps section), so a misconfiguration here does not page anyone. It just produces silence that looks like low engagement.

Read this warning before you start, because it governs every check below:

**Both the email and the SMS layers report success when they are unconfigured.** In `lib/email.ts`, if `RESEND_API_KEY` is missing the dispatcher prints the message to stdout and records every recipient as sent with the id `dev-mode-email`. In `lib/services/sms.ts`, if no Twilio credentials resolve, `sendSMS` prints to stdout and returns `{ success: true, messageId: 'dev-mode-sms' }`. That behavior is correct for local development and dangerous in production. An absence of errors in your logs is therefore not evidence that anything was delivered. Only a message arriving in someone else's inbox or on someone else's phone is evidence.

### 4.1 Set the email variables before you touch DNS

Set these in Vercel for the production environment. Use `vercel env add`, which prompts for the value on stdin so the secret never lands in your shell history.

```bash
vercel env add RESEND_API_KEY production
vercel env add EMAIL_FROM production
vercel env add MAILING_ADDRESS production
```

Values:

- `RESEND_API_KEY` — from the Resend dashboard, API Keys. Starts with `re_`. Give it send-only permission if the dashboard offers the choice.
- `EMAIL_FROM` — the full sender header, for example `Bleacher Backers <noreply@yourdomain.com>`. **The domain in this address must be the domain you verify in step 4.2.** If `EMAIL_FROM` is unset the code falls back to a hardcoded default sender at `bleacherbackers.com`; unless you own and have verified that exact domain in your Resend account, every send will be rejected.
- `MAILING_ADDRESS` — your real postal address, required by CAN-SPAM in the footer of non-transactional mail. There is a hardcoded fallback in `lib/suppression.ts` (a Wilmington, DE placeholder). If you leave this unset you will be mailing people a postal address that is not yours.

Then confirm `NEXT_PUBLIC_APP_URL` is already set to your real HTTPS origin with no trailing slash, for example `https://yourdomain.com`. Email templates build verification links, reset links and invite links from it, defaulting to `http://localhost:3000`. A wrong value here produces mail that delivers perfectly and contains links nobody outside your laptop can open.

```bash
vercel env ls production
```

Environment variables are read at build and runtime from the deployment, so **changing any of them requires a new deployment before it takes effect**. Redeploy from the dashboard or run `vercel --prod`. Skipping this is the single most common reason a variable "does not work" ten minutes after you set it.

### 4.2 Add the three DNS records for the Resend domain

The domain is registered in Resend but **not verified**. Three records are pending. Add all three at your DNS provider, on the same domain you put in `EMAIL_FROM`.

| Type | Host / Name | Value | Notes |
| --- | --- | --- | --- |
| TXT | `resend._domainkey` | the DKIM public key, beginning `p=MIGfMA0GCSqGSIb3DQ...` | Copy from the Resend dashboard. Do not retype. |
| MX | `send` | `feedback-smtp.us-east-1.amazonses.com` | Priority `10`. |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | |

Rules that decide whether this works on the first try:

1. **Copy the DKIM value out of the Resend dashboard with the clipboard.** It is a long base64 key. One transposed character produces a record that looks right and never verifies, and nothing will tell you which character is wrong.
2. Most DNS providers append your domain to whatever you type in the Host field. Enter `resend._domainkey`, not `resend._domainkey.yourdomain.com`, or you will create `resend._domainkey.yourdomain.com.yourdomain.com`. Check the provider's preview of the final record name before saving.
3. Some providers split TXT values longer than 255 characters, and some require the value wrapped in quotes while others add the quotes for you. If your provider rejects the DKIM value for length, paste it as a single string and let the provider chunk it; do not manually insert spaces or line breaks.
4. The SPF record goes on the `send` subdomain, not the root. It does not conflict with, and does not replace, any SPF record already on your root domain. Do not move it to the root.
5. If you registered a subdomain in Resend (for example `mail.yourdomain.com`), every host above gains that prefix: `resend._domainkey.mail`, `send.mail`.

Confirm the records are live from the public DNS, querying a resolver directly so you are not reading your own cache:

```bash
dig +short TXT resend._domainkey.yourdomain.com @1.1.1.1
dig +short MX  send.yourdomain.com @1.1.1.1
dig +short TXT send.yourdomain.com @1.1.1.1
```

What correct output looks like:

```
"p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC..."
10 feedback-smtp.us-east-1.amazonses.com.
"v=spf1 include:amazonses.com ~all"
```

Empty output means the record is not published yet, is on the wrong host, or your provider is still within its TTL. Propagation is usually minutes and occasionally hours.

Once all three resolve, go to the Resend dashboard, Domains, and click Verify. The status must read **Verified**. Pending or Failed means keep going; do not move on and hope.

### 4.3 Understand exactly what is broken until that status says Verified

While the domain is unverified, Resend accepts sends only from `onboarding@resend.dev` and delivers only to the email address that owns the Resend account. Every other send is rejected by the API.

Concretely, for every real user, all of this fails: donation receipts, the signup verification email, password resets, team-member invitations, the parent welcome email, and disbursement notifications.

It fails quietly, for three stacked reasons:

- The Resend SDK does not throw on API errors; it resolves to `{ data, error }`. The wrapper in `lib/email.ts` turns that into a per-recipient failure and a `console.error`.
- `app/api/auth/forgot-password/route.ts` and `app/api/auth/resend-verification/route.ts` call the send **without awaiting it** and always return HTTP 200 with a generic message, deliberately, so an attacker cannot enumerate accounts. The HTTP status of those endpoints tells you nothing about delivery, by design.
- Nothing records the failure anywhere durable. It exists only as a line in that instance's stdout.

So the only signal available is the log line and the Resend dashboard. In Vercel runtime logs, search for these substrings:

```
Email sent successfully          # a send the API accepted; the Resend id follows
Failed to send email             # a send the API rejected; the reason follows
Resend not configured            # RESEND_API_KEY is missing entirely
```

An unverified-domain rejection appears after `Failed to send email` as a `Resend error:` whose text reads roughly *"You can only send testing emails to your own email address... verify a domain at resend.com/domains."* That message is unambiguous: the domain is not verified, or `EMAIL_FROM` does not match the domain that is.

### 4.4 Prove delivery to an address you do not own

This is the acceptance test for the whole email half of this stage. Do not skip it. Sending to yourself proves nothing, because your own address is exactly the one that works while the domain is broken.

1. Pick a recipient that is **not** the Resend account owner. A colleague, a second personal address on a different provider (Gmail if your account owner is on Outlook, or the reverse), or a burner. Different provider is better, because it also tells you something about spam placement.
2. Create a real account for that address through the production signup UI. That exercises the verification email, which is the highest-stakes template you have, since a user who never receives it cannot use the product at all.
3. Independently, trigger a password reset for the same address:

```bash
curl -sS -X POST https://yourdomain.com/api/auth/forgot-password \
  -H 'Content-Type: application/json' \
  -d '{"email":"tester@example.com"}'
```

Expect `{"success":true,...}` regardless of outcome. Again: that response is anti-enumeration boilerplate, not a delivery confirmation.

4. Now check all three places, in this order:
   - **The recipient's inbox, and its spam folder.** Spam placement is a pass for this stage and a follow-up item, not a failure.
   - **Resend dashboard, Emails.** Every accepted send appears here with a status. If nothing appears, the API rejected it or the app never called Resend.
   - **Vercel runtime logs**, for the strings in 4.3.
5. Open the verification link from the received email. It must land on your production domain, not `localhost:3000`. If it points at localhost, `NEXT_PUBLIC_APP_URL` is wrong or was set after the last deployment; fix it and redeploy.

Failure modes you may hit here:

- **HTTP 429 with a `Retry-After` header** from the reset endpoint. Expected. Both auth endpoints are rate limited per account and per IP to stop mail-bombing. Wait out the window rather than retrying in a loop. Note that this limiter is in-memory per instance, so on Vercel the effective threshold is multiplied by however many instances are warm.
- **Nothing arrives, nothing in the Resend dashboard, and `Resend not configured` in the logs.** `RESEND_API_KEY` is missing from the production environment, or you set it and did not redeploy.
- **Nothing arrives, `Failed to send email` in the logs.** Read the reason. Almost always an unverified domain or a `from` address whose domain does not match the verified one.
- **The dashboard shows the send but the mailbox never gets it.** Delivery-side problem, not configuration. Check the recipient's spam folder and the bounce reason in the dashboard before changing anything.

Once real mail reaches a real stranger, the email half is done. Publishing a DMARC record on the sending domain is a worthwhile follow-up for inbox placement, but it is not required for Resend verification and is not a blocker for launch.

### 4.5 Set the Twilio credentials

```bash
vercel env add TWILIO_ACCOUNT_SID production
vercel env add TWILIO_API_KEY_SID production
vercel env add TWILIO_API_KEY_SECRET production
vercel env add TWILIO_PHONE_NUMBER production
```

- `TWILIO_ACCOUNT_SID` — starts with `AC`. Always required; an API key is scoped to an account, so the account SID is needed either way.
- `TWILIO_API_KEY_SID` / `TWILIO_API_KEY_SECRET` — starts with `SK`. **This is the preferred authentication path** and `lib/services/sms.ts` picks it over the auth token whenever both are present. Prefer it because an API key is individually revocable: if it leaks you delete that key, while rotating the account auth token invalidates every other integration at once. That distinction matters here specifically, because a Twilio auth token was committed to public git history and must be treated as compromised. The secret is shown exactly once at creation; if you lose it, delete the key and make a new one.
- `TWILIO_AUTH_TOKEN` — the outbound client uses it only as a fallback when no API key is configured. It has a second, separate job: `app/api/webhooks/twilio-inbound/route.ts` validates the `X-Twilio-Signature` on inbound messages with the auth token and **fails closed with 403 when it is unset**. If you wire up the inbound STOP webhook in 4.9, set the auth token too, even though sending uses the API key.
- `TWILIO_PHONE_NUMBER` — full E.164, for example `+15551234567`. No spaces, dashes, or parentheses.

Redeploy after setting these.

Failure signatures specific to this block:

- If `TWILIO_ACCOUNT_SID` is missing, or both the API key pair and the auth token are missing, `sendSMS` never calls Twilio. It logs `SMS (Twilio not configured - logging to console)` and returns **success** with the id `dev-mode-sms`. Nothing is sent and nothing looks wrong.
- If `TWILIO_PHONE_NUMBER` is missing, `sendSMS` returns `{ success: false, error: 'TWILIO_PHONE_NUMBER not configured' }`.

### 4.6 Confirm the number belongs to that account and can send SMS

A number that is on a different subaccount, or is voice-only, fails at send time with an error that reads like a formatting problem. Check it before you test.

```bash
export TWILIO_ACCOUNT_SID='AC...'
export TWILIO_API_KEY_SID='SK...'
export TWILIO_API_KEY_SECRET='...'
export TWILIO_PHONE_NUMBER='+15551234567'

curl -sS -u "$TWILIO_API_KEY_SID:$TWILIO_API_KEY_SECRET" \
  --get "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/IncomingPhoneNumbers.json" \
  --data-urlencode "PhoneNumber=$TWILIO_PHONE_NUMBER"
```

Read two things in the response:

- `incoming_phone_numbers` must be non-empty. **An empty list means this account does not own that number.** The usual cause is that the number lives on a subaccount while `TWILIO_ACCOUNT_SID` points at the parent, or the reverse.
- `capabilities.sms` must be `true`. A number with `"sms": false` is voice-only and will never send a text no matter what else you fix.

This request also doubles as a credential test: an HTTP 401 here means the API key SID and secret pair is wrong, and no amount of debugging the message body will help.

### 4.7 Send one real test SMS

Send to a phone you can physically look at, not to your own Twilio number.

```bash
curl -sS -X POST \
  "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json" \
  -u "$TWILIO_API_KEY_SID:$TWILIO_API_KEY_SECRET" \
  --data-urlencode "From=$TWILIO_PHONE_NUMBER" \
  --data-urlencode "To=+15559876543" \
  --data-urlencode "Body=Bleacher Backers production SMS test. Ignore."
```

This uses the exact credential pair and the exact from-number the application uses, so a pass here means the app's outbound path is sound.

A 201 response with `"status": "queued"` means Twilio **accepted** the request. It does not mean anyone received anything. Open Twilio Console, Monitor, Logs, Messaging, and find the message SID. The final status must be `delivered`. `undelivered` and `failed` are the outcomes you are hunting for, and each carries a numeric error code.

| Code | What it means | What to do |
| --- | --- | --- |
| 20003 | Authentication failed | Wrong API key SID/secret, or the key belongs to a different account than `TWILIO_ACCOUNT_SID`. |
| 21606 | The `From` number is not a valid, SMS-capable number on this account | Re-run 4.6. Wrong number, wrong subaccount, or voice-only. |
| 21608 | Trial account restriction | The number can only text verified numbers. Upgrade the account. |
| 21408 | Permission to send to that region is not enabled | Enable the destination country in Twilio's Geo Permissions. |
| 21610 | Recipient previously sent STOP | Expected and correct. Pick another test phone; do not try to override it. |
| 30007 | Carrier filtered the message | Usually unregistered A2P traffic or content the carrier disliked. See 4.8. |
| 30034 | Sent from an unregistered 10DLC number | You have not completed A2P registration. See 4.8. |

Finally, exercise the app's own path once through the UI, not just curl, using the outreach feature on a test campaign with a single recipient. Do not test by messaging a real roster: SMS is metered, opt-outs are permanent, and the rate limiter is per-instance.

### 4.8 A2P 10DLC registration is required in the US, and it is not instant

If you are sending application-to-person SMS to US numbers from a standard 10-digit long code, US carriers require the traffic to be registered under A2P 10DLC. This applies at **any volume**. There is no "small enough not to bother" threshold.

Unregistered traffic is not rejected at the API. Twilio accepts it, and the carrier filters it downstream. From your side the message shows as accepted and then lands as `undelivered` with code 30007 or 30034, or in some cases simply never arrives. Recipients see nothing. This is why the runbook makes you look at the Twilio message log rather than the curl response.

What registration involves, in Twilio Console under Messaging, Regulatory Compliance:

1. Register a **Brand** with your legal entity details. A US EIN gets you a verified brand and better throughput; a sole-proprietor path exists with substantially lower throughput and per-day limits.
2. Register a **Campaign** describing the use case, with sample messages and a description of how you obtain consent. Youth-sports fundraising outreach is a mixed or marketing use case depending on content; describe it accurately, because a mismatch between your registered samples and your actual traffic is itself grounds for filtering.
3. Attach the number to a **Messaging Service** linked to the approved campaign.

Approval takes days to weeks and can be rejected for vague consent language. Start it early. Until it clears, treat SMS delivery as unreliable and make sure nothing in the launch plan depends on a text arriving.

If you are using a toll-free number instead, the equivalent requirement is Toll-Free Verification, a different form with a similar delay. Either way, do not assume the number you bought this afternoon can text customers tonight.

### 4.9 Optional but recommended: wire the inbound STOP webhook

The app already handles SMS opt-outs. `app/api/webhooks/twilio-inbound/route.ts` records a revocation synchronously when someone replies STOP or an equivalent keyword, and `lib/services/sms.ts` checks the suppression list before every single send with no transactional bypass, because the TCPA does not grant one for SMS.

To use it, set the number's "A message comes in" webhook in Twilio Console to `POST https://yourdomain.com/api/webhooks/twilio-inbound`.

Two things to know before you do:

- The route verifies the `X-Twilio-Signature` header using `TWILIO_AUTH_TOKEN` and **returns 403 to every inbound message if that variable is unset**. Set it, or leave the webhook unconfigured; do not point Twilio at a URL that rejects everything.
- `ALLOW_UNSIGNED_WEBHOOKS` disables that check. It is inert in production by design, and it must remain unset there regardless.

Verify by texting STOP to the number from your test phone and confirming you receive the opt-out confirmation. That number is then permanently suppressed for testing, so use a phone you can afford to burn.

### 4.10 Exit criteria for Stage 4

Do not proceed until every one of these is true:

- Resend Domains shows **Verified**, and all three DNS records resolve from a public resolver.
- A signup verification email and a password reset email both arrived at an address that does **not** own the Resend account, and the link in the email opened on the production domain.
- `EMAIL_FROM` uses the verified domain, and `MAILING_ADDRESS` is your real postal address.
- The Vercel logs show `Email sent successfully` for those sends, and never `Resend not configured`.
- The Twilio number is confirmed owned by `TWILIO_ACCOUNT_SID` with `capabilities.sms: true`.
- One real test SMS reached a real handset and shows `delivered` in the Twilio message log.
- A2P 10DLC registration is either approved, or submitted and explicitly accepted as an open risk with a date.


---

## Stage 5 — Make production observable (required before live money)

Right now this application is unobservable. There is no error tracking, no alerting, and no log drain. If a donation fails at 11pm tonight, nothing tells you — you find out when a parent emails asking where their money went. That is acceptable for a demo and unacceptable for a system that moves real money and stores minors' PII.

Do not switch Stripe to live keys until this stage is done. Earlier stages make the app work; this stage makes failure visible. A payment bug you cannot see is a payment bug you cannot fix.

Budget about two hours. Most of it is account setup and alert rules, not code.

---

### 5.1 Install Sentry

Sentry is the fastest path from nothing to real error tracking on Next.js. Any equivalent (Rollbar, Bugsnag, Honeybadger, Datadog) is fine — what matters is that unhandled exceptions in Route Handlers reach a human. The rest of this stage assumes Sentry; adapt the alert rules if you choose otherwise.

From the repo root:

```bash
npx @sentry/wizard@latest -i nextjs
```

The wizard asks you to log in, pick or create a project, then writes config files, adds `@sentry/nextjs` to `package.json`, and wraps the Next config. Let it do all of it. At the end it prints the exact paths of the files it created. Copy that list somewhere — you need it in 5.2.

Confirm it did not break the build:

```bash
npm run build
```

This runs `prisma generate && next build` and must exit 0.

The most common wizard-induced failure is a mangled Next config. The wizard wraps the config with `withSentryConfig`, and if it writes that wrapper into a config file that is not the one actually in use, you get either a build error or — worse — a clean build where Sentry is silently inert. If the build fails, fix the config wrapper and re-run `npm run build` before continuing. If the build passes, do not assume Sentry works; 5.2 proves it.

Add the DSN to Vercel. The wizard's variables (`SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`, and `SENTRY_AUTH_TOKEN` for source-map upload) are **new** variables introduced by Sentry — they are not part of the application's own environment list from Stage 2. Set them for Production and Preview:

```bash
vercel env add NEXT_PUBLIC_SENTRY_DSN production
vercel env add SENTRY_AUTH_TOKEN production
```

`SENTRY_AUTH_TOKEN` is a credential. It goes in Vercel's environment settings and nowhere else. Do not commit it — this repo already has one credential leak to clean up (Stage 1); do not create a second.

---

### 5.2 Scrub PII before you send a single event, then prove capture works

This step is not optional and it comes before the first real error, not after.

Sentry's default behavior attaches request data to events. This app's request bodies contain minors' names, emails, phone numbers, photo references, and parent contact details, plus donor names, emails, and donation amounts. Shipping that to a third-party error tracker by default turns an observability improvement into a new data-disclosure surface.

In each Sentry config file the wizard generated (it printed the paths in 5.1 — typically a client config plus `sentry.server.config.ts` and an edge config), set:

- `sendDefaultPii: false` — explicitly, even though it is the default. Someone will flip it later while debugging and a comment saying why it is off is the thing that stops them.
- A `beforeSend` hook that drops request bodies and cookies. Keep the URL path and status code; discard the payload. You want to know that `POST /api/donations` threw, not what the donor typed.
- `tracesSampleRate` low (0.1 or less) to start. Traces carry parameters too, and full sampling on a donation endpoint is both expensive and PII-leaky.

Then prove events actually arrive. Deploy, and trigger a real error against the deployed app — the easiest reliable trigger is a request that hits a genuinely broken path (for example, calling an authenticated endpoint with a malformed campaign id) — then check the Sentry issues list.

**If nothing appears within about a minute**, the integration is inert. Check, in order: the DSN env var is set for the *Production* environment specifically and the deployment was rebuilt after you set it; the build actually included the Sentry wrapper; and you are looking at the right Sentry project. An empty Sentry dashboard after a deliberate error means you have no error tracking, regardless of what `package.json` says. Do not proceed until you have seen a test event land.

---

### 5.3 Alert on the four things that actually cost money here

Generic "alert on errors" is not enough. This app has four specific failure modes where the system stays up, returns 200s, and quietly does the wrong thing with someone's money. Configure each one.

Route every alert below to something that wakes a person — SMS or a phone push. Email-only alerting fails exactly when it matters, because nobody reads email at 11pm.

**a) Failed Stripe webhooks.** The webhook at `/api/webhooks/stripe` is what credits a campaign after a payment succeeds. If it stops working, donors are charged and campaigns are never credited — the single worst failure in this system, because it is invisible from the donor's side (their card was charged, they saw a success page) and invisible from the campaign's side (the money simply never appears).

Alert from both ends:

- **In the Stripe Dashboard** (Developers → Webhooks → your endpoint), enable notifications for failed deliveries. Stripe retries failures for days and will email on repeated failure — turn that on and point it at a monitored address. This catches the case where your app is down entirely and Sentry cannot report anything.
- **In Sentry**, alert on any error from the webhook route. The handler logs distinct failures for a missing `STRIPE_WEBHOOK_SECRET`, signature-verification failure, missing payment-intent metadata, and a failure to process the donation. Each means something different:
  - *Signature verification failed* → the `STRIPE_WEBHOOK_SECRET` in Vercel does not match the signing secret of the endpoint Stripe is calling. This is the classic mistake after switching from test to live mode, or after re-creating the endpoint: the secret is per-endpoint, and the live-mode endpoint has a different one than the test-mode endpoint. Symptom: every delivery 400s, Stripe's dashboard shows a wall of red, zero donations get credited.
  - *`STRIPE_WEBHOOK_SECRET` is not configured* → the variable is missing in Production. Same symptom, different cause.
  - *Missing required metadata in payment intent* → a payment intent reached the webhook without the metadata the handler needs to attribute it. Usually means a payment was created outside the app's normal flow.

  A 400 on a forged signature is correct behavior and is verified working — do not "fix" it by relaxing verification. And confirm `ALLOW_UNSIGNED_WEBHOOKS` is unset in Production; it is a development-only escape hatch and it disables the check that protects the credit path.

**b) Donations stuck in PENDING.** A `Donation` row is created with status `PENDING` at payment-intent creation, and moves to `COMPLETED` via the verify endpoint or the webhook. A row that is still `PENDING` well after creation is the money-was-taken-but-not-credited case. Nothing in the app detects this today.

Check it with a scheduled query. Anything older than roughly 15 minutes is suspect — a real card payment resolves in seconds:

```sql
SELECT id,
       "campaignId",
       "donorEmail",
       "grossAmount" / 100.0 AS dollars,
       "paymentIntentId",
       "createdAt"
FROM "Donation"
WHERE status = 'PENDING'
  AND "paymentProvider" = 'STRIPE'
  AND "createdAt" < now() - interval '15 minutes'
ORDER BY "createdAt" DESC;
```

The `"paymentProvider" = 'STRIPE'` filter matters: `SIMULATED` donations are a normal part of non-production flows and will otherwise fill your results with rows that are not real money.

Run it from an alerting tool that can execute SQL on a schedule and page on a non-empty result. If you have no such tool on day one, the honest fallback is to run it by hand every morning and after every deploy, and write down that you did. Do not skip it because it is manual.

**Any row this query returns is a donor who may have been charged with no campaign credit.** Triage it with 5.6 before assuming it is a false positive.

**c) Payout and transfer failures.** `/api/stripe-connect/payout` calls `stripe.transfers.create` against a Connect account using an atomic claim-then-transfer, so two concurrent payouts cannot double-spend. That protects against double-paying; it does not protect against a transfer that fails partway.

This path has **never been exercised with live money**. Its first real run will be with a real team's real funds. Treat every error from it as a page, not a ticket.

Alert on any Sentry error from the payout or onboarding routes. Also watch for disbursement requests that entered processing and never finished:

```sql
SELECT id,
       "campaignId",
       "requestedAmount" / 100.0 AS dollars,
       status,
       "approvedAt",
       "payoutTransactionId",
       "updatedAt"
FROM "DisbursementRequest"
WHERE status = 'PROCESSING'
  AND "updatedAt" < now() - interval '30 minutes'
ORDER BY "updatedAt" ASC;
```

A row here with a null `payoutTransactionId` means the claim was taken but the transfer did not complete. Do not retry it blindly — check the Stripe Dashboard for the Connect account first, because a transfer may have succeeded on Stripe's side after the app's error, and a naive retry sends the money twice.

**d) 5xx rate.** Everything above is specific; this is the catch-all for what you did not anticipate. In Sentry, set an alert on error volume crossing a threshold over a short window (a handful of errors in five minutes is a reasonable start — tune it after a week of real traffic rather than guessing now). Pair it with Vercel's own function error alerting.

Watch two routes with extra care because they fail closed and will look like outages:

- `/api/cron/campaign-automation` returns **503** when `CRON_SECRET` is unset. The Vercel cron in `vercel.json` runs hourly, so a missing secret produces one 503 every hour, forever, while campaign automation silently does nothing. Check the cron's execution history in Vercel after your first deploy rather than waiting to notice.
- The app **throws at startup in production** if `JWT_SECRET` is unset or still the dev fallback. This is deliberate. The symptom is a deployment that fails to boot rather than one that runs insecurely, which is the correct trade — but recognize it for what it is instead of hunting for a code bug.

Worth adding once the basics are live: alert on `OutreachLog` rows accumulating with a `failureReason`. Until the Resend domain DNS is verified (three records still pending), transactional email fails silently to real recipients — receipts, verification, and invitations all break with no user-visible error. That is an email-configuration problem, but the log table is where you would first see it.

---

### 5.4 Health check and uptime monitoring

A health endpoint already exists at `app/api/health/route.ts`. It is registered in `middleware.ts` under `publicExactRoutes`, so an external monitor can reach it with no credentials, and it is marked `force-dynamic` with `Cache-Control: no-store` so it cannot report a cached past state. It does one thing: a `SELECT 1` round-trip to Postgres.

Verify it on the deployed URL. Substitute your real domain:

```bash
curl -s https://YOUR_DOMAIN/api/health
curl -s -o /dev/null -w 'HTTP %{http_code}\n' https://YOUR_DOMAIN/api/health
```

Expected responses:

- `200` with `{"status":"ok","database":"ok"}` — process is up and the database answered.
- `503` with `{"status":"degraded","database":"unreachable"}` — the process is up but Postgres did not answer. Check `DATABASE_URL` in Production, whether your database provider is up, and whether you have exhausted the connection limit. Connection exhaustion is the likeliest cause under load on serverless, since each instance opens its own pool; the fix is a pooled connection string, not a bigger timeout.
- A timeout or a Vercel error page — the deployment itself is down. Sentry will not tell you about this, which is exactly why an external monitor exists.

The endpoint deliberately reveals nothing else: no versions, no connection strings, no error text. The specific failure is logged server-side instead. Keep it that way — an unauthenticated endpoint that reports internals is free reconnaissance.

Point an uptime monitor at it. UptimeRobot, Better Stack, Pingdom, or Checkly all work; the free tiers are sufficient.

- URL: `https://YOUR_DOMAIN/api/health`
- Interval: 1–5 minutes
- Alert when: non-200 status, or two consecutive failures (two avoids paging on one blip)
- Notify: SMS or push to the on-call person from 5.8, not email

**Understand the limit of this check.** A 200 means the process is running and the database is reachable. It says nothing about whether Stripe is reachable, whether webhooks are being delivered, whether email is sending, or whether donations are being credited. All four can be completely broken while this endpoint returns a cheerful `ok`. The health check catches hard-down; 5.3 catches broken-but-up. You need both.

---

### 5.5 Log retention — set this up before you need it, because you cannot retroactively

Vercel's runtime logs are short-lived by default; the retention window depends on your plan and is measured in hours to days, not months. Check your plan's actual number in the Vercel dashboard rather than assuming.

That window is far shorter than the time it takes a payment dispute to arrive. Card chargebacks routinely land weeks or months after the charge. By the time a dispute notification reaches you, the request logs for that donation are long gone.

Two consequences, both of which shape how you operate:

1. **Configure a log drain before you go live.** Vercel can stream logs to Better Stack, Datadog, Axiom, or similar. Do it now — a drain only captures logs from the moment it is configured, so setting one up after an incident gives you nothing about the incident. This is the single most common regret in this stage.

2. **The database is your durable record, not the logs.** `Donation`, `Transaction`, `DisbursementRequest`, and `BankingAccount` rows persist indefinitely. Request logs do not. When you need to reconstruct what happened months later, you will be reading tables and the Stripe Dashboard, not scrollback. There is no separate audit-log table in this schema, so those tables plus Stripe are the whole record.

---

### 5.6 Runbook: reconstructing one donation's history during a dispute

This is the procedure to follow when a donor says "I was charged twice" or "my donation never showed up," or when a chargeback notice arrives. Follow it in order.

Connect to the production database read-only if you can. Every query below is a `SELECT`; resist the urge to `UPDATE` anything until you have the full picture, because the payment path is idempotent and a manual correction can double-count.

```bash
psql "$DATABASE_URL"
```

**Step 1 — Find the donation.** By donor email:

```sql
SELECT id, "campaignId", "donorEmail", "donorName",
       "grossAmount" / 100.0 AS gross_dollars,
       "netAmount"   / 100.0 AS net_dollars,
       "platformFee" / 100.0 AS platform_fee,
       status, "paymentProvider", "paymentIntentId",
       "paymentMethodLast4", "createdAt", "updatedAt"
FROM "Donation"
WHERE "donorEmail" = 'donor@example.com'
ORDER BY "createdAt" DESC;
```

Or, if the donor gave you a Stripe receipt and you have the payment intent id:

```sql
SELECT * FROM "Donation" WHERE "paymentIntentId" = 'pi_XXXXXXXXXXXX';
```

All amounts are stored as BigInt **cents**; the `/ 100.0` is what makes them dollars. A donation with `isAnonymous = true` is hidden from public display only — the donor's identity is still in these columns, and you can look it up for a dispute.

**Step 2 — Read the ledger entries.** Every credit and reversal writes a `Transaction` row:

```sql
SELECT t.id, t.type,
       t.amount       / 100.0 AS amount_dollars,
       t."balanceAfter" / 100.0 AS balance_after,
       t.description, t."createdAt"
FROM "Transaction" t
WHERE t."donationId" = 'DONATION_ID_FROM_STEP_1'
ORDER BY t."createdAt" ASC;
```

How to read the result:

- **One `DEPOSIT` row** and donation status `COMPLETED` — normal. The campaign was credited once. If the donor claims a double charge, they were most likely charged once and saw a confirmation twice, or made two separate donations. Check Step 1's full result list for a second row.
- **Two `DEPOSIT` rows for one donation** — a double credit. This should not happen; the payment path was verified to produce exactly one credit even under a concurrent verify-plus-webhook race. Treat it as a genuine bug, capture the rows, and do not correct the balance until you understand the cause.
- **No rows at all, donation status `PENDING`** — the charge may have succeeded at Stripe while the campaign was never credited. Go to Step 3; this is the case that matters most.
- **`REFUND` rows present** — a refund reversed the credits, which is expected behavior.

**Step 3 — Reconcile against Stripe, which is the source of truth for money.** Take the `paymentIntentId` from Step 1 and search it in the Stripe Dashboard (Payments → search by `pi_...`). Stripe tells you definitively whether the donor's card was charged, how many times, and whether a refund or dispute exists.

Then compare:

| Stripe says | Database says | What it means | Action |
|---|---|---|---|
| Succeeded | `COMPLETED`, one `DEPOSIT` | Consistent | Nothing. Explain to the donor. |
| Succeeded | `PENDING`, no `Transaction` | **Donor charged, campaign not credited** | The webhook did not land. Check webhook delivery attempts in the Stripe Dashboard and resend the event from there — the handler is idempotent under replay, so a resend is safe. |
| No charge / failed | `PENDING` | Payment never completed | No money moved. The `PENDING` row is an abandoned attempt, which is normal. |
| Refunded | `REFUNDED` with `REFUND` rows | Consistent | Nothing. |
| Succeeded twice | Two donation rows | Donor genuinely donated twice | Refund one from the Stripe Dashboard and let the webhook reverse the credits. |

Stripe's record wins in any disagreement. The database describes what the app *believes*; Stripe describes what happened to the card.

**Step 4 — Write down what you found**, including donation id, payment intent id, and the resolution, and reply to the donor from the support address in 5.8. Do this even when the answer is "everything is correct" — the next dispute from the same donor is much easier when there is a record.

---

### 5.7 The rate limiter does not survive serverless — state this plainly

Rate limiting is wired to the auth and donation endpoints and it works: a production build was verified returning 429 with `Retry-After`.

**But the limiter is in-memory and per-instance.** Each running instance keeps its own counters and none of them share state. On Vercel's serverless platform, the number of concurrent instances scales with traffic, so the *effective* limit is your configured limit multiplied by the number of live instances. Under exactly the conditions where a limit matters — a burst of automated requests — the platform spawns more instances and the limit loosens on its own. Cold starts reset counters to zero as well.

What this means concretely:

- Do not treat the current limiter as protection against credential stuffing on `/api/auth/login`.
- Do not treat it as protection against card-testing on `/api/donations`. **Stripe Radar is your real backstop** for card testing — make sure it is enabled on the live account.
- Also set `TRUSTED_PROXY_HOPS` correctly (`1` behind Vercel alone, `2` if Cloudflare sits in front of Vercel). Without it the limiter cannot determine the true client IP, and a limiter keyed on the wrong IP either rate-limits everyone as one caller or nobody at all.

For real abuse resistance this needs a shared store — Upstash Redis is the usual choice on Vercel because it speaks HTTP and works from serverless functions without connection pooling. That is a code change, not a configuration change, and it is out of scope for this stage. Log it as known and tracked. Launching without it is a defensible risk for low traffic; pretending the limits hold as configured is not.

---

### 5.8 The non-technical half: who is actually on call, and where donors reach you

Monitoring that pages nobody is monitoring theater. Two things must be real people with real contact details before launch. Fill these in — an unfilled table here means this stage is not done.

**On-call.** Name a specific person, not a team.

| Role | Name | Contact | Covers |
|---|---|---|---|
| Primary on-call | *(fill in)* | *(mobile that receives SMS)* | Health check down, 5xx alerts, webhook failures |
| Payment escalation | *(fill in)* | *(mobile)* | Stuck `PENDING` donations, payout/transfer failures, disputes |
| Backup / after hours | *(fill in)* | *(mobile)* | Anything unanswered after 30 minutes |

Every alert in 5.3 and 5.4 must route to the mobile number of the person named above. Verify this end to end: fire a test alert from Sentry and from the uptime monitor and confirm a phone actually buzzes. An alert rule that has never been tested is a rule you should assume is broken.

If it is one person for now — which is likely — say so explicitly in the document rather than leaving blanks. "Primary and backup are both Robert; there is no after-hours coverage" is a legitimate, honest posture. Silent blanks are not, because they read as coverage that does not exist.

**Support address.** A confused parent, a donor who thinks they were double-charged, and a coach who cannot find their payout all need somewhere to write. That address must be:

- **Published where people in trouble will look**: on the donation confirmation page, in the footer, and in the `EMAIL_FROM` sender's reply path. `EMAIL_FROM` is a no-reply sender, so a reply-to address that reaches a human has to be published separately or replies vanish.
- **A real, monitored mailbox** — a shared inbox or a forwarding alias, not a personal address that goes unread on weekends.
- **Independent of this app's own email sending.** This matters more than it sounds. Until the Resend domain DNS is verified, outbound transactional email silently fails to real recipients. Your support channel cannot depend on the same pipeline that is broken; if it does, the people who need help most are exactly the ones who cannot reach you. Use a mailbox you can read directly.

| | Value |
|---|---|
| Support email | *(fill in, e.g. `support@yourdomain.com`)* |
| Monitored by | *(fill in)* |
| Response-time commitment | *(fill in, e.g. one business day)* |
| Escalation for money issues | Payment escalation contact above |

Publish the response-time commitment you can actually meet. A parent who is told "one business day" and gets a reply in one business day is satisfied. One who is told nothing assumes they have been ignored and escalates to their bank instead — and a chargeback costs more than the donation.

Note that `/terms` and `/privacy` are unreviewed placeholder copy. The support address is currently the only real channel a user has for a data question about their child's information. Given that the app collects minors' names, emails, phones, photos, and parent contact details with no verified parental-consent gate, expect those questions and be ready to answer them from a monitored mailbox.

---

### Stage 5 exit checklist

Do not move to live Stripe keys until every line is checked:

- [ ] `npx @sentry/wizard@latest -i nextjs` run, `npm run build` exits 0
- [ ] `sendDefaultPii: false` and a `beforeSend` scrubber configured in every generated Sentry config
- [ ] Sentry DSN set for Production in Vercel and a deliberate test error confirmed visible in the Sentry dashboard
- [ ] Stripe Dashboard webhook failure notifications enabled and pointed at a monitored address
- [ ] Sentry alert on errors from `/api/webhooks/stripe`
- [ ] Stuck-`PENDING` donation query scheduled, or a written daily manual check with an owner
- [ ] Alert on payout/Connect route errors and on `DisbursementRequest` rows stuck in `PROCESSING`
- [ ] 5xx volume alert configured
- [ ] `curl https://YOUR_DOMAIN/api/health` returns `200 {"status":"ok","database":"ok"}`
- [ ] Uptime monitor pointed at `/api/health`, alerting to a phone
- [ ] Vercel cron execution history checked — no hourly 503s from a missing `CRON_SECRET`
- [ ] `ALLOW_UNSIGNED_WEBHOOKS` confirmed unset in Production
- [ ] `TRUSTED_PROXY_HOPS` set correctly for your proxy chain
- [ ] Log drain configured and receiving logs
- [ ] Stripe Radar enabled on the live account
- [ ] On-call table filled in with real names and mobile numbers; test alert confirmed received on a phone
- [ ] Support email live, monitored, published, and independent of the app's own email sending
- [ ] Team walked through 5.6 once against a test-mode donation, so the dispute procedure is not being read for the first time during a real dispute

---

## Stage 6 — Go live with real money

This is the first stage where a real card is charged. Do not start it until Stages 0-5 are complete:
credentials rotated, database provisioned and backed up, the app deployed and healthy, the test-mode
money path proven green, email actually delivering, and error tracking live. Every one of those is a
prerequisite for being able to notice and recover from a problem that now involves someone's money.

The step numbers continue from Stage 3, because this is the same money path — just pointed at
production.

### Step 10 — Understand what "switching to live" actually means

Stripe keeps test and live completely separate. These are all distinct between the two modes and none of them carry over:

- API keys (`sk_test_`/`pk_test_` vs `sk_live_`/`pk_live_`)
- Webhook endpoint registrations
- Webhook signing secrets
- The event log and the payments list
- Connect accounts, customers, and payment intents

So going live is not a key swap. It is a key swap **plus a second, independent webhook registration with its own signing secret**. Miss the second registration and donations will still charge cards while the app never hears about them.

Before you can get live keys, the Stripe account itself must be activated: real business details, real bank account, identity verification. Do that in the Stripe dashboard first. Until activation completes, `sk_live_` keys do not exist.

### Step 11 — Swap in the live API keys

```bash
vercel env rm STRIPE_SECRET_KEY production
vercel env add STRIPE_SECRET_KEY production
# paste sk_live_...

vercel env rm NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
# paste pk_live_...
```

Do **not** redeploy yet — do Step 12 first so the live secret and the live keys go out in the same deployment. Between the key swap and the new webhook secret, the app is in a broken half-state; keep that window as short as possible.

Note that the leaked-credentials problem applies here too: the old test secret key in git history must be rolled in the Stripe dashboard (**Developers → API keys → roll**) as part of the credential rotation work, and it should be rolled *before* any history purge, since a purge does nothing for anyone who already cloned the repo.

### Step 12 — Register the LIVE webhook endpoint (a second, separate registration)

Turn the Stripe dashboard's test-mode toggle **off**. Then **Developers → Webhooks → Add endpoint** again:

- Endpoint URL: `https://YOUR_DOMAIN/api/webhooks/stripe` — the same URL as before. This is correct; it is a different registration in a different mode, not a duplicate.
- Events: `payment_intent.succeeded` and `charge.refunded` (plus `payment_intent.payment_failed` and `account.updated` if you added them in Step 2).

Reveal **this** endpoint's signing secret. It is a different `whsec_…` from the test one. Set it and deploy everything together:

```bash
vercel env rm STRIPE_WEBHOOK_SECRET production
vercel env add STRIPE_WEBHOOK_SECRET production
# paste the LIVE endpoint's whsec_...

vercel --prod
```

### Step 13 — Verify the live keys actually shipped

Re-run the forged-signature curl from Step 4. It must still return `400 {"error":"Invalid signature"}` — that tells you a webhook secret is loaded, though not yet which one.

Then check that the browser is getting the live publishable key. The stale-bundle failure is the one that bites here, because `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is baked in at build time:

```bash
curl -s https://YOUR_DOMAIN/raise/YOUR_SLUG/donate | grep -o 'pk_[a-z]*_[A-Za-z0-9]\{6\}' | sort -u
```

If that prints a `pk_test_…` prefix, the deployment is stale — redeploy. If it prints nothing, the key is in a JavaScript chunk rather than the HTML; open the donate page in devtools and inspect the Stripe request there instead.

Symptoms of a key mismatch, so you can recognise them at the till:

- Live publishable key in the browser with a test secret key on the server (or the reverse): the payment step fails with a client-side error along the lines of *"No such payment_intent"* or *"The client_secret provided does not match"*. The donate page shows an error; no donation is created. This is a configuration error, not a card decline.
- Live keys everywhere but the test-mode webhook secret still deployed: the card **is charged**, but the webhook returns `400 Invalid signature`. Donations may still complete via the browser's verify call, which masks the problem until a donor closes the tab early. Check the live endpoint's event log for green 200s, not just the app's totals.

### Step 14 — Make a real $1 donation with a real card

This charges a real card. Use your own.

Open `https://YOUR_DOMAIN/raise/YOUR_SLUG/donate`, donate **$1.00** with a real card. Use a donor email you control and can check, because this also exercises the receipt email path.

Two practical notes:

- $1 is the minimum the API accepts.
- The rate limiter is in-memory and per-instance. Donation attempts are capped at 10 per hour per donor email, and payment verification at 10 per hour. Repeated retries with the same email during debugging will produce a `429` with a `Retry-After` header. On serverless the effective limit multiplies by the number of running instances, so a retry may succeed simply because it landed on a different instance — do not read that as the limit being off.

### Step 15 — Confirm the live donation, then refund it

Confirm, in this order:

1. The donate page reports success.
2. The campaign total on `https://YOUR_DOMAIN/raise/YOUR_SLUG` increased by **$1.00** — exactly once, not twice.
3. Stripe dashboard (live mode) → **Payments** shows a $1.00 succeeded charge.
4. The live endpoint's event log shows `payment_intent.succeeded` with HTTP **200**.
5. A receipt email arrived. If it did not, that is the unverified Resend DNS problem, not a Stripe problem — until the Resend domain's DNS records are verified, all transactional email fails silently to real recipients. Note it and keep going; it does not block this stage.

Then refund it. Stripe dashboard (live) → **Payments** → the $1.00 charge → **Refund** → **full** amount.

Confirm the reversal:

1. `charge.refunded` shows **200** in the live endpoint's event log.
2. The campaign total returned to its pre-donation value.
3. The campaign's available balance dropped by the net amount that was credited.

For a $1.00 donation with the default 10% platform fee, the arithmetic is: gross $1.00, platform fee $0.10, processing fee $0.33 (2.9% + $0.30), net **$0.57** credited to the campaign's spendable balance. The campaign's displayed total moves by the full $1.00. Both numbers reverse on refund.

Refunding a real card returns the money to the cardholder in roughly 5–10 business days, and on standard Stripe pricing the processing fee is not returned to you — so this test costs about $0.33. That is the correct price for knowing the live path works.

### Step 16 — Onboard one real campaign to Stripe Connect

Everything up to here was money **in**. The rest is money **out**, and it has never moved a live dollar. Treat it as the least-trusted part of the system.

There is currently **no UI** for starting Connect onboarding. You must call the API directly, as the campaign's primary leader. CSRF protection uses an `httpOnly`, `SameSite=strict` cookie, so you cannot read the token from `document.cookie` — fetch it from `/api/csrf-token`, which returns the value and sets the matching cookie.

Sign in at `https://YOUR_DOMAIN` **as the campaign's primary leader** (not as the admin — the route requires `campaign.primaryLeaderId === user.id`). Get the campaign id from the dashboard URL: `/dashboard/<campaignId>`. Then, in that tab's devtools console:

```js
const campaignId = 'PASTE_CAMPAIGN_ID_HERE';
const { csrfToken } = await (await fetch('/api/csrf-token')).json();
const res = await fetch('/api/stripe-connect/onboard', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
  body: JSON.stringify({ campaignId }),
});
console.log(res.status, await res.json());
```

Expected: `200` with `{ success: true, onboardingUrl: "https://connect.stripe.com/..." }`.

Failure readings:

| Response | Meaning |
| --- | --- |
| `401` | Not signed in, or the session cookie did not travel. Run this in a tab on `https://YOUR_DOMAIN`, not on a preview domain. |
| `403 Invalid CSRF token` | The token and cookie did not match. Reload the page and re-run the snippet as one block. |
| `403 You must be the campaign leader to set up payouts` | You are signed in as someone else. Being an admin does not satisfy this route. |
| `404 Campaign not found` | Wrong `campaignId`. |
| `404 Banking account not found for this campaign` | The campaign has no banking account row. Do not hand-edit the database; create the campaign through the app so the banking account is created with it. |
| `500 Failed to create onboarding link` | Stripe rejected the call. Detail is only in the Vercel function logs — check them. Common cause: Connect is not enabled on the live Stripe account, which you enable in the Stripe dashboard under **Connect**. |

Open `onboardingUrl` and complete Stripe Express onboarding with the organisation's **real** legal entity details and **real** bank account. This is the account that will receive real money.

> **Expect a 404 when Stripe sends you back.** The onboarding return URL points at `/campaigns/<slug>/settings/payouts`, and that page does not exist in this app. A 404 after finishing onboarding does **not** mean onboarding failed. Verify the real state in the next step instead.

Verify the account status (still signed in as the leader, same console):

```js
const campaignId = 'PASTE_CAMPAIGN_ID_HERE';
const res = await fetch(`/api/stripe-connect/status?campaignId=${campaignId}`);
console.log(res.status, await res.json());
```

You want `connected: true`, `detailsSubmitted: true`, `payoutsEnabled: true`, and `currentlyDue: []`. If `payoutsEnabled` is `false` or `currentlyDue` is non-empty, Stripe still wants information — the listed requirements tell you what. Do not attempt a payout until `payoutsEnabled` is `true`.

### Step 17 — Fund the campaign and raise a disbursement request

The refund in Step 15 pulled the test dollar back out, so the campaign's available balance is back to where it started. To exercise a payout you need a real, **un-refunded** donation to pay out.

Make a second real donation — $5 is a reasonable size — following Step 14, and confirm it exactly as in Step 15 items 1 through 4. Leave it in place; do not refund this one.

Remember the balance arithmetic: on a $5 gross donation the campaign's available balance rises by about $4.05, not $5. Requesting a disbursement larger than the available balance is rejected.

Then, signed in as the campaign leader, go to `https://YOUR_DOMAIN/dashboard/<campaignId>` and submit a disbursement request for an amount at or below the available balance. The form takes dollars.

### Step 18 — Approve and run one real payout

Sign out and sign back in as the `BANK_ADMIN` you created with `scripts/bootstrap-admin.mjs`. Go to `https://YOUR_DOMAIN/admin/disbursements`.

1. Find the pending request and **approve** it. Approval only records the decision; it moves no money.
2. Then use the **payout** action on the approved request. That is the call to `/api/stripe-connect/payout`, and it is the only thing in the system that moves money out.

Internally the route claims the request and debits the balance in one atomic step *before* calling Stripe, so two concurrent payout attempts cannot both transfer. If the Stripe call fails, it puts the claim and the funds back and the request returns to `APPROVED` so you can retry.

Failure readings:

| Response | Meaning | Action |
| --- | --- | --- |
| `403 Only banking admins can process payouts` | You are not `BANK_ADMIN` or `ADMIN`. | Re-check the bootstrap step. |
| `400 Disbursement request must be approved first` | You skipped the approval. | Approve, then retry. |
| `400 Campaign has not set up payout account` | No Connect account id on the banking account. | Step 16 did not complete. |
| `400 Insufficient balance for payout` | Requested more than the available (net) balance. | Re-read the fee arithmetic in Step 15. |
| `409 Disbursement request was already processed` | Something else claimed it — often your own double-click. | Refresh the list and check the real status before retrying. |
| `502 Payout could not be confirmed` | Stripe returned no transfer id. The request is deliberately left `PROCESSING` rather than falsely marked complete. | Do **not** retry blindly. Check Stripe → **Connect → Transfers** for whether a transfer exists, and reconcile by hand. |
| `500` | The Stripe transfer threw. The claim and funds are rolled back and the request returns to `APPROVED`. | Read the Vercel function logs for the Stripe error before retrying. |

The most likely real-world failure on a first live payout is **insufficient platform balance**. Transfers are funded from your platform's available Stripe balance, and freshly settled charges sit in pending for several days on a new account. So a donation that clearly succeeded can still produce a transfer failure with a `balance_insufficient` error. The symptom is a `500` from the payout action with the disbursement back in `APPROVED` and the funds restored in-app. This is expected on a new account; wait for the platform balance to settle and retry. Confirm the available versus pending split in Stripe → **Balances** before you conclude something is broken.

### Step 19 — Confirm the payout actually landed

1. Stripe dashboard (live) → **Connect → Transfers** shows a transfer to the connected account for the expected amount, with `disbursementRequestId` and `campaignId` in its metadata.
2. In `/admin/disbursements`, the request shows `COMPLETED` and carries the Stripe transfer id. A `COMPLETED` row without a transfer id should never exist; if you see one, stop and reconcile manually.
3. The campaign's available balance decreased by the disbursed amount.
4. The connected account's own payout to its bank typically arrives within about two business days. Confirm with the organisation that the money actually landed. Do not close out this stage on the Stripe dashboard's word alone — the point of this step is that nobody has ever watched a live dollar complete this journey before.

### Kill switches, if something goes wrong mid-cutover

- **Stop new donations to one campaign:** set that campaign's status to anything other than `ACTIVE`. The donations API rejects donations to non-active campaigns with a `400`.
- **Stop the app hearing about payments:** disable the live webhook endpoint in Stripe. Cards will still be charged — this is not a way to stop taking money, only a way to stop processing events. Stripe will retry deliveries when you re-enable it.
- **Stop taking money entirely:** remove or invalidate `STRIPE_SECRET_KEY` and redeploy. This breaks the donate flow loudly and immediately; it is a blunt instrument, and any in-flight payment intent will be orphaned.
- **Stop money going out:** payouts require an approved disbursement plus a `BANK_ADMIN`. Simply do not approve anything.

### What you should have at the end of Stage 6

- A test-mode webhook endpoint and a live-mode webhook endpoint, both registered, each with its own signing secret, with only the live secret currently deployed.
- Green `200` deliveries for `payment_intent.succeeded` and `charge.refunded` in the **live** event log.
- One real donation observed to credit the campaign exactly once, and one real refund observed to reverse it exactly once.
- One campaign fully onboarded to Stripe Connect with `payoutsEnabled: true`.
- One real transfer completed end to end, with the transfer id recorded against a `COMPLETED` disbursement, and confirmation from the receiving organisation that the funds arrived.

Anything on that list you have not personally observed is still unproven, regardless of what test mode showed.


---

## Stage 7 — Controlled go-live

Everything before this stage was about making the deployment correct. This stage is about limiting the blast radius while you find out what the tests could not tell you.

Three facts should shape how you launch:

- You have error tracking only if you actually completed Stage 5. If you skipped it, stop and go back: without it, a page that throws for a real donor at 9pm is invisible to you unless that donor tells you.
- The money-out path was exercised exactly once, in Stage 6, by you. One successful payout proves the path works; it does not prove it works for a campaign you did not personally set up.
- Rate limiting is in-memory and per-instance. On Vercel each serverless instance keeps its own counters, so the effective limit is the configured limit multiplied by however many instances are warm.

So: launch with exactly one team, chosen because you know them personally and can call them.

### 7.1 Choose the pilot team

Pick a team where you have the coach's or treasurer's mobile number and they have yours. You want someone who will text you "the donate button did nothing" instead of quietly giving up.

Tell them, in these words or close to them, before they agree:

- This is the first real run of the software. They are the pilot.
- You will personally watch every transaction.
- Payouts have never been run with live money before theirs.
- If something breaks with their money, you will make them whole out of your own pocket.

Set a size limit for the pilot: one campaign, one team roster, and a fundraising goal small enough that you could personally cover the entire amount if a payout goes wrong. If you cannot cover it, the pilot is too big.

Understand what "one team" does and does not hide. `/campaigns` lists campaigns whose status is `ACTIVE` (`app/api/campaigns/public/route.ts` only ever lists `ACTIVE` and `COMPLETED`; `DRAFT`, `PAUSED` and `ARCHIVED` are never listed). Once the pilot campaign goes `ACTIVE` it is publicly visible to anyone who knows the domain. There is no unlisted mode. Your access control during the pilot is that nobody knows the URL, so do not post it anywhere, do not submit it to search engines, and do not put it in a public README.

### 7.2 Smoke-test the live URL before anyone else touches it

Run this against the real production URL, from your own machine, before you send the pilot team a link. It takes about ten minutes.

Set up once:

```bash
export BASE="https://your-production-domain.com"   # exactly what NEXT_PUBLIC_APP_URL is set to
```

If `BASE` and `NEXT_PUBLIC_APP_URL` disagree, stop and fix the env var first — every link in every email is built from `NEXT_PUBLIC_APP_URL`, and a wrong value sends donors to a dead host.

**Step 1 — Public pages load.**

```bash
for path in / /campaigns /about /help /terms /privacy /login /signup; do
  printf '%-12s %s\n' "$path" "$(curl -sS -o /dev/null -w '%{http_code}' "$BASE$path")"
done
```

Expect `200` on every line. What failure looks like:

- `500` on every page, including `/`: the most likely cause is `JWT_SECRET` unset or still the dev fallback. `lib/jwt-secret.ts` throws at startup in production by design. Check the Vercel runtime logs for the throw, set the variable, redeploy.
- `404` on `/terms` or `/privacy`: the build did not include those routes. Check the deployment is from the commit you think it is.

**Step 2 — Health and database connectivity.**

```bash
curl -sS -i "$BASE/api/health"
```

Expect `200` with `{"status":"ok","database":"ok"}`. A `503` with `{"status":"degraded","database":"unreachable"}` means the app is up but cannot reach Postgres — wrong `DATABASE_URL`, the connection pooler is exhausted, or the database is not accepting connections from Vercel's egress. The endpoint deliberately does not tell you which; the specific error is in the Vercel runtime log for that request.

**Step 3 — Security headers on the live host.**

```bash
node scripts/test-security-headers.mjs "$BASE"
```

The script checks HSTS, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy` against the URL you pass, and applies the production-strength expectations because the URL is `https://` and is not localhost. Anything it flags is a real regression — those headers are set in `next.config.mjs` and were passing before.

**Step 4 — An anonymous request to a campaign-scoped API is refused.**

Get a campaign id from the dashboard URL (`/dashboard/<campaignId>`), then:

```bash
export CAMPAIGN_ID="paste-the-campaign-id-here"
curl -sS -i "$BASE/api/campaigns/$CAMPAIGN_ID/stats"
```

Expect `401` with `{"error":"Unauthorized"}` — that body comes from `middleware.ts`, which rejects the request before the route handler runs. This endpoint returns the revenue timeline and named player performance, so a `200` here means minors' names are readable by anyone on the internet. If you get `200`, stop the go-live immediately and do not send anyone the link.

**Step 5 — Login works and sets a secure cookie.**

Do not put the password in your shell history:

```bash
read -rsp "password: " PW; echo
curl -sS -i -c /tmp/owner.cookies -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"leader@example.com\",\"password\":\"$PW\"}" | head -25
unset PW
```

Expect `200`, a body containing `"success":true`, and a `Set-Cookie: sessionToken=...` carrying `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`. If `Secure` is missing, `NODE_ENV` is not `production` on the deployment — the cookie flag is set from it in `app/api/auth/login/route.ts`. Fix that before continuing; a non-Secure session cookie is a session-theft bug.

If your password contains `"` or `\`, that inline JSON will break. Rather than fighting quoting, log in through the browser and export the cookie from devtools, or temporarily set a simpler password on the probe account.

**Step 6 — The owner gets 200 on the same endpoint.**

```bash
curl -sS -b /tmp/owner.cookies -o /dev/null -w '%{http_code}\n' \
  "$BASE/api/campaigns/$CAMPAIGN_ID/stats"
```

Expect `200`. A `403` here means the account you logged in as is not the campaign's `primaryLeaderId`, not a guardian, and not an admin — you used the wrong account, or the campaign belongs to someone else.

**Step 7 — A logged-in non-owner gets 403.**

Sign up a second throwaway account through the UI at `$BASE/signup` (public signup can only create `CAMPAIGN_LEADER` / `GUARDIAN` / `DONOR`, so this account can never escalate itself). Log it in to a separate cookie jar and hit the same campaign:

```bash
read -rsp "probe password: " PW; echo
curl -sS -c /tmp/other.cookies -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"probe@example.com\",\"password\":\"$PW\"}" -o /dev/null
unset PW

curl -sS -b /tmp/other.cookies -i "$BASE/api/campaigns/$CAMPAIGN_ID/stats"
```

Expect `403` with `{"success":false,"error":"Not authorized"}`. A `200` is a cross-tenant data leak — halt the go-live.

Repeat steps 4, 6 and 7 against at least two more campaign-scoped endpoints, for example:

```bash
for p in stats analytics team-members export contacts; do
  printf '%-14s anon=%s other=%s owner=%s\n' "$p" \
    "$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/api/campaigns/$CAMPAIGN_ID/$p")" \
    "$(curl -sS -b /tmp/other.cookies -o /dev/null -w '%{http_code}' "$BASE/api/campaigns/$CAMPAIGN_ID/$p")" \
    "$(curl -sS -b /tmp/owner.cookies -o /dev/null -w '%{http_code}' "$BASE/api/campaigns/$CAMPAIGN_ID/$p")"
done
```

The pattern you want on every row is `401 403 200`. Anything else, investigate that route before launch.

**Step 8 — Rate limiting refuses repeated failed logins.**

Use an address that is **not** a real user. The per-account bucket is checked before the password is verified, so five failures lock that account out of login for up to fifteen minutes even with the correct password. Never run this against the pilot leader's email the night before a launch.

```bash
for i in $(seq 1 10); do
  printf '%s ' "$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"email":"ratelimit-probe@example.invalid","password":"deliberately-wrong"}')"
done; echo
```

`RATE_LIMITS.AUTH` in `lib/utils/rate-limiter.ts` is 5 attempts per 15 minutes per account, so the expected output is five `401`s followed by `429`s. Confirm the headers on a refused attempt:

```bash
curl -sS -D - -o /dev/null -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"ratelimit-probe@example.invalid","password":"deliberately-wrong"}' \
  | grep -iE 'HTTP/|retry-after|x-ratelimit'
```

Expect `HTTP/2 429` plus `Retry-After` and `X-RateLimit-*`.

Two honest caveats about this test:

- The counters live in process memory. On Vercel your ten requests may be spread across several warm instances, each with its own count, so you may need more than six attempts to see a `429`, and you may see the counter appear to reset when an instance is recycled. If you see `429` at all, the mechanism works. If you see none after 15 attempts, that is the multi-instance behaviour, not necessarily a bug — but note it, because it means the real-world limit is looser than 5.
- `middleware.ts` also applies a global 300-requests-per-15-minutes-per-IP limit to all `/api/` routes. If you loop hard enough you will trip that instead and see `{"error":"Too many requests. Please slow down."}`. That is also a pass, just a different limiter.

This is also the moment to confirm `TRUSTED_PROXY_HOPS` is set (`1` behind Vercel alone, `2` if Cloudflare is in front of Vercel). Without it the limiter cannot trust the client IP, and every anonymous donor collapses into one shared bucket.

**Step 9 — Cron is authenticated and actually runs.**

```bash
curl -sS -o /dev/null -w '%{http_code}\n' "$BASE/api/cron/campaign-automation"
```

Expect `401`. A `503` means `CRON_SECRET` is not configured — the route fails closed by design, and the consequence is that the hourly automation silently does nothing forever. Then prove the happy path:

```bash
read -rsp "CRON_SECRET: " CRON_SECRET; echo
curl -sS -i "$BASE/api/cron/campaign-automation" \
  -H "Authorization: Bearer $CRON_SECRET"
unset CRON_SECRET
```

Expect `200`. If you skip the `read` line, `$CRON_SECRET` expands to nothing, the request goes out
with an empty bearer token, and you get a `401` that looks exactly like a mismatched secret — you
would then go hunting for a configuration bug that does not exist. Vercel sends that same `Authorization: Bearer` header on the scheduled invocation when `CRON_SECRET` is set on the project. `vercel.json` schedules this at `0 * * * *` with `maxDuration: 60`, so within the hour check the Vercel dashboard's Cron Jobs view and the runtime logs to confirm a scheduled run actually fired and finished inside 60 seconds. A run that is being killed at the duration limit will show as a timeout, not as an error you would otherwise notice.

**Step 10 — The Stripe webhook still rejects forged signatures.**

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X POST "$BASE/api/webhooks/stripe" \
  -H 'Content-Type: application/json' \
  -H 'stripe-signature: t=1,v1=forged' \
  -d '{"type":"payment_intent.succeeded"}'
```

Expect `400`. A `200` means signature verification was skipped, and anyone on the internet can credit
donations that never happened. The bypass in `app/api/webhooks/stripe/route.ts` requires *both*
`ALLOW_UNSIGNED_WEBHOOKS === "true"` **and** `NODE_ENV !== "production"`, so a `200` here means one of
two things, and both are serious:

- the flag is set **and** this deployment is not running as production — check `NODE_ENV`, because a
  Preview deployment carrying production data is its own problem; or
- you are pointed at the wrong URL entirely.

Stop the go-live, unset the flag, confirm `NODE_ENV=production`, redeploy, and re-run this check
before continuing.

**Step 11 — Clean up.** Delete or leave inert the probe accounts you created. Never leave a probe account with an elevated role, and never leave one whose password you typed into a shell.

### 7.3 The four things the pilot must actually prove

The smoke test proves the app responds correctly. It does not prove money and messages reach real humans. Each of the following must happen once, for real, with a real person, before you consider go-live done.

**1. A real donation from a real donor.**

Have someone who is not you donate a small real amount (five or ten dollars) from their own phone, on their own network, using their own card. Your own card on your own laptop tests less than you think: same IP, same browser, and often a card already known to Stripe.

Verify, in this order:

- The Stripe dashboard (live mode) shows one succeeded payment for the exact amount.
- The campaign page total went up by exactly that amount, once.
- The donation is attributed to the right player if the donor used a player's share link.
- The database agrees:

```bash
psql "$DATABASE_URL" -c 'SELECT * FROM "Donation" ORDER BY "createdAt" DESC LIMIT 3;'
```

You are looking for exactly one row for that payment. The verify-and-webhook race was proven idempotent in test mode; this is you confirming it in production, once, with real money. If you see two rows for one Stripe payment, stop taking donations and investigate before anything else.

**2. A real receipt email in a real inbox.**

The donor must receive their receipt in a real consumer mailbox — Gmail or Outlook, not a catch-all you control. Check the spam folder too; a first send from a new domain frequently lands there.

This is the single most likely thing to fail right now, because the Resend domain DNS is unverified with three records still pending. Until those verify, **all** transactional email silently fails to real recipients: no donation receipts, no email verification, no player invitations. It does not throw a visible error in the app. The way to tell is the Resend dashboard — the domain shows unverified and sends show as failed or blocked rather than delivered.

Before the pilot: confirm the domain is verified in Resend, and confirm `EMAIL_FROM` uses that exact verified domain (for example `Bleacher Backers <noreply@yourdomain.com>`). A `EMAIL_FROM` on a domain Resend has not verified will be rejected. While you are in a real receipt, check that `MAILING_ADDRESS` renders your actual postal address in the footer — it has a hardcoded fallback, so a wrong value looks fine to the code and wrong to a regulator — and click the unsubscribe link to confirm it resolves.

**3. A real player invitation and onboarding, on a real phone.**

Have the coach invite one real player from the roster. Then watch that player, on their own phone, open the invitation and complete onboarding.

Verify:

- The invitation email or SMS arrives. In the Twilio console, Monitor → Logs → Messaging should show the message as delivered. "Undelivered" with a carrier-filtering error on a US long code usually means A2P 10DLC registration is missing — carriers drop unregistered application-to-person traffic silently, and nothing in your app will tell you.
- `TWILIO_PHONE_NUMBER` is a number owned by the account behind `TWILIO_ACCOUNT_SID` and is SMS-capable. If it is not, sends fail at the API call.
- The onboarding link opens without a login (it is token-authorized), the player can add supporter contacts, and the parent then receives the informational welcome email.

Before you invite a real child: read section 6.5 on parental consent. In a pilot with a team you know, get the parent's explicit permission out of band — a phone call or a written email per child — before the invitation goes out. The app does not do this for you.

**4. A real payout landing in the team's bank account.**

This is the one that has never run with live money, and it is the one that matters most. A fundraising platform that takes money and cannot pay it out is worse than no platform at all.

Prerequisite: you need a `BANK_ADMIN`. Public signup cannot create one and role changes require an existing one, so on a fresh production database there is nobody who can approve a disbursement. Confirm:

```bash
psql "$DATABASE_URL" -c 'SELECT id, email, role FROM "User" WHERE role = '"'"'BANK_ADMIN'"'"';'
```

If that returns no rows, sign up through the UI first, then promote that user:

```bash
DATABASE_URL="postgresql://..." node scripts/bootstrap-admin.mjs you@yourdomain.com
```

The script only promotes an existing user, refuses to run if a `BANK_ADMIN` already exists unless you pass `--force`, and prints the before/after role. If it reports the user does not exist, you skipped the signup step.

Then run the money out, in order:

1. The team completes Stripe Connect onboarding through the app (`/api/stripe-connect/onboard` creates a real Connect account and hosted onboarding link). In live mode this asks their treasurer for real identity details and real bank account details. Budget time for this — it is the step most likely to stall for days.
2. Confirm in the Stripe dashboard, under Connect → Accounts, that the connected account shows charges and payouts enabled with no outstanding requirements. The app's `/api/stripe-connect/status` reads the same state.
3. The campaign leader requests a disbursement from the dashboard. The request lands as `PENDING`.
4. You, as `BANK_ADMIN`, approve it at `$BASE/admin/disbursements`. It moves to `APPROVED`. The payout route rejects anything not `APPROVED` with a `400`.
5. Trigger the payout **from the admin UI in a browser**, not from curl. `app/api/stripe-connect/payout` enforces CSRF (`checkCsrf`) as well as the session and the `BANK_ADMIN`/`ADMIN` role, so a bare curl will be refused on CSRF grounds and tell you nothing useful.
6. Make the first live payout small — five or ten dollars — even if the campaign raised more. Prove the rails, then move the rest.
7. Verify in Stripe that a Transfer to the connected account exists, and then that the connected account has a payout scheduled or paid to their bank.
8. Do not call it done until the treasurer looks at their actual bank statement and confirms the money arrived. Expect a delay: Stripe holds a brand-new connected account's first payout considerably longer than later ones. Check that connected account's payout schedule in the Stripe dashboard rather than assuming a timeline, and tell the treasurer the expected date up front so a normal delay does not turn into a panic.
9. Reconcile afterwards: the amount transferred equals the approved amount, the campaign's balance decreased exactly once, and the disbursement row is `COMPLETED` carrying the Stripe transfer id.

Failure modes worth recognising on the night:

- "Insufficient funds" from the payout route: donation funds are not immediately available in your Stripe balance. A payout attempted the same day as the donation can legitimately fail on available balance. Check the Stripe balance page for pending versus available before assuming a bug.
- `400` "must be approved first": step 4 was skipped or the request was rejected.
- `403`: the account you are using is not `BANK_ADMIN` or `ADMIN`. Re-check the bootstrap step and log out and back in so the session carries the new role.
- `404`: no Stripe Connect account id on the banking account — onboarding was started but never finished.

### 7.4 Watching the pilot with no observability

There is no error tracking. Until there is, your monitoring is manual and you must schedule it rather than intend it.

- Vercel runtime logs are the only view of a server-side failure, and retention is limited. When you see an error, copy it out immediately; do not assume you can go back for it.
- Point an external uptime monitor at `$BASE/api/health` on a short interval. That endpoint returns `503` when the database is unreachable, so a monitor watching it will page you for the failure most likely to take the whole app down. This is the cheapest observability you can add today and takes five minutes.
- Check the Stripe dashboard for failed payments, the Resend dashboard for bounced or blocked email, and the Twilio message log for undelivered SMS. Each of these fails silently from the app's point of view.
- Give the coach and treasurer your mobile number and tell them to text you. Do not expect a bug report; expect "it's not working".
- Know your rollback: Vercel can instantly promote the previous deployment. Be clear with yourself that a rollback does not undo a database migration, so a code rollback after a schema change is not automatically safe.

### 7.5 The blockers that are not engineering

Everything above is about whether the software works. This section is about whether you are permitted to run it. These are not code changes and you cannot resolve them by deploying. None of this is legal advice; all of it is a reason to talk to a lawyer before you take money from anyone who is not a personal friend.

**1. An incorporated entity as merchant of record.** Right now the Stripe account is in someone's name. If that name is yours as an individual, you personally are the merchant of record: the donations are legally yours, the chargebacks are yours, the liability for a data breach involving minors is yours, and the money is your personal income until an accountant says otherwise. Resolved looks like: an incorporated entity (LLC or a nonprofit corporation), an EIN, a business bank account, and Stripe onboarding redone under the entity. Do not take strangers' money on a personal Stripe account.

**2. Lawyer-reviewed `/terms` and `/privacy`.** Both pages exist and both are placeholder copy that has never been reviewed. That is worse than having no pages, because placeholder terms make promises you have not read and omit disclosures you may owe. At minimum a review needs to cover: what data is collected from minors, how long it is retained, how a parent requests deletion, and the actual third parties data flows to — Stripe, Resend, Twilio, your database host, and OpenAI if `OPENAI_API_KEY` is set and the AI help chat is live. Resolved looks like: a lawyer has read the code's actual data flows and written pages that match them.

**3. Whether you are implying donations are tax-deductible.** Donations to this platform are **not** tax-deductible unless the recipient has 501(c)(3) status or you are operating under a fiscal sponsor that does. Implying deductibility when it does not exist is not a copy problem, it is a legal problem, and receipt emails are the highest-risk place for it because donors keep them for taxes. Audit every surface — site copy, receipt and notification email templates, share text, the AI help chat's templates:

```bash
grep -rniE "tax.?deduct|write.?off|501\(c\)|charitable contribution|deductib|for your (taxes|records)" \
  /workspaces/rally/app /workspaces/rally/lib /workspaces/rally/components
```

Read every hit. If the recipient is not a 501(c)(3), the receipt should say plainly that the contribution is not tax-deductible. "Donation" as a word is fine; a promise about the IRS is not.

**4. State charitable-solicitation registration.** Roughly 40 states require registration before you solicit charitable donations from their residents, and a public donate page is generally treated as soliciting in every state it can be read from. Several states require the registration number to appear on the solicitation itself. Multi-state registration is a real, slow, paid process. This is the single strongest argument for the one-team pilot: soliciting from people you personally know, on a URL you have not published, is a materially different posture from putting a public donate page on the internet. Resolved looks like: a nonprofit attorney has told you which states you must register in and you have done it, or you are operating under a fiscal sponsor whose registrations cover you.

**5. The parental-consent gap.** Be precise about what the product actually does today. During onboarding, a child enters their parent's contact details themselves, as a `CHILD`-type contact. The parent then receives an informational welcome email — after the fact. There is no step at which a parent affirmatively consents before their child's name, email, phone, photo, and contact list are collected and stored. `requiresGuardianApproval` does not help here; it gates disbursement amounts, not data collection.

The app does not collect date of birth or age. That reduces COPPA exposure but does not eliminate it: COPPA turns on actual knowledge that a user is under 13, and "this is a youth sports team roster" is context a regulator can reasonably say gave you that knowledge. Not asking is not the same as not knowing. Separately, you are storing photographs of minors, which several states regulate independently of COPPA.

For the pilot, the honest mitigation is out of band: written parental permission per child, collected by you or the coach before any invitation is sent, kept on file. That is what makes a pilot defensible while the product does not do it. Resolved, for a real launch, looks like: a verified parental consent gate that runs *before* a child's data is stored, not an email that arrives afterwards.

### 7.6 Go / no-go

The code being correct and you being allowed to operate are two different gates. Treat these as separate lists and do not let a green left column persuade you about the right one.

Engineering, all of which you can verify tonight:

- [ ] Steps 1–11 of the smoke test pass against the live URL, including `401` / `403` / `200` on every campaign-scoped endpoint you probed.
- [ ] A `BANK_ADMIN` exists (`scripts/bootstrap-admin.mjs` run, verified in the database).
- [ ] Resend domain verified, and a real receipt landed in a real inbox.
- [ ] SMS delivered to a real phone, confirmed in the Twilio log.
- [ ] One real donation, one row, reconciled against Stripe.
- [ ] One real payout confirmed on the team's bank statement.
- [ ] `ALLOW_UNSIGNED_WEBHOOKS` unset, `CRON_SECRET` set, `TRUSTED_PROXY_HOPS` set.
- [ ] An uptime monitor is watching `/api/health`.
- [ ] Committed credentials rotated (this must have been done in an earlier stage; if it was not, no launch).

Not engineering, and none of which a deploy will fix:

- [ ] Incorporated entity is the merchant of record on the Stripe account.
- [ ] `/terms` and `/privacy` reviewed by a lawyer against the real data flows.
- [ ] No copy anywhere implies tax-deductibility that does not exist.
- [ ] Charitable-solicitation registration understood and, where required, completed.
- [ ] Written parental permission on file for every minor in the pilot.

If the first list is complete and the second is not, you have proven the code works. You have not established that you are allowed to operate this. Stay on the one team you know, and do not take money from strangers until the second list is complete too.