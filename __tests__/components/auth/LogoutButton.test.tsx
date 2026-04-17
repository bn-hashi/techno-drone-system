import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LogoutButton } from "@/components/auth/LogoutButton";

// next-auth/react をモック
vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

import { signOut } from "next-auth/react";

describe("LogoutButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("test_LogoutButton_renders_button", () => {
    render(<LogoutButton />);
    const button = screen.getByRole("button", { name: /ログアウト/i });
    expect(button).toBeInTheDocument();
  });

  it("test_LogoutButton_calls_signOut_with_login_callbackUrl_on_click", async () => {
    vi.mocked(signOut).mockResolvedValue(undefined as never);

    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: /ログアウト/i }));

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
    });
  });

  it("test_LogoutButton_shows_loading_state_while_signing_out", async () => {
    // signOut がすぐには完了しない状態をシミュレート
    vi.mocked(signOut).mockReturnValue(new Promise(() => {}) as never);

    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: /ログアウト/i }));

    await waitFor(() => {
      expect(screen.getByRole("button")).toBeDisabled();
    });
  });

  it("test_LogoutButton_is_enabled_before_click", () => {
    render(<LogoutButton />);
    expect(screen.getByRole("button", { name: /ログアウト/i })).not.toBeDisabled();
  });

  it("test_LogoutButton_resets_loading_state_on_signOut_failure", async () => {
    vi.mocked(signOut).mockRejectedValue(new Error("network error"));

    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: /ログアウト/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /ログアウト/i })).not.toBeDisabled();
    });
  });
});
