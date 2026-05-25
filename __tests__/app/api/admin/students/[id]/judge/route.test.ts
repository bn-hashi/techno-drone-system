import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole, UserStatus, JudgmentResult } from "@/types/prisma";
import { BusinessError } from "@/services/errors";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({
  getJudgmentService: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { getJudgmentService } from "@/lib/serviceFactory";
import { POST } from "@/app/api/admin/students/[id]/judge/route";

const mockJudgeAccepted = vi.fn();
const mockJudgeRejected = vi.fn();

const adminSession = {
  user: { id: "admin-1", name: "管理者A", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getJudgmentService).mockReturnValue({
    judgeAccepted: mockJudgeAccepted,
    judgeRejected: mockJudgeRejected,
  } as unknown as ReturnType<typeof getJudgmentService>);
});

const makeRequest = (body: unknown) =>
  new Request("http://localhost/api/admin/students/user-1/judge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const makeContext = (id = "user-1") => ({ params: Promise.resolve({ id }) });

const sampleRecord = {
  id: "j-1",
  userId: "user-1",
  result: JudgmentResult.ACCEPTED,
  comment: null,
  judgedBy: "管理者A",
  judgedAt: new Date(),
};

describe("POST /api/admin/students/[id]/judge", () => {
  it("test_POST_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await POST(makeRequest({ result: "ACCEPTED" }), makeContext());
    expect(res.status).toBe(401);
  });

  it("test_POST_student_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.STUDENT, status: UserStatus.ACTIVE },
    });
    const res = await POST(makeRequest({ result: "ACCEPTED" }), makeContext());
    expect(res.status).toBe(403);
  });

  it("test_POST_missing_result_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    const res = await POST(makeRequest({}), makeContext());
    expect(res.status).toBe(400);
  });

  it("test_POST_invalid_result_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    const res = await POST(makeRequest({ result: "MAYBE" }), makeContext());
    expect(res.status).toBe(400);
  });

  it("test_POST_accepted_BusinessError_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockJudgeAccepted.mockRejectedValue(
      new BusinessError("受講成立判定は EXAM_PASSED 状態の受講者のみ実行できます")
    );
    const res = await POST(makeRequest({ result: "ACCEPTED" }), makeContext());
    expect(res.status).toBe(400);
  });

  it("test_POST_accepted_success_returns_200", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockJudgeAccepted.mockResolvedValue(sampleRecord);
    const res = await POST(makeRequest({ result: "ACCEPTED" }), makeContext());
    expect(res.status).toBe(200);
  });

  it("test_POST_accepted_returns_record_id", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockJudgeAccepted.mockResolvedValue(sampleRecord);
    const res = await POST(makeRequest({ result: "ACCEPTED" }), makeContext());
    const data = await res.json();
    expect(data.record.id).toBe("j-1");
  });

  it("test_POST_accepted_passes_id_judgedBy_comment_to_service", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockJudgeAccepted.mockResolvedValue(sampleRecord);
    await POST(makeRequest({ result: "ACCEPTED", comment: "OK" }), makeContext("user-1"));
    expect(mockJudgeAccepted).toHaveBeenCalledWith("user-1", "管理者A", "OK");
  });

  it("test_POST_rejected_returns_200", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockJudgeRejected.mockResolvedValue({
      record: { ...sampleRecord, result: JudgmentResult.REJECTED },
      mailSent: true,
    });
    const res = await POST(makeRequest({ result: "REJECTED" }), makeContext());
    expect(res.status).toBe(200);
  });

  it("test_POST_rejected_returns_mailSent_true", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockJudgeRejected.mockResolvedValue({
      record: { ...sampleRecord, result: JudgmentResult.REJECTED },
      mailSent: true,
    });
    const res = await POST(makeRequest({ result: "REJECTED" }), makeContext());
    const data = await res.json();
    expect(data.mailSent).toBe(true);
  });

  it("test_POST_rejected_mailSent_false_still_returns_200", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockJudgeRejected.mockResolvedValue({
      record: { ...sampleRecord, result: JudgmentResult.REJECTED },
      mailSent: false,
    });
    const res = await POST(makeRequest({ result: "REJECTED" }), makeContext());
    expect(res.status).toBe(200);
  });

  it("test_POST_rejected_passes_judgedBy_from_session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockJudgeRejected.mockResolvedValue({
      record: { ...sampleRecord, result: JudgmentResult.REJECTED },
      mailSent: true,
    });
    await POST(makeRequest({ result: "REJECTED" }), makeContext("user-1"));
    expect(mockJudgeRejected).toHaveBeenCalledWith("user-1", "管理者A", undefined);
  });
});
