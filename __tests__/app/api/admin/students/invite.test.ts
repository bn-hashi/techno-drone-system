import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole } from "@/types/prisma";

// NextAuth のセッションモック
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// serviceFactory モック
vi.mock("@/lib/serviceFactory", () => ({
  getSetupService: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { getSetupService } from "@/lib/serviceFactory";
import { POST } from "@/app/api/admin/students/[id]/invite/route";

const mockSendInviteEmail = vi.fn();

const adminSession = {
  user: { id: "admin-1", email: "admin@example.com", role: UserRole.ADMIN },
};

describe("POST /api/admin/students/[id]/invite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSetupService).mockReturnValue({
      sendInviteEmail: mockSendInviteEmail,
      setPassword: vi.fn(),
      agreeToTerms: vi.fn(),
    } as unknown as ReturnType<typeof getSetupService>);
  });

  it("test_POST_authenticated_admin_returns_200", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockSendInviteEmail.mockResolvedValue(undefined);

    const request = new Request("http://localhost/api/admin/students/user-1/invite", {
      method: "POST",
    });
    const params = { params: { id: "user-1" } };

    // Act
    const response = await POST(request, params);

    // Assert
    expect(response.status).toBe(200);
  });

  it("test_POST_authenticated_admin_calls_sendInviteEmail_with_userId", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockSendInviteEmail.mockResolvedValue(undefined);

    const request = new Request("http://localhost/api/admin/students/user-1/invite", {
      method: "POST",
    });
    const params = { params: { id: "user-1" } };

    // Act
    await POST(request, params);

    // Assert
    const callArgs = mockSendInviteEmail.mock.calls[0];
    expect(callArgs[0]).toBe("user-1");
  });

  it("test_POST_unauthenticated_returns_401", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(null);

    const request = new Request("http://localhost/api/admin/students/user-1/invite", {
      method: "POST",
    });
    const params = { params: { id: "user-1" } };

    // Act
    const response = await POST(request, params);

    // Assert
    expect(response.status).toBe(401);
  });

  it("test_POST_student_role_returns_403", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "student-1", role: UserRole.STUDENT },
    });

    const request = new Request("http://localhost/api/admin/students/user-1/invite", {
      method: "POST",
    });
    const params = { params: { id: "user-1" } };

    // Act
    const response = await POST(request, params);

    // Assert
    expect(response.status).toBe(403);
  });

  it("test_POST_user_not_found_returns_404", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    const { UserNotFoundError } = await import("@/services/errors");
    mockSendInviteEmail.mockRejectedValue(new UserNotFoundError("user-1"));

    const request = new Request("http://localhost/api/admin/students/user-1/invite", {
      method: "POST",
    });
    const params = { params: { id: "user-1" } };

    // Act
    const response = await POST(request, params);

    // Assert
    expect(response.status).toBe(404);
  });

  it("test_POST_unexpected_error_returns_500", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockSendInviteEmail.mockRejectedValue(new Error("Unexpected"));

    const request = new Request("http://localhost/api/admin/students/user-1/invite", {
      method: "POST",
    });
    const params = { params: { id: "user-1" } };

    // Act
    const response = await POST(request, params);

    // Assert
    expect(response.status).toBe(500);
  });
});
