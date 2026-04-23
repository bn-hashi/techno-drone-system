import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole, UserStatus, CourseType } from "@/types/prisma";

// NextAuth のセッションモック
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// UserManagementService モック
vi.mock("@/services/userManagementService", () => ({
  UserManagementService: vi.fn(),
}));

// UserRepository モック
vi.mock("@/repositories/userRepository", () => ({
  UserRepository: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { UserManagementService } from "@/services/userManagementService";
import { GET, POST } from "@/app/api/admin/users/route";

const mockListUsers = vi.fn();
const mockCreateUser = vi.fn();

describe("GET /api/admin/users", () => {
  const adminSession = {
    user: { id: "admin-1", email: "admin@example.com", role: UserRole.ADMIN },
  };

  const mockSafeUser = {
    id: "user-1",
    email: "student@example.com",
    name: "Test Student",
    role: UserRole.STUDENT,
    courseType: CourseType.BEGINNER,
    status: UserStatus.ACTIVE,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(UserManagementService).mockImplementation(
      () => ({ listUsers: mockListUsers, createUser: mockCreateUser }) as unknown as UserManagementService
    );
  });

  it("GET_authenticated_admin_returns_200_with_users", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListUsers.mockResolvedValue([mockSafeUser]);

    const request = new Request("http://localhost/api/admin/users");
    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  it("GET_authenticated_admin_response_contains_users_array", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListUsers.mockResolvedValue([mockSafeUser]);

    const request = new Request("http://localhost/api/admin/users");
    const response = await GET(request);
    const body = await response.json();

    expect(body.users).toHaveLength(1);
  });

  it("GET_with_status_query_param_passes_filter_to_service", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListUsers.mockResolvedValue([]);

    const request = new Request(
      "http://localhost/api/admin/users?status=ACTIVE"
    );
    await GET(request);

    expect(mockListUsers).toHaveBeenCalledWith({ status: UserStatus.ACTIVE });
  });

  it("GET_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const request = new Request("http://localhost/api/admin/users");
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("GET_student_role_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", email: "s@example.com", role: UserRole.STUDENT },
    });

    const request = new Request("http://localhost/api/admin/users");
    const response = await GET(request);

    expect(response.status).toBe(403);
  });

  it("GET_invalid_status_param_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);

    const request = new Request(
      "http://localhost/api/admin/users?status=INVALID_STATUS"
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
  });
});

describe("POST /api/admin/users", () => {
  const adminSession = {
    user: { id: "admin-1", email: "admin@example.com", role: UserRole.ADMIN },
  };

  const validBody = {
    email: "new@example.com",
    name: "New Student",
    password: "password123",
    courseType: CourseType.BEGINNER,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(UserManagementService).mockImplementation(
      () => ({ listUsers: mockListUsers, createUser: mockCreateUser }) as unknown as UserManagementService
    );
  });

  it("POST_authenticated_admin_valid_body_returns_201", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockCreateUser.mockResolvedValue({
      id: "user-new",
      ...validBody,
      role: UserRole.STUDENT,
      status: UserStatus.PENDING_REGISTRATION,
    });

    const request = new Request("http://localhost/api/admin/users", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
  });

  it("POST_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const request = new Request("http://localhost/api/admin/users", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("POST_student_role_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", email: "s@example.com", role: UserRole.STUDENT },
    });

    const request = new Request("http://localhost/api/admin/users", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);

    expect(response.status).toBe(403);
  });

  it("POST_missing_required_fields_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);

    const request = new Request("http://localhost/api/admin/users", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com" }), // name/password/courseType 欠損
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("POST_duplicate_email_returns_409", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockCreateUser.mockRejectedValue(
      new Error("このメールアドレスはすでに使用されています")
    );

    const request = new Request("http://localhost/api/admin/users", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json" },
    });
    const response = await POST(request);

    expect(response.status).toBe(409);
  });
});
