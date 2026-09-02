-- Donation: one donation per Stripe payment intent.
--
-- `payment_intent.succeeded` is redelivered by Stripe, and the webhook's
-- fallback path (lib/banking.ts processDonation) used to guard only with a
-- find-then-create inside a ReadCommitted transaction. That is a TOCTOU check,
-- not an exclusion: two concurrent deliveries could both miss the read and both
-- insert a COMPLETED donation, crediting Campaign.currentAmount,
-- BankingAccount.totalRaised/availableBalance and the ledger twice. This index
-- is what actually makes it exactly-once; the application catches P2002 and
-- returns the donation that won.
--
-- Partial (`WHERE "paymentIntentId" IS NOT NULL`) rather than a plain unique
-- index. Postgres already treats NULLs as distinct, so the two behave
-- identically for this column, but the partial form keeps the index off the
-- large population of SIMULATED/legacy donations that have no payment intent.
--
-- NOT built CONCURRENTLY: `prisma migrate` runs each migration inside a
-- transaction and CREATE INDEX CONCURRENTLY cannot run in one. On a large
-- Donation table, build it by hand out-of-band instead and let this statement
-- become a no-op:
--   CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "Donation_paymentIntentId_key"
--     ON "Donation"("paymentIntentId") WHERE "paymentIntentId" IS NOT NULL;
--
-- The index name matches what Prisma generates for `@unique` so the schema and
-- the database agree.

BEGIN;

-- Collapse any pre-existing duplicates before the unique index is built, so the
-- CREATE cannot fail on historical double-credited rows. Keeps the earliest
-- donation per payment intent and detaches the payment intent from the rest —
-- their amounts are left alone, because reversing credits blindly would be
-- worse than a reconcilable orphan. Anything this touches needs a manual
-- ledger review (search for donations with a NULL paymentIntentId and a
-- DEPOSIT Transaction row).
UPDATE "Donation" d
SET "paymentIntentId" = NULL
WHERE d."paymentIntentId" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "Donation" other
    WHERE other."paymentIntentId" = d."paymentIntentId"
      AND (
        other."createdAt" < d."createdAt"
        OR (other."createdAt" = d."createdAt" AND other.id < d.id)
      )
  );

CREATE UNIQUE INDEX IF NOT EXISTS "Donation_paymentIntentId_key"
  ON "Donation"("paymentIntentId")
  WHERE "paymentIntentId" IS NOT NULL;

COMMIT;
