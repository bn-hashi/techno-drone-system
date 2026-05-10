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
 * Generate an invite token for the given user ID by calling the token module
 * directly.  This allows tests to bypass the email step and navigate to
 * /setup/password?token=<token> directly.
 *
 * The INVITE_TOKEN_SECRET env var must be set (loaded from .env.local above).
 */
export function buildInviteToken(userId: string): string {
  // Inline the token generation logic so we avoid cross-module TS compilation
  // issues (the token module uses process.env.INVITE_TOKEN_SECRET which must
  // already be available when this helper is imported).
  const secret = process.env.INVITE_TOKEN_SECRET;
  if (!secret) {
    throw new Error(
      "INVITE_TOKEN_SECRET is not set. Add it to .env.local before running E2E tests."
    );
  }

  const { createHmac } = require("crypto") as typeof import("crypto");

  const TOKEN_EXPIRY_MS = 72 * 60 * 60 * 1000;

  const payload = { userId, exp: Date.now() + TOKEN_EXPIRY_MS };
  const payloadBase64 = Buffer.from(JSON.stringify(payload))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const hmac = createHmac("sha256", secret);
  hmac.update(payloadBase64);
  const signature = hmac
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `${payloadBase64}.${signature}`;
}
