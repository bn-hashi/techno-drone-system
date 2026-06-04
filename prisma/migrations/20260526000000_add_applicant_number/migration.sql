-- AlterTable: 技能証明申請者番号カラム追加 (nullable、既存レコードに影響なし)
ALTER TABLE "enrollment_applications" ADD COLUMN "applicantNumber" TEXT;
