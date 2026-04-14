import { test as setup, expect } from "@playwright/test"
import { TEST_USERS, STORAGE_STATE } from "./test-users"

/**
 * Global setup: authenticate as ADMIN and save browser storage state.
 *
 * Uses Playwright's page.request (shares cookies with the browser context)
 * to call the NextAuth API directly, bypassing the browser form.
 * This avoids intermittent CSRF failures that occur when next-auth/react
 * fetches the CSRF token inside a cold-started dev server.
 */
setup("authenticate as ADMIN", async ({ page }) => {
  // Step 1: Fetch the CSRF token. This also sets the next-auth.csrf-token
  // cookie in the shared browser context.
  const csrfRes = await page.request.get("/api/auth/csrf")
  expect(csrfRes.ok()).toBeTruthy()
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string }

  // Step 2: POST credentials directly to NextAuth.
  // page.request shares the cookie jar with the browser page, so the
  // csrf-token cookie from step 1 is automatically included.
  const signInRes = await page.request.post("/api/auth/callback/credentials", {
    form: {
      csrfToken,
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
      callbackUrl: "http://localhost:3000/auth/role-redirect",
      json: "true",
    },
  })
  expect(signInRes.ok()).toBeTruthy()
  const data = (await signInRes.json()) as { url: string }

  // A CSRF failure returns ?csrf=true; credential failure returns ?error=...
  expect(data.url).not.toContain("csrf=true")
  expect(data.url).not.toContain("error=")

  // Step 3: Navigate to the role-redirect handler.
  // The session cookie set in step 2 is available to the browser page
  // because page.request and page share the same cookie jar.
  await page.goto("/auth/role-redirect")

  // Confirm we have reached the admin area
  await expect(page).toHaveURL(/\/admin/)

  // Step 4: Persist the authenticated session to disk
  await page.context().storageState({ path: STORAGE_STATE.admin })
})
