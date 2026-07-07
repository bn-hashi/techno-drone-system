/**
 * E2E test user seeding script
 *
 * Creates test-only users with deterministic credentials.
 * Safe to run multiple times (upsert semantics).
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' e2e/fixtures/seed-e2e-users.ts
 *
 * Or via npm script:
 *   npm run e2e:seed
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcryptjs";
import { TEST_USERS } from "./test-users";
import { E2E_COURSE, E2E_VIDEOS } from "./test-content";

// Load .env.local then .env.test.local (test-local takes precedence)
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.test.local"), override: true });

const BCRYPT_ROUNDS = 12;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Fail-closed: prevent accidental writes to non-test databases
if (process.env.NODE_ENV !== "test") {
  throw new Error(
    "E2E seeding must run with NODE_ENV=test to prevent accidental production writes"
  );
}
if (!/-test\b|_test\b/i.test(databaseUrl)) {
  throw new Error(
    "DATABASE_URL must contain '-test' or '_test' suffix to confirm test database target"
  );
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seedE2EUsers(): Promise<void> {
  console.log("Seeding E2E test users...");

  // STUDENT user — status ACTIVE so login is allowed
  const studentPasswordHash = await bcrypt.hash(TEST_USERS.student.password, BCRYPT_ROUNDS);
  await prisma.user.upsert({
    where: { email: TEST_USERS.student.email },
    update: {
      passwordHash: studentPasswordHash,
      status: "ACTIVE",
      name: TEST_USERS.student.name,
      role: TEST_USERS.student.role,
    },
    create: {
      email: TEST_USERS.student.email,
      name: TEST_USERS.student.name,
      role: "STUDENT",
      status: "ACTIVE",
      passwordHash: studentPasswordHash,
    },
  });
  console.log("  Created/updated STUDENT test user");

  // ADMIN user — status ACTIVE so login is allowed
  const adminPasswordHash = await bcrypt.hash(TEST_USERS.admin.password, BCRYPT_ROUNDS);
  await prisma.user.upsert({
    where: { email: TEST_USERS.admin.email },
    update: {
      passwordHash: adminPasswordHash,
      status: "ACTIVE",
      name: TEST_USERS.admin.name,
      role: TEST_USERS.admin.role,
    },
    create: {
      email: TEST_USERS.admin.email,
      name: TEST_USERS.admin.name,
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash: adminPasswordHash,
    },
  });
  console.log("  Created/updated ADMIN test user");

  // PILOT user — status ACTIVE so login is allowed
  const pilotPasswordHash = await bcrypt.hash(TEST_USERS.pilot.password, BCRYPT_ROUNDS);
  await prisma.user.upsert({
    where: { email: TEST_USERS.pilot.email },
    update: {
      passwordHash: pilotPasswordHash,
      status: "ACTIVE",
      name: TEST_USERS.pilot.name,
      role: TEST_USERS.pilot.role,
    },
    create: {
      email: TEST_USERS.pilot.email,
      name: TEST_USERS.pilot.name,
      role: "PILOT",
      status: "ACTIVE",
      passwordHash: pilotPasswordHash,
    },
  });
  console.log("  Created/updated PILOT test user");

  // PENDING user — status PENDING_REGISTRATION so login is rejected
  const pendingPasswordHash = await bcrypt.hash(TEST_USERS.pendingUser.password, BCRYPT_ROUNDS);
  await prisma.user.upsert({
    where: { email: TEST_USERS.pendingUser.email },
    update: {
      passwordHash: pendingPasswordHash,
      status: "PENDING_REGISTRATION",
      name: TEST_USERS.pendingUser.name,
      role: TEST_USERS.pendingUser.role,
    },
    create: {
      email: TEST_USERS.pendingUser.email,
      name: TEST_USERS.pendingUser.name,
      role: "STUDENT",
      status: "PENDING_REGISTRATION",
      passwordHash: pendingPasswordHash,
    },
  });
  console.log(`  Created/updated PENDING: ${TEST_USERS.pendingUser.email}`);

  console.log("E2E user seeding complete.");
}

async function seedE2EContent(): Promise<void> {
  console.log("Seeding E2E test content (course, videos)...");

  // 既存 subjects のうち最初のものに紐付ける（本番 seed が前提）
  const firstSubject = await prisma.subject.findFirst({ orderBy: { code: "asc" } });
  if (!firstSubject) {
    throw new Error("No subjects found in DB. Run `make seed` to seed production data before E2E.");
  }

  // コース
  await prisma.course.upsert({
    where: { id: E2E_COURSE.id },
    update: { name: E2E_COURSE.name, type: E2E_COURSE.type },
    create: { id: E2E_COURSE.id, name: E2E_COURSE.name, type: E2E_COURSE.type },
  });
  console.log(`  Created/updated COURSE: ${E2E_COURSE.id}`);

  // 動画 3 本（first / second / unpublished）
  for (const video of [E2E_VIDEOS.first, E2E_VIDEOS.second, E2E_VIDEOS.unpublished]) {
    await prisma.video.upsert({
      where: { id: video.id },
      update: {
        title: video.title,
        sortOrder: video.sortOrder,
        duration: video.duration,
        isPublished: video.isPublished,
        subjectId: firstSubject.id,
        courseId: E2E_COURSE.id,
      },
      create: {
        id: video.id,
        title: video.title,
        sortOrder: video.sortOrder,
        duration: video.duration,
        isPublished: video.isPublished,
        filePath: `e2e/${video.id}.mp4`,
        subjectId: firstSubject.id,
        courseId: E2E_COURSE.id,
      },
    });
    console.log(`  Created/updated VIDEO: ${video.id}`);
  }

  // テスト独立性確保のため、E2E student の視聴ログをクリーンアップ
  // (前回テスト実行で進捗が残っているとロック表示テストが失敗するため)
  const student = await prisma.user.findUnique({
    where: { email: TEST_USERS.student.email },
  });
  if (student) {
    await prisma.viewingLog.deleteMany({ where: { userId: student.id } });
    await prisma.subjectProgress.deleteMany({ where: { userId: student.id } });
    console.log(`  Cleared progress for E2E student: ${student.id}`);
  }

  console.log("E2E content seeding complete.");
}

async function main(): Promise<void> {
  await seedE2EUsers();
  await seedE2EContent();
}

main()
  .catch((error: unknown) => {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
