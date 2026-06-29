import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole, UserStatus } from "@/types/prisma";
import { VideoNotFoundError } from "@/services/errors";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("@/lib/serviceFactory", () => ({
  getVideoService: vi.fn(),
  getViewingLogService: vi.fn(),
  getCourseAccessService: vi.fn(),
  getProgressService: vi.fn(),
}));
vi.mock("@/components/student/VideoPlayer", () => ({
  VideoPlayer: () => null,
}));

import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import {
  getVideoService,
  getViewingLogService,
  getCourseAccessService,
  getProgressService,
} from "@/lib/serviceFactory";
import StudentVideoViewingPage from "@/app/(student)/courses/[courseId]/videos/[videoId]/page";

const mockGetVideo = vi.fn();
const mockGetMaxWatched = vi.fn();
const mockCanAccessCourse = vi.fn();
const mockCanWatchVideo = vi.fn();

const activeStudentSession = {
  user: { id: "user-1", role: UserRole.STUDENT, status: UserStatus.ACTIVE },
};

const params = { courseId: "course-1", videoId: "video-1" };

const mockVideo = {
  id: "video-1",
  title: "ドローン基礎",
  description: "基礎から学ぶ",
  subjectId: "subject-1",
  courseId: "course-1",
  filePath: "basic.mp4",
  duration: 3600,
  sortOrder: 0,
  isPublished: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getVideoService).mockReturnValue({
    getVideo: mockGetVideo,
  } as unknown as ReturnType<typeof getVideoService>);
  vi.mocked(getViewingLogService).mockReturnValue({
    getMaxWatchedSeconds: mockGetMaxWatched,
  } as unknown as ReturnType<typeof getViewingLogService>);
  vi.mocked(getCourseAccessService).mockReturnValue({
    canAccessCourse: mockCanAccessCourse,
  } as unknown as ReturnType<typeof getCourseAccessService>);
  vi.mocked(getProgressService).mockReturnValue({
    canWatchVideo: mockCanWatchVideo,
  } as unknown as ReturnType<typeof getProgressService>);
  mockGetVideo.mockResolvedValue(mockVideo);
  mockGetMaxWatched.mockResolvedValue(0);
  mockCanAccessCourse.mockResolvedValue(true);
  mockCanWatchVideo.mockResolvedValue(true);
});

describe("StudentVideoViewingPage", () => {
  it("test_page_unauthenticated_throws_error", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    await expect(StudentVideoViewingPage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("test_page_unauthenticated_calls_notFound", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    await StudentVideoViewingPage({ params }).catch(() => {});

    expect(notFound).toHaveBeenCalled();
  });

  it("test_page_inaccessible_course_throws_error", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockCanAccessCourse.mockResolvedValue(false);

    await expect(StudentVideoViewingPage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("test_page_inaccessible_course_calls_notFound", async () => {
    // 別 CourseType のコースは存在秘匿のため notFound
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockCanAccessCourse.mockResolvedValue(false);

    await StudentVideoViewingPage({ params }).catch(() => {});

    expect(notFound).toHaveBeenCalled();
  });

  it("test_page_inaccessible_course_does_not_resolve_video", async () => {
    // 認可で弾いた場合、動画解決まで進まない
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockCanAccessCourse.mockResolvedValue(false);

    await StudentVideoViewingPage({ params }).catch(() => {});

    expect(mockGetVideo).not.toHaveBeenCalled();
  });

  it("test_page_nonexistent_video_throws_error", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockGetVideo.mockRejectedValue(new VideoNotFoundError("video-1"));

    await expect(StudentVideoViewingPage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("test_page_nonexistent_video_calls_notFound", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockGetVideo.mockRejectedValue(new VideoNotFoundError("video-1"));

    await StudentVideoViewingPage({ params }).catch(() => {});

    expect(notFound).toHaveBeenCalled();
  });

  it("test_page_accessible_course_does_not_call_notFound", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);

    await StudentVideoViewingPage({ params });

    expect(notFound).not.toHaveBeenCalled();
  });

  it("test_page_checks_access_with_userId_and_courseId", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);

    await StudentVideoViewingPage({ params });

    expect(mockCanAccessCourse).toHaveBeenCalledWith("user-1", "course-1");
  });

  it("test_page_locked_video_throws_error", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockCanWatchVideo.mockResolvedValue(false);

    await expect(StudentVideoViewingPage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("test_page_locked_video_calls_notFound", async () => {
    // 順番視聴ロックにより canWatchVideo=false の動画は 404（存在秘匿）
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockCanWatchVideo.mockResolvedValue(false);

    await StudentVideoViewingPage({ params }).catch(() => {});

    expect(notFound).toHaveBeenCalled();
  });

  it("test_page_locked_video_does_not_fetch_max_watched", async () => {
    // ロックされた動画では視聴ログ取得まで進まない
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockCanWatchVideo.mockResolvedValue(false);

    await StudentVideoViewingPage({ params }).catch(() => {});

    expect(mockGetMaxWatched).not.toHaveBeenCalled();
  });
});
