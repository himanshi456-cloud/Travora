-- Replace per-booking assignment with one assignment per service category.
CREATE TABLE "ServiceTypeAssignment" (
    "id" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "agentId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceTypeAssignment_pkey" PRIMARY KEY ("id")
);

-- Preserve existing assignments by carrying forward the most recently updated
-- assignment for each service category. New assignment model is service-wide.
INSERT INTO "ServiceTypeAssignment" ("id", "serviceType", "agentId", "assignedById", "createdAt", "updatedAt")
SELECT DISTINCT ON (sb."serviceType")
    'legacy_' || sb."serviceType"::text,
    sb."serviceType",
    sa."agentId",
    sa."assignedById",
    sa."createdAt",
    sa."updatedAt"
FROM "ServiceAssignment" sa
JOIN "ServiceBooking" sb ON sb."id" = sa."serviceBookingId"
ORDER BY sb."serviceType", sa."updatedAt" DESC;

CREATE UNIQUE INDEX "ServiceTypeAssignment_serviceType_key" ON "ServiceTypeAssignment"("serviceType");
CREATE INDEX "ServiceTypeAssignment_agentId_idx" ON "ServiceTypeAssignment"("agentId");
CREATE INDEX "ServiceTypeAssignment_assignedById_idx" ON "ServiceTypeAssignment"("assignedById");

ALTER TABLE "ServiceTypeAssignment" ADD CONSTRAINT "ServiceTypeAssignment_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceTypeAssignment" ADD CONSTRAINT "ServiceTypeAssignment_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TABLE "ServiceAssignment";

-- Link each customer-facing VIEWER login to exactly one customer record.
ALTER TABLE "User" ADD COLUMN "customerId" TEXT;
CREATE UNIQUE INDEX "User_customerId_key" ON "User"("customerId");
ALTER TABLE "User" ADD CONSTRAINT "User_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Customer service inbox: a customer can raise requests and admins can reply/update status.
CREATE TYPE "SupportStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

CREATE TABLE "SupportRequest" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "tripId" TEXT,
    "serviceBookingId" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "SupportStatus" NOT NULL DEFAULT 'OPEN',
    "adminReply" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportRequest_customerId_createdAt_idx" ON "SupportRequest"("customerId", "createdAt");
CREATE INDEX "SupportRequest_requesterUserId_createdAt_idx" ON "SupportRequest"("requesterUserId", "createdAt");
CREATE INDEX "SupportRequest_status_createdAt_idx" ON "SupportRequest"("status", "createdAt");

ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_requesterUserId_fkey"
  FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_serviceBookingId_fkey"
  FOREIGN KEY ("serviceBookingId") REFERENCES "ServiceBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
