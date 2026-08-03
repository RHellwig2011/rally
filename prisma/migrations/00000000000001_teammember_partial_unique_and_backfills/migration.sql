-- TeamMember: soft-delete-aware email uniqueness + collapse duplicate phone columns
--
-- 1. The unconditional unique index on (campaignId, email) was not aware of soft
--    deletes. Every application query filters `deletedAt IS NULL`, so a removed
--    player's row stayed invisible to the app while still occupying the unique
--    slot. Re-adding that player raised P2002 with no recovery path anywhere in
--    the codebase, permanently burning the address. Replaced with a partial
--    unique index covering only live rows; the routes now revive the
--    soft-deleted row instead of inserting a second one, which also keeps the
--    player's historical `amountRaised` attached to them.
--
-- 2. TeamMember carried both `phone` and `phoneNumber`. Player onboarding wrote
--    `phone`; every staff-facing read and write used `phoneNumber`, so a phone
--    number a player typed in was stored and never shown to their coach.
--    `phoneNumber` is now canonical and onboarding writes there. This backfills
--    any value that only ever landed in `phone`.
--
--    `phone` is intentionally NOT dropped yet: app/api/programs/[programId]/alumni/route.ts
--    and lib/alumni.ts still select/read it (both already fall back to
--    phoneNumber). Drop it in a follow-up once those two readers are updated:
--      ALTER TABLE "TeamMember" DROP COLUMN phone;

BEGIN;

-- Collapse any live duplicate emails before the partial index is built, so the
-- CREATE cannot fail on pre-existing data. Keeps the earliest row.
UPDATE "TeamMember" t
SET "deletedAt" = NOW()
WHERE t."deletedAt" IS NULL
  AND t.email IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "TeamMember" o
    WHERE o."deletedAt" IS NULL
      AND o.email IS NOT NULL
      AND o."campaignId" = t."campaignId"
      AND lower(o.email) = lower(t.email)
      AND (o."createdAt", o.id) < (t."createdAt", t.id)
  );

DROP INDEX IF EXISTS "TeamMember_campaignId_email_key";

CREATE UNIQUE INDEX IF NOT EXISTS "TeamMember_campaignId_email_live_key"
  ON "TeamMember" ("campaignId", email)
  WHERE "deletedAt" IS NULL;

UPDATE "TeamMember"
SET "phoneNumber" = COALESCE("phoneNumber", phone)
WHERE phone IS NOT NULL;

-- Players who finished onboarding before acceptance was recorded: their
-- invitation status and joinedAt were never written, so the "accepted" roster
-- filter could not return them and resend-invite would re-email them.
UPDATE "TeamMember"
SET "joinedAt" = COALESCE("joinedAt", "onboardingCompletedAt"),
    "invitationStatus" = 'ACCEPTED'
WHERE "onboardingCompletedAt" IS NOT NULL
  AND ("joinedAt" IS NULL OR "invitationStatus" <> 'ACCEPTED');

COMMIT;
