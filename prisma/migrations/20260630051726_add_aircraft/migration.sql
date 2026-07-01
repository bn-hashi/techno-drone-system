-- CreateEnum
CREATE TYPE "FlightPlanStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "InspectionPhase" AS ENUM ('PRE_FLIGHT', 'POST_FLIGHT');

-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('PASS', 'FAIL', 'NA');

-- CreateTable
CREATE TABLE "aircrafts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "modelNumber" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "weightGrams" INTEGER NOT NULL,
    "maxFlightTimeMin" INTEGER NOT NULL,
    "registrationNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aircrafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aircrafts_serialNumber_key" ON "aircrafts"("serialNumber");

-- AddForeignKey
ALTER TABLE "aircrafts" ADD CONSTRAINT "aircrafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
