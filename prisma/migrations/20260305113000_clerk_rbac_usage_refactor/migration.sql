-- Phase 2 hardening migration: Clerk identity, RBAC normalization, usage events.

-- Normalize role values before enum reduction.
UPDATE "Membership"
SET "role" = 'MEMBER'
WHERE "role" = 'VIEWER';

UPDATE "AuditLog"
SET "actorRole" = 'MEMBER'
WHERE "actorRole" = 'VIEWER';

-- Add Clerk identity + org preference to User.
ALTER TABLE "User"
ADD COLUMN "clerkUserId" TEXT,
ADD COLUMN "lastActiveOrgId" TEXT;

UPDATE "User"
SET "clerkUserId" = CONCAT('legacy_', "id")
WHERE "clerkUserId" IS NULL;

ALTER TABLE "User"
ALTER COLUMN "clerkUserId" SET NOT NULL;

CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");
CREATE INDEX "User_lastActiveOrgId_idx" ON "User"("lastActiveOrgId");

-- Drop legacy local-auth columns no longer needed with Clerk.
ALTER TABLE "User"
DROP COLUMN IF EXISTS "passwordHash",
DROP COLUMN IF EXISTS "isActive";

-- Remove Session model (Clerk-backed sessions are external).
DROP TABLE IF EXISTS "Session";

-- Rename Membership tenant column to orgId.
ALTER TABLE "Membership" DROP CONSTRAINT IF EXISTS "Membership_organizationId_fkey";
ALTER TABLE "Membership" RENAME COLUMN "organizationId" TO "orgId";
DROP INDEX IF EXISTS "Membership_userId_organizationId_key";
CREATE UNIQUE INDEX "Membership_orgId_userId_key" ON "Membership"("orgId", "userId");
CREATE INDEX "Membership_orgId_role_idx" ON "Membership"("orgId", "role");
ALTER TABLE "Membership"
ADD CONSTRAINT "Membership_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rename Invite columns and keep secure token as unique opaque value.
ALTER TABLE "Invite" DROP CONSTRAINT IF EXISTS "Invite_organizationId_fkey";
ALTER TABLE "Invite" RENAME COLUMN "organizationId" TO "orgId";
ALTER TABLE "Invite" RENAME COLUMN "tokenHash" TO "token";
DROP INDEX IF EXISTS "Invite_tokenHash_key";
CREATE UNIQUE INDEX "Invite_token_key" ON "Invite"("token");
CREATE INDEX "Invite_orgId_idx" ON "Invite"("orgId");
CREATE INDEX "Invite_email_idx" ON "Invite"("email");
CREATE INDEX "Invite_orgId_status_idx" ON "Invite"("orgId", "status");
CREATE INDEX "Invite_orgId_email_status_idx" ON "Invite"("orgId", "email", "status");
ALTER TABLE "Invite"
ADD CONSTRAINT "Invite_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reduce OrganizationRole enum to OWNER/ADMIN/MEMBER.
CREATE TYPE "OrganizationRole_new" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

ALTER TABLE "Membership"
ALTER COLUMN "role" TYPE "OrganizationRole_new"
USING ("role"::text::"OrganizationRole_new");

ALTER TABLE "Invite"
ALTER COLUMN "role" TYPE "OrganizationRole_new"
USING ("role"::text::"OrganizationRole_new");

ALTER TABLE "AuditLog"
ALTER COLUMN "actorRole" TYPE "OrganizationRole_new"
USING ("actorRole"::text::"OrganizationRole_new");

ALTER TYPE "OrganizationRole" RENAME TO "OrganizationRole_old";
ALTER TYPE "OrganizationRole_new" RENAME TO "OrganizationRole";
DROP TYPE "OrganizationRole_old";

-- Add user last-active-org relation.
ALTER TABLE "User"
ADD CONSTRAINT "User_lastActiveOrgId_fkey"
FOREIGN KEY ("lastActiveOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Audit log schema normalization.
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_actorUserId_fkey";
ALTER TABLE "AuditLog" RENAME COLUMN "actorUserId" TO "userId";
ALTER TABLE "AuditLog" RENAME COLUMN "entityType" TO "resourceType";
ALTER TABLE "AuditLog" RENAME COLUMN "entityId" TO "resourceId";
ALTER TABLE "AuditLog" RENAME COLUMN "meta" TO "metadata";
ALTER TABLE "AuditLog"
ADD COLUMN "ipAddress" TEXT,
ADD COLUMN "userAgent" TEXT,
ADD COLUMN "requestId" TEXT;
ALTER TABLE "AuditLog"
ADD CONSTRAINT "AuditLog_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "AuditLog_entityType_entityId_idx";
DROP INDEX IF EXISTS "AuditLog_orgId_entityType_entityId_idx";
CREATE INDEX "AuditLog_orgId_action_createdAt_idx" ON "AuditLog"("orgId", "action", "createdAt");
CREATE INDEX "AuditLog_orgId_resourceType_resourceId_idx" ON "AuditLog"("orgId", "resourceType", "resourceId");

-- Usage transitions from daily aggregate rows to per-request usage events.
ALTER TABLE "Usage"
ADD COLUMN "userId" TEXT,
ADD COLUMN "model" TEXT,
ADD COLUMN "costUsd" DECIMAL(12,6),
ADD COLUMN "requestId" TEXT,
ADD COLUMN "templateName" TEXT,
ADD COLUMN "createdAt" TIMESTAMP(3);

-- Backfill usage rows with neutral defaults for historical aggregated data.
WITH owner_candidates AS (
  SELECT m."orgId", m."userId"
  FROM "Membership" m
  WHERE m."role" = 'OWNER'
),
fallback_members AS (
  SELECT DISTINCT ON (m."orgId") m."orgId", m."userId"
  FROM "Membership" m
  ORDER BY m."orgId", m."createdAt" ASC
)
UPDATE "Usage" u
SET "userId" = COALESCE(oc."userId", fm."userId"),
    "model" = COALESCE(u."model", 'unknown'),
    "createdAt" = COALESCE(u."createdAt", u."date")
FROM fallback_members fm
LEFT JOIN owner_candidates oc ON oc."orgId" = u."orgId"
WHERE fm."orgId" = u."orgId"
  AND u."userId" IS NULL;

ALTER TABLE "Usage"
ALTER COLUMN "userId" SET NOT NULL,
ALTER COLUMN "model" SET NOT NULL,
ALTER COLUMN "createdAt" SET NOT NULL;

ALTER TABLE "Usage"
ADD CONSTRAINT "Usage_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Usage_orgId_date_idx";
DROP INDEX IF EXISTS "Usage_orgId_date_key";
DROP INDEX IF EXISTS "Usage_date_idx";
CREATE INDEX "Usage_orgId_createdAt_idx" ON "Usage"("orgId", "createdAt");
CREATE INDEX "Usage_orgId_userId_createdAt_idx" ON "Usage"("orgId", "userId", "createdAt");
CREATE INDEX "Usage_requestId_idx" ON "Usage"("requestId");

ALTER TABLE "Usage"
DROP COLUMN IF EXISTS "date",
DROP COLUMN IF EXISTS "optimizeCount";
