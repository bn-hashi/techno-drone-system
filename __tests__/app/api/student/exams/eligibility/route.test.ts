import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole, UserStatus, CourseType } from "@/types/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({
  getExamService: vi.fn(),
  getUserManagementService: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { getExamService, getUserManagementService } from "@/lib/serviceFactory";
import { GET } from "@/app/api/student/exams/eligibility/route";

const mockCheckEligibility = vi.fn();
const mockGetUserById = vi.fn();

const activeSession = {
  user: { id: "user-1", role: UserRole.STUDENT, status: UserStatus.ACTIVE },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getExamService).mockReturnValue({
    checkEligibility: mockCheckEligibility,
  } as unknown as ReturnType<typeof getExamService>);
  vi.mocked(getUserManagementService).mockReturnValue({
    getUserById: mockGetUserById,
  } as unknown as ReturnType<typeof getUserManagementService>);
});

describe("GET /api/student/exams/eligibility", () => {
  it("test_GET_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("test_GET_admin_role_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    });

    const response = await GET();

    expect(response.status).toBe(403);
  });

  it("test_GET_inactive_student_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.STUDENT, status: UserStatus.PENDING_ACTIVATION },
    });

    const response = await GET();

    expect(response.status).toBe(403);
  });

  it("test_GET_no_courseType_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeSession);
    mockGetUserById.mockResolvedValue({ id: "user-1", courseType: null });

    const response = await GET();

    expect(response.status).toBe(400);
  });

  it("test_GET_active_returns_200", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeSession);
    mockGetUserById.mockResolvedValue({ id: "user-1", courseType: CourseType.BEGINNER });
    mockCheckEligibility.mockResolvedValue({ eligible: true, progress: [] });

    const response = await GET();

    expect(response.status).toBe(200);
  });

  it("test_GET_returns_eligible_flag_from_service", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeSession);
    mockGetUserById.mockResolvedValue({ id: "user-1", courseType: CourseType.BEGINNER });
    mockCheckEligibility.mockResolvedValue({ eligible: false, progress: [] });

    const response = await GET();
    const body = await response.json();

    expect(body.eligible).toBe(false);
  });
});
