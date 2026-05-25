-- CreateEnum
CREATE TYPE "JudgmentResult" AS ENUM ('ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "judgment_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "result" "JudgmentResult" NOT NULL,
    "comment" TEXT,
    "judgedBy" TEXT NOT NULL,
    "judgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "judgment_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "judgment_records_userId_judgedAt_idx" ON "judgment_records"("userId", "judgedAt");

-- AddForeignKey
ALTER TABLE "judgment_records" ADD CONSTRAINT "judgment_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
