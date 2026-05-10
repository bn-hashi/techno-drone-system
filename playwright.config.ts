import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration
 *
 * - Target: Chromium only (cost/time balance)
 * - Trace captured on first retry for debugging
 * - Screenshots and video on failure only
 * - Authenticated storage state files are stored under e2e/fixtures/
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

// E2E-only fallback for INVITE_TOKEN_SECRET.
// Must match the value in e2e/fixtures/global-setup.ts so the server and test
// workers share the same secret when .env.local does not define it.
const INVITE_TOKEN_SECRET_FOR_E2E =
  process.env.INVITE_TOKEN_SECRET ?? "e2e-invite-token-secret-for-playwright-minimum-32chars";

export default defineConfig({
  testDir: "./e2e/specs",
  outputDir: "./e2e/test-results",
  globalSetup: "./e2e/fixtures/global-setup.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ["html", { outputFolder: "e2e/playwright-report", open: "never" }],
    ["junit", { outputFile: "e2e/junit-results.xml" }],
    ["list"],
  ],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Wait for the network to be idle before asserting
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    // --- Setup: create authenticated storage states ---
    {
      name: "setup-student",
      testDir: "./e2e/fixtures",
      testMatch: /student\.setup\.ts/,
    },
    {
      name: "setup-admin",
      testDir: "./e2e/fixtures",
      testMatch: /admin\.setup\.ts/,
    },
    // --- Main test suite (requires authenticated sessions) ---
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
      // Exclude invitation-flow tests: they manage their own auth state
      testIgnore: /invitation-flow\.spec\.ts/,
      dependencies: ["setup-student", "setup-admin"],
    },
    // --- Invitation / registration flow (no pre-auth session required) ---
    // Runs independently without depending on setup-admin/setup-student.
    // The admin API tests in this suite rely on the admin storage state file
    // that already exists on disk (e2e/fixtures/.auth/admin.json).  Run
    // `npx playwright test --project=setup-admin` once to generate it if missing.
    {
      name: "invitation-flow",
      testDir: "./e2e/specs",
      testMatch: /invitation-flow\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  // Start Next.js dev server automatically when running locally
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      DATABASE_URL: "postgresql://ubuntu@localhost/drone_school",
      NEXTAUTH_URL: "http://localhost:3000",
      // .env.local の NEXTAUTH_SECRET を優先し、未設定時はローカル E2E 専用値を使用
      NEXTAUTH_SECRET:
        process.env.NEXTAUTH_SECRET ?? "e2e-test-secret-for-playwright-minimum-32chars",
      // テストワーカーの global-setup.ts と同じフォールバック値を使用することで
      // サーバーとテストワーカーが同一のシークレットでトークンを生成・検証できる
      INVITE_TOKEN_SECRET: INVITE_TOKEN_SECRET_FOR_E2E,
    },
  },
});
