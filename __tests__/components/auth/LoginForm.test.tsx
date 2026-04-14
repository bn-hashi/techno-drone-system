import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoginForm } from "@/components/auth/LoginForm";

// next-auth/react をモック
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

// next/navigation をモック
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
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

  it("test_LoginForm_success_does_not_push_error_route", async () => {
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

    // router.push should NOT be called on success; navigation is via window.location.href
    expect(mockPush).not.toHaveBeenCalled();
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

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/login?error=CredentialsSignin");
    });
  });
});
