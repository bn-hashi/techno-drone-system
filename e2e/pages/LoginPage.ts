import { type Page, type Locator, expect } from "@playwright/test"

/**
 * Page Object Model for the /login page.
 *
 * Uses data-testid selectors exclusively so the tests remain
 * decoupled from CSS class names and DOM structure.
 */
export class LoginPage {
  readonly page: Page
  readonly form: Locator
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator
  readonly errorMessage: Locator

  constructor(page: Page) {
    this.page = page
    this.form = page.getByTestId("login-form")
    this.emailInput = page.getByTestId("email-input")
    this.passwordInput = page.getByTestId("password-input")
    this.submitButton = page.getByTestId("login-submit")
    this.errorMessage = page.getByTestId("login-error")
  }

  async goto(): Promise<void> {
    await this.page.goto("/login")
    await expect(this.form).toBeVisible()
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }

  async loginAndWaitForNavigation(
    email: string,
    password: string,
    expectedPath: string
  ): Promise<void> {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)

    await Promise.all([
      this.page.waitForURL(`**${expectedPath}**`),
      this.submitButton.click(),
    ])
  }

  async expectErrorVisible(messageSubstring?: string): Promise<void> {
    await expect(this.errorMessage).toBeVisible()
    if (messageSubstring) {
      await expect(this.errorMessage).toContainText(messageSubstring)
    }
  }

  async expectOnLoginPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/login/)
    await expect(this.form).toBeVisible()
  }
}
