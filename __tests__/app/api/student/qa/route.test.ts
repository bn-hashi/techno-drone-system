import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole, UserStatus } from "@/types/prisma";
import { BusinessError } from "@/services/errors";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({
  getQAService: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { getQAService } from "@/lib/serviceFactory";
import { POST, GET } from "@/app/api/student/qa/route";

const mockCreateQuestion = vi.fn();
const mockListByUser = vi.fn();

const studentSession = {
  user: { id: "user-1", role: UserRole.STUDENT, status: UserStatus.ACTIVE },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getQAService).mockReturnValue({
    createQuestion: mockCreateQuestion,
    listByUser: mockListByUser,
  } as unknown as ReturnType<typeof getQAService>);
});

const makePostRequest = (body: unknown) =>
  new Request("http://localhost/api/student/qa", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const makeGetRequest = () => new Request("http://localhost/api/student/qa", { method: "GET" });

describe("POST /api/student/qa", () => {
  it("test_POST_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await POST(makePostRequest({ question: "Q?" }));
    expect(res.status).toBe(401);
  });

  it("test_POST_admin_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    });
    const res = await POST(makePostRequest({ question: "Q?" }));
    expect(res.status).toBe(403);
  });

  it("test_POST_pending_status_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.STUDENT, status: UserStatus.PENDING_ACTIVATION },
    });
    const res = await POST(makePostRequest({ question: "Q?" }));
    expect(res.status).toBe(403);
  });

  it("test_POST_missing_question_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(studentSession);
    const res = await POST(makePostRequest({}));
    expect(res.status).toBe(400);
  });

  it("test_POST_BusinessError_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(studentSession);
    mockCreateQuestion.mockRejectedValue(new BusinessError("質問本文を入力してください"));
    const res = await POST(makePostRequest({ question: "" }));
    expect(res.status).toBe(400);
  });

  const sampleCreatedRecord = {
    id: "qa-1",
    userId: "user-1",
    question: "Q?",
    answer: null,
    questionedAt: new Date(),
    answeredAt: null,
    answeredBy: null,
  };

  it("test_POST_success_returns_201", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(studentSession);
    mockCreateQuestion.mockResolvedValue(sampleCreatedRecord);

    // Act
    const res = await POST(makePostRequest({ question: "Q?" }));

    // Assert
    expect(res.status).toBe(201);
  });

  it("test_POST_success_returns_record_in_body", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(studentSession);
    mockCreateQuestion.mockResolvedValue(sampleCreatedRecord);

    // Act
    const res = await POST(makePostRequest({ question: "Q?" }));
    const data = await res.json();

    // Assert
    expect(data.record.id).toBe("qa-1");
  });

  it("test_POST_passes_userId_and_question_to_service", async () => {
    vi.mocked(getServerSession).mockResolvedValue(studentSession);
    mockCreateQuestion.mockResolvedValue({
      id: "qa-1",
      userId: "user-1",
      question: "Q?",
      answer: null,
      questionedAt: new Date(),
      answeredAt: null,
      answeredBy: null,
    });
    await POST(makePostRequest({ question: "ご質問本文" }));
    expect(mockCreateQuestion).toHaveBeenCalledWith("user-1", "ご質問本文");
  });
});

describe("GET /api/student/qa", () => {
  it("test_GET_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("test_GET_admin_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    });
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(403);
  });

  it("test_GET_success_returns_200", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(studentSession);
    mockListByUser.mockResolvedValue([]);

    // Act
    const res = await GET(makeGetRequest());

    // Assert
    expect(res.status).toBe(200);
  });

  it("test_GET_success_returns_records_field", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(studentSession);
    mockListByUser.mockResolvedValue([]);

    // Act
    const res = await GET(makeGetRequest());
    const data = await res.json();

    // Assert
    expect(data.records).toEqual([]);
  });

  it("test_GET_passes_userId_to_service", async () => {
    vi.mocked(getServerSession).mockResolvedValue(studentSession);
    mockListByUser.mockResolvedValue([]);
    await GET(makeGetRequest());
    expect(mockListByUser).toHaveBeenCalledWith("user-1");
  });
});
