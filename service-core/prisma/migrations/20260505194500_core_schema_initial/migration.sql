-- ReserveHub service-core: schema "core" (departments, users, resources, reservations)
-- IAM/audit live outside this service; users table exists for FK integrity only.

CREATE SCHEMA IF NOT EXISTS "core";

CREATE TYPE "core"."Role" AS ENUM ('ADMIN', 'MANAGER', 'EMPLOYEE');

CREATE TYPE "core"."ReservationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "core"."departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "core"."users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "core"."Role" NOT NULL DEFAULT 'EMPLOYEE',
    "departmentId" TEXT NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "core"."resources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "core"."reservations" (
    "id" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "core"."ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "rejectReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "departments_sigla_key" ON "core"."departments"("sigla");

CREATE UNIQUE INDEX "users_email_key" ON "core"."users"("email");

CREATE INDEX "reservations_resourceId_startDate_idx" ON "core"."reservations"("resourceId", "startDate");

CREATE INDEX "reservations_userId_idx" ON "core"."reservations"("userId");

CREATE INDEX "reservations_status_idx" ON "core"."reservations"("status");

ALTER TABLE "core"."users" ADD CONSTRAINT "users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "core"."departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "core"."reservations" ADD CONSTRAINT "reservations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "core"."reservations" ADD CONSTRAINT "reservations_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "core"."resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
