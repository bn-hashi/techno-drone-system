import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole } from "@/types/prisma";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/serviceFactory", () => ({
  getEnrollmentService: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { getEnrollmentService } from "@/lib/serviceFactory";
import { POST } from "@/app/api/enrollment/documents/route";

const mockUploadDocuments = vi.fn();

const studentSession = {
  user: { id: "student-1", email: "s@example.com", role: UserRole.STUDENT },
};

// jsdom 環境では FormData を Request の body に渡しても Content-Type が自動設定されず
// request.formData() が TypeError を投げるため、formData() メソッドをモックする
function createRequestWithFormData(formData: FormData): Request {
  const request = new Request("http://localhost/api/enrollment/documents", {
    method: "POST",
  });
  Object.defineProperty(request, "formData", {
    value: () => Promise.resolve(formData),
  });
  return request;
}

function createValidFile(name = "id.jpg"): File {
  return new File(["file content"], name, { type: "image/jpeg" });
}

describe("POST /api/enrollment/documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEnrollmentService).mockReturnValue({
      uploadDocuments: mockUploadDocuments,
    } as unknown as ReturnType<typeof getEnrollmentService>);
  });

  it("test_POST_no_session_returns_401", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(null);
    const request = createRequestWithFormData(new FormData());

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(401);
  });

  it("test_POST_non_student_returns_403", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "admin-1", role: UserRole.ADMIN },
    });
    const request = createRequestWithFormData(new FormData());

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(403);
  });

  it("test_POST_valid_files_returns_200", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(studentSession);
    mockUploadDocuments.mockResolvedValue(undefined);

    const formData = new FormData();
    formData.append("idDocument", createValidFile());
    const request = createRequestWithFormData(formData);

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(200);
  });

  it("test_POST_no_files_returns_400", async () => {
    // Arrange
    // ファイルなし → Service が BusinessError → 400
    vi.mocked(getServerSession).mockResolvedValue(studentSession);
    const { BusinessError } = await import("@/services/errors");
    mockUploadDocuments.mockRejectedValue(new BusinessError("ファイルが1件も提供されていません"));
    const request = createRequestWithFormData(new FormData());

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(400);
  });

  // Issue #12: 0バイトファイルと有効ファイルの混在 → Service が BusinessError → 400
  it("test_POST_zero_byte_file_mixed_with_valid_returns_400", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(studentSession);
    const { BusinessError } = await import("@/services/errors");
    mockUploadDocuments.mockRejectedValue(new BusinessError("0バイトのファイルが含まれています"));

    const formData = new FormData();
    formData.append("idDocument", createValidFile());
    formData.append("photo", new File([], "empty.jpg", { type: "image/jpeg" }));
    const request = createRequestWithFormData(formData);

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(400);
  });

  it("test_POST_application_not_found_returns_404", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(studentSession);
    const { EnrollmentNotFoundError } = await import("@/services/errors");
    mockUploadDocuments.mockRejectedValue(new EnrollmentNotFoundError("student-1"));

    const formData = new FormData();
    formData.append("idDocument", createValidFile());
    const request = createRequestWithFormData(formData);

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(404);
  });

  it("test_POST_upload_failure_returns_500", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(studentSession);
    mockUploadDocuments.mockRejectedValue(new Error("Disk full"));

    const formData = new FormData();
    formData.append("idDocument", createValidFile());
    const request = createRequestWithFormData(formData);

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(500);
  });

  it("test_POST_valid_files_calls_uploadDocuments_with_correct_userId", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(studentSession);
    mockUploadDocuments.mockResolvedValue(undefined);

    const formData = new FormData();
    formData.append("idDocument", createValidFile());
    const request = createRequestWithFormData(formData);

    // Act
    await POST(request);

    // Assert
    expect(mockUploadDocuments).toHaveBeenCalledWith(
      "student-1",
      expect.arrayContaining([expect.objectContaining({ field: "idDocument" })])
    );
  });
});
