import { type Page, type Locator, expect } from "@playwright/test"

/**
 * Page Object Model for the document upload page.
 *
 * This POM is prepared for a future student-facing document upload UI.
 * The target URL is expected to be /student/enrollment/documents.
 *
 * All locators use data-testid selectors so the tests remain decoupled
 * from CSS class names and DOM structure.
 */
export class DocumentUploadPage {
  readonly page: Page

  // Form container
  readonly uploadForm: Locator

  // File input locators — one per document field
  readonly idDocumentInput: Locator
  readonly photoInput: Locator
  readonly experienceCertInput: Locator

  // Feedback locators
  readonly submitButton: Locator
  readonly successMessage: Locator
  readonly errorMessage: Locator

  static readonly URL = "/student/enrollment/documents"

  constructor(page: Page) {
    this.page = page
    this.uploadForm = page.getByTestId("document-upload-form")
    this.idDocumentInput = page.getByTestId("id-document-input")
    this.photoInput = page.getByTestId("photo-input")
    this.experienceCertInput = page.getByTestId("experience-cert-input")
    this.submitButton = page.getByTestId("document-upload-submit")
    this.successMessage = page.getByTestId("document-upload-success")
    this.errorMessage = page.getByTestId("document-upload-error")
  }

  async goto(): Promise<void> {
    await this.page.goto(DocumentUploadPage.URL)
  }

  /**
   * Upload a single file to the idDocument field and submit the form.
   *
   * @param filePath - Absolute path to the file to upload
   */
  async uploadIdDocument(filePath: string): Promise<void> {
    await this.idDocumentInput.setInputFiles(filePath)
    await this.submitButton.click()
  }

  /**
   * Expect the success message to be visible after a successful upload.
   */
  async expectUploadSuccess(): Promise<void> {
    await expect(this.successMessage).toBeVisible()
    await expect(this.errorMessage).not.toBeVisible()
  }

  /**
   * Expect an error message containing the given substring to be visible.
   *
   * @param messageSubstring - Text fragment to look for in the error element
   */
  async expectErrorVisible(messageSubstring?: string): Promise<void> {
    await expect(this.errorMessage).toBeVisible()
    if (messageSubstring) {
      await expect(this.errorMessage).toContainText(messageSubstring)
    }
  }

  async expectRedirectedToLogin(): Promise<void> {
    await expect(this.page).toHaveURL(/\/login/)
  }
}
