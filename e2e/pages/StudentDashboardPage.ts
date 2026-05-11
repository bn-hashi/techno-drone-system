import { type Page, expect } from "@playwright/test"

/**
 * Page Object Model for the /student/* pages.
 *
 * The student dashboard is only reachable by users with role STUDENT.
 * Accessing it as an unauthenticated user or as ADMIN redirects to /login.
 */
export class StudentDashboardPage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  async goto(): Promise<void> {
    await this.page.goto("/student")
  }

  async expectAccessible(): Promise<void> {
    await expect(this.page).toHaveURL(/\/student/)
    // Confirm we are NOT on the login page
    await expect(this.page.getByTestId("login-form")).not.toBeVisible()
  }

  async expectRedirectedToLogin(): Promise<void> {
    await expect(this.page).toHaveURL(/\/login/)
  }
}
