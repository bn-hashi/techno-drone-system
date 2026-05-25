import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole, UserStatus } from "@/types/prisma";
import { BusinessError, NotFoundError } from "@/services/errors";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({
  getQAService: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { getQAService } from "@/lib/serviceFactory";
import { POST } from "@/app/api/admin/qa/[id]/route";

const mockAnswerQuestion = vi.fn();

const adminSession = {
  user: {
    id: "admin-1",
    name: "管理者A",
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getQAService).mockReturnValue({
    answerQuestion: mockAnswerQuestion,
  } as unknown as ReturnType<typeof getQAService>);
});

const makeRequest = (body: unknown) =>
  new Request("http://localhost/api/admin/qa/qa-1", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const makeContext = (id = "qa-1") => ({ params: Promise.resolve({ id }) });

describe("POST /api/admin/qa/[id]", () => {
  it("test_POST_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await POST(makeRequest({ answer: "A" }), makeContext());
    expect(res.status).toBe(401);
  });

  it("test_POST_student_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: {
        id: "u-1",
        name: "学生",
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
      },
    });
    const res = await POST(makeRequest({ answer: "A" }), makeContext());
    expect(res.status).toBe(403);
  });

  it("test_POST_missing_answer_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    const res = await POST(makeRequest({}), makeContext());
    expect(res.status).toBe(400);
  });

  it("test_POST_NotFoundError_returns_404", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockAnswerQuestion.mockRejectedValue(new NotFoundError("指定された質問が見つかりません"));
    const res = await POST(makeRequest({ answer: "A" }), makeContext("qa-x"));
    expect(res.status).toBe(404);
  });

  it("test_POST_BusinessError_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockAnswerQuestion.mockRejectedValue(new BusinessError("回答本文を入力してください"));
    const res = await POST(makeRequest({ answer: "" }), makeContext());
    expect(res.status).toBe(400);
  });

  it("test_POST_success_returns_200_with_record_and_mailSent", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    const record = {
      id: "qa-1",
      userId: "user-1",
      question: "Q?",
      answer: "回答",
      questionedAt: new Date(),
      answeredAt: new Date(),
      answeredBy: "管理者A",
    };
    mockAnswerQuestion.mockResolvedValue({ record, mailSent: true });
    const res = await POST(makeRequest({ answer: "回答" }), makeContext());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.record.id).toBe("qa-1");
    expect(data.mailSent).toBe(true);
  });

  it("test_POST_passes_id_answer_answeredBy_from_session_to_service", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockAnswerQuestion.mockResolvedValue({
      record: {
        id: "qa-1",
        userId: "user-1",
        question: "Q?",
        answer: "回答",
        questionedAt: new Date(),
        answeredAt: new Date(),
        answeredBy: "管理者A",
      },
      mailSent: true,
    });
    await POST(makeRequest({ answer: "回答" }), makeContext("qa-1"));
    expect(mockAnswerQuestion).toHaveBeenCalledWith("qa-1", "回答", "管理者A");
  });

  it("test_POST_mailSent_false_still_returns_200", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    const record = {
      id: "qa-1",
      userId: "user-1",
      question: "Q?",
      answer: "回答",
      questionedAt: new Date(),
      answeredAt: new Date(),
      answeredBy: "管理者A",
    };
    mockAnswerQuestion.mockResolvedValue({ record, mailSent: false });
    const res = await POST(makeRequest({ answer: "回答" }), makeContext());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mailSent).toBe(false);
  });
});
