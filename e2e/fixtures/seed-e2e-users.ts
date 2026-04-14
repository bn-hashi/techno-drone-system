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

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const BCRYPT_ROUNDS = 12;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
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
    update: { passwordHash: studentPasswordHash, status: "ACTIVE" },
    create: {
      email: TEST_USERS.student.email,
      name: TEST_USERS.student.name,
      role: "STUDENT",
      status: "ACTIVE",
      passwordHash: studentPasswordHash,
    },
  });
  console.log(`  Created/updated STUDENT: ${TEST_USERS.student.email}`);

  // ADMIN user — status ACTIVE so login is allowed
  const adminPasswordHash = await bcrypt.hash(TEST_USERS.admin.password, BCRYPT_ROUNDS);
  await prisma.user.upsert({
    where: { email: TEST_USERS.admin.email },
    update: { passwordHash: adminPasswordHash, status: "ACTIVE" },
    create: {
      email: TEST_USERS.admin.email,
      name: TEST_USERS.admin.name,
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash: adminPasswordHash,
    },
  });
  console.log(`  Created/updated ADMIN: ${TEST_USERS.admin.email}`);

  // PENDING user — status PENDING_REGISTRATION so login is rejected
  const pendingPasswordHash = await bcrypt.hash(TEST_USERS.pendingUser.password, BCRYPT_ROUNDS);
  await prisma.user.upsert({
    where: { email: TEST_USERS.pendingUser.email },
    update: { passwordHash: pendingPasswordHash, status: "PENDING_REGISTRATION" },
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

seedE2EUsers()
  .catch((error: unknown) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
