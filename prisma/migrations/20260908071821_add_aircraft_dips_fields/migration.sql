-- AlterTable
ALTER TABLE "aircrafts" ADD COLUMN     "dipsCertificationNumber" TEXT,
ADD COLUMN     "dipsUaType" INTEGER,
ADD COLUMN     "hasDipsCertification1" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasDipsCertification2" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxTakeoffWeightGrams" INTEGER;
