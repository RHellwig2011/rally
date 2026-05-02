-- Add scheduled status changes table
-- This allows users to schedule status changes in advance

CREATE TABLE "ScheduledStatusChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "scheduledStatus" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdById" TEXT NOT NULL,
    "executed" BOOLEAN NOT NULL DEFAULT false,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledStatusChange_campaignId_fkey"
        FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduledStatusChange_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ScheduledStatusChange_campaignId_idx" ON "ScheduledStatusChange"("campaignId");
CREATE INDEX "ScheduledStatusChange_scheduledFor_idx" ON "ScheduledStatusChange"("scheduledFor");
CREATE INDEX "ScheduledStatusChange_executed_idx" ON "ScheduledStatusChange"("executed");
