CREATE TYPE "TripStatus" AS ENUM ('NOT_SPECIFIED', 'UPCOMING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "RefundStatus" AS ENUM ('NOT_APPLICABLE', 'UNKNOWN', 'PENDING', 'PARTIAL_REFUNDED', 'FULL_REFUNDED');
CREATE TYPE "ServiceType" AS ENUM ('FLIGHTS', 'STAYS', 'ACTIVITIES', 'TRANSFERS', 'FERRY', 'VISA', 'TOURIST_TAX', 'ARRIVAL_CARD', 'TRAVEL_INSURANCE');
CREATE TYPE "BookingStatus" AS ENUM ('UNKNOWN', 'TO_BE_DONE', 'IN_PROGRESS', 'COMPLETED', 'NOT_NEEDED', 'CANCELLED');
CREATE TYPE "Handler" AS ENUM ('UNASSIGNED', 'GAMAN', 'SELF', 'MIXED');

CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "tripStatus" "TripStatus" NOT NULL DEFAULT 'NOT_SPECIFIED',
    "sourceStatusText" TEXT,
    "operationalNotes" TEXT,
    "refundStatus" "RefundStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "refundPercentage" INTEGER,
    "refundAmount" DECIMAL(12,2),
    "refundNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceBooking" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "itemName" TEXT,
    "bookingStatus" "BookingStatus" NOT NULL DEFAULT 'UNKNOWN',
    "handledBy" "Handler" NOT NULL DEFAULT 'UNASSIGNED',
    "progressNote" TEXT,
    "notes" TEXT,
    "sourceStatusText" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceBooking_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Customer_name_idx" ON "Customer"("name");
CREATE INDEX "Trip_startDate_idx" ON "Trip"("startDate");
CREATE INDEX "Trip_tripStatus_idx" ON "Trip"("tripStatus");
CREATE INDEX "Trip_destination_idx" ON "Trip"("destination");
CREATE INDEX "ServiceBooking_tripId_serviceType_idx" ON "ServiceBooking"("tripId", "serviceType");
CREATE INDEX "ServiceBooking_serviceType_bookingStatus_idx" ON "ServiceBooking"("serviceType", "bookingStatus");
CREATE INDEX "ServiceBooking_handledBy_idx" ON "ServiceBooking"("handledBy");

ALTER TABLE "Trip" ADD CONSTRAINT "Trip_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceBooking" ADD CONSTRAINT "ServiceBooking_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
