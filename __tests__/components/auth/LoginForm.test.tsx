import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoginForm } from "@/components/auth/LoginForm";

// next-auth/react をモック
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

import { signIn } from "next-auth/react";

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("test_LoginForm_renders_email_input", () => {
    render(<LoginForm />);
    const emailInput = screen.getByPlaceholderText(/email/i) as HTMLInputElement;
    expect(emailInput).toBeInTheDocument();
  });

  it("test_LoginForm_renders_password_input", () => {
    render(<LoginForm />);
    const passwordInput = screen.getByPlaceholderText(/password/i) as HTMLInputElement;
    expect(passwordInput).toBeInTheDocument();
  });

  it("test_LoginForm_renders_submit_button", () => {
    render(<LoginForm />);
    const submitButton = screen.getByRole("button", { name: /login|sign in/i });
    expect(submitButton).toBeInTheDocument();
  });

  it("test_LoginForm_submit_calls_signIn_with_credentials", async () => {
    // SUCCESS: next-auth v4 returns undefined after setting window.location.href
    vi.mocked(signIn).mockResolvedValue(undefined);

    render(<LoginForm />);

    const emailInput = screen.getByPlaceholderText(/email/i) as HTMLInputElement;
    const passwordInput = screen.getByPlaceholderText(/password/i) as HTMLInputElement;
    const submitButton = screen.getByRole("button", { name: /login|sign in/i });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith("credentials", {
        email: "test@example.com",
        password: "password123",
        redirect: false,
        callbackUrl: "/auth/role-redirect",
      });
    });
  });

  it("test_LoginForm_success_does_not_show_error", async () => {
    // SUCCESS: next-auth v4 navigates via window.location.href then returns undefined
    vi.mocked(signIn).mockResolvedValue(undefined);

    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /login|sign in/i }));

    await waitFor(() => expect(signIn).toHaveBeenCalled());

    // エラーメッセージは表示されない
    expect(screen.queryByTestId("login-error")).not.toBeInTheDocument();
  });

  it("test_LoginForm_displays_error_on_failed_signIn", async () => {
    // FAILURE: next-auth v4 returns { ok: false, error: "CredentialsSignin" }
    vi.mocked(signIn).mockResolvedValue({
      ok: false,
      error: "CredentialsSignin",
      status: 401,
      url: null,
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/password/i), {
      target: { value: "wrongpassword" },
    });
    fireEvent.click(screen.getByRole("button", { name: /login|sign in/i }));

    // URLへの露出ではなく、フォーム内にエラーメッセージを表示する
    await waitFor(() => {
      expect(screen.getByTestId("login-error")).toBeInTheDocument();
      expect(screen.getByTestId("login-error")).toHaveTextContent(
        "メールアドレスまたはパスワードが正しくありません。"
      );
    });
  });

  it("test_LoginForm_displays_account_not_active_error_message", async () => {
    vi.mocked(signIn).mockResolvedValue({
      ok: false,
      error: "account_not_active",
      status: 401,
      url: null,
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /login|sign in/i }));

    await waitFor(() => {
      expect(screen.getByTestId("login-error")).toBeInTheDocument();
      expect(screen.getByTestId("login-error")).toHaveTextContent(
        "アカウント登録が完了していません。"
      );
    });
  });

  it("test_LoginForm_displays_account_pending_error_message", async () => {
    vi.mocked(signIn).mockResolvedValue({
      ok: false,
      error: "account_pending",
      status: 401,
      url: null,
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /login|sign in/i }));

    await waitFor(() => {
      expect(screen.getByTestId("login-error")).toBeInTheDocument();
      expect(screen.getByTestId("login-error")).toHaveTextContent("本登録メールをご確認ください。");
    });
  });

  it("test_LoginForm_displays_fallback_error_for_unknown_error_code", async () => {
    vi.mocked(signIn).mockResolvedValue({
      ok: false,
      error: "UNKNOWN_ERROR_CODE",
      status: 500,
      url: null,
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByPlaceholderText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /login|sign in/i }));

    await waitFor(() => {
      expect(screen.getByTestId("login-error")).toBeInTheDocument();
      expect(screen.getByTestId("login-error")).toHaveTextContent(
        "ログインに失敗しました。もう一度お試しください。"
      );
    });
  });
});
