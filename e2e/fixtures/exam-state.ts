/**
 * 試験〜証明書 E2E 用の EXAM STUDENT 状態リセットヘルパ
 *
 * spec の冒頭とシードスクリプトの両方から呼ぶ。試験 E2E は
 * ACTIVE → EXAM_PASSED → COMPLETED → CERTIFIED と状態を進めるため、
 * リトライや再実行時に必ず既知の初期状態 (ACTIVE + 受験適格) へ戻す必要がある。
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { TEST_USERS } from "./test-users";
import { E2E_EXAM_VIDEOS } from "./test-content";

// Playwright worker では global-setup が設定した DATABASE_URL (テスト DB) が
// 既に process.env にあり、dotenv は既存値を上書きしないため安全に読み込める
dotenv.config({ path: path.resolve(process.cwd(), ".env.test.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

let prismaInstance: PrismaClient | null = null;

function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    const pool = new Pool({ connectionString: databaseUrl });
    const adapter = new PrismaPg(pool);
    prismaInstance = new PrismaClient({ adapter });
  }
  return prismaInstance;
}

/**
 * EXAM STUDENT を「ACTIVE + 全科目の視聴時間充足 + 試験/判定/証明書の記録なし」
 * の初期状態へ戻す。E2E_EXAM_VIDEOS が seed 済みであることが前提。
 */
export async function resetExamStudentState(client?: PrismaClient): Promise<void> {
  const prisma = client ?? getPrismaClient();

  const examStudent = await prisma.user.findUnique({
    where: { email: TEST_USERS.examStudent.email },
  });
  if (!examStudent) {
    throw new Error("EXAM STUDENT not found. Run `npm run e2e:seed` first.");
  }

  await prisma.examAnswer.deleteMany({ where: { exam: { userId: examStudent.id } } });
  await prisma.exam.deleteMany({ where: { userId: examStudent.id } });
  await prisma.judgmentRecord.deleteMany({ where: { userId: examStudent.id } });
  await prisma.completionCertificate.deleteMany({ where: { userId: examStudent.id } });
  await prisma.viewingLog.deleteMany({ where: { userId: examStudent.id } });
  await prisma.subjectProgress.deleteMany({ where: { userId: examStudent.id } });
  await prisma.user.update({
    where: { id: examStudent.id },
    data: { status: "ACTIVE" },
  });

  // 受験適格化: 科目別合計がちょうど必要分に達する視聴ログを挿入する
  // (進捗集計は動画ごとの max(watchedSeconds) の合計を分換算する)
  const now = new Date();
  for (const video of E2E_EXAM_VIDEOS) {
    await prisma.viewingLog.create({
      data: {
        userId: examStudent.id,
        videoId: video.id,
        startedAt: now,
        endedAt: now,
        watchedSeconds: video.requiredMinutes * 60,
      },
    });
  }
}
