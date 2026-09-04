# Functional operations requirements — who does what

As of commit `5e16b18` on `feat/roster-alumni-leaderboard` (pushed).

This is the owner split for turning Bleacher Backers into a **working fundraising operation** (real coaches, real kids, eventually real money). It is not a substitute for `DEPLOYMENT.md`, which is the step-by-step production runbook (commands, failure modes, Stripe test vs live). Use that file when you are actually deploying. Use this file to know **who owns each gap**.

Three bars, in order:

1. **Closed pilot** — invited coaches, Stripe test mode, you are the admin. No live cards.
2. **Public product** — a team can run a season without you sitting in the loop for roster/onboarding.
3. **Live money** — real cards, real payouts. `DEPLOYMENT.md` Stages 0–6 then 7.

Do not skip 1 to get to 3.

---

## Already in the code (do not re-do)

Money path: exactly-once donation completion, claim-then-debit disbursements, Stripe idempotency, chargebacks (`charge.dispute.*`), partial refunds, PENDING reconciler cron, cover-fees fallback reconstruction, attribution 400s.

Trust mins: new player profiles default **private**; public player/leaderboard/donation APIs 404 unless campaign is ACTIVE or COMPLETED; player pages `noindex`; leader cannot go live until staff verifies the org (`POST /api/admin/campaigns/[id]/verify` or admin activation).

Auth: HMAC JWTs, refresh rotation, CSRF on cookie mutations, fail-closed webhooks and crons.

If it is not on this “already done” list, assume it is not done.

---

## YOU — accounts, legal, money, people

These require a human, a vendor dashboard, a lawyer, or a bank. I cannot complete them from the repo.

### Identity and secrets

- [ ] Rotate every credential that ever sat in git (Stripe, Twilio, DB password, `JWT_SECRET`). Confirm the historical Stripe secret in git history was actually rotated, not just deleted from the tree. `DEPLOYMENT.md` Stage 0.
- [ ] Own the GitHub repo, Vercel project, Stripe account, Resend, Twilio, DNS, and a password manager.
- [ ] Generate production `JWT_SECRET` (`openssl rand -hex 32`) and `CRON_SECRET` (`openssl rand -hex 24`). Never reuse the local/dev values.
- [ ] Scope `DATABASE_URL` / Stripe / Resend to **Production only** on Vercel (Preview deploys must not share the prod DB).

### Hosting and database

- [ ] Provision production Postgres with backups + point-in-time recovery; test a restore.
- [ ] Apply migrations the **Rally way**: this database was never Prisma-baselined (`P3005`). Apply `0004` / `0005` / `0006` as raw SQL like the earlier ones. **Never `prisma db push`** — it would replace the TeamMember partial unique index and break re-adding a soft-deleted player.
- [ ] Set `NEXT_PUBLIC_APP_URL` to the real origin, then **redeploy** (invitation emails otherwise can say the wrong domain).
- [ ] Set `TRUSTED_PROXY_HOPS=1` on Vercel. Leave `ALLOW_UNSIGNED_WEBHOOKS` unset.
- [ ] Confirm both crons after deploy: `/api/cron/campaign-automation` (hourly at :00) and `/api/cron/reconcile-donations` (hourly at :15). Unset `CRON_SECRET` → silent 503s forever. `DEPLOYMENT.md` still documents only the first job — treat both as required.

### Stripe (test, then live — never skip test)

- [ ] Test-mode webhook endpoint with events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`, `charge.dispute.funds_reinstated`, `account.updated`.
- [ ] Walk a test donation (`4242…`), confirm webhook **200**, refund, and (once) a test dispute so you are not reading the procedure during a real chargeback.
- [ ] Enable Stripe Radar.
- [ ] Live mode is a **new** set of keys and a **new** webhook secret. Test-mode proofs do not carry over. `DEPLOYMENT.md` Stage 6: real $1 donation → refund → Connect onboard → one real payout to a team you control.
- [ ] One `BANK_ADMIN` human (you or a named partner). Promote with `scripts/bootstrap-admin.mjs`, then **sign out and back in**. Payout approval is this person.

### Email, SMS, domain

- [ ] Resend: add the three DNS records, verify the domain, send a real receipt and a real verify-email. Until DNS is verified, mail **silently does not send**.
- [ ] Confirm the From address and a monitored `support@` that is **not** the app’s own mailer.
- [ ] Twilio: number you own, if you want SMS. Optional for a card-only pilot.

### Observability and on-call

- [ ] Sentry (or equivalent) on production, `sendDefaultPii: false`, alert on `/api/webhooks/stripe` errors and 5xx volume.
- [ ] Uptime monitor on `GET /api/health` → a **phone**, not only email.
- [ ] Stripe dashboard webhook-failure emails to a mailbox you read.
- [ ] Named on-call for money issues. A parent who cannot reach anyone files a chargeback.

### Legal / compliance (not closable in code)

- [ ] Lawyer-reviewed Terms and Privacy. Current `/terms` and `/privacy` are placeholder copy.
- [ ] Decide whether you will serve **under-13s**. If yes: COPPA (verifiable parental consent, deletion, retention). Code currently has **no age gate and no consent artifact**. Default-private + noindex is not COPPA.
- [ ] Decide 501(c)(3) vs not. Receipts today are not IRS-ready (no EIN, goods-or-services statement). Do not tell donors gifts are tax-deductible until this is real.
- [ ] Business entity, bank account, Stripe identity verification for **you** (Connect KYC is Stripe’s, but the platform still needs a legal person).
- [ ] Support SLA you can actually meet, published.

### Operating the product (ongoing)

- [ ] Verify each new organization **before** it goes live (admin UI / `POST /api/admin/campaigns/[id]/verify`). Until then a coach cannot self-activate.
- [ ] Do not promise player self-service, referrals, prizes, drip outreach, or “guardian approval on large withdrawals” — those are not connected or are dead code.
- [ ] For a pilot: you import rosters or they add players one at a time. Keep profiles private unless a parent actually opted in.
- [ ] Never load `seed-test-data.mjs` (`coach@example.com` / `password123`) into production.

---

## AGENT — code I can implement in this repo

I can write, test, and (when you ask) commit these. I cannot rotate Stripe keys or talk to a lawyer.

### Must-have before a public product (coaches run a season without you)

| ID | What | Why it blocks |
|----|------|----------------|
| C4 | Connect `TeamMember.userId` on onboarding claim | Player dashboard, profile edit, self-outreach, referrals are all dead |
| C5 | Link bulk roster import; add remove/edit/resend on the routed roster page | Coaches cannot upload a 60-player roster; import wizard is unreachable |
| H13 | UI that creates ContactInvite tokens | `/contribute/[token]` collector is built and unused |
| H7 | SMS invite and/or copyable onboarding link | Phone-only Hudl exports can never be onboarded |
| C6 | Accept `minContactsPerPlayer` on campaign create/update + wizard | Contact-quota accountability cannot be turned on |
| H5 | Delete or gate the legacy roster-import API | It bypasses attestation/provenance and auto-emails |
| H6 | In-place email change (do not delete-and-re-add) | Fundraising history orphans onto the soft-deleted row |
| H12 | Create Referral rows; pass `referralCode` through DonationForm | Share links track nothing |

### Must-have before live money (in addition to your Stripe/Sentry work)

| ID | What | Why it blocks |
|----|------|----------------|
| H3 | Gate disbursement on `payoutAccountVerified` / Connect status; show it on the dashboard | Teams discover unfinished KYC at payout after a full season |
| H16 | Short access JWT (~15 min) minted by refresh | Stolen session works 30 days; `/admin` middleware reads stale role |
| H17 | Shared rate-limit store (Redis) | Per-process limits reset on cold start and multiply per instance |
| H15 | Enforce guardian-approval threshold **or** remove it from help copy | Advertised control does not exist |
| H14 | Expire/rotate onboarding invitation tokens; one-time claim | Forwarded email is a permanent hijack of a minor’s record |
| M16 | Record dated ToS/privacy acceptance at signup and campaign create | You cannot prove what anyone agreed to |
| M13 | Approver ≠ requester on disbursements | A BANK_ADMIN who also leads a team can pay themselves |

### Should-have shortly after launch

| ID | What |
|----|------|
| H4 | Org legal name + EIN on Program; IRS-shaped receipts; W-9 during payout onboarding |
| H8 | Staff-only offline/cash/check donation entry (same ledger) |
| H9 | Scheduled/drip outreach via the existing cron; write open/click counters |
| H1 leftover / H11 | Paginate/aggregate analytics (unbounded donation rows on the dashboard) |
| M1 | coverFees equation on charged amount (~9¢/$100 under-recovery) |
| C2 rest | Age/DOB, verifiable parental consent, parent export/delete, first-party photos |
| C3 rest | School-domain or review queue beyond a staff timestamp; Connect onboard before ACTIVE |
| L16 | Remove `/test-donation` from production |
| L17 | Durable audit log for role and campaign-status changes (today: `console.log`) |

### Already done in Sprint 1 (reference)

C1 chargebacks · H1 partial refunds · H2 PENDING reconciler · H10 webhook fallback cover-fees/attribution · M4 unresolvable `teamMemberId` is 400 · C2 min (private default, noindex, status gates) · C3 min (org verify stamp).

---

## SHARED — you decide, then I build

Do not start these until you pick an option. Wrong default is expensive.

1. **Under-13s?** If no: I can add a hard “13+ only” attestation and keep profiles private. If yes: full COPPA path (consent, delete, retention) — you still need a lawyer.
2. **Who activates campaigns?** Staff-only (current min) vs school-domain email vs paid review queue.
3. **Payouts:** keep BANK_ADMIN as the only approver, or implement the advertised guardian threshold.
4. **Pilot vs public:** if you only want a closed test, I should **not** spend a week on referrals/prizes; I should do C4+C5+H13+H7 so a roster actually works.
5. **Commit `GO_LIVE.md`?** This file is new. Say if you want it on the branch.

---

## Suggested sequence

**This week (pilot, test Stripe):** you do Stage 0 rotation + Vercel test-mode deploy (`DEPLOYMENT.md` 0–3) + Resend DNS. I do C5 (import reachable) + H7 (copyable invite) so you can stand up one real roster by hand.

**Before public signup:** I do C4, H13, C6, H5, H6. You write real terms/privacy and a support mailbox.

**Before live keys:** I do H3, H16, H17, H15, H14, M16, M13, remove `/test-donation`. You do Sentry, uptime, Radar, a test dispute, then Stage 6.

Until C4/C5/H13 exist, a “shipped” site is a donation page plus an admin, not a group fundraising product.
