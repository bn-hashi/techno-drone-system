import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole, UserStatus } from "@/types/prisma";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({
  getQAService: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { getQAService } from "@/lib/serviceFactory";
import { GET } from "@/app/api/admin/qa/route";

const mockListAll = vi.fn();

const adminSession = {
  user: { id: "admin-1", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getQAService).mockReturnValue({
    listAll: mockListAll,
  } as unknown as ReturnType<typeof getQAService>);
});

const makeRequest = (url = "http://localhost/api/admin/qa") => new Request(url, { method: "GET" });

describe("GET /api/admin/qa", () => {
  it("test_GET_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("test_GET_student_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.STUDENT, status: UserStatus.ACTIVE },
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it("test_GET_success_default_returns_200", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListAll.mockResolvedValue([]);

    // Act
    const res = await GET(makeRequest());

    // Assert
    expect(res.status).toBe(200);
  });

  it("test_GET_success_default_passes_false_to_listAll", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListAll.mockResolvedValue([]);

    // Act
    await GET(makeRequest());

    // Assert
    expect(mockListAll).toHaveBeenCalledWith(false);
  });

  it("test_GET_unansweredOnly_true_passes_true", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListAll.mockResolvedValue([]);

    // Act
    await GET(makeRequest("http://localhost/api/admin/qa?unansweredOnly=true"));

    // Assert
    expect(mockListAll).toHaveBeenCalledWith(true);
  });

  it("test_GET_unansweredOnly_false_passes_false", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockListAll.mockResolvedValue([]);

    // Act
    await GET(makeRequest("http://localhost/api/admin/qa?unansweredOnly=false"));

    // Assert
    expect(mockListAll).toHaveBeenCalledWith(false);
  });

  it("test_GET_returns_records_field_with_correct_length", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    const sample = {
      id: "qa-1",
      userId: "user-1",
      question: "Q?",
      answer: null,
      questionedAt: new Date(),
      answeredAt: null,
      answeredBy: null,
      user: { id: "user-1", name: "山田", email: "y@e.com" },
    };
    mockListAll.mockResolvedValue([sample]);

    // Act
    const res = await GET(makeRequest());
    const data = await res.json();

    // Assert
    expect(data.records).toHaveLength(1);
  });

  it("test_GET_returns_record_id_in_records", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    const sample = {
      id: "qa-1",
      userId: "user-1",
      question: "Q?",
      answer: null,
      questionedAt: new Date(),
      answeredAt: null,
      answeredBy: null,
      user: { id: "user-1", name: "山田", email: "y@e.com" },
    };
    mockListAll.mockResolvedValue([sample]);

    // Act
    const res = await GET(makeRequest());
    const data = await res.json();

    // Assert
    expect(data.records[0].id).toBe("qa-1");
  });
});
