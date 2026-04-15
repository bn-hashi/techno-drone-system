/**
 * E2E test user credentials
 *
 * These credentials must exist in the database before running E2E tests.
 * Run `npm run e2e:seed` to create them.
 *
 * Passwords are read from environment variables. Set them in `.env.test.local`
 * or export them before running tests. Fallback values are used for local
 * development only — never use fallbacks in CI.
 *
 * IMPORTANT: These credentials are for the local test environment only.
 * Never use real user credentials in E2E tests.
 */

export const TEST_USERS = {
  student: {
    email: "e2e-student@techno-drone.test",
    password: process.env.E2E_STUDENT_PASSWORD ?? "E2eStudent#2024",
    role: "STUDENT" as const,
    name: "E2E Student User",
  },
  admin: {
    email: "e2e-admin@techno-drone.test",
    password: process.env.E2E_ADMIN_PASSWORD ?? "E2eAdmin#2024",
    role: "ADMIN" as const,
    name: "E2E Admin User",
  },
  pendingUser: {
    email: "e2e-pending@techno-drone.test",
    password: process.env.E2E_PENDING_PASSWORD ?? "E2ePending#2024",
    role: "STUDENT" as const,
    name: "E2E Pending User",
    // status: PENDING_REGISTRATION — login should be rejected
  },
}

/**
 * Storage state file paths for authenticated sessions.
 * Playwright stores authenticated browser state here so each test
 * does not need to go through the login flow.
 */
export const STORAGE_STATE = {
  student: "e2e/fixtures/.auth/student.json",
  admin: "e2e/fixtures/.auth/admin.json",
} as const
