-- AlterTable
-- 出題された問題 ID 配列を保存し、提出時の改ざん検証に使用する
ALTER TABLE "exams" ADD COLUMN "questionIds" JSONB NOT NULL DEFAULT '[]';
