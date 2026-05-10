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
import { createHmac } from "crypto";
import path from "path";
import fs from "fs";

// E2E-only fallback secret used when INVITE_TOKEN_SECRET is not present in
// .env.local.  The value must match what is passed to webServer.env in
// playwright.config.ts so the server and the test workers share the same secret.
const E2E_FALLBACK_INVITE_TOKEN_SECRET = "e2e-invite-token-secret-for-playwright-minimum-32chars";

// Path where the probe result is written so test workers can read it
const PROBE_RESULT_PATH = path.resolve(process.cwd(), "e2e/test-results/.server-probe.json");

function buildProbeToken(secret: string): string {
  const TOKEN_EXPIRY_MS = 72 * 60 * 60 * 1000;
  const payload = { userId: "probe-user-id", exp: Date.now() + TOKEN_EXPIRY_MS };
  const payloadBase64 = Buffer.from(JSON.stringify(payload))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const hmac = createHmac("sha256", secret);
  hmac.update(payloadBase64);
  const signature = hmac.digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  return `${payloadBase64}.${signature}`;
}

export default async function globalSetup(): Promise<void> {
  // Merge .env.local into process.env (does not override already-set vars)
  config({ path: path.resolve(process.cwd(), ".env.local") });

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
  const probeToken = buildProbeToken(process.env.INVITE_TOKEN_SECRET);

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
            `Fix: Add INVITE_TOKEN_SECRET=${process.env.INVITE_TOKEN_SECRET} to .env.local and restart the server.\n`
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
