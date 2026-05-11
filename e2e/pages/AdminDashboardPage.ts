import { type Page, expect } from "@playwright/test"

/**
 * Page Object Model for the /admin/* pages.
 *
 * The admin dashboard is only reachable by users with role ADMIN.
 * Accessing it as an unauthenticated user or as STUDENT redirects to /login.
 */
export class AdminDashboardPage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  async goto(): Promise<void> {
    await this.page.goto("/admin")
  }

  async expectAccessible(): Promise<void> {
    await expect(this.page).toHaveURL(/\/admin/)
    // Confirm we are NOT on the login page
    await expect(this.page.getByTestId("login-form")).not.toBeVisible()
  }

  async expectRedirectedToLogin(): Promise<void> {
    await expect(this.page).toHaveURL(/\/login/)
  }
}
