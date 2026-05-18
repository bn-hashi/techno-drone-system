import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole, UserStatus } from "@/types/prisma";
import { VideoNotFoundError } from "@/services/errors";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({
  getVideoService: vi.fn(),
  getViewingLogService: vi.fn(),
  getProgressService: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { getVideoService, getViewingLogService, getProgressService } from "@/lib/serviceFactory";
import { GET } from "@/app/api/student/videos/[id]/route";

const mockGetVideo = vi.fn();
const mockGetMaxWatched = vi.fn();
const mockCanWatchVideo = vi.fn();

const activeStudentSession = {
  user: { id: "user-1", role: UserRole.STUDENT, status: UserStatus.ACTIVE },
};

const params = { id: "video-1" };

const mockVideo = {
  id: "video-1",
  title: "ドローン基礎",
  description: "基礎から学ぶ",
  subjectId: "subject-1",
  courseId: "course-1",
  filePath: "/videos/basic.mp4",
  duration: 3600,
  sortOrder: 0,
  isPublished: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const makeRequest = () =>
  new Request(`http://localhost/api/student/videos/${params.id}`, { method: "GET" });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getVideoService).mockReturnValue({
    listVideos: vi.fn(),
    getVideo: mockGetVideo,
    createVideo: vi.fn(),
    updateVideo: vi.fn(),
    deleteVideo: vi.fn(),
    addSupervisor: vi.fn(),
    updateSupervisor: vi.fn(),
    removeSupervisor: vi.fn(),
  } as unknown as ReturnType<typeof getVideoService>);
  vi.mocked(getViewingLogService).mockReturnValue({
    recordSession: vi.fn(),
    getMaxWatchedSeconds: mockGetMaxWatched,
  } as unknown as ReturnType<typeof getViewingLogService>);
  vi.mocked(getProgressService).mockReturnValue({
    getProgressByUser: vi.fn(),
    canWatchVideo: mockCanWatchVideo,
  } as unknown as ReturnType<typeof getProgressService>);
  // デフォルトで受講許可（既存テストに影響を出さない）
  mockCanWatchVideo.mockResolvedValue(true);
});

describe("GET /api/student/videos/[id]", () => {
  it("test_GET_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await GET(makeRequest(), { params });

    expect(response.status).toBe(401);
  });

  it("test_GET_admin_role_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    });

    const response = await GET(makeRequest(), { params });

    expect(response.status).toBe(403);
  });

  it("test_GET_inactive_student_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.STUDENT, status: UserStatus.PENDING_ACTIVATION },
    });

    const response = await GET(makeRequest(), { params });

    expect(response.status).toBe(403);
  });

  it("test_GET_unpublished_video_returns_404", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockGetVideo.mockResolvedValue({ ...mockVideo, isPublished: false });

    const response = await GET(makeRequest(), { params });

    expect(response.status).toBe(404);
  });

  it("test_GET_nonexistent_video_returns_404", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockGetVideo.mockRejectedValue(new VideoNotFoundError("video-1"));

    const response = await GET(makeRequest(), { params });

    expect(response.status).toBe(404);
  });

  it("test_GET_published_video_returns_200", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockGetVideo.mockResolvedValue(mockVideo);
    mockGetMaxWatched.mockResolvedValue(0);

    const response = await GET(makeRequest(), { params });

    expect(response.status).toBe(200);
  });

  it("test_GET_returns_video_metadata_in_body", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockGetVideo.mockResolvedValue(mockVideo);
    mockGetMaxWatched.mockResolvedValue(60);

    const response = await GET(makeRequest(), { params });
    const body = await response.json();

    expect(body.video.id).toBe("video-1");
  });

  it("test_GET_returns_maxWatchedSeconds_in_body", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockGetVideo.mockResolvedValue(mockVideo);
    mockGetMaxWatched.mockResolvedValue(60);

    const response = await GET(makeRequest(), { params });
    const body = await response.json();

    expect(body.maxWatchedSeconds).toBe(60);
  });

  it("test_GET_returns_403_when_previous_video_not_completed", async () => {
    // 受講順序制御: canWatchVideo が false なら 403
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockGetVideo.mockResolvedValue(mockVideo);
    mockCanWatchVideo.mockResolvedValue(false);

    const response = await GET(makeRequest(), { params });

    expect(response.status).toBe(403);
  });
});
