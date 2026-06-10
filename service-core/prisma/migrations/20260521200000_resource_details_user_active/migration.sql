-- Resource UI fields + soft-disable for core.users (IAM sync)
ALTER TABLE "core"."users" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "core"."resources" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "core"."resources" ADD COLUMN IF NOT EXISTS "capacity" INTEGER;
ALTER TABLE "core"."resources" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "core"."resources" ADD COLUMN IF NOT EXISTS "characteristics" TEXT[] DEFAULT ARRAY[]::TEXT[];
