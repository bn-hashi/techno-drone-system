-- CreateTable
CREATE TABLE "flight_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "aircraftId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "plannedAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" "FlightPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flight_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flight_plans_userId_status_idx" ON "flight_plans"("userId", "status");

-- AddForeignKey
ALTER TABLE "flight_plans" ADD CONSTRAINT "flight_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight_plans" ADD CONSTRAINT "flight_plans_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "aircrafts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
