import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole, UserStatus, CourseType } from "@/types/prisma";
import { UserNotFoundError, InvalidTransitionError } from "@/services/errors";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// serviceFactory モック — route は getUserManagementService() 経由でサービスを取得する
vi.mock("@/lib/serviceFactory", () => ({
  getUserManagementService: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { getUserManagementService } from "@/lib/serviceFactory";
import { PATCH } from "@/app/api/admin/users/[id]/status/route";

const mockUpdateStatus = vi.fn();

describe("PATCH /api/admin/users/[id]/status", () => {
  const adminSession = {
    user: { id: "admin-1", email: "admin@example.com", role: UserRole.ADMIN },
  };

  const mockSafeUser = {
    id: "user-1",
    email: "student@example.com",
    name: "Test Student",
    role: UserRole.STUDENT,
    courseType: CourseType.BEGINNER,
    status: UserStatus.EXAM_PASSED,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserManagementService).mockReturnValue({
      updateStatus: mockUpdateStatus,
    } as unknown as ReturnType<typeof getUserManagementService>);
  });

  it("test_PATCH_authenticated_admin_valid_transition_returns_200", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockUpdateStatus.mockResolvedValue(mockSafeUser);

    const request = new Request("http://localhost/api/admin/users/user-1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: UserStatus.EXAM_PASSED }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await PATCH(request, { params: { id: "user-1" } });

    expect(response.status).toBe(200);
  });

  it("test_PATCH_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const request = new Request("http://localhost/api/admin/users/user-1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: UserStatus.EXAM_PASSED }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await PATCH(request, { params: { id: "user-1" } });

    expect(response.status).toBe(401);
  });

  it("test_PATCH_student_role_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", email: "s@example.com", role: UserRole.STUDENT },
    });

    const request = new Request("http://localhost/api/admin/users/user-1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: UserStatus.EXAM_PASSED }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await PATCH(request, { params: { id: "user-1" } });

    expect(response.status).toBe(403);
  });

  it("test_PATCH_invalid_transition_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockUpdateStatus.mockRejectedValue(
      new InvalidTransitionError("ACTIVE", "PENDING_REGISTRATION")
    );

    const request = new Request("http://localhost/api/admin/users/user-1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: UserStatus.PENDING_REGISTRATION }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await PATCH(request, { params: { id: "user-1" } });

    expect(response.status).toBe(400);
  });

  it("test_PATCH_nonexistent_user_returns_404", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockUpdateStatus.mockRejectedValue(new UserNotFoundError("nonexistent"));

    const request = new Request("http://localhost/api/admin/users/nonexistent/status", {
      method: "PATCH",
      body: JSON.stringify({ status: UserStatus.EXAM_PASSED }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await PATCH(request, { params: { id: "nonexistent" } });

    expect(response.status).toBe(404);
  });

  it("test_PATCH_missing_status_field_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);

    const request = new Request("http://localhost/api/admin/users/user-1/status", {
      method: "PATCH",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    const response = await PATCH(request, { params: { id: "user-1" } });

    expect(response.status).toBe(400);
  });

  it("test_PATCH_unexpected_error_returns_500_with_generic_message", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockUpdateStatus.mockRejectedValue(new Error("DB connection failed"));

    const request = new Request("http://localhost/api/admin/users/user-1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: UserStatus.EXAM_PASSED }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await PATCH(request, { params: { id: "user-1" } });

    expect(response.status).toBe(500);
  });

  it("test_PATCH_unexpected_error_does_not_expose_internal_message", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockUpdateStatus.mockRejectedValue(new Error("DB connection failed"));

    const request = new Request("http://localhost/api/admin/users/user-1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: UserStatus.EXAM_PASSED }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await PATCH(request, { params: { id: "user-1" } });
    const body = await response.json();

    expect(body.error).toBe("内部エラーが発生しました");
  });
});
