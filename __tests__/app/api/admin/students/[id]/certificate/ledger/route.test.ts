import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRole, UserStatus } from "@/types/prisma";
import { BusinessError } from "@/services/errors";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/serviceFactory", () => ({ getCertificateLedgerService: vi.fn() }));

import { getServerSession } from "next-auth";
import { getCertificateLedgerService } from "@/lib/serviceFactory";
import { GET } from "@/app/api/admin/students/[id]/certificate/ledger/route";

const mockGetLedgerPdf = vi.fn();

const adminSession = {
  user: { id: "admin-1", name: "管理者A", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCertificateLedgerService).mockReturnValue({
    getLedgerPdf: mockGetLedgerPdf,
  } as unknown as ReturnType<typeof getCertificateLedgerService>);
});

const makeRequest = () =>
  new Request("http://localhost/api/admin/students/user-1/certificate/ledger", {
    method: "GET",
  });

const makeContext = (id = "user-1") => ({ params: Promise.resolve({ id }) });

describe("GET /api/admin/students/[id]/certificate/ledger", () => {
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
    mockGetLedgerPdf.mockRejectedValue(new BusinessError("修了証明書がまだ発行されていません"));
    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(404);
  });

  it("test_GET_success_returns_200", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockGetLedgerPdf.mockResolvedValue(Buffer.from("LEDGER PDF DATA"));
    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(200);
  });

  it("test_GET_success_returns_pdf_content_type", async () => {
    vi.mocked(getServerSession).mockResolvedValue(adminSession);
    mockGetLedgerPdf.mockResolvedValue(Buffer.from("LEDGER"));
    const res = await GET(makeRequest(), makeContext());
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });
});
