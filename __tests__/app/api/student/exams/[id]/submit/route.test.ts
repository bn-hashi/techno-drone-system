import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole, UserStatus, ExamStatus } from "@/types/prisma";
import { BusinessError, NotFoundError } from "@/services/errors";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({
  getExamService: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { getExamService } from "@/lib/serviceFactory";
import { POST } from "@/app/api/student/exams/[id]/submit/route";

const mockSubmitExam = vi.fn();

const studentSession = {
  user: { id: "user-1", role: UserRole.STUDENT, status: UserStatus.ACTIVE },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getExamService).mockReturnValue({
    submitExam: mockSubmitExam,
  } as unknown as ReturnType<typeof getExamService>);
});

const makeContext = (id: string) => ({ params: Promise.resolve({ id }) });

const makeReq = (body: unknown) =>
  new Request("http://localhost/api/student/exams/exam-1/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const validBody = {
  answers: [
    { questionId: "q-1", selectedIndex: 0 },
    { questionId: "q-2", selectedIndex: 1 },
  ],
};

describe("POST /api/student/exams/[id]/submit", () => {
  it("test_POST_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await POST(makeReq(validBody), makeContext("exam-1"));

    expect(response.status).toBe(401);
  });

  it("test_POST_admin_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    });

    const response = await POST(makeReq(validBody), makeContext("exam-1"));

    expect(response.status).toBe(403);
  });

  it("test_POST_invalid_body_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(studentSession);

    const response = await POST(makeReq({ answers: "not-array" }), makeContext("exam-1"));

    expect(response.status).toBe(400);
  });

  it("test_POST_answer_missing_questionId_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(studentSession);

    const response = await POST(
      makeReq({ answers: [{ selectedIndex: 0 }] }),
      makeContext("exam-1")
    );

    expect(response.status).toBe(400);
  });

  it("test_POST_not_found_returns_404", async () => {
    vi.mocked(getServerSession).mockResolvedValue(studentSession);
    mockSubmitExam.mockRejectedValue(new NotFoundError("試験が見つかりません"));

    const response = await POST(makeReq(validBody), makeContext("exam-x"));

    expect(response.status).toBe(404);
  });

  it("test_POST_business_error_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(studentSession);
    mockSubmitExam.mockRejectedValue(new BusinessError("この試験はすでに提出済みです"));

    const response = await POST(makeReq(validBody), makeContext("exam-1"));

    expect(response.status).toBe(400);
  });

  it("test_POST_success_returns_200", async () => {
    vi.mocked(getServerSession).mockResolvedValue(studentSession);
    mockSubmitExam.mockResolvedValue({
      id: "exam-1",
      userId: "user-1",
      score: 100,
      passed: true,
      status: ExamStatus.PASSED,
    });

    const response = await POST(makeReq(validBody), makeContext("exam-1"));

    expect(response.status).toBe(200);
  });

  it("test_POST_passes_answers_to_service", async () => {
    vi.mocked(getServerSession).mockResolvedValue(studentSession);
    mockSubmitExam.mockResolvedValue({ id: "exam-1" });

    await POST(makeReq(validBody), makeContext("exam-1"));

    expect(mockSubmitExam).toHaveBeenCalledWith("user-1", "exam-1", validBody.answers);
  });
});
