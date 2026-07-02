-- CreateIndex
CREATE UNIQUE INDEX "flight_inspections_flightLogId_phase_itemKey_key" ON "flight_inspections"("flightLogId", "phase", "itemKey");

-- CreateIndex
CREATE INDEX "flight_logs_startedAt_idx" ON "flight_logs"("startedAt");
