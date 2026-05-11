import { describe, it, expect, beforeEach, vi } from "vitest";

// serviceFactory モック
vi.mock("@/lib/serviceFactory", () => ({
  getSetupService: vi.fn(),
}));

import { getSetupService } from "@/lib/serviceFactory";
import { POST } from "@/app/api/setup/password/route";
import { BusinessError } from "@/services/errors";

const mockSetPassword = vi.fn();

describe("POST /api/setup/password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSetupService).mockReturnValue({
      sendInviteEmail: vi.fn(),
      setPassword: mockSetPassword,
      agreeToTerms: vi.fn(),
    } as unknown as ReturnType<typeof getSetupService>);
  });

  it("test_POST_valid_body_returns_200", async () => {
    // Arrange
    mockSetPassword.mockResolvedValue(undefined);
    const request = new Request("http://localhost/api/setup/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "valid-token", password: "Password1" }),
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(200);
  });

  it("test_POST_valid_body_calls_setPassword_with_token_and_password", async () => {
    // Arrange
    mockSetPassword.mockResolvedValue(undefined);
    const request = new Request("http://localhost/api/setup/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "valid-token", password: "Password1" }),
    });

    // Act
    await POST(request);

    // Assert
    expect(mockSetPassword).toHaveBeenCalledWith("valid-token", "Password1");
  });

  it("test_POST_missing_token_returns_400", async () => {
    // Arrange
    const request = new Request("http://localhost/api/setup/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "Password1" }),
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(400);
  });

  it("test_POST_missing_password_returns_400", async () => {
    // Arrange
    const request = new Request("http://localhost/api/setup/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "valid-token" }),
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(400);
  });

  it("test_POST_BusinessError_returns_400", async () => {
    // Arrange
    mockSetPassword.mockRejectedValue(
      new BusinessError("パスワードポリシー違反")
    );
    const request = new Request("http://localhost/api/setup/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "invalid-token", password: "weak" }),
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(400);
  });

  it("test_POST_BusinessError_response_contains_error_message", async () => {
    // Arrange
    mockSetPassword.mockRejectedValue(
      new BusinessError("パスワードポリシー違反")
    );
    const request = new Request("http://localhost/api/setup/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "invalid-token", password: "weak" }),
    });

    // Act
    const response = await POST(request);
    const body = await response.json();

    // Assert
    expect(body.error).toBe("パスワードポリシー違反");
  });

  it("test_POST_unexpected_error_returns_500", async () => {
    // Arrange
    mockSetPassword.mockRejectedValue(new Error("Unexpected"));
    const request = new Request("http://localhost/api/setup/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "valid-token", password: "Password1" }),
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(500);
  });
});
