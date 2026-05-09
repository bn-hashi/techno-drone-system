import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole } from "@/types/prisma";

// NextAuth のセッションモック
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// saveUploadedFile をモック
vi.mock("@/lib/upload", () => ({
  saveUploadedFile: vi.fn(),
}));

// Prisma をモック
// getPrisma() が毎回同じインスタンスを返すようにして、テスト側のモック設定が route 内で有効になるようにする
vi.mock("@/lib/db", () => {
  const sharedInstance = {
    enrollmentApplication: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  return {
    getPrisma: vi.fn(() => sharedInstance),
  };
});

import { getServerSession } from "next-auth";
import { saveUploadedFile } from "@/lib/upload";
import { POST } from "@/app/api/enrollment/documents/route";

const studentSession = {
  user: { id: "student-1", email: "student@example.com", role: UserRole.STUDENT },
};

// jsdom 環境では FormData を Request の body に渡しても Content-Type が自動設定されず
// request.formData() が TypeError を投げるため、formData() メソッドをモックする
function createMultipartRequest(fields: Record<string, File | null>): Request {
  const formData = new FormData();
  for (const [key, file] of Object.entries(fields)) {
    if (file) {
      formData.append(key, file);
    }
  }
  const request = new Request("http://localhost/api/enrollment/documents", {
    method: "POST",
  });
  Object.defineProperty(request, "formData", {
    value: () => Promise.resolve(formData),
  });
  return request;
}

function createMockFile(name: string, type = "image/jpeg"): File {
  return new File(["file content"], name, { type });
}

describe("POST /api/enrollment/documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("test_POST_unauthenticated_returns_401", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(null);
    const request = createMultipartRequest({});

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(401);
  });

  it("test_POST_admin_role_returns_403", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "admin-1", role: UserRole.ADMIN },
    });
    const request = createMultipartRequest({});

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(403);
  });

  it("test_POST_authenticated_student_with_id_document_returns_200", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(studentSession);
    vi.mocked(saveUploadedFile).mockResolvedValue("/home/ubuntu/uploads/id-documents/file.jpg");

    const { getPrisma } = await import("@/lib/db");
    const mockPrisma = getPrisma();
    vi.mocked(mockPrisma.enrollmentApplication.findUnique).mockResolvedValue({
      id: "app-1",
      userId: "student-1",
    } as unknown as Awaited<ReturnType<typeof mockPrisma.enrollmentApplication.findUnique>>);
    vi.mocked(mockPrisma.enrollmentApplication.update).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof mockPrisma.enrollmentApplication.update>>
    );

    const request = createMultipartRequest({
      idDocument: createMockFile("id.jpg"),
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(200);
  });

  it("test_POST_with_id_document_calls_saveUploadedFile", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(studentSession);
    vi.mocked(saveUploadedFile).mockResolvedValue("/home/ubuntu/uploads/id-documents/file.jpg");

    const { getPrisma } = await import("@/lib/db");
    const mockPrisma = getPrisma();
    vi.mocked(mockPrisma.enrollmentApplication.findUnique).mockResolvedValue({
      id: "app-1",
      userId: "student-1",
    } as unknown as Awaited<ReturnType<typeof mockPrisma.enrollmentApplication.findUnique>>);
    vi.mocked(mockPrisma.enrollmentApplication.update).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof mockPrisma.enrollmentApplication.update>>
    );

    const request = createMultipartRequest({
      idDocument: createMockFile("id.jpg"),
    });

    // Act
    await POST(request);

    // Assert
    expect(saveUploadedFile).toHaveBeenCalled();
  });

  it("test_POST_no_files_provided_returns_400", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(studentSession);

    const request = createMultipartRequest({});

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(400);
  });

  it("test_POST_enrollment_not_found_returns_404", async () => {
    // Arrange
    vi.mocked(getServerSession).mockResolvedValue(studentSession);
    vi.mocked(saveUploadedFile).mockResolvedValue("/home/ubuntu/uploads/id-documents/file.jpg");

    const { getPrisma } = await import("@/lib/db");
    const mockPrisma = getPrisma();
    vi.mocked(mockPrisma.enrollmentApplication.findUnique).mockResolvedValue(null);

    const request = createMultipartRequest({
      idDocument: createMockFile("id.jpg"),
    });

    // Act
    const response = await POST(request);

    // Assert
    expect(response.status).toBe(404);
  });
});
