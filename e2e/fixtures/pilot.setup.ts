import { test as setup, expect } from "@playwright/test";
import { TEST_USERS, STORAGE_STATE } from "./test-users";

/**
 * Global setup: authenticate as PILOT and save browser storage state.
 *
 * Mirrors admin.setup.ts — uses page.request to sign in via NextAuth
 * directly, bypassing the browser form to avoid cold-start CSRF flakiness.
 */
setup("authenticate as PILOT", async ({ page }) => {
  const csrfRes = await page.request.get("/api/auth/csrf");
  expect(csrfRes.ok()).toBeTruthy();
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const signInRes = await page.request.post("/api/auth/callback/credentials", {
    form: {
      csrfToken,
      email: TEST_USERS.pilot.email,
      password: TEST_USERS.pilot.password,
      callbackUrl: `${process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"}/auth/role-redirect`,
      json: "true",
    },
  });
  expect(signInRes.ok()).toBeTruthy();
  const data = (await signInRes.json()) as { url: string };

  expect(data.url).not.toContain("csrf=true");
  expect(data.url).not.toContain("error=");

  await page.goto("/auth/role-redirect");

  // PILOT role-redirect destination is /flight/aircraft (see app/auth/role-redirect/route.ts)
  await expect(page).toHaveURL(/\/flight\/aircraft/);

  await page.context().storageState({ path: STORAGE_STATE.pilot });
});
