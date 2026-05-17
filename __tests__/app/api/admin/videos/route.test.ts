import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole } from "@/types/prisma";
import { BusinessError } from "@/services/errors";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({ getVideoService: vi.fn() }));

import { getServerSession } from "next-auth";
import { getVideoService } from "@/lib/serviceFactory";
import { GET, POST } from "@/app/api/admin/videos/route";

const mockListVideos = vi.fn();
const mockCreateVideo = vi.fn();

const adminSession = { user: { id: "admin-1", role: UserRole.ADMIN } };

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

const validCreateBody = {
  title: "ドローン基礎講座",
  subjectId: "subject-1",
  courseId: "course-1",
  filePath: "/videos/basic.mp4",
  duration: 3600,
};

const makePostRequest = (body: unknown) =>
  new Request("http://localhost/api/admin/videos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("GET /api/admin/videos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getVideoService).mockReturnValue({
      listVideos: mockListVideos,
      getVideo: vi.fn(),
      createVideo: mockCreateVideo,
      updateVideo: vi.fn(),
      deleteVideo: vi.fn(),
      addSupervisor: vi.fn(),
      updateSupervisor: vi.fn(),
      removeSupervisor: vi.fn(),
    } as unknown as ReturnType<typeof getVideoService>);
  });

  it("test_GET_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/admin/videos"));

    expect(response.status).toBe(401);
  });

  it("test_GET_student_role_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.STUDENT },
    });

    const response = await GET(new Request("http://localhost/api/admin/videos"));

    expect(response.status).toBe(403);
  });

  it("test_GET_admin_returns_200_with_videos", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListVideos.mockResolvedValue([mockVideo]);

    const response = await GET(new Request("http://localhost/api/admin/videos"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.videos).toHaveLength(1);
  });

  it("test_GET_with_courseId_filter_passes_to_service", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListVideos.mockResolvedValue([]);

    await GET(new Request("http://localhost/api/admin/videos?courseId=course-1"));

    expect(mockListVideos).toHaveBeenCalledWith({ courseId: "course-1" });
  });

  it("test_GET_with_isPublished_true_filter_passes_boolean", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListVideos.mockResolvedValue([]);

    await GET(new Request("http://localhost/api/admin/videos?isPublished=true"));

    expect(mockListVideos).toHaveBeenCalledWith({ isPublished: true });
  });
});

describe("POST /api/admin/videos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getVideoService).mockReturnValue({
      listVideos: mockListVideos,
      getVideo: vi.fn(),
      createVideo: mockCreateVideo,
      updateVideo: vi.fn(),
      deleteVideo: vi.fn(),
      addSupervisor: vi.fn(),
      updateSupervisor: vi.fn(),
      removeSupervisor: vi.fn(),
    } as unknown as ReturnType<typeof getVideoService>);
  });

  it("test_POST_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await POST(makePostRequest(validCreateBody));

    expect(response.status).toBe(401);
  });

  it("test_POST_missing_title_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    const { title: _, ...withoutTitle } = validCreateBody;

    const response = await POST(makePostRequest(withoutTitle));

    expect(response.status).toBe(400);
  });

  it("test_POST_missing_filePath_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    const { filePath: _, ...withoutFilePath } = validCreateBody;

    const response = await POST(makePostRequest(withoutFilePath));

    expect(response.status).toBe(400);
  });

  it("test_POST_non_integer_duration_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);

    const response = await POST(makePostRequest({ ...validCreateBody, duration: "sixty" }));

    expect(response.status).toBe(400);
  });

  it("test_POST_valid_body_returns_201_with_video", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockCreateVideo.mockResolvedValue(mockVideo);

    const response = await POST(makePostRequest(validCreateBody));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.video).toEqual(mockVideo);
  });

  it("test_POST_business_error_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockCreateVideo.mockRejectedValue(new BusinessError("動画タイトルは必須です"));

    const response = await POST(makePostRequest({ ...validCreateBody, title: "" }));

    expect(response.status).toBe(400);
  });
});
