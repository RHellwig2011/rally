-- H14: onboarding invitation tokens expire (14-day TTL stamped by the app on
-- create/resend, see lib/onboarding.ts) and are cleared on successful claim.
ALTER TABLE "TeamMember" ADD COLUMN IF NOT EXISTS "invitationTokenExpiresAt" TIMESTAMP(3);

-- Backfill rows that were invited before expiry tracking existed so their
-- links live out the same 14 days from when the invite was actually sent
-- (or from row creation if no invite was ever sent). Rows whose backfilled
-- expiry is already in the past are treated as expired by the app and need
-- a resend, which rotates the token and stamps a fresh expiry.
UPDATE "TeamMember"
SET "invitationTokenExpiresAt" = COALESCE("invitationSentAt", "createdAt") + INTERVAL '14 days'
WHERE "invitationToken" IS NOT NULL
  AND "invitationTokenExpiresAt" IS NULL;
