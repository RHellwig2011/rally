-- Cumulative gross cents reversed by Stripe refunds. Partial refunds stay
-- COMPLETED until refundedAmount reaches grossAmount.

ALTER TABLE "Donation" ADD COLUMN IF NOT EXISTS "refundedAmount" BIGINT NOT NULL DEFAULT 0;
