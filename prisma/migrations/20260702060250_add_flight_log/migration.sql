-- CreateTable
CREATE TABLE "flight_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "aircraftId" TEXT NOT NULL,
    "flightPlanId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "location" TEXT NOT NULL,
    "pilotNote" TEXT,
    "incidentNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flight_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flight_inspections" (
    "id" TEXT NOT NULL,
    "flightLogId" TEXT NOT NULL,
    "phase" "InspectionPhase" NOT NULL,
    "itemKey" TEXT NOT NULL,
    "result" "InspectionResult" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flight_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flight_logs_userId_startedAt_idx" ON "flight_logs"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "flight_logs_aircraftId_idx" ON "flight_logs"("aircraftId");

-- CreateIndex
CREATE INDEX "flight_logs_flightPlanId_idx" ON "flight_logs"("flightPlanId");

-- CreateIndex
CREATE INDEX "flight_inspections_flightLogId_idx" ON "flight_inspections"("flightLogId");

-- AddForeignKey
ALTER TABLE "flight_logs" ADD CONSTRAINT "flight_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight_logs" ADD CONSTRAINT "flight_logs_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "aircrafts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight_logs" ADD CONSTRAINT "flight_logs_flightPlanId_fkey" FOREIGN KEY ("flightPlanId") REFERENCES "flight_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight_inspections" ADD CONSTRAINT "flight_inspections_flightLogId_fkey" FOREIGN KEY ("flightLogId") REFERENCES "flight_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
