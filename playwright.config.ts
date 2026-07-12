import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import os from "os";
import path from "path";

/**
 * Playwright E2E configuration
 *
 * - Target: Chromium only (cost/time balance)
 * - Trace captured on first retry for debugging
 * - Screenshots and video on failure only
 * - Authenticated storage state files are stored under e2e/fixtures/
 */

// .env.test.local (gitignored, developer-managed) can override DATABASE_URL
// and other test-only secrets before we read process.env below.
loadEnv({ path: path.resolve(process.cwd(), ".env.test.local") });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

// E2E-only fallback for INVITE_TOKEN_SECRET.
// Must match the value in e2e/fixtures/global-setup.ts so the server and test
// workers share the same secret when .env.local does not define it.
const INVITE_TOKEN_SECRET_FOR_E2E =
  process.env.INVITE_TOKEN_SECRET ?? "e2e-invite-token-secret-for-playwright-minimum-32chars";

// The dedicated E2E database must never point at the development database.
// Falls back to a per-OS-user database name so each developer's local Postgres
// role (e.g. `kenji`) is used instead of the hardcoded `ubuntu` dev-server role.
const DATABASE_URL_FOR_E2E =
  process.env.DATABASE_URL ?? `postgresql://${os.userInfo().username}@localhost/drone_school_test`;

export default defineConfig({
  testDir: "./e2e/specs",
  outputDir: "./e2e/test-results",
  globalSetup: "./e2e/fixtures/global-setup.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // ローカルの dev server はオンデマンドコンパイルにより初回アクセスが遅く、
  // フルスイート実行時に断続的なタイムアウトが発生しうる。テスト/実装の不具合
  // ではなく dev server 固有の一時的な遅延のため、ローカルでも1回リトライする。
  retries: process.env.CI ? 2 : 1,
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
    // ローカルの dev server はルート初回アクセス時にオンデマンドコンパイルが
    // 走り数秒〜十数秒かかることがあるため、CI より長めの猶予を持たせる。
    actionTimeout: 15_000,
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
    {
      name: "setup-pilot",
      testDir: "./e2e/fixtures",
      testMatch: /pilot\.setup\.ts/,
    },
    // --- Main test suite (requires authenticated sessions) ---
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
      // Exclude invitation-flow tests: they manage their own auth state
      testIgnore: /invitation-flow\.spec\.ts/,
      dependencies: ["setup-student", "setup-admin", "setup-pilot"],
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
      dependencies: ["setup-admin"],
    },
  ],
  // Start Next.js dev server automatically when running locally
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      DATABASE_URL: DATABASE_URL_FOR_E2E,
      NEXTAUTH_URL: "http://localhost:3000",
      // role-redirect等の絶対URL構築ガード(lib/appBaseUrl.ts)が要求する必須変数。
      // .env.test.local（またはシェル環境変数）のAPP_BASE_URLを優先し、
      // 未設定時はローカルE2E既定値を使用。
      APP_BASE_URL: process.env.APP_BASE_URL ?? BASE_URL,
      // .env.local の NEXTAUTH_SECRET を優先し、未設定時はローカル E2E 専用値を使用
      NEXTAUTH_SECRET:
        process.env.NEXTAUTH_SECRET ?? "e2e-test-secret-for-playwright-minimum-32chars",
      // テストワーカーの global-setup.ts と同じフォールバック値を使用することで
      // サーバーとテストワーカーが同一のシークレットでトークンを生成・検証できる
      INVITE_TOKEN_SECRET: INVITE_TOKEN_SECRET_FOR_E2E,
    },
  },
});
