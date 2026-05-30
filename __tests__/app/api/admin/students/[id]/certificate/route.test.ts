import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole, UserStatus, JudgmentResult } from "@/types/prisma";
import { BusinessError } from "@/services/errors";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({
  getCertificateService: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { getCertificateService } from "@/lib/serviceFactory";
import { POST } from "@/app/api/admin/students/[id]/certificate/route";

const mockIssueCertificate = vi.fn();

const adminSession = {
  user: { id: "admin-1", name: "管理者A", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCertificateService).mockReturnValue({
    issueCertificate: mockIssueCertificate,
  } as unknown as ReturnType<typeof getCertificateService>);
});

const makeRequest = () =>
  new Request("http://localhost/api/admin/students/user-1/certificate", { method: "POST" });

const makeContext = (id = "user-1") => ({ params: Promise.resolve({ id }) });

const sampleResult = {
  certificate: {
    id: "cert-1",
    userId: "user-1",
    certificateNumber: "第TC051526050001号",
    issuedAt: new Date(),
    expiresAt: new Date(),
    pdfPath: "/path/cert.pdf",
  },
  pdfGenerated: true,
  mailSent: true,
};

describe("POST /api/admin/students/[id]/certificate", () => {
  // sentinel to keep enums imported (avoid lint unused warning)
  void JudgmentResult;

  it("test_POST_unauthenticated_returns_401", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(401);
  });

  it("test_POST_student_returns_403", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.STUDENT, status: UserStatus.ACTIVE },
    });
    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(403);
  });

  it("test_POST_BusinessError_returns_400", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockIssueCertificate.mockRejectedValue(
      new BusinessError("修了証明書の発行は COMPLETED 状態の受講者のみ実行できます")
    );
    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(400);
  });

  it("test_POST_success_returns_201", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockIssueCertificate.mockResolvedValue(sampleResult);
    const res = await POST(makeRequest(), makeContext());
    expect(res.status).toBe(201);
  });

  it("test_POST_success_returns_certificate", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockIssueCertificate.mockResolvedValue(sampleResult);
    const res = await POST(makeRequest(), makeContext());
    const data = await res.json();
    expect(data.certificate.id).toBe("cert-1");
  });

  it("test_POST_returns_pdfGenerated_and_mailSent_flags", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockIssueCertificate.mockResolvedValue({ ...sampleResult, pdfGenerated: false, mailSent: false });
    const res = await POST(makeRequest(), makeContext());
    const data = await res.json();
    expect(data.pdfGenerated).toBe(false);
    expect(data.mailSent).toBe(false);
  });

  it("test_POST_passes_userId_to_service", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockIssueCertificate.mockResolvedValue(sampleResult);
    await POST(makeRequest(), makeContext("user-xyz"));
    expect(mockIssueCertificate).toHaveBeenCalledWith("user-xyz");
  });
});
