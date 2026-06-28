import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole, UserStatus } from "@/types/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/lib/serviceFactory", () => ({
  getProgressService: vi.fn(),
  getCourseAccessService: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { getProgressService, getCourseAccessService } from "@/lib/serviceFactory";
import CourseVideosPage from "@/app/(student)/courses/[courseId]/page";

const mockGetVideosWithLockStatus = vi.fn();
const mockCanAccessCourse = vi.fn();

const activeStudentSession = {
  user: { id: "user-1", role: UserRole.STUDENT, status: UserStatus.ACTIVE },
};

const params = { courseId: "course-1" };

const lockedVideo = {
  id: "video-1",
  title: "v1",
  sortOrder: 0,
  duration: 600,
  isLocked: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getProgressService).mockReturnValue({
    getVideosWithLockStatus: mockGetVideosWithLockStatus,
  } as unknown as ReturnType<typeof getProgressService>);
  vi.mocked(getCourseAccessService).mockReturnValue({
    canAccessCourse: mockCanAccessCourse,
  } as unknown as ReturnType<typeof getCourseAccessService>);
  mockCanAccessCourse.mockResolvedValue(true);
});

describe("CourseVideosPage", () => {
  it("test_page_unauthenticated_throws_error", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    await expect(CourseVideosPage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("test_page_unauthenticated_calls_notFound", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    await CourseVideosPage({ params }).catch(() => {});

    expect(notFound).toHaveBeenCalled();
  });

  it("test_page_admin_role_throws_error", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    });

    await expect(CourseVideosPage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("test_page_admin_role_calls_notFound", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    });

    await CourseVideosPage({ params }).catch(() => {});

    expect(notFound).toHaveBeenCalled();
  });

  it("test_page_inaccessible_course_throws_error", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockCanAccessCourse.mockResolvedValue(false);
    mockGetVideosWithLockStatus.mockResolvedValue([lockedVideo]);

    await expect(CourseVideosPage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("test_page_inaccessible_course_calls_notFound", async () => {
    // 別 CourseType のコースは存在秘匿のため notFound
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockCanAccessCourse.mockResolvedValue(false);

    await CourseVideosPage({ params }).catch(() => {});

    expect(notFound).toHaveBeenCalled();
  });

  it("test_page_inaccessible_course_does_not_load_videos", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockCanAccessCourse.mockResolvedValue(false);

    await CourseVideosPage({ params }).catch(() => {});

    expect(mockGetVideosWithLockStatus).not.toHaveBeenCalled();
  });

  it("test_page_accessible_course_does_not_call_notFound", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockGetVideosWithLockStatus.mockResolvedValue([lockedVideo]);

    await CourseVideosPage({ params });

    expect(notFound).not.toHaveBeenCalled();
  });

  it("test_page_checks_access_with_userId_and_courseId", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockGetVideosWithLockStatus.mockResolvedValue([lockedVideo]);

    await CourseVideosPage({ params });

    expect(mockCanAccessCourse).toHaveBeenCalledWith("user-1", "course-1");
  });
});
