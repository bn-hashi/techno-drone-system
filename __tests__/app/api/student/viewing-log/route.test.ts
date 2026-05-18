import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole, UserStatus } from "@/types/prisma";
import { BusinessError, VideoNotFoundError } from "@/services/errors";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({ getViewingLogService: vi.fn() }));

import { getServerSession } from "next-auth";
import { getViewingLogService } from "@/lib/serviceFactory";
import { POST } from "@/app/api/student/viewing-log/route";

const mockRecord = vi.fn();

const activeStudentSession = {
  user: { id: "user-1", role: UserRole.STUDENT, status: UserStatus.ACTIVE },
};

const validBody = {
  videoId: "video-1",
  startedAt: "2026-05-18T10:00:00.000Z",
  endedAt: "2026-05-18T10:00:10.000Z",
  watchedSeconds: 10,
};

const makeRequest = (body: unknown) =>
  new Request("http://localhost/api/student/viewing-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getViewingLogService).mockReturnValue({
    recordSession: mockRecord,
    getMaxWatchedSeconds: vi.fn(),
  } as unknown as ReturnType<typeof getViewingLogService>);
});

describe("POST /api/student/viewing-log", () => {
  it("test_POST_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(401);
  });

  it("test_POST_admin_role_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    });

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(403);
  });

  it("test_POST_missing_videoId_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);

    const response = await POST(makeRequest({ ...validBody, videoId: undefined }));

    expect(response.status).toBe(400);
  });

  it("test_POST_invalid_watchedSeconds_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);

    const response = await POST(makeRequest({ ...validBody, watchedSeconds: "abc" }));

    expect(response.status).toBe(400);
  });

  it("test_POST_invalid_iso_date_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);

    const response = await POST(makeRequest({ ...validBody, startedAt: "not-a-date" }));

    expect(response.status).toBe(400);
  });

  it("test_POST_business_error_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockRecord.mockRejectedValue(new BusinessError("視聴時間が動画長を超えています"));

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(400);
  });

  it("test_POST_video_not_found_returns_404", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockRecord.mockRejectedValue(new VideoNotFoundError("video-1"));

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(404);
  });

  it("test_POST_valid_body_returns_201", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockRecord.mockResolvedValue({ id: "log-1" });

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(201);
  });

  it("test_POST_passes_userId_from_session_to_service", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockRecord.mockResolvedValue({ id: "log-1" });

    await POST(makeRequest(validBody));

    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", videoId: "video-1", watchedSeconds: 10 })
    );
  });
});
