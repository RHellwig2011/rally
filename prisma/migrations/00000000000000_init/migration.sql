-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('DONOR', 'PLAYER', 'TEAM_MEMBER', 'CAMPAIGN_LEADER', 'GUARDIAN', 'ADMIN', 'BANK_ADMIN');

-- CreateEnum
CREATE TYPE "KYCStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CampaignCategory" AS ENUM ('SPORTS', 'ARTS', 'EDUCATION', 'COMMUNITY', 'OTHER');

-- CreateEnum
CREATE TYPE "PayoutAccountType" AS ENUM ('BANK_ACCOUNT', 'DEBIT_CARD');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'DISBURSEMENT', 'FEE_COLLECTION', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "DonationStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'ACH', 'WALLET');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'SIMULATED');

-- CreateEnum
CREATE TYPE "DisbursementStatus" AS ENUM ('PENDING', 'APPROVED', 'PROCESSING', 'REJECTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UpdateStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('BADGE', 'POINTS', 'PRIZE');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EMAIL_FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ContactSource" AS ENUM ('MANUAL_IMPORT', 'CSV_UPLOAD', 'ROSTER_INVITE', 'DONATION');

-- CreateEnum
CREATE TYPE "OutreachType" AS ENUM ('EMAIL', 'SMS', 'BOTH');

-- CreateEnum
CREATE TYPE "OutreachStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'OPENED', 'CLICKED');

-- CreateEnum
CREATE TYPE "RosterImportSource" AS ENUM ('HUDL_CSV', 'GENERIC_CSV', 'MANUAL_PASTE');

-- CreateEnum
CREATE TYPE "ContactInviteRole" AS ENUM ('PLAYER', 'GUARDIAN');

-- CreateEnum
CREATE TYPE "OptOutChannel" AS ENUM ('EMAIL', 'SMS', 'ALL');

-- CreateEnum
CREATE TYPE "OptOutSource" AS ENUM ('UNSUBSCRIBE_LINK', 'SMS_STOP', 'MANUAL', 'BOUNCE', 'COMPLAINT');

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "platformFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "minDonationAmountCents" BIGINT NOT NULL DEFAULT 100,
    "maxDonationAmountCents" BIGINT NOT NULL DEFAULT 1000000,
    "suggestedAmountsCents" BIGINT[] DEFAULT ARRAY[2500, 5000, 10000, 25000]::BIGINT[],
    "maxFileUploadSizeMb" INTEGER NOT NULL DEFAULT 5,
    "termsOfServiceUrl" TEXT NOT NULL DEFAULT '',
    "privacyPolicyUrl" TEXT NOT NULL DEFAULT '',
    "supportEmail" TEXT NOT NULL DEFAULT 'support@rallyfundraising.com',
    "enableEmailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "enableSmsNotifications" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'DONOR',
    "passwordHash" TEXT NOT NULL,
    "verificationToken" TEXT,
    "verificationTokenExpiry" TIMESTAMP(3),
    "passwordResetToken" TEXT,
    "passwordResetTokenExpiry" TIMESTAMP(3),
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "kycStatus" "KYCStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "replacedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdByIp" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedByIp" TEXT,
    "reason" TEXT,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "sport" TEXT,
    "slug" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "programId" TEXT,
    "seasonYear" INTEGER,
    "minContactsPerPlayer" INTEGER NOT NULL DEFAULT 0,
    "organizationName" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "goalAmount" BIGINT NOT NULL,
    "currentAmount" BIGINT NOT NULL DEFAULT 0,
    "platformFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "logoUrl" TEXT,
    "bannerImageUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#6366F1',
    "secondaryColor" TEXT NOT NULL DEFAULT '#F59E0B',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "category" "CampaignCategory" NOT NULL DEFAULT 'OTHER',
    "primaryLeaderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clonedFromId" TEXT,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledStatusChange" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "scheduledStatus" "CampaignStatus" NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdById" TEXT NOT NULL,
    "executed" BOOLEAN NOT NULL DEFAULT false,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "CampaignCategory" NOT NULL DEFAULT 'OTHER',
    "goalAmount" BIGINT,
    "platformFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "durationDays" INTEGER,
    "logoUrl" TEXT,
    "bannerImageUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#6366F1',
    "secondaryColor" TEXT NOT NULL DEFAULT '#F59E0B',
    "descriptionTemplate" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankingAccount" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "totalRaised" BIGINT NOT NULL DEFAULT 0,
    "platformFeesCollected" BIGINT NOT NULL DEFAULT 0,
    "availableBalance" BIGINT NOT NULL DEFAULT 0,
    "disbursedTotal" BIGINT NOT NULL DEFAULT 0,
    "pendingDisbursement" BIGINT NOT NULL DEFAULT 0,
    "payoutAccountType" "PayoutAccountType",
    "payoutAccountLast4" TEXT,
    "payoutAccountVerified" BOOLEAN NOT NULL DEFAULT false,
    "stripeConnectAccountId" TEXT,
    "dailyDisbursementLimit" BIGINT,
    "requiresGuardianApproval" BOOLEAN NOT NULL DEFAULT true,
    "approvalThreshold" BIGINT NOT NULL DEFAULT 50000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "bankingAccountId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" BIGINT NOT NULL,
    "balanceAfter" BIGINT NOT NULL,
    "donationId" TEXT,
    "disbursementId" TEXT,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "donorId" TEXT,
    "teamMemberId" TEXT,
    "grossAmount" BIGINT NOT NULL,
    "platformFee" BIGINT NOT NULL,
    "netAmount" BIGINT NOT NULL,
    "processingFee" BIGINT NOT NULL,
    "donorEmail" TEXT NOT NULL,
    "donorName" TEXT,
    "donorMessage" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "paymentProvider" "PaymentProvider" NOT NULL DEFAULT 'SIMULATED',
    "paymentIntentId" TEXT,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CARD',
    "paymentMethodLast4" TEXT,
    "referredByUserId" TEXT,
    "referralCode" TEXT,
    "utmSource" TEXT,
    "status" "DonationStatus" NOT NULL DEFAULT 'PENDING',
    "taxReceiptUrl" TEXT,
    "taxReceiptSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisbursementRequest" (
    "id" TEXT NOT NULL,
    "bankingAccountId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "requestedAmount" BIGINT NOT NULL,
    "purpose" TEXT NOT NULL,
    "description" TEXT,
    "receiptsUrls" TEXT[],
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "DisbursementStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "disbursementDate" TIMESTAMP(3),
    "payoutTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisbursementRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignUpdate" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrls" TEXT[],
    "notifyDonors" BOOLEAN NOT NULL DEFAULT true,
    "sentToEmails" INTEGER NOT NULL DEFAULT 0,
    "sentToSms" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "status" "UpdateStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheerWallMessage" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "donationId" TEXT,
    "authorName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "isApproved" BOOLEAN NOT NULL DEFAULT true,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheerWallMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "donationCount" INTEGER NOT NULL DEFAULT 0,
    "totalRaised" BIGINT NOT NULL DEFAULT 0,
    "rewardType" "RewardType",
    "rewardValue" BIGINT,
    "rewardUnlockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "phoneNumber" TEXT,
    "personalGoal" BIGINT,
    "amountRaised" BIGINT NOT NULL DEFAULT 0,
    "profilePhotoUrl" TEXT,
    "profileVideoUrl" TEXT,
    "personalStory" TEXT,
    "position" TEXT,
    "grade" TEXT,
    "graduationYear" INTEGER,
    "jerseyNumber" TEXT,
    "favoriteQuote" TEXT,
    "parentFirstName" TEXT,
    "parentLastName" TEXT,
    "parentEmail" TEXT,
    "parentPhone" TEXT,
    "secondParentFirstName" TEXT,
    "secondParentLastName" TEXT,
    "secondParentEmail" TEXT,
    "secondParentPhone" TEXT,
    "invitationToken" TEXT,
    "invitationStatus" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitationSentAt" TIMESTAMP(3),
    "onboardingCompletedAt" TIMESTAMP(3),
    "fundLinkCode" TEXT,
    "joinedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "isProfilePublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "source" "ContactSource" NOT NULL DEFAULT 'MANUAL_IMPORT',
    "notes" TEXT,
    "consentAttestedAt" TIMESTAMP(3),
    "consentSource" TEXT,
    "consentAttestedById" TEXT,
    "tags" TEXT[],
    "emailsSent" INTEGER NOT NULL DEFAULT 0,
    "smsSent" INTEGER NOT NULL DEFAULT 0,
    "lastContactedAt" TIMESTAMP(3),
    "donated" BOOLEAN NOT NULL DEFAULT false,
    "donationAmount" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachCampaign" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OutreachType" NOT NULL,
    "status" "OutreachStatus" NOT NULL DEFAULT 'DRAFT',
    "emailSubject" TEXT,
    "emailBody" TEXT,
    "smsBody" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "emailsSent" INTEGER NOT NULL DEFAULT 0,
    "smsSent" INTEGER NOT NULL DEFAULT 0,
    "emailsOpened" INTEGER NOT NULL DEFAULT 0,
    "linksClicked" INTEGER NOT NULL DEFAULT 0,
    "donationsReceived" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachLog" (
    "id" TEXT NOT NULL,
    "outreachCampaignId" TEXT NOT NULL,
    "contactId" TEXT,
    "type" "OutreachType" NOT NULL,
    "recipientEmail" TEXT,
    "recipientPhone" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "emailProvider" TEXT,
    "smsProvider" TEXT,
    "providerMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterImport" (
    "id" TEXT NOT NULL,
    "programId" TEXT,
    "campaignId" TEXT NOT NULL,
    "source" "RosterImportSource" NOT NULL DEFAULT 'GENERIC_CSV',
    "seasonYear" INTEGER,
    "fileName" TEXT,
    "columnMapping" JSONB,
    "rowsTotal" INTEGER NOT NULL DEFAULT 0,
    "rowsImported" INTEGER NOT NULL DEFAULT 0,
    "rowsSkipped" INTEGER NOT NULL DEFAULT 0,
    "rowsFailed" INTEGER NOT NULL DEFAULT 0,
    "importedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RosterImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactInvite" (
    "id" TEXT NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" "ContactInviteRole" NOT NULL DEFAULT 'PLAYER',
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactOptOut" (
    "id" TEXT NOT NULL,
    "programId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "channel" "OptOutChannel" NOT NULL DEFAULT 'ALL',
    "source" "OptOutSource" NOT NULL DEFAULT 'UNSUBSCRIBE_LINK',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactOptOut_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_Guardians" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Program_slug_key" ON "Program"("slug");

-- CreateIndex
CREATE INDEX "Program_createdById_idx" ON "Program"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Program_organizationName_teamName_key" ON "Program"("organizationName", "teamName");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_slug_key" ON "Campaign"("slug");

-- CreateIndex
CREATE INDEX "Campaign_slug_idx" ON "Campaign"("slug");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE INDEX "Campaign_primaryLeaderId_idx" ON "Campaign"("primaryLeaderId");

-- CreateIndex
CREATE INDEX "Campaign_clonedFromId_idx" ON "Campaign"("clonedFromId");

-- CreateIndex
CREATE INDEX "ScheduledStatusChange_campaignId_idx" ON "ScheduledStatusChange"("campaignId");

-- CreateIndex
CREATE INDEX "ScheduledStatusChange_scheduledFor_idx" ON "ScheduledStatusChange"("scheduledFor");

-- CreateIndex
CREATE INDEX "ScheduledStatusChange_executed_idx" ON "ScheduledStatusChange"("executed");

-- CreateIndex
CREATE INDEX "CampaignTemplate_createdById_idx" ON "CampaignTemplate"("createdById");

-- CreateIndex
CREATE INDEX "CampaignTemplate_isPublic_idx" ON "CampaignTemplate"("isPublic");

-- CreateIndex
CREATE INDEX "CampaignTemplate_category_idx" ON "CampaignTemplate"("category");

-- CreateIndex
CREATE UNIQUE INDEX "BankingAccount_campaignId_key" ON "BankingAccount"("campaignId");

-- CreateIndex
CREATE INDEX "BankingAccount_campaignId_idx" ON "BankingAccount"("campaignId");

-- CreateIndex
CREATE INDEX "Transaction_bankingAccountId_idx" ON "Transaction"("bankingAccountId");

-- CreateIndex
CREATE INDEX "Transaction_donationId_idx" ON "Transaction"("donationId");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");

-- CreateIndex
CREATE INDEX "Donation_campaignId_idx" ON "Donation"("campaignId");

-- CreateIndex
CREATE INDEX "Donation_donorId_idx" ON "Donation"("donorId");

-- CreateIndex
CREATE INDEX "Donation_teamMemberId_idx" ON "Donation"("teamMemberId");

-- CreateIndex
CREATE INDEX "Donation_status_idx" ON "Donation"("status");

-- CreateIndex
CREATE INDEX "Donation_createdAt_idx" ON "Donation"("createdAt");

-- CreateIndex
CREATE INDEX "DisbursementRequest_bankingAccountId_idx" ON "DisbursementRequest"("bankingAccountId");

-- CreateIndex
CREATE INDEX "DisbursementRequest_status_idx" ON "DisbursementRequest"("status");

-- CreateIndex
CREATE INDEX "DisbursementRequest_requestedBy_idx" ON "DisbursementRequest"("requestedBy");

-- CreateIndex
CREATE INDEX "CampaignUpdate_campaignId_idx" ON "CampaignUpdate"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignUpdate_status_idx" ON "CampaignUpdate"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CheerWallMessage_donationId_key" ON "CheerWallMessage"("donationId");

-- CreateIndex
CREATE INDEX "CheerWallMessage_campaignId_idx" ON "CheerWallMessage"("campaignId");

-- CreateIndex
CREATE INDEX "CheerWallMessage_createdAt_idx" ON "CheerWallMessage"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referralCode_key" ON "Referral"("referralCode");

-- CreateIndex
CREATE INDEX "Referral_campaignId_idx" ON "Referral"("campaignId");

-- CreateIndex
CREATE INDEX "Referral_referrerId_idx" ON "Referral"("referrerId");

-- CreateIndex
CREATE INDEX "Referral_referralCode_idx" ON "Referral"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_invitationToken_key" ON "TeamMember"("invitationToken");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_fundLinkCode_key" ON "TeamMember"("fundLinkCode");

-- CreateIndex
CREATE INDEX "TeamMember_campaignId_idx" ON "TeamMember"("campaignId");

-- CreateIndex
CREATE INDEX "TeamMember_invitationToken_idx" ON "TeamMember"("invitationToken");

-- CreateIndex
CREATE INDEX "TeamMember_fundLinkCode_idx" ON "TeamMember"("fundLinkCode");

-- CreateIndex
CREATE INDEX "Contact_teamMemberId_idx" ON "Contact"("teamMemberId");

-- CreateIndex
CREATE INDEX "Contact_email_idx" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "Contact_phone_idx" ON "Contact"("phone");

-- CreateIndex
CREATE INDEX "OutreachCampaign_campaignId_idx" ON "OutreachCampaign"("campaignId");

-- CreateIndex
CREATE INDEX "OutreachCampaign_status_idx" ON "OutreachCampaign"("status");

-- CreateIndex
CREATE INDEX "OutreachLog_outreachCampaignId_idx" ON "OutreachLog"("outreachCampaignId");

-- CreateIndex
CREATE INDEX "OutreachLog_contactId_idx" ON "OutreachLog"("contactId");

-- CreateIndex
CREATE INDEX "OutreachLog_status_idx" ON "OutreachLog"("status");

-- CreateIndex
CREATE INDEX "RosterImport_campaignId_idx" ON "RosterImport"("campaignId");

-- CreateIndex
CREATE INDEX "RosterImport_programId_idx" ON "RosterImport"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactInvite_token_key" ON "ContactInvite"("token");

-- CreateIndex
CREATE INDEX "ContactInvite_teamMemberId_idx" ON "ContactInvite"("teamMemberId");

-- CreateIndex
CREATE INDEX "ContactInvite_token_idx" ON "ContactInvite"("token");

-- CreateIndex
CREATE INDEX "ContactOptOut_email_idx" ON "ContactOptOut"("email");

-- CreateIndex
CREATE INDEX "ContactOptOut_phone_idx" ON "ContactOptOut"("phone");

-- CreateIndex
CREATE INDEX "ContactOptOut_programId_idx" ON "ContactOptOut"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "_Guardians_AB_unique" ON "_Guardians"("A", "B");

-- CreateIndex
CREATE INDEX "_Guardians_B_index" ON "_Guardians"("B");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "RefreshToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_primaryLeaderId_fkey" FOREIGN KEY ("primaryLeaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_clonedFromId_fkey" FOREIGN KEY ("clonedFromId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledStatusChange" ADD CONSTRAINT "ScheduledStatusChange_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledStatusChange" ADD CONSTRAINT "ScheduledStatusChange_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignTemplate" ADD CONSTRAINT "CampaignTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankingAccount" ADD CONSTRAINT "BankingAccount_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_bankingAccountId_fkey" FOREIGN KEY ("bankingAccountId") REFERENCES "BankingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_disbursementId_fkey" FOREIGN KEY ("disbursementId") REFERENCES "DisbursementRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisbursementRequest" ADD CONSTRAINT "DisbursementRequest_bankingAccountId_fkey" FOREIGN KEY ("bankingAccountId") REFERENCES "BankingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisbursementRequest" ADD CONSTRAINT "DisbursementRequest_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisbursementRequest" ADD CONSTRAINT "DisbursementRequest_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignUpdate" ADD CONSTRAINT "CampaignUpdate_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignUpdate" ADD CONSTRAINT "CampaignUpdate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheerWallMessage" ADD CONSTRAINT "CheerWallMessage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheerWallMessage" ADD CONSTRAINT "CheerWallMessage_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachCampaign" ADD CONSTRAINT "OutreachCampaign_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachCampaign" ADD CONSTRAINT "OutreachCampaign_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachLog" ADD CONSTRAINT "OutreachLog_outreachCampaignId_fkey" FOREIGN KEY ("outreachCampaignId") REFERENCES "OutreachCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachLog" ADD CONSTRAINT "OutreachLog_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterImport" ADD CONSTRAINT "RosterImport_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterImport" ADD CONSTRAINT "RosterImport_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterImport" ADD CONSTRAINT "RosterImport_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactInvite" ADD CONSTRAINT "ContactInvite_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactOptOut" ADD CONSTRAINT "ContactOptOut_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Guardians" ADD CONSTRAINT "_Guardians_A_fkey" FOREIGN KEY ("A") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Guardians" ADD CONSTRAINT "_Guardians_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

