-- Moving stretch goals + assistant coach invites.
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "autoStretchGoal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "stretchGoalPercent" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "stretchGoalTriggerPercent" INTEGER NOT NULL DEFAULT 90;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "originalGoalAmount" BIGINT;

CREATE TABLE IF NOT EXISTS "CoachInvite" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CoachInvite_token_key" ON "CoachInvite"("token");
CREATE INDEX IF NOT EXISTS "CoachInvite_campaignId_idx" ON "CoachInvite"("campaignId");
CREATE INDEX IF NOT EXISTS "CoachInvite_email_idx" ON "CoachInvite"("email");
CREATE INDEX IF NOT EXISTS "CoachInvite_invitedById_idx" ON "CoachInvite"("invitedById");

DO $$ BEGIN
  ALTER TABLE "CoachInvite"
    ADD CONSTRAINT "CoachInvite_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CoachInvite"
    ADD CONSTRAINT "CoachInvite_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
