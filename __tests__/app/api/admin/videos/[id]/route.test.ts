import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole } from "@/types/prisma";
import { VideoNotFoundError, BusinessError } from "@/services/errors";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({ getVideoService: vi.fn() }));

import { getServerSession } from "next-auth";
import { getVideoService } from "@/lib/serviceFactory";
import { GET, PATCH, DELETE } from "@/app/api/admin/videos/[id]/route";

const mockGetVideo = vi.fn();
const mockUpdateVideo = vi.fn();
const mockDeleteVideo = vi.fn();

const adminSession = { user: { id: "admin-1", role: UserRole.ADMIN } };
const params = { id: "video-1" };

const mockVideo = {
  id: "video-1",
  title: "ドローン基礎講座",
  description: null,
  subjectId: "subject-1",
  courseId: "course-1",
  filePath: "/videos/basic.mp4",
  duration: 3600,
  sortOrder: 0,
  isPublished: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const makeRequest = (method: string, body?: unknown) =>
  new Request(`http://localhost/api/admin/videos/${params.id}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

describe("GET /api/admin/videos/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getVideoService).mockReturnValue({
      listVideos: vi.fn(),
      getVideo: mockGetVideo,
      createVideo: vi.fn(),
      updateVideo: mockUpdateVideo,
      deleteVideo: mockDeleteVideo,
      addSupervisor: vi.fn(),
      updateSupervisor: vi.fn(),
      removeSupervisor: vi.fn(),
    } as unknown as ReturnType<typeof getVideoService>);
  });

  it("test_GET_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await GET(makeRequest("GET"), { params });

    expect(response.status).toBe(401);
  });

  it("test_GET_admin_existing_video_returns_200", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockGetVideo.mockResolvedValue(mockVideo);

    const response = await GET(makeRequest("GET"), { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.video).toEqual(mockVideo);
  });

  it("test_GET_video_not_found_returns_404", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockGetVideo.mockRejectedValue(new VideoNotFoundError("video-1"));

    const response = await GET(makeRequest("GET"), { params });

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/admin/videos/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getVideoService).mockReturnValue({
      listVideos: vi.fn(),
      getVideo: mockGetVideo,
      createVideo: vi.fn(),
      updateVideo: mockUpdateVideo,
      deleteVideo: mockDeleteVideo,
      addSupervisor: vi.fn(),
      updateSupervisor: vi.fn(),
      removeSupervisor: vi.fn(),
    } as unknown as ReturnType<typeof getVideoService>);
  });

  it("test_PATCH_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await PATCH(makeRequest("PATCH", { title: "new" }), { params });

    expect(response.status).toBe(401);
  });

  it("test_PATCH_valid_body_returns_200", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockUpdateVideo.mockResolvedValue({ ...mockVideo, title: "更新後" });

    const response = await PATCH(makeRequest("PATCH", { title: "更新後" }), { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.video.title).toBe("更新後");
  });

  it("test_PATCH_video_not_found_returns_404", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockUpdateVideo.mockRejectedValue(new VideoNotFoundError("video-1"));

    const response = await PATCH(makeRequest("PATCH", { title: "test" }), { params });

    expect(response.status).toBe(404);
  });

  it("test_PATCH_publish_without_supervisor_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockUpdateVideo.mockRejectedValue(
      new BusinessError("監修者が登録されていない動画は公開できません")
    );

    const response = await PATCH(makeRequest("PATCH", { isPublished: true }), { params });

    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/admin/videos/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getVideoService).mockReturnValue({
      listVideos: vi.fn(),
      getVideo: mockGetVideo,
      createVideo: vi.fn(),
      updateVideo: mockUpdateVideo,
      deleteVideo: mockDeleteVideo,
      addSupervisor: vi.fn(),
      updateSupervisor: vi.fn(),
      removeSupervisor: vi.fn(),
    } as unknown as ReturnType<typeof getVideoService>);
  });

  it("test_DELETE_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await DELETE(makeRequest("DELETE"), { params });

    expect(response.status).toBe(401);
  });

  it("test_DELETE_existing_video_returns_204", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockDeleteVideo.mockResolvedValue(undefined);

    const response = await DELETE(makeRequest("DELETE"), { params });

    expect(response.status).toBe(204);
  });

  it("test_DELETE_video_not_found_returns_404", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockDeleteVideo.mockRejectedValue(new VideoNotFoundError("video-1"));

    const response = await DELETE(makeRequest("DELETE"), { params });

    expect(response.status).toBe(404);
  });
});
