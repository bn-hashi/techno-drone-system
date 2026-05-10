import { describe, it, expect, beforeEach, vi } from "vitest";

// token モック
vi.mock("@/lib/token", () => ({
  verifyInviteToken: vi.fn(),
}));

// serviceFactory モック
vi.mock("@/lib/serviceFactory", () => ({
  getSetupService: vi.fn(),
}));

import * as tokenModule from "@/lib/token";
import { getSetupService } from "@/lib/serviceFactory";
import { POST } from "@/app/api/setup/agreement/route";

const mockAgreeToTerms = vi.fn();

describe("POST /api/setup/agreement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSetupService).mockReturnValue({
      sendInviteEmail: vi.fn(),
      setPassword: vi.fn(),
      agreeToTerms: mockAgreeToTerms,
    } as unknown as ReturnType<typeof getSetupService>);
  });

  it("test_POST_valid_token_returns_200", async () => {
    // Arrange
    vi.mocked(tokenModule.verifyInviteToken).mockReturnValue({
      userId: "user-1",
    });
    mockAgreeToTerms.mockResolvedValue(undefined);

    const request = new Request("http://localhost/api/setup/agreement", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "192.168.1.1",
      },
      body: JSON.stringify({ token: "valid-token" }),
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(200);
  });

  it("test_POST_valid_token_calls_agreeToTerms_with_userId", async () => {
    // Arrange
    vi.mocked(tokenModule.verifyInviteToken).mockReturnValue({
      userId: "user-1",
    });
    mockAgreeToTerms.mockResolvedValue(undefined);

    const request = new Request("http://localhost/api/setup/agreement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "valid-token" }),
    });

    // Act
    await POST(request);

    // Assert
    const callArgs = mockAgreeToTerms.mock.calls[0];
    expect(callArgs[0]).toBe("user-1");
  });

  it("test_POST_invalid_token_returns_400", async () => {
    // Arrange
    vi.mocked(tokenModule.verifyInviteToken).mockReturnValue(null);

    const request = new Request("http://localhost/api/setup/agreement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "invalid-token" }),
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(400);
  });

  it("test_POST_missing_token_returns_400", async () => {
    // Arrange
    const request = new Request("http://localhost/api/setup/agreement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(400);
  });

  it("test_POST_unexpected_error_returns_500", async () => {
    // Arrange
    vi.mocked(tokenModule.verifyInviteToken).mockReturnValue({
      userId: "user-1",
    });
    mockAgreeToTerms.mockRejectedValue(new Error("Unexpected"));

    const request = new Request("http://localhost/api/setup/agreement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "valid-token" }),
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(500);
  });
});
