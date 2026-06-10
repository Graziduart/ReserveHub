-- Governança corporativa: departamento (prioridade/centro de custo), recurso por departamento, aprovador na reserva

ALTER TABLE "core"."departments"
  ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "costCenterCode" TEXT;

ALTER TABLE "core"."resources"
  ADD COLUMN IF NOT EXISTS "departmentId" TEXT,
  ADD COLUMN IF NOT EXISTS "costCenterCode" TEXT;

ALTER TABLE "core"."reservations"
  ADD COLUMN IF NOT EXISTS "approvedById" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'resources_departmentId_fkey'
  ) THEN
    ALTER TABLE "core"."resources"
      ADD CONSTRAINT "resources_departmentId_fkey"
      FOREIGN KEY ("departmentId") REFERENCES "core"."departments"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reservations_approvedById_fkey'
  ) THEN
    ALTER TABLE "core"."reservations"
      ADD CONSTRAINT "reservations_approvedById_fkey"
      FOREIGN KEY ("approvedById") REFERENCES "core"."users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "resources_departmentId_idx" ON "core"."resources"("departmentId");
