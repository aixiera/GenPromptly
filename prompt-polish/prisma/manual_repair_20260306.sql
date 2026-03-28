-- Manual repair for partially applied Phase 2 migrations.
-- Safe to run once on the affected database.

-- Ensure every existing project orgId has an Organization row before adding FK constraints.
INSERT INTO "Organization" ("id", "name", "slug", "createdAt", "updatedAt")
SELECT
  src."orgId",
  CONCAT('Legacy Organization ', src."orgId"),
  CONCAT('legacy-', SUBSTRING(MD5(src."orgId") FOR 12)),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "orgId"
  FROM "Project"
  WHERE "orgId" IS NOT NULL
) AS src
LEFT JOIN "Organization" org ON org."id" = src."orgId"
WHERE org."id" IS NULL;

-- Finish enum reduction from OrganizationRole(OWNER,ADMIN,MEMBER,VIEWER) to OWNER,ADMIN,MEMBER.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrganizationRole_new') THEN
    ALTER TABLE "Membership" ALTER COLUMN "role" DROP DEFAULT;
    ALTER TABLE "Invite" ALTER COLUMN "role" DROP DEFAULT;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'actorRole'
    ) THEN
      ALTER TABLE "AuditLog" ALTER COLUMN "actorRole" DROP DEFAULT;
      ALTER TABLE "AuditLog"
        ALTER COLUMN "actorRole" TYPE "OrganizationRole_new"
        USING (
          CASE
            WHEN "actorRole" IS NULL THEN NULL
            ELSE "actorRole"::text::"OrganizationRole_new"
          END
        );
    END IF;

    ALTER TABLE "Membership"
      ALTER COLUMN "role" TYPE "OrganizationRole_new"
      USING ("role"::text::"OrganizationRole_new");

    ALTER TABLE "Invite"
      ALTER COLUMN "role" TYPE "OrganizationRole_new"
      USING ("role"::text::"OrganizationRole_new");

    ALTER TYPE "OrganizationRole" RENAME TO "OrganizationRole_old";
    ALTER TYPE "OrganizationRole_new" RENAME TO "OrganizationRole";
    DROP TYPE IF EXISTS "OrganizationRole_old";

    ALTER TABLE "Membership" ALTER COLUMN "role" SET DEFAULT 'MEMBER'::"OrganizationRole";
    ALTER TABLE "Invite" ALTER COLUMN "role" SET DEFAULT 'MEMBER'::"OrganizationRole";
  END IF;
END $$;

-- Add user last-active-org FK if missing.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_lastActiveOrgId_fkey') THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_lastActiveOrgId_fkey"
      FOREIGN KEY ("lastActiveOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Normalize AuditLog columns to resource/user naming used by current app code.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'actorUserId'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'userId'
  ) THEN
    ALTER TABLE "AuditLog" RENAME COLUMN "actorUserId" TO "userId";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'entityType'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'resourceType'
  ) THEN
    ALTER TABLE "AuditLog" RENAME COLUMN "entityType" TO "resourceType";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'entityId'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'resourceId'
  ) THEN
    ALTER TABLE "AuditLog" RENAME COLUMN "entityId" TO "resourceId";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'meta'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE "AuditLog" RENAME COLUMN "meta" TO "metadata";
  END IF;
END $$;

ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "ipAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "userAgent" TEXT,
  ADD COLUMN IF NOT EXISTS "requestId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_userId_fkey') THEN
    ALTER TABLE "AuditLog"
      ADD CONSTRAINT "AuditLog_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DROP INDEX IF EXISTS "AuditLog_entityType_entityId_idx";
DROP INDEX IF EXISTS "AuditLog_orgId_entityType_entityId_idx";
CREATE INDEX IF NOT EXISTS "AuditLog_orgId_action_createdAt_idx" ON "AuditLog"("orgId", "action", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_orgId_resourceType_resourceId_idx" ON "AuditLog"("orgId", "resourceType", "resourceId");

-- Migrate Usage to event-level schema used by current app code.
ALTER TABLE "Usage"
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "model" TEXT,
  ADD COLUMN IF NOT EXISTS "costUsd" DECIMAL(12,6),
  ADD COLUMN IF NOT EXISTS "requestId" TEXT,
  ADD COLUMN IF NOT EXISTS "templateName" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3);

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
LEFT JOIN owner_candidates oc ON oc."orgId" = fm."orgId"
WHERE fm."orgId" = u."orgId"
  AND u."userId" IS NULL;

UPDATE "Usage" SET "model" = 'unknown' WHERE "model" IS NULL;
UPDATE "Usage" SET "createdAt" = COALESCE("createdAt", CURRENT_TIMESTAMP) WHERE "createdAt" IS NULL;

ALTER TABLE "Usage"
  ALTER COLUMN "userId" SET NOT NULL,
  ALTER COLUMN "model" SET NOT NULL,
  ALTER COLUMN "createdAt" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Usage_userId_fkey') THEN
    ALTER TABLE "Usage"
      ADD CONSTRAINT "Usage_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DROP INDEX IF EXISTS "Usage_orgId_date_idx";
DROP INDEX IF EXISTS "Usage_orgId_date_key";
DROP INDEX IF EXISTS "Usage_date_idx";
CREATE INDEX IF NOT EXISTS "Usage_orgId_createdAt_idx" ON "Usage"("orgId", "createdAt");
CREATE INDEX IF NOT EXISTS "Usage_orgId_userId_createdAt_idx" ON "Usage"("orgId", "userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Usage_requestId_idx" ON "Usage"("requestId");

ALTER TABLE "Usage"
  DROP COLUMN IF EXISTS "date",
  DROP COLUMN IF EXISTS "optimizeCount";

-- Add missing org FK constraints expected by current Prisma schema.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Project_orgId_fkey') THEN
    ALTER TABLE "Project"
      ADD CONSTRAINT "Project_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Prompt_orgId_fkey') THEN
    ALTER TABLE "Prompt"
      ADD CONSTRAINT "Prompt_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromptVersion_orgId_fkey') THEN
    ALTER TABLE "PromptVersion"
      ADD CONSTRAINT "PromptVersion_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_orgId_fkey') THEN
    ALTER TABLE "AuditLog"
      ADD CONSTRAINT "AuditLog_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Usage_orgId_fkey') THEN
    ALTER TABLE "Usage"
      ADD CONSTRAINT "Usage_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
