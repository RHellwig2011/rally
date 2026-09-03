-- Chargebacks: a Donation can be DISPUTED, a ledger row can be CHARGEBACK,
-- and we persist Stripe's dispute id + fee so webhook redeliveries are
-- exactly-once.

ALTER TYPE "DonationStatus" ADD VALUE IF NOT EXISTS 'DISPUTED';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'CHARGEBACK';

ALTER TABLE "Donation" ADD COLUMN IF NOT EXISTS "disputeId" TEXT;
ALTER TABLE "Donation" ADD COLUMN IF NOT EXISTS "disputedAt" TIMESTAMP(3);
ALTER TABLE "Donation" ADD COLUMN IF NOT EXISTS "disputeFee" BIGINT NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "Donation_disputeId_key" ON "Donation"("disputeId");
