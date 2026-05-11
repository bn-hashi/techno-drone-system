/*
  Warnings:

  - Added the required column `address` to the `enrollment_applications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dateOfBirth` to the `enrollment_applications` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phoneNumber` to the `enrollment_applications` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "agreement_logs" ADD COLUMN     "ipAddress" TEXT;

-- AlterTable
ALTER TABLE "enrollment_applications" ADD COLUMN     "address" TEXT NOT NULL,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "phoneNumber" TEXT NOT NULL;
