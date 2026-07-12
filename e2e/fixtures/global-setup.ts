/**
 * Playwright global setup
 *
 * Loads .env.local into the test worker process environment before any tests
 * or fixtures run.  This makes DATABASE_URL, INVITE_TOKEN_SECRET, and other
 * server-side secrets available to test helpers (e.g. buildInviteToken,
 * createPendingActivationUser) that run inside Playwright worker processes.
 *
 * Next.js loads .env.local automatically on the server side; Playwright
 * workers do NOT, so we bridge the gap here.
 *
 * Additionally, this setup probes the running dev server to check whether
 * INVITE_TOKEN_SECRET is configured.  The result is written to a temp file
 * so test specs can adjust their assertions accordingly.
 */

import { config } from "dotenv";
import os from "os";
import path from "path";
import fs from "fs";
import { generateInviteToken } from "../../lib/token";

// E2E-only fallback secret used when INVITE_TOKEN_SECRET is not present in
// .env.local.  The value must match what is passed to webServer.env in
// playwright.config.ts so the server and the test workers share the same secret.
const E2E_FALLBACK_INVITE_TOKEN_SECRET = "e2e-invite-token-secret-for-playwright-minimum-32chars";

// Path where the probe result is written so test workers can read it
const PROBE_RESULT_PATH = path.resolve(process.cwd(), "e2e/test-results/.server-probe.json");

export default async function globalSetup(): Promise<void> {
  // .env.test.local takes priority (loaded first; dotenv does not override
  // already-set vars), then .env.local fills in anything test config omits.
  config({ path: path.resolve(process.cwd(), ".env.test.local") });
  // .env.local's DATABASE_URL is typically the development database. Capture
  // whatever .env.test.local already resolved *before* loading .env.local, so
  // a dev-DB value there can never leak into the E2E worker's DATABASE_URL —
  // it must always match what playwright.config.ts resolves for webServer.
  const e2eDatabaseUrl = process.env.DATABASE_URL;
  config({ path: path.resolve(process.cwd(), ".env.local") });

  // Dedicated E2E database must never fall back to the development database.
  // Falls back to a per-OS-user database name so each developer's local
  // Postgres role (e.g. `kenji`) is used instead of the dev-server `ubuntu` role.
  process.env.DATABASE_URL =
    e2eDatabaseUrl ?? `postgresql://${os.userInfo().username}@localhost/drone_school_test`;

  // Ensure INVITE_TOKEN_SECRET is available for test helpers that generate
  // invite tokens in-process.  If .env.local does not define it use the E2E
  // fallback — the webServer.env in playwright.config.ts passes the same value
  // to the Next.js process so tokens generated here will be accepted there.
  if (!process.env.INVITE_TOKEN_SECRET) {
    process.env.INVITE_TOKEN_SECRET = E2E_FALLBACK_INVITE_TOKEN_SECRET;
  }

  // Probe the server: send a token made with our secret and check whether
  // the server can verify it (i.e., it uses the same secret).
  // A 400 "token invalid" response means the server has a DIFFERENT secret.
  // A 400 "user not found" / "ステータス" response means the secret matches.
  const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

  // Next.js dev server compiles each route on first request, which can take
  // well over the default actionTimeout. Warm up /api/auth/csrf here (used
  // by every setup-*.ts authentication fixture) so the first real test does
  // not eat that compile cost inside its own timeout budget.
  try {
    await fetch(`${BASE_URL}/api/auth/csrf`);
  } catch {
    // Server not yet running — webServer config will start it
  }

  const probeToken = generateInviteToken("probe-user-id");

  let serverSecretMismatch = false;
  try {
    const response = await fetch(`${BASE_URL}/api/setup/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: probeToken, password: "Probe2024!" }),
    });

    if (response.ok || response.status === 400) {
      const body = (await response.json()) as { error?: string };
      // "トークンが無効" means the server rejected our token → secret mismatch
      // Any other 400 error means the secret matched but business logic rejected
      if (body.error?.includes("トークンが無効")) {
        serverSecretMismatch = true;
        console.warn(
          "\n[E2E WARNING] INVITE_TOKEN_SECRET mismatch detected.\n" +
            "The dev server uses a different INVITE_TOKEN_SECRET than the test worker.\n" +
            "Token-dependent tests will be marked as fixme.\n" +
            "Fix: Ensure INVITE_TOKEN_SECRET is set in .env.local and restart the server.\n"
        );
      }
    }
  } catch {
    // Server not yet running — webServer config will start it
    console.info("[E2E] Server probe skipped (server not yet running).");
  }

  // Write probe result for test workers to read
  fs.mkdirSync(path.dirname(PROBE_RESULT_PATH), { recursive: true });
  fs.writeFileSync(PROBE_RESULT_PATH, JSON.stringify({ serverSecretMismatch }), "utf-8");
}
