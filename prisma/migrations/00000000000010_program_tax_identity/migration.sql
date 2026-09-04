-- H4: legal/tax identity on Program for IRS-shaped donation receipts.
ALTER TABLE "Program" ADD COLUMN IF NOT EXISTS "legalName" TEXT;
ALTER TABLE "Program" ADD COLUMN IF NOT EXISTS "ein" TEXT;
ALTER TABLE "Program" ADD COLUMN IF NOT EXISTS "isTaxExempt" BOOLEAN NOT NULL DEFAULT false;
