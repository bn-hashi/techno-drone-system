import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Page Object Model for /setup/password
 *
 * This page is reached via the invitation link:
 *   /setup/password?token=<invite-token>
 *
 * After a successful password submission the app redirects to /setup/agreement.
 */
export class SetupPasswordPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly invalidTokenMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    // Heading text defined in SetupPasswordForm.tsx
    this.heading = page.getByRole("heading", { name: "パスワードの設定" });
    // Input locators via label text (rendered by the Input component)
    this.passwordInput = page.getByLabel("パスワード").first();
    this.confirmPasswordInput = page.getByLabel("パスワード（確認）");
    // Submit button text defined in SetupPasswordForm.tsx
    this.submitButton = page.getByRole("button", { name: "次へ（規約の確認）" });
    // Error paragraph rendered with role="alert".
    // Exclude Next.js's route announcer element (__next-route-announcer__) which
    // also has role="alert" and would cause a strict mode violation.
    this.errorMessage = page.locator('[role="alert"]:not([id="__next-route-announcer__"])').first();
    // Message shown when token query param is absent
    this.invalidTokenMessage = page.getByText(
      "無効なリンクです。招待メールのリンクを再度ご確認ください。"
    );
  }

  async goto(token: string): Promise<void> {
    await this.page.goto(`/setup/password?token=${encodeURIComponent(token)}`);
    await expect(this.heading).toBeVisible();
  }

  async gotoWithoutToken(): Promise<void> {
    await this.page.goto("/setup/password");
    await expect(this.invalidTokenMessage).toBeVisible();
  }

  async fillPassword(password: string): Promise<void> {
    await this.passwordInput.fill(password);
  }

  async fillConfirmPassword(password: string): Promise<void> {
    await this.confirmPasswordInput.fill(password);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async fillAndSubmit(password: string, confirmPassword?: string): Promise<void> {
    await this.fillPassword(password);
    await this.fillConfirmPassword(confirmPassword ?? password);
    await this.submit();
  }

  async expectErrorVisible(substring?: string): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    if (substring) {
      await expect(this.errorMessage).toContainText(substring);
    }
  }

  async expectRedirectedToAgreement(): Promise<void> {
    await expect(this.page).toHaveURL(/\/setup\/agreement/);
  }
}
