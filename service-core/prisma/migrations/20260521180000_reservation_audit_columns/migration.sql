-- Alinha reservations com o schema Prisma (DB antigo sem notes/timestamps)

ALTER TABLE "core"."reservations"
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "rejectReason" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "reservations_resourceId_startDate_idx"
  ON "core"."reservations"("resourceId", "startDate");

CREATE INDEX IF NOT EXISTS "reservations_userId_idx"
  ON "core"."reservations"("userId");

CREATE INDEX IF NOT EXISTS "reservations_status_idx"
  ON "core"."reservations"("status");
