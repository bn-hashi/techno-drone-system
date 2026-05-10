/**
 * E2E test user credentials
 *
 * These credentials must exist in the database before running E2E tests.
 * Run `npm run e2e:seed` to create them.
 *
 * Passwords are read from environment variables. Set them in `.env.test.local`
 * or export them before running tests. All three variables are required — no
 * fallback values are provided to prevent hardcoded credentials in git history.
 *
 * IMPORTANT: These credentials are for the local test environment only.
 * Never use real user credentials in E2E tests.
 */

// Load env files here so this module works when imported before dotenv is
// configured by the caller (e.g. seed-e2e-users.ts, which imports this module
// before its own dotenv.config() call executes).
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.test.local"), override: true });

function requireEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Required E2E environment variable "${name}" is not set. ` +
        "Add it to .env.test.local and run npm run e2e:seed."
    );
  }
  return value;
}

export const TEST_USERS = {
  student: {
    email: "e2e-student@techno-drone.test",
    password: requireEnvVar("E2E_STUDENT_PASSWORD"),
    role: "STUDENT" as const,
    name: "E2E Student User",
  },
  admin: {
    email: "e2e-admin@techno-drone.test",
    password: requireEnvVar("E2E_ADMIN_PASSWORD"),
    role: "ADMIN" as const,
    name: "E2E Admin User",
  },
  pendingUser: {
    email: "e2e-pending@techno-drone.test",
    password: requireEnvVar("E2E_PENDING_PASSWORD"),
    role: "STUDENT" as const,
    name: "E2E Pending User",
    // status: PENDING_REGISTRATION — login should be rejected
  },
};

/**
 * Storage state file paths for authenticated sessions.
 * Playwright stores authenticated browser state here so each test
 * does not need to go through the login flow.
 */
export const STORAGE_STATE = {
  student: "e2e/fixtures/.auth/student.json",
  admin: "e2e/fixtures/.auth/admin.json",
} as const;
