CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'AGENT', 'VIEWER');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceAssignment" (
    "id" TEXT NOT NULL,
    "serviceBookingId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");
CREATE UNIQUE INDEX "ServiceAssignment_serviceBookingId_key" ON "ServiceAssignment"("serviceBookingId");
CREATE INDEX "ServiceAssignment_agentId_idx" ON "ServiceAssignment"("agentId");
CREATE INDEX "ServiceAssignment_assignedById_idx" ON "ServiceAssignment"("assignedById");

ALTER TABLE "ServiceAssignment" ADD CONSTRAINT "ServiceAssignment_serviceBookingId_fkey"
  FOREIGN KEY ("serviceBookingId") REFERENCES "ServiceBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceAssignment" ADD CONSTRAINT "ServiceAssignment_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceAssignment" ADD CONSTRAINT "ServiceAssignment_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
