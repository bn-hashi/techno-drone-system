import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole, UserStatus } from "@/types/prisma";
import { BusinessError } from "@/services/errors";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({
  getJudgmentService: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { getJudgmentService } from "@/lib/serviceFactory";
import { GET } from "@/app/api/admin/students/[id]/review/route";

const mockGetReviewData = vi.fn();

const adminSession = {
  user: { id: "admin-1", name: "管理者A", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getJudgmentService).mockReturnValue({
    getReviewData: mockGetReviewData,
  } as unknown as ReturnType<typeof getJudgmentService>);
});

const makeRequest = () =>
  new Request("http://localhost/api/admin/students/user-1/review", { method: "GET" });

const makeContext = (id = "user-1") => ({ params: Promise.resolve({ id }) });

describe("GET /api/admin/students/[id]/review", () => {
  it("test_GET_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(401);
  });

  it("test_GET_student_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.STUDENT, status: UserStatus.ACTIVE },
    });
    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(403);
  });

  it("test_GET_BusinessError_returns_404", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockGetReviewData.mockRejectedValue(new BusinessError("指定された受講者が見つかりません"));
    const res = await GET(makeRequest(), makeContext("user-x"));
    expect(res.status).toBe(404);
  });

  it("test_GET_success_returns_200", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockGetReviewData.mockResolvedValue({
      user: { id: "user-1" },
      progress: [],
      fraudFlags: [],
      judgmentHistory: [],
      canJudge: true,
    });

    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(200);
  });

  it("test_GET_success_passes_id_to_service", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockGetReviewData.mockResolvedValue({
      user: { id: "user-1" },
      progress: [],
      fraudFlags: [],
      judgmentHistory: [],
      canJudge: true,
    });

    await GET(makeRequest(), makeContext("user-1"));
    expect(mockGetReviewData).toHaveBeenCalledWith("user-1");
  });
});
