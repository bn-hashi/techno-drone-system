import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole } from "@/types/prisma";
import { BusinessError, DuplicateEnrollmentError, UserNotFoundError } from "@/services/errors";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/serviceFactory", () => ({
  getEnrollmentService: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { getEnrollmentService } from "@/lib/serviceFactory";
import { POST } from "@/app/api/admin/enrollment/route";

const mockCreateEnrollment = vi.fn();

describe("POST /api/admin/enrollment", () => {
  const adminSession = {
    user: { id: "admin-1", email: "admin@example.com", role: UserRole.ADMIN },
  };

  const mockApplication = {
    id: "app-1",
    userId: "user-1",
    applicationDate: new Date("2026-05-01"),
    dateOfBirth: new Date("1990-01-15"),
    address: "東京都千代田区1-1-1",
    phoneNumber: "090-1234-5678",
    idDocumentPath: null,
    photoPath: null,
    experienceCertPath: null,
    acceptedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function createJsonRequest(bodyOverride?: Record<string, unknown>): Request {
    const body = {
      userId: "user-1",
      dateOfBirth: "1990-01-15",
      address: "東京都千代田区1-1-1",
      phoneNumber: "090-1234-5678",
      ...bodyOverride,
    };
    return new Request("http://localhost/api/admin/enrollment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEnrollmentService).mockReturnValue({
      createEnrollment: mockCreateEnrollment,
      uploadDocument: vi.fn(),
      acceptEnrollment: vi.fn(),
    } as unknown as ReturnType<typeof getEnrollmentService>);
  });

  it("test_POST_enrollment_valid_input_returns_201", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockCreateEnrollment.mockResolvedValue(mockApplication);

    const response = await POST(createJsonRequest());

    expect(response.status).toBe(201);
  });

  it("test_POST_enrollment_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await POST(createJsonRequest());

    expect(response.status).toBe(401);
  });

  it("test_POST_enrollment_non_admin_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", email: "s@example.com", role: UserRole.STUDENT },
    });

    const response = await POST(createJsonRequest());

    expect(response.status).toBe(403);
  });

  it("test_POST_enrollment_missing_fields_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);

    const request = new Request("http://localhost/api/admin/enrollment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-1" }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("test_POST_enrollment_duplicate_returns_409", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockCreateEnrollment.mockRejectedValue(new DuplicateEnrollmentError("user-1"));

    const response = await POST(createJsonRequest());

    expect(response.status).toBe(409);
  });

  it("test_POST_enrollment_internal_error_returns_500", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockCreateEnrollment.mockRejectedValue(new Error("DB error"));

    const response = await POST(createJsonRequest());

    expect(response.status).toBe(500);
  });
});
