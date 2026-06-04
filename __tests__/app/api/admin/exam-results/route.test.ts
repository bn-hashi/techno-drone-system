import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole, UserStatus, ExamStatus } from "@/types/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({
  getExamService: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { getExamService } from "@/lib/serviceFactory";
import { GET } from "@/app/api/admin/exam-results/route";

const mockListAllResults = vi.fn();

const adminSession = { user: { id: "admin-1", role: UserRole.ADMIN } };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getExamService).mockReturnValue({
    listAllResults: mockListAllResults,
  } as unknown as ReturnType<typeof getExamService>);
});

const makeReq = () => new Request("http://localhost/api/admin/exam-results");

describe("GET /api/admin/exam-results", () => {
  it("test_GET_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await GET(makeReq());

    expect(response.status).toBe(401);
  });

  it("test_GET_student_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.STUDENT, status: UserStatus.ACTIVE },
    });

    const response = await GET(makeReq());

    expect(response.status).toBe(403);
  });

  it("test_GET_admin_returns_200", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListAllResults.mockResolvedValue([
      {
        id: "exam-1",
        userId: "user-1",
        score: 90,
        passed: true,
        status: ExamStatus.PASSED,
        user: { id: "user-1", name: "山田", email: "y@example.com" },
      },
    ]);

    const response = await GET(makeReq());

    expect(response.status).toBe(200);
  });

  it("test_GET_returns_exam_results_array", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListAllResults.mockResolvedValue([]);

    const response = await GET(makeReq());
    const body = await response.json();

    expect(body.examResults).toEqual([]);
  });
});
