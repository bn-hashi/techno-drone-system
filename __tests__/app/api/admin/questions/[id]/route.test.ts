import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole } from "@/types/prisma";
import { BusinessError, QuestionNotFoundError } from "@/services/errors";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({ getQuestionService: vi.fn() }));

import { getServerSession } from "next-auth";
import { getQuestionService } from "@/lib/serviceFactory";
import { GET, PATCH, DELETE } from "@/app/api/admin/questions/[id]/route";

const mockGet = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

const adminSession = { user: { id: "admin-1", role: UserRole.ADMIN } };
const params = { id: "q-1" };

const mockQuestion = {
  id: "q-1",
  subjectId: "subject-1",
  body: "問題",
  choices: ["A", "B", "C"],
  correctIndex: 0,
  explanation: "解説",
  createdAt: new Date(),
};

const makeRequest = (method: string, body?: unknown) =>
  new Request(`http://localhost/api/admin/questions/${params.id}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getQuestionService).mockReturnValue({
    listQuestions: vi.fn(),
    getQuestion: mockGet,
    createQuestion: vi.fn(),
    updateQuestion: mockUpdate,
    deleteQuestion: mockDelete,
    importFromCsv: vi.fn(),
  } as unknown as ReturnType<typeof getQuestionService>);
});

describe("GET /api/admin/questions/[id]", () => {
  it("test_GET_admin_returns_200", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockGet.mockResolvedValue(mockQuestion);

    const response = await GET(makeRequest("GET"), { params });

    expect(response.status).toBe(200);
  });

  it("test_GET_not_found_returns_404", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockGet.mockRejectedValue(new QuestionNotFoundError("q-x"));

    const response = await GET(makeRequest("GET"), { params });

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/admin/questions/[id]", () => {
  it("test_PATCH_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await PATCH(makeRequest("PATCH", { body: "更新" }), { params });

    expect(response.status).toBe(401);
  });

  it("test_PATCH_valid_returns_200", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockUpdate.mockResolvedValue({ ...mockQuestion, body: "更新" });

    const response = await PATCH(makeRequest("PATCH", { body: "更新" }), { params });

    expect(response.status).toBe(200);
  });

  it("test_PATCH_not_found_returns_404", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockUpdate.mockRejectedValue(new QuestionNotFoundError("q-x"));

    const response = await PATCH(makeRequest("PATCH", { body: "更新" }), { params });

    expect(response.status).toBe(404);
  });

  it("test_PATCH_business_error_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockUpdate.mockRejectedValue(new BusinessError("error"));

    const response = await PATCH(makeRequest("PATCH", { body: "更新" }), { params });

    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/admin/questions/[id]", () => {
  it("test_DELETE_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await DELETE(makeRequest("DELETE"), { params });

    expect(response.status).toBe(401);
  });

  it("test_DELETE_existing_returns_204", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockDelete.mockResolvedValue(undefined);

    const response = await DELETE(makeRequest("DELETE"), { params });

    expect(response.status).toBe(204);
  });

  it("test_DELETE_not_found_returns_404", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockDelete.mockRejectedValue(new QuestionNotFoundError("q-x"));

    const response = await DELETE(makeRequest("DELETE"), { params });

    expect(response.status).toBe(404);
  });
});
