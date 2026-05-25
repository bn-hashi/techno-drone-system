import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole, UserStatus, CourseType } from "@/types/prisma";
import { BusinessError } from "@/services/errors";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({
  getExamService: vi.fn(),
  getUserManagementService: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { getExamService, getUserManagementService } from "@/lib/serviceFactory";
import { POST } from "@/app/api/student/exams/route";

const mockStartExam = vi.fn();
const mockGetUserById = vi.fn();

const activeSession = {
  user: { id: "user-1", role: UserRole.STUDENT, status: UserStatus.ACTIVE },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getExamService).mockReturnValue({
    startExam: mockStartExam,
  } as unknown as ReturnType<typeof getExamService>);
  vi.mocked(getUserManagementService).mockReturnValue({
    getUserById: mockGetUserById,
  } as unknown as ReturnType<typeof getUserManagementService>);
});

const makeRequest = () => new Request("http://localhost/api/student/exams", { method: "POST" });

describe("POST /api/student/exams", () => {
  it("test_POST_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
  });

  it("test_POST_admin_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(403);
  });

  it("test_POST_inactive_student_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.STUDENT, status: UserStatus.PENDING_ACTIVATION },
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(403);
  });

  it("test_POST_no_courseType_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeSession);
    mockGetUserById.mockResolvedValue({ id: "user-1", courseType: null });

    const response = await POST(makeRequest());

    expect(response.status).toBe(400);
  });

  it("test_POST_BusinessError_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeSession);
    mockGetUserById.mockResolvedValue({ id: "user-1", courseType: CourseType.BEGINNER });
    mockStartExam.mockRejectedValue(new BusinessError("進行中の試験があります"));

    const response = await POST(makeRequest());

    expect(response.status).toBe(400);
  });

  it("test_POST_success_returns_201", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeSession);
    mockGetUserById.mockResolvedValue({ id: "user-1", courseType: CourseType.BEGINNER });
    mockStartExam.mockResolvedValue({
      examId: "exam-1",
      startedAt: new Date(),
      durationMinutes: 30,
      totalQuestions: 5,
      questions: [],
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(201);
  });

  it("test_POST_passes_userId_and_courseType_to_service", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeSession);
    mockGetUserById.mockResolvedValue({ id: "user-1", courseType: CourseType.EXPERIENCED });
    mockStartExam.mockResolvedValue({
      examId: "exam-1",
      startedAt: new Date(),
      durationMinutes: 30,
      totalQuestions: 5,
      questions: [],
    });

    await POST(makeRequest());

    expect(mockStartExam).toHaveBeenCalledWith("user-1", CourseType.EXPERIENCED);
  });
});
