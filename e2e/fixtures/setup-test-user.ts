/**
 * Test helper: create and clean up a PENDING_ACTIVATION user for E2E tests.
 *
 * This module is imported by the invitation flow spec to prepare the database
 * without relying on the admin UI (which is a separate concern).
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { generateInviteToken } from "../../lib/token";

// Load .env.local so DATABASE_URL and INVITE_TOKEN_SECRET are available
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

let prismaInstance: PrismaClient | null = null;

function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    const pool = new Pool({ connectionString: databaseUrl });
    const adapter = new PrismaPg(pool);
    prismaInstance = new PrismaClient({ adapter });
  }
  return prismaInstance;
}

export interface InvitedTestUser {
  userId: string;
  email: string;
  name: string;
}

/**
 * Create a PENDING_ACTIVATION user for invitation flow testing.
 *
 * The user is created without a real password hash because the invitation flow
 * starts at /setup/password where the student sets their own password.
 * A placeholder hash is used to satisfy the NOT NULL constraint.
 */
export async function createPendingActivationUser(
  email: string,
  name: string
): Promise<InvitedTestUser> {
  const prisma = getPrismaClient();

  // Remove any leftover user from a previous failed test run
  await prisma.user.deleteMany({ where: { email } });

  const user = await prisma.user.create({
    data: {
      email,
      name,
      role: "STUDENT",
      // Placeholder — overwritten by the /api/setup/password endpoint
      passwordHash: "$2b$12$placeholder-hash-for-e2e-tests-only-not-a-real-hash",
      status: "PENDING_ACTIVATION",
    },
  });

  return { userId: user.id, email: user.email, name: user.name };
}

/**
 * Delete the test user and all cascade-related records after each test.
 */
export async function deletePendingActivationUser(email: string): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.user.deleteMany({ where: { email } });
}

/**
 * Generate an invite token for the given user ID.
 *
 * Delegates to lib/token.ts generateInviteToken so the token format stays
 * in sync with the production implementation.
 *
 * INVITE_TOKEN_SECRET must be set in process.env before calling this function
 * (loaded from .env.local via dotenv.config above).
 */
export function buildInviteToken(userId: string): string {
  return generateInviteToken(userId);
}
