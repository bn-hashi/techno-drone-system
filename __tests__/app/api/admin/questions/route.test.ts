import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole } from "@/types/prisma";
import { BusinessError } from "@/services/errors";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({ getQuestionService: vi.fn() }));

import { getServerSession } from "next-auth";
import { getQuestionService } from "@/lib/serviceFactory";
import { GET, POST } from "@/app/api/admin/questions/route";

const mockList = vi.fn();
const mockCreate = vi.fn();

const adminSession = { user: { id: "admin-1", role: UserRole.ADMIN } };

const mockQuestion = {
  id: "q-1",
  subjectId: "subject-1",
  body: "問題",
  choices: ["A", "B", "C"],
  correctIndex: 0,
  explanation: "解説",
  createdAt: new Date(),
};

const validCreateBody = {
  subjectId: "subject-1",
  body: "問題",
  choices: ["A", "B", "C"],
  correctIndex: 0,
  explanation: "解説",
};

const makeGetRequest = (search = "") =>
  new Request(`http://localhost/api/admin/questions${search}`);

const makePostRequest = (body: unknown) =>
  new Request("http://localhost/api/admin/questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getQuestionService).mockReturnValue({
    listQuestions: mockList,
    getQuestion: vi.fn(),
    createQuestion: mockCreate,
    updateQuestion: vi.fn(),
    deleteQuestion: vi.fn(),
    importFromCsv: vi.fn(),
  } as unknown as ReturnType<typeof getQuestionService>);
});

describe("GET /api/admin/questions", () => {
  it("test_GET_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await GET(makeGetRequest());

    expect(response.status).toBe(401);
  });

  it("test_GET_student_role_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.STUDENT },
    });

    const response = await GET(makeGetRequest());

    expect(response.status).toBe(403);
  });

  it("test_GET_admin_returns_200", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockList.mockResolvedValue([mockQuestion]);

    const response = await GET(makeGetRequest());

    expect(response.status).toBe(200);
  });

  it("test_GET_passes_subjectId_filter", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockList.mockResolvedValue([]);

    await GET(makeGetRequest("?subjectId=subject-1"));

    expect(mockList).toHaveBeenCalledWith({ subjectId: "subject-1" });
  });
});

describe("POST /api/admin/questions", () => {
  it("test_POST_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await POST(makePostRequest(validCreateBody));

    expect(response.status).toBe(401);
  });

  it("test_POST_invalid_body_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);

    const response = await POST(makePostRequest({ body: "" }));

    expect(response.status).toBe(400);
  });

  it("test_POST_business_error_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockCreate.mockRejectedValue(new BusinessError("error"));

    const response = await POST(makePostRequest(validCreateBody));

    expect(response.status).toBe(400);
  });

  it("test_POST_valid_returns_201", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockCreate.mockResolvedValue(mockQuestion);

    const response = await POST(makePostRequest(validCreateBody));

    expect(response.status).toBe(201);
  });
});
