/**
 * シードスクリプト
 *
 * 冪等実行対応: upsert を使って重複エラーを防ぐ
 * 実行方法: npx prisma db seed (または make seed)
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as bcrypt from "bcryptjs";
import { SEED_ADMIN, SEED_SUBJECTS, SEED_COURSE, SEED_QUESTIONS } from "./seed-data";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  // 管理者パスワードを環境変数から取得（必須）
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error("SEED_ADMIN_PASSWORD environment variable is required for seeding");
  }

  // 管理者アカウント
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { email: SEED_ADMIN.email },
    update: {},
    create: {
      email: SEED_ADMIN.email,
      name: SEED_ADMIN.name,
      role: SEED_ADMIN.role,
      passwordHash,
    },
  });

  // 4科目マスタ
  for (const subject of SEED_SUBJECTS) {
    await prisma.subject.upsert({
      where: { code: subject.code },
      update: {
        name: subject.name,
        requiredMinutesBeginner: subject.requiredMinutesBeginner,
        requiredMinutesExperienced: subject.requiredMinutesExperienced,
      },
      create: {
        code: subject.code,
        name: subject.name,
        requiredMinutesBeginner: subject.requiredMinutesBeginner,
        requiredMinutesExperienced: subject.requiredMinutesExperienced,
      },
    });
  }

  // サンプルコース
  await prisma.course.upsert({
    where: { id: "seed-course-beginner" },
    update: {},
    create: {
      id: "seed-course-beginner",
      name: SEED_COURSE.name,
      type: SEED_COURSE.type,
    },
  });

  // 試験問題 5問（N+1 回避: 事前に全科目を取得）
  const allSubjects = await prisma.subject.findMany();
  const subjectMap = new Map(allSubjects.map((s) => [s.code, s.id]));

  for (const q of SEED_QUESTIONS) {
    const subjectId = subjectMap.get(q.subjectCode);
    if (!subjectId) {
      throw new Error(`Subject not found: ${q.subjectCode}`);
    }

    // 同じ問題文が存在する場合はスキップ（冪等性）
    const existing = await prisma.question.findFirst({
      where: {
        subjectId,
        body: q.body,
      },
    });

    if (!existing) {
      await prisma.question.create({
        data: {
          subjectId,
          body: q.body,
          choices: [...q.choices],
          correctIndex: q.correctIndex,
          explanation: q.explanation,
        },
      });
    }
  }
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect().catch(console.error);
    pool.end().catch(console.error);
  });
