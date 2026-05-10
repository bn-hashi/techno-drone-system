import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Page Object Model for /setup/agreement
 *
 * This page is reached after a successful password submission.
 * The invite token is stored in sessionStorage under the key "setup_token".
 *
 * After checking the agreement checkbox and clicking the submit button,
 * the app calls POST /api/setup/agreement and redirects to /login?registered=1.
 */
export class SetupAgreementPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly agreementTextArea: Locator;
  readonly agreementCheckbox: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly invalidTokenMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    // Heading text defined in SetupAgreementForm.tsx
    this.heading = page.getByRole("heading", { name: "受講規約への同意" });
    // Scrollable terms-of-service box (pre element inside gray box)
    this.agreementTextArea = page.locator("pre");
    // Checkbox label text defined in SetupAgreementForm.tsx
    this.agreementCheckbox = page.getByLabel("受講規約を読み、内容に同意します");
    // Submit button text defined in SetupAgreementForm.tsx
    this.submitButton = page.getByRole("button", { name: "同意して本登録を完了する" });
    // Error paragraph rendered with role="alert".
    // Exclude Next.js's route announcer element (__next-route-announcer__) which
    // also has role="alert" and would cause a strict mode violation.
    this.errorMessage = page.locator('[role="alert"]:not([id="__next-route-announcer__"])').first();
    // Message shown when no token is found in sessionStorage or URL
    this.invalidTokenMessage = page.getByText(
      "無効なリンクです。招待メールのリンクを再度ご確認ください。"
    );
  }

  /**
   * Navigate to /setup/agreement with the token passed as a URL query param.
   *
   * NOTE: The form component first reads from sessionStorage, then falls back
   * to the URL query param. Passing the token via URL is safe in tests because
   * the test environment does not log browser history to production systems.
   */
  async goto(token: string): Promise<void> {
    await this.page.goto(`/setup/agreement?token=${encodeURIComponent(token)}`);
    await expect(this.heading).toBeVisible();
  }

  async gotoWithoutToken(): Promise<void> {
    await this.page.goto("/setup/agreement");
    await expect(this.invalidTokenMessage).toBeVisible();
  }

  /**
   * Inject the invite token directly into sessionStorage so the form picks it
   * up without relying on URL query params.  Call this after navigating to the
   * page (addInitScript runs before navigation, addEvalOnNewDocument is not
   * available in Playwright; evaluate runs after load).
   */
  async injectTokenViaSessionStorage(token: string): Promise<void> {
    await this.page.evaluate((t) => {
      sessionStorage.setItem("setup_token", t);
    }, token);
  }

  async checkAgreement(): Promise<void> {
    await this.agreementCheckbox.check();
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async agreeAndSubmit(): Promise<void> {
    await this.checkAgreement();
    await this.submit();
  }

  async expectErrorVisible(substring?: string): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    if (substring) {
      await expect(this.errorMessage).toContainText(substring);
    }
  }

  async expectRedirectedToLogin(): Promise<void> {
    await expect(this.page).toHaveURL(/\/login/);
  }
}
