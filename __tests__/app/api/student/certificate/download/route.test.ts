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
import { GET } from "@/app/api/student/certificate/download/route";

const mockGetCertificateData = vi.fn();

const certifiedSession = {
  user: { id: "user-1", role: UserRole.STUDENT, status: UserStatus.CERTIFIED },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCertificateService).mockReturnValue({
    getCertificateData: mockGetCertificateData,
  } as unknown as ReturnType<typeof getCertificateService>);
  mockReadFile.mockReset();
});

const makeRequest = () =>
  new Request("http://localhost/api/student/certificate/download", { method: "GET" });

describe("GET /api/student/certificate/download", () => {
  it("test_GET_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("test_GET_admin_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "a-1", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it("test_GET_non_certified_student_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.STUDENT, status: UserStatus.COMPLETED },
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it("test_GET_no_certificate_returns_404", async () => {
    vi.mocked(getServerSession).mockResolvedValue(certifiedSession);
    mockGetCertificateData.mockResolvedValue({
      user: { id: "user-1" },
      certificate: null,
      canIssue: false,
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
  });

  it("test_GET_certificate_without_pdfPath_returns_409", async () => {
    vi.mocked(getServerSession).mockResolvedValue(certifiedSession);
    mockGetCertificateData.mockResolvedValue({
      user: { id: "user-1" },
      certificate: { id: "cert-1", pdfPath: null },
      canIssue: false,
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(409);
  });

  it("test_GET_success_returns_200_and_pdf", async () => {
    vi.mocked(getServerSession).mockResolvedValue(certifiedSession);
    mockGetCertificateData.mockResolvedValue({
      user: { id: "user-1" },
      certificate: { id: "cert-1", pdfPath: "/path/cert.pdf" },
      canIssue: false,
    });
    mockReadFile.mockResolvedValue(Buffer.from("PDF"));
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });

  it("test_GET_passes_session_user_id_to_service", async () => {
    vi.mocked(getServerSession).mockResolvedValue(certifiedSession);
    mockGetCertificateData.mockResolvedValue({
      user: { id: "user-1" },
      certificate: { id: "cert-1", pdfPath: "/path/cert.pdf" },
      canIssue: false,
    });
    mockReadFile.mockResolvedValue(Buffer.from("PDF"));
    await GET(makeRequest());
    expect(mockGetCertificateData).toHaveBeenCalledWith("user-1");
  });

  it("test_GET_DIPS_LINKED_status_also_allowed", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: UserRole.STUDENT, status: UserStatus.DIPS_LINKED },
    });
    mockGetCertificateData.mockResolvedValue({
      user: { id: "user-1" },
      certificate: { id: "cert-1", pdfPath: "/path/cert.pdf" },
      canIssue: false,
    });
    mockReadFile.mockResolvedValue(Buffer.from("PDF"));
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
  });
});
