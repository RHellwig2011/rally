# SHIP CHECKLIST — Bleacher Backers

Everything code-side is done (branch `feat/roster-alumni-leaderboard` @ `111e7b9`).
This is the remaining human/operational work, in execution order. Do not skip
the test-mode pilot to get to live money.

Companion docs: `DEPLOYMENT.md` (step-by-step runbook), `GO_LIVE.md` (owner split),
`DATABASE_SETUP_GUIDE.md` (provisioning).

---

## Stage 0 — Secrets and accounts (blocks everything)

- [ ] Rotate every credential that ever sat in git: Stripe secret, Twilio, DB
      password, `JWT_SECRET`. Confirm the historical Stripe key in git history
      was actually rotated, not just deleted from the tree.
- [ ] Generate production secrets — never reuse dev values:
      - `JWT_SECRET`: `openssl rand -hex 32`
      - `CRON_SECRET`: `openssl rand -hex 24`
- [ ] Own the accounts: GitHub repo, Vercel project, Stripe, Resend,
      Twilio (optional for a card-only pilot), DNS, password manager.

## Stage 1 — Database + hosting

- [ ] Provision production Postgres with backups + point-in-time recovery.
      Test a restore once.
- [ ] Apply migrations `0004`–`0010` as **raw SQL** (DB was never
      Prisma-baselined — P3005). **Never `prisma db push`** (it would replace
      the TeamMember partial unique index).
      Note: `0009` (`ALTER TYPE ... ADD VALUE`) must run **outside** a
      transaction block.
- [ ] Vercel env vars, scoped to **Production only** (Preview must not share
      the prod DB):
      - [ ] `DATABASE_URL`
      - [ ] `JWT_SECRET`, `CRON_SECRET`
      - [ ] `NEXT_PUBLIC_APP_URL` = real origin — then **redeploy**
            (invitation emails bake it in)
      - [ ] `TRUSTED_PROXY_HOPS=1`; leave `ALLOW_UNSIGNED_WEBHOOKS` unset
      - [ ] `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
            (create an Upstash Redis DB; without these, rate limits are
            per-instance/in-memory again)
      - [ ] `RESEND_WEBHOOK_SECRET` (Resend dashboard → webhook →
            `email.opened` + `email.clicked` events; without it open/click
            tracking 401s — safe but dead)
- [ ] After deploy, confirm **both** crons fire:
      - [ ] `/api/cron/campaign-automation` (hourly at :00)
      - [ ] `/api/cron/reconcile-donations` (hourly at :15)
      Unset `CRON_SECRET` → silent 503s forever.

## Stage 2 — Email

- [ ] Resend: add the three DNS records, verify the domain, send a real
      receipt and a real verify-email. Until DNS verifies, mail **silently
      does not send**.
- [ ] Confirm the From address and a monitored `support@` that is **not**
      the app's own mailer.

## Stage 3 — Stripe (test mode — never skip)

- [ ] Test-mode webhook endpoint with events:
      `payment_intent.succeeded`, `payment_intent.payment_failed`,
      `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`,
      `charge.dispute.funds_reinstated`, `account.updated`.
- [ ] Walk a test donation (`4242…`) → webhook **200** → refund.
- [ ] Trigger one **test dispute** so you know the procedure before a real
      chargeback.
- [ ] Enable Stripe Radar.
- [ ] Promote one human to `BANK_ADMIN`
      (`DATABASE_URL=... node scripts/bootstrap-admin.mjs you@example.com`,
      then sign out and back in). Payout approval is this person.

## Stage 4 — Observability + on-call

- [ ] Sentry (or equivalent) on production, `sendDefaultPii: false`; alert on
      `/api/webhooks/stripe` errors and 5xx volume.
- [ ] Uptime monitor on `GET /api/health` → a **phone**, not only email.
- [ ] Stripe webhook-failure emails to a mailbox you read.
- [ ] Named on-call for money issues. A parent who cannot reach anyone files
      a chargeback.

## Stage 5 — Legal (not closable in code)

- [ ] Lawyer-reviewed Terms and Privacy. Current `/terms` and `/privacy` are
      placeholder copy.
- [ ] Decide whether you serve **under-13s**. If yes: COPPA (verifiable
      parental consent, deletion, retention) — lawyer first, before public
      signup. Default-private + noindex is **not** COPPA.
- [ ] Decide 501(c)(3) posture. The receipt code supports IRS-shaped receipts,
      but only set a Program's `isTaxExempt` (ADMIN-only) after seeing the
      actual determination letter; leaders enter `legalName`/`ein` first.
      Do not tell donors gifts are deductible until this is real.
- [ ] Business entity, bank account, Stripe identity verification for the
      platform's legal person (you).
- [ ] Publish a support SLA you can actually meet.

## Stage 6 — Live money (last; only after 0–5 pass in test mode)

- [ ] Live mode = **new** keys and a **new** webhook secret (test-mode proofs
      do not carry over).
- [ ] `DEPLOYMENT.md` Stage 6: real $1 donation → refund → Connect onboard →
      one real payout to a team you control.

## Ongoing operating rules

- [ ] Verify each new organization (**admin UI** /
      `POST /api/admin/campaigns/[id]/verify`) before it can go ACTIVE.
- [ ] Never load `seed-test-data.mjs` (`coach@example.com` / `password123`)
      into production.
- [ ] Keep player profiles private unless a parent actually opted in.

---

Gate summary:
- Items in Stages 0–3 → closed pilot on test-mode Stripe.
- Stages 4–5 → public signup.
- Stage 6 → real cards.
