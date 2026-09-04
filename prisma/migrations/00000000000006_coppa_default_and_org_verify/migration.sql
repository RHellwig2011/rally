-- C2: new TeamMember rows are private until explicitly opted in.
ALTER TABLE "TeamMember" ALTER COLUMN "isProfilePublic" SET DEFAULT false;

-- C3: staff verification before a leader can take a campaign live.
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "organizationVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "organizationVerifiedById" TEXT;
