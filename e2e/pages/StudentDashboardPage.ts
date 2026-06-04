import { type Page, expect } from "@playwright/test";

/**
 * Page Object Model for the /student/* pages.
 *
 * The student dashboard is only reachable by users with role STUDENT.
 * Accessing it as an unauthenticated user or as ADMIN redirects to /login.
 */
export class StudentDashboardPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(): Promise<void> {
    await this.page.goto("/student");
  }

  async expectAccessible(): Promise<void> {
    await expect(this.page).toHaveURL(/\/student/);
    // Confirm we are NOT on the login page
    await expect(this.page.getByTestId("login-form")).not.toBeVisible();
  }

  async expectRedirectedToLogin(): Promise<void> {
    await expect(this.page).toHaveURL(/\/login/);
  }

  /** 科目別進捗バー (role="progressbar") が少なくとも 1 件表示されていること */
  async expectProgressBarVisible(): Promise<void> {
    await expect(this.page.getByRole("progressbar").first()).toBeVisible();
  }

  /** 表示中の進捗バーの本数を検証する (本番 seed の 4 科目分が表示される想定) */
  async expectSubjectCount(count: number): Promise<void> {
    const list = this.page.getByTestId("subject-progress-list");
    await expect(list.locator("li")).toHaveCount(count);
  }
}
