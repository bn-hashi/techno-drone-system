import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole, UserStatus, ExamStatus } from "@/types/prisma";
import { BusinessError, NotFoundError } from "@/services/errors";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({
  getExamService: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { getExamService } from "@/lib/serviceFactory";
import { GET } from "@/app/api/student/exams/[id]/result/route";

const mockGetExam = vi.fn();

const studentSession = {
  user: { id: "user-1", role: UserRole.STUDENT, status: UserStatus.EXAM_PASSED },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getExamService).mockReturnValue({
    getExam: mockGetExam,
  } as unknown as ReturnType<typeof getExamService>);
});

const makeContext = (id: string) => ({ params: Promise.resolve({ id }) });

const makeReq = () => new Request("http://localhost/api/student/exams/exam-1/result");

describe("GET /api/student/exams/[id]/result", () => {
  it("test_GET_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await GET(makeReq(), makeContext("exam-1"));

    expect(response.status).toBe(401);
  });

  it("test_GET_admin_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    });

    const response = await GET(makeReq(), makeContext("exam-1"));

    expect(response.status).toBe(403);
  });

  it("test_GET_pending_activation_student_returns_403", async () => {
    // 試験を実施していないステータスは allowlist 外 → 403
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.STUDENT, status: UserStatus.PENDING_ACTIVATION },
    });

    const response = await GET(makeReq(), makeContext("exam-1"));

    expect(response.status).toBe(403);
  });

  it("test_GET_not_found_returns_404", async () => {
    vi.mocked(getServerSession).mockResolvedValue(studentSession);
    mockGetExam.mockRejectedValue(new NotFoundError("試験が見つかりません"));

    const response = await GET(makeReq(), makeContext("exam-x"));

    expect(response.status).toBe(404);
  });

  it("test_GET_other_user_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue(studentSession);
    mockGetExam.mockRejectedValue(new BusinessError("この試験を閲覧する権限がありません"));

    const response = await GET(makeReq(), makeContext("exam-1"));

    expect(response.status).toBe(403);
  });

  it("test_GET_owned_returns_200", async () => {
    vi.mocked(getServerSession).mockResolvedValue(studentSession);
    mockGetExam.mockResolvedValue({
      exam: { id: "exam-1", userId: "user-1", status: ExamStatus.PASSED, score: 90, passed: true },
      answers: [],
    });

    const response = await GET(makeReq(), makeContext("exam-1"));

    expect(response.status).toBe(200);
  });
});
