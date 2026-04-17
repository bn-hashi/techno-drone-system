import { test as base, type BrowserContext } from "@playwright/test"
import { STORAGE_STATE } from "./test-users"

/**
 * Extended Playwright test fixture that provides pre-authenticated browser
 * contexts for STUDENT and ADMIN roles.
 *
 * Usage:
 *   import { test } from "../fixtures/auth-fixtures"
 *
 *   test("student can access dashboard", async ({ studentContext }) => {
 *     const page = await studentContext.newPage()
 *     ...
 *   })
 */

type AuthFixtures = {
  studentContext: BrowserContext
  adminContext: BrowserContext
}

export const test = base.extend<AuthFixtures>({
  studentContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: STORAGE_STATE.student,
    })
    await use(context)
    await context.close()
  },

  adminContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: STORAGE_STATE.admin,
    })
    await use(context)
    await context.close()
  },
})

export { expect } from "@playwright/test"
