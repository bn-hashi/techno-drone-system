import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole, UserStatus } from "@/types/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({
  getVideoService: vi.fn(),
  getProgressService: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { getVideoService, getProgressService } from "@/lib/serviceFactory";
import { GET } from "@/app/api/student/courses/[courseId]/videos/route";

const mockListVideos = vi.fn();
const mockCanWatchVideo = vi.fn();

const activeStudentSession = {
  user: { id: "user-1", role: UserRole.STUDENT, status: UserStatus.ACTIVE },
};

const params = { courseId: "course-1" };

const video1 = {
  id: "video-1",
  title: "v1",
  subjectId: "subject-1",
  courseId: "course-1",
  filePath: "/v1.mp4",
  duration: 600,
  sortOrder: 0,
  isPublished: true,
};
const video2 = { ...video1, id: "video-2", sortOrder: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getVideoService).mockReturnValue({
    listVideos: mockListVideos,
  } as unknown as ReturnType<typeof getVideoService>);
  vi.mocked(getProgressService).mockReturnValue({
    canWatchVideo: mockCanWatchVideo,
    getProgressByUser: vi.fn(),
  } as unknown as ReturnType<typeof getProgressService>);
});

describe("GET /api/student/courses/[courseId]/videos", () => {
  it("test_GET_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/"), { params });

    expect(response.status).toBe(401);
  });

  it("test_GET_admin_role_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    });

    const response = await GET(new Request("http://localhost/"), { params });

    expect(response.status).toBe(403);
  });

  it("test_GET_returns_200_with_videos", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockListVideos.mockResolvedValue([video1, video2]);
    mockCanWatchVideo.mockResolvedValue(true);

    const response = await GET(new Request("http://localhost/"), { params });
    const body = await response.json();

    expect(body.videos).toHaveLength(2);
  });

  it("test_GET_returns_isLocked_per_video", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockListVideos.mockResolvedValue([video1, video2]);
    mockCanWatchVideo.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const response = await GET(new Request("http://localhost/"), { params });
    const body = await response.json();

    expect(body.videos[1].isLocked).toBe(true);
  });

  it("test_GET_filters_by_courseId_and_published_only", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockListVideos.mockResolvedValue([]);
    mockCanWatchVideo.mockResolvedValue(true);

    await GET(new Request("http://localhost/"), { params });

    expect(mockListVideos).toHaveBeenCalledWith({
      courseId: "course-1",
      isPublished: true,
    });
  });
});
