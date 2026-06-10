-- Aprovação multi-nível (gestor → diretor → financeiro)
ALTER TABLE "core"."reservations" ADD COLUMN IF NOT EXISTS "approvalLevelRequired" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "core"."reservations" ADD COLUMN IF NOT EXISTS "approvalStage" INTEGER NOT NULL DEFAULT 0;
