import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole, UserStatus } from "@/types/prisma";

const { mockReadFile } = vi.hoisted(() => ({ mockReadFile: vi.fn() }));

vi.mock("node:fs/promises", () => ({
  default: { readFile: mockReadFile },
  readFile: mockReadFile,
}));
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({ getCertificateService: vi.fn() }));

import { getServerSession } from "next-auth";
import { getCertificateService } from "@/lib/serviceFactory";
import { GET } from "@/app/api/admin/students/[id]/certificate/download/route";

const mockGetCertificateData = vi.fn();

const adminSession = {
  user: { id: "admin-1", name: "管理者A", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCertificateService).mockReturnValue({
    getCertificateData: mockGetCertificateData,
  } as unknown as ReturnType<typeof getCertificateService>);
  mockReadFile.mockReset();
});

const makeRequest = () =>
  new Request("http://localhost/api/admin/students/user-1/certificate/download", {
    method: "GET",
  });

const makeContext = (id = "user-1") => ({ params: Promise.resolve({ id }) });

describe("GET /api/admin/students/[id]/certificate/download", () => {
  it("test_GET_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(401);
  });

  it("test_GET_student_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.STUDENT, status: UserStatus.ACTIVE },
    });
    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(403);
  });

  it("test_GET_no_certificate_returns_404", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockGetCertificateData.mockResolvedValue({
      user: { id: "user-1" },
      certificate: null,
      canIssue: true,
    });
    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(404);
  });

  it("test_GET_certificate_without_pdfPath_returns_409", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockGetCertificateData.mockResolvedValue({
      user: { id: "user-1" },
      certificate: { id: "cert-1", pdfPath: null },
      canIssue: false,
    });
    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(409);
  });

  it("test_GET_success_returns_200", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockGetCertificateData.mockResolvedValue({
      user: { id: "user-1" },
      certificate: { id: "cert-1", pdfPath: "/path/cert.pdf" },
      canIssue: false,
    });
    mockReadFile.mockResolvedValue(Buffer.from("PDF DATA"));
    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(200);
  });

  it("test_GET_success_returns_pdf_content_type", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockGetCertificateData.mockResolvedValue({
      user: { id: "user-1" },
      certificate: { id: "cert-1", pdfPath: "/path/cert.pdf" },
      canIssue: false,
    });
    mockReadFile.mockResolvedValue(Buffer.from("PDF"));
    const res = await GET(makeRequest(), makeContext());
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });
});
