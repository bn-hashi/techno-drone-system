import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole, UserStatus, CourseType } from "@/types/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({
  getProgressService: vi.fn(),
  getUserManagementService: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { getProgressService, getUserManagementService } from "@/lib/serviceFactory";
import { GET } from "@/app/api/student/progress/route";

const mockGetProgressByUser = vi.fn();
const mockGetUserById = vi.fn();

const activeStudentSession = {
  user: { id: "user-1", role: UserRole.STUDENT, status: UserStatus.ACTIVE },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getProgressService).mockReturnValue({
    getProgressByUser: mockGetProgressByUser,
    canWatchVideo: vi.fn(),
  } as unknown as ReturnType<typeof getProgressService>);
  vi.mocked(getUserManagementService).mockReturnValue({
    getUserById: mockGetUserById,
  } as unknown as ReturnType<typeof getUserManagementService>);
});

describe("GET /api/student/progress", () => {
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

  it("test_GET_returns_200_with_progress_array", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockGetUserById.mockResolvedValue({ id: "user-1", courseType: CourseType.BEGINNER });
    mockGetProgressByUser.mockResolvedValue([
      {
        subjectId: "s-1",
        subjectName: "基礎",
        totalWatchedMinutes: 60,
        requiredMinutes: 180,
        isFulfilled: false,
      },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);
  });

  it("test_GET_uses_user_courseType_to_get_progress", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockGetUserById.mockResolvedValue({ id: "user-1", courseType: CourseType.EXPERIENCED });
    mockGetProgressByUser.mockResolvedValue([]);

    await GET();

    expect(mockGetProgressByUser).toHaveBeenCalledWith("user-1", CourseType.EXPERIENCED);
  });

  it("test_GET_user_without_courseType_returns_400", async () => {
    // コース未割当ユーザーは進捗を計算できない
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockGetUserById.mockResolvedValue({ id: "user-1", courseType: null });

    const response = await GET();

    expect(response.status).toBe(400);
  });
});
