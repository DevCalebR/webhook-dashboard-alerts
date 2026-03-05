-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."MatchType" AS ENUM ('exact', 'prefix', 'contains');

-- CreateEnum
CREATE TYPE "public"."ActionType" AS ENUM ('db_only');

-- CreateEnum
CREATE TYPE "public"."AlertRunStatus" AS ENUM ('fired', 'skipped_cooldown', 'disabled', 'no_match');

-- CreateTable
CREATE TABLE "public"."UserProfile" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Event" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "externalId" TEXT,
    "payload" JSONB NOT NULL,
    "rawBodyHash" TEXT NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AlertRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL,
    "matchType" "public"."MatchType" NOT NULL,
    "matchValue" TEXT NOT NULL,
    "actionType" "public"."ActionType" NOT NULL DEFAULT 'db_only',
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 0,
    "lastFiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AlertRun" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "firedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "public"."AlertRunStatus" NOT NULL,
    "note" TEXT NOT NULL,

    CONSTRAINT "AlertRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_clerkUserId_key" ON "public"."UserProfile"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_email_key" ON "public"."UserProfile"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Event_dedupeKey_key" ON "public"."Event"("dedupeKey");

-- CreateIndex
CREATE INDEX "Event_source_receivedAt_idx" ON "public"."Event"("source", "receivedAt" DESC);

-- CreateIndex
CREATE INDEX "Event_type_idx" ON "public"."Event"("type");

-- CreateIndex
CREATE INDEX "Event_externalId_idx" ON "public"."Event"("externalId");

-- CreateIndex
CREATE INDEX "Event_signatureValid_receivedAt_idx" ON "public"."Event"("signatureValid", "receivedAt" DESC);

-- CreateIndex
CREATE INDEX "AlertRule_enabled_source_idx" ON "public"."AlertRule"("enabled", "source");

-- CreateIndex
CREATE INDEX "AlertRun_ruleId_firedAt_idx" ON "public"."AlertRun"("ruleId", "firedAt" DESC);

-- CreateIndex
CREATE INDEX "AlertRun_eventId_idx" ON "public"."AlertRun"("eventId");

-- AddForeignKey
ALTER TABLE "public"."AlertRun" ADD CONSTRAINT "AlertRun_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "public"."AlertRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AlertRun" ADD CONSTRAINT "AlertRun_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
