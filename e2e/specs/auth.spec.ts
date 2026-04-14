import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/LoginPage";
import { StudentDashboardPage } from "../pages/StudentDashboardPage";
import { AdminDashboardPage } from "../pages/AdminDashboardPage";
import { TEST_USERS, STORAGE_STATE } from "../fixtures/test-users";

// ============================================================
// CRITICAL: Unauthenticated redirect
// ============================================================

test.describe("Unauthenticated user redirect", () => {
  // Each test starts with a fresh unauthenticated browser context
  test.use({ storageState: { cookies: [], origins: [] } });

  test("visiting /student redirects to /login", async ({ page }) => {
    const studentPage = new StudentDashboardPage(page);
    await studentPage.goto();
    await studentPage.expectRedirectedToLogin();
  });

  test("visiting /admin redirects to /login", async ({ page }) => {
    const adminPage = new AdminDashboardPage(page);
    await adminPage.goto();
    await adminPage.expectRedirectedToLogin();
  });
});

// ============================================================
// CRITICAL: Login flow — happy path
// ============================================================

test.describe("Login flow — happy path", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("STUDENT credentials redirect to /student", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.loginAndWaitForNavigation(
      TEST_USERS.student.email,
      TEST_USERS.student.password,
      "/student"
    );

    await expect(page).toHaveURL(/\/student/);
  });

  test("ADMIN credentials redirect to /admin", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.loginAndWaitForNavigation(
      TEST_USERS.admin.email,
      TEST_USERS.admin.password,
      "/admin"
    );

    await expect(page).toHaveURL(/\/admin/);
  });
});

// ============================================================
// IMPORTANT: Login flow — error handling
// ============================================================

test.describe("Login flow — error handling", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("invalid credentials show error message", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Submit wrong password; NextAuth signIn with redirect:true will
    // redirect back to /login?error=CredentialsSignin on failure
    await loginPage.emailInput.fill("nonexistent@example.com");
    await loginPage.passwordInput.fill("WrongPassword#999");

    // Wait for NextAuth to redirect back to /login?error=CredentialsSignin
    await Promise.all([page.waitForURL(/error=/), loginPage.submitButton.click()]);

    // URL should contain error param (redirect:true path)
    // or DOM error may be visible (redirect:false path)
    const urlHasError = page.url().includes("error");
    const domErrorVisible = await loginPage.errorMessage.isVisible().catch(() => false);

    expect(urlHasError || domErrorVisible).toBe(true);
  });

  test("PENDING_REGISTRATION user is rejected at login", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.emailInput.fill(TEST_USERS.pendingUser.email);
    await loginPage.passwordInput.fill(TEST_USERS.pendingUser.password);

    // Wait for NextAuth to redirect back to /login?error=CredentialsSignin
    await Promise.all([page.waitForURL(/error=/), loginPage.submitButton.click()]);

    const urlHasError = page.url().includes("error");
    const domErrorVisible = await loginPage.errorMessage.isVisible().catch(() => false);

    expect(urlHasError || domErrorVisible).toBe(true);
  });
});

// ============================================================
// CRITICAL: Role-based access control
// ============================================================

test.describe("Role-based access control — STUDENT", () => {
  test.use({ storageState: STORAGE_STATE.student });

  test("STUDENT can access /student", async ({ page }) => {
    const studentPage = new StudentDashboardPage(page);
    await studentPage.goto();
    await studentPage.expectAccessible();
  });

  test("STUDENT accessing /admin is redirected to /login", async ({ page }) => {
    const adminPage = new AdminDashboardPage(page);
    await adminPage.goto();
    await adminPage.expectRedirectedToLogin();
  });
});

test.describe("Role-based access control — ADMIN", () => {
  test.use({ storageState: STORAGE_STATE.admin });

  test("ADMIN can access /admin", async ({ page }) => {
    const adminPage = new AdminDashboardPage(page);
    await adminPage.goto();
    await adminPage.expectAccessible();
  });

  test("ADMIN accessing /student is redirected to /login", async ({ page }) => {
    const studentPage = new StudentDashboardPage(page);
    await studentPage.goto();
    await studentPage.expectRedirectedToLogin();
  });
});

// ============================================================
// IMPORTANT: Session persistence
// ============================================================

test.describe("Session persistence", () => {
  test("STUDENT session is preserved after page reload", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: STORAGE_STATE.student,
    });
    const page = await context.newPage();

    // First navigation — should succeed
    await page.goto("/student");
    await expect(page).toHaveURL(/\/student/);

    // Reload the page
    await page.reload();

    // Session should still be valid
    await expect(page).toHaveURL(/\/student/);
    await expect(page.getByTestId("login-form")).not.toBeVisible();

    await context.close();
  });

  test("ADMIN session is preserved after page reload", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: STORAGE_STATE.admin,
    });
    const page = await context.newPage();

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);

    await page.reload();

    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByTestId("login-form")).not.toBeVisible();

    await context.close();
  });
});
