import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole } from "@/types/prisma";
import { BusinessError } from "@/services/errors";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({ getQuestionService: vi.fn() }));

import { getServerSession } from "next-auth";
import { getQuestionService } from "@/lib/serviceFactory";
import { POST } from "@/app/api/admin/questions/import/route";

const mockImport = vi.fn();

const adminSession = { user: { id: "admin-1", role: UserRole.ADMIN } };

const makeRequest = (csvText: string) =>
  new Request("http://localhost/api/admin/questions/import", {
    method: "POST",
    headers: { "Content-Type": "text/csv" },
    body: csvText,
  });

const makeRequestWithContentType = (csvText: string, contentType: string) =>
  new Request("http://localhost/api/admin/questions/import", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: csvText,
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getQuestionService).mockReturnValue({
    listQuestions: vi.fn(),
    getQuestion: vi.fn(),
    createQuestion: vi.fn(),
    updateQuestion: vi.fn(),
    deleteQuestion: vi.fn(),
    importFromCsv: mockImport,
  } as unknown as ReturnType<typeof getQuestionService>);
});

describe("POST /api/admin/questions/import", () => {
  it("test_POST_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const response = await POST(makeRequest("dummy"));

    expect(response.status).toBe(401);
  });

  it("test_POST_student_role_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.STUDENT },
    });

    const response = await POST(makeRequest("dummy"));

    expect(response.status).toBe(403);
  });

  it("test_POST_valid_returns_200", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockImport.mockResolvedValue({ imported: 3, skipped: 1 });

    const response = await POST(makeRequest("csv"));

    expect(response.status).toBe(200);
  });

  it("test_POST_valid_returns_imported_count_in_body", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockImport.mockResolvedValue({ imported: 3, skipped: 1 });

    const response = await POST(makeRequest("csv"));
    const body = await response.json();

    expect(body.imported).toBe(3);
  });

  it("test_POST_business_error_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockImport.mockRejectedValue(new BusinessError("line 3: error"));

    const response = await POST(makeRequest("csv"));

    expect(response.status).toBe(400);
  });

  it("test_POST_business_error_includes_message", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockImport.mockRejectedValue(new BusinessError("line 3: invalid"));

    const response = await POST(makeRequest("csv"));
    const body = await response.json();

    expect(body.error).toContain("line 3");
  });

  it("test_POST_unsupported_content_type_returns_415", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);

    const response = await POST(makeRequestWithContentType("dummy", "application/json"));

    expect(response.status).toBe(415);
  });
});
