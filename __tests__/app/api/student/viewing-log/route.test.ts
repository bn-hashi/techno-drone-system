import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole, UserStatus } from "@/types/prisma";
import { BusinessError, VideoNotFoundError } from "@/services/errors";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({
  getViewingLogService: vi.fn(),
}));

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
  // デフォルトで正常終了。各テストで上書きする。
  mockRecord.mockResolvedValue({ id: "log-1" });
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

  it("test_POST_pending_activation_student_returns_403", async () => {
    // ロールは STUDENT だがステータスが ACTIVE 以外なら 403
    vi.mocked(getServerSession).mockResolvedValue({
      user: {
        id: "u-1",
        role: UserRole.STUDENT,
        status: UserStatus.PENDING_ACTIVATION,
      },
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

  it("test_POST_non_existent_calendar_date_returns_400", async () => {
    // 2 月 30 日は存在しないが、new Date は 3/2 に繰り越して解釈してしまう
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);

    const response = await POST(
      makeRequest({ ...validBody, startedAt: "2026-02-30T10:00:00.000Z" })
    );

    expect(response.status).toBe(400);
  });

  it("test_POST_iso_date_without_Z_returns_400", async () => {
    // 末尾 Z 無しはローカル TZ 解釈になり秒単位ログの正確性を損なう
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);

    const response = await POST(makeRequest({ ...validBody, startedAt: "2026-05-18T10:00:00" }));

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

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(201);
  });

  it("test_POST_passes_userId_from_session_to_service", async () => {
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);

    await POST(makeRequest(validBody));

    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", videoId: "video-1", watchedSeconds: 10 })
    );
  });

  it("test_POST_unresolvable_video_returns_404", async () => {
    // body の videoId が解決できない場合、サービスが VideoNotFoundError を投げ 404 になる
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockRecord.mockRejectedValue(new VideoNotFoundError("video-1"));

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(404);
  });

  it("test_POST_inaccessible_course_returns_404", async () => {
    // 別 CourseType のコースへのアクセスは ViewingLogService が VideoNotFoundError を投げ 404
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockRecord.mockRejectedValue(new VideoNotFoundError("video-1"));

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(404);
  });

  it("test_POST_unpublished_video_returns_404", async () => {
    // 未公開動画は ViewingLogService が VideoNotFoundError を投げ 404（存在秘匿）
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockRecord.mockRejectedValue(new VideoNotFoundError("video-1"));

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(404);
  });

  it("test_POST_locked_video_returns_404", async () => {
    // 順番視聴ロックの動画は ViewingLogService が VideoNotFoundError を投げ 404
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockRecord.mockRejectedValue(new VideoNotFoundError("video-1"));

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(404);
  });

  it("test_POST_all_404_paths_return_same_body", async () => {
    // 存在しない動画・認可外・未公開・ロックされた動画はすべて同じ 404 本文
    // （videoId の存在状態を本文差分で推測できないことを保証する）
    vi.mocked(getServerSession).mockResolvedValue(activeStudentSession);
    mockRecord.mockRejectedValue(new VideoNotFoundError("video-1"));

    const [resNotFound, resNoAccess, resUnpublished, resLocked] = await Promise.all([
      POST(makeRequest(validBody)),
      POST(makeRequest(validBody)),
      POST(makeRequest(validBody)),
      POST(makeRequest(validBody)),
    ]);

    const bodies = await Promise.all([
      resNotFound.json(),
      resNoAccess.json(),
      resUnpublished.json(),
      resLocked.json(),
    ]);
    expect(new Set(bodies.map((b) => JSON.stringify(b))).size).toBe(1);
  });
});
