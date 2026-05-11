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

  describe("rendering", () => {
    it("test_LoginForm_renders_email_input", () => {
      render(<LoginForm />);
      expect(screen.getByTestId("email-input")).toBeInTheDocument();
    });

    it("test_LoginForm_renders_password_input", () => {
      render(<LoginForm />);
      expect(screen.getByTestId("password-input")).toBeInTheDocument();
    });

    it("test_LoginForm_renders_submit_button", () => {
      render(<LoginForm />);
      expect(screen.getByTestId("login-submit")).toBeInTheDocument();
    });
  });

  describe("success", () => {
    beforeEach(async () => {
      // SUCCESS: next-auth v4 returns undefined after setting window.location.href
      vi.mocked(signIn).mockResolvedValue(undefined);
      render(<LoginForm />);
      fireEvent.change(screen.getByTestId("email-input"), {
        target: { value: "test@example.com" },
      });
      fireEvent.change(screen.getByTestId("password-input"), {
        target: { value: "password123" },
      });
    });

    it("test_LoginForm_submit_calls_signIn_with_credentials", async () => {
      fireEvent.click(screen.getByTestId("login-submit"));

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
      fireEvent.click(screen.getByTestId("login-submit"));

      await waitFor(() => expect(signIn).toHaveBeenCalled());

      // エラーメッセージは表示されない
      expect(screen.queryByTestId("login-error")).not.toBeInTheDocument();
    });
  });

  describe("CredentialsSignin error", () => {
    beforeEach(async () => {
      vi.mocked(signIn).mockResolvedValue({
        ok: false,
        error: "CredentialsSignin",
        status: 401,
        url: null,
      });
      render(<LoginForm />);
      fireEvent.change(screen.getByTestId("email-input"), {
        target: { value: "test@example.com" },
      });
      fireEvent.change(screen.getByTestId("password-input"), {
        target: { value: "wrongpassword" },
      });
      fireEvent.click(screen.getByTestId("login-submit"));
    });

    it("test_LoginForm_shows_error_element_on_failed_signIn", async () => {
      await waitFor(() => {
        expect(screen.getByTestId("login-error")).toBeInTheDocument();
      });
    });

    it("test_LoginForm_displays_invalid_credentials_message_on_failed_signIn", async () => {
      await waitFor(() => {
        expect(screen.getByTestId("login-error")).toHaveTextContent(
          "メールアドレスまたはパスワードが正しくありません。"
        );
      });
    });
  });

  describe("account_not_active error", () => {
    beforeEach(async () => {
      vi.mocked(signIn).mockResolvedValue({
        ok: false,
        error: "account_not_active",
        status: 401,
        url: null,
      });
      render(<LoginForm />);
      fireEvent.change(screen.getByTestId("email-input"), {
        target: { value: "test@example.com" },
      });
      fireEvent.change(screen.getByTestId("password-input"), {
        target: { value: "password123" },
      });
      fireEvent.click(screen.getByTestId("login-submit"));
    });

    it("test_LoginForm_shows_error_element_on_account_not_active", async () => {
      await waitFor(() => {
        expect(screen.getByTestId("login-error")).toBeInTheDocument();
      });
    });

    it("test_LoginForm_displays_account_not_active_error_message", async () => {
      await waitFor(() => {
        expect(screen.getByTestId("login-error")).toHaveTextContent(
          "アカウント登録が完了していません。"
        );
      });
    });
  });

  describe("account_pending error", () => {
    beforeEach(async () => {
      vi.mocked(signIn).mockResolvedValue({
        ok: false,
        error: "account_pending",
        status: 401,
        url: null,
      });
      render(<LoginForm />);
      fireEvent.change(screen.getByTestId("email-input"), {
        target: { value: "test@example.com" },
      });
      fireEvent.change(screen.getByTestId("password-input"), {
        target: { value: "password123" },
      });
      fireEvent.click(screen.getByTestId("login-submit"));
    });

    it("test_LoginForm_shows_error_element_on_account_pending", async () => {
      await waitFor(() => {
        expect(screen.getByTestId("login-error")).toBeInTheDocument();
      });
    });

    it("test_LoginForm_displays_account_pending_error_message", async () => {
      await waitFor(() => {
        expect(screen.getByTestId("login-error")).toHaveTextContent("本登録メールをご確認ください。");
      });
    });
  });

  describe("unknown error code", () => {
    beforeEach(async () => {
      vi.mocked(signIn).mockResolvedValue({
        ok: false,
        error: "UNKNOWN_ERROR_CODE",
        status: 500,
        url: null,
      });
      render(<LoginForm />);
      fireEvent.change(screen.getByTestId("email-input"), {
        target: { value: "test@example.com" },
      });
      fireEvent.change(screen.getByTestId("password-input"), {
        target: { value: "password123" },
      });
      fireEvent.click(screen.getByTestId("login-submit"));
    });

    it("test_LoginForm_shows_error_element_on_unknown_error_code", async () => {
      await waitFor(() => {
        expect(screen.getByTestId("login-error")).toBeInTheDocument();
      });
    });

    it("test_LoginForm_displays_fallback_error_for_unknown_error_code", async () => {
      await waitFor(() => {
        expect(screen.getByTestId("login-error")).toHaveTextContent(
          "ログインに失敗しました。もう一度お試しください。"
        );
      });
    });
  });
});
