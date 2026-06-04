import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { IssueCertificateButton } from "@/components/admin/certificate/IssueCertificateButton";

const mockRefresh = vi.fn();
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh, replace: mockReplace }),
  usePathname: () => "/admin/students/user-1/certificate",
}));

const mockPostIssueCertificate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/adminCertificate", () => ({
  postIssueCertificate: mockPostIssueCertificate,
}));

describe("IssueCertificateButton", () => {
  beforeEach(() => {
    mockRefresh.mockReset();
    mockReplace.mockReset();
    mockPostIssueCertificate.mockReset();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("test_IssueCertificateButton_renders_default_label", () => {
    render(<IssueCertificateButton userId="user-1" />);

    expect(screen.getByRole("button", { name: "修了証明書を発行" })).toBeInTheDocument();
  });

  it("test_IssueCertificateButton_click_shows_confirm_dialog", () => {
    render(<IssueCertificateButton userId="user-1" />);

    fireEvent.click(screen.getByRole("button", { name: "修了証明書を発行" }));

    expect(window.confirm).toHaveBeenCalled();
  });

  it("test_IssueCertificateButton_cancel_does_not_call_api", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<IssueCertificateButton userId="user-1" />);

    fireEvent.click(screen.getByRole("button", { name: "修了証明書を発行" }));

    expect(mockPostIssueCertificate).not.toHaveBeenCalled();
  });

  it("test_IssueCertificateButton_confirmed_calls_post_with_userId", async () => {
    mockPostIssueCertificate.mockResolvedValue({
      certificate: {
        id: "cert-1",
        userId: "user-1",
        certificateNumber: "第TC051526050001号",
        issuedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        pdfPath: "/tmp/cert.pdf",
      },
      pdfGenerated: true,
      mailSent: true,
    });

    render(<IssueCertificateButton userId="user-1" />);

    fireEvent.click(screen.getByRole("button", { name: "修了証明書を発行" }));

    await waitFor(() => {
      expect(mockPostIssueCertificate).toHaveBeenCalledWith("user-1");
    });
  });

  it("test_IssueCertificateButton_success_triggers_router_refresh", async () => {
    mockPostIssueCertificate.mockResolvedValue({
      certificate: {
        id: "cert-1",
        userId: "user-1",
        certificateNumber: "第TC051526050001号",
        issuedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        pdfPath: "/tmp/cert.pdf",
      },
      pdfGenerated: true,
      mailSent: true,
    });

    render(<IssueCertificateButton userId="user-1" />);

    fireEvent.click(screen.getByRole("button", { name: "修了証明書を発行" }));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("test_IssueCertificateButton_pdfGenerated_false_navigates_with_warn_pdf_failed", async () => {
    mockPostIssueCertificate.mockResolvedValue({
      certificate: {
        id: "cert-1",
        userId: "user-1",
        certificateNumber: "第TC051526050001号",
        issuedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      },
      pdfGenerated: false,
      mailSent: true,
    });

    render(<IssueCertificateButton userId="user-1" />);

    fireEvent.click(screen.getByRole("button", { name: "修了証明書を発行" }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        "/admin/students/user-1/certificate?warn=pdf_failed"
      );
    });
  });

  it("test_IssueCertificateButton_mailSent_false_navigates_with_warn_mail_failed", async () => {
    mockPostIssueCertificate.mockResolvedValue({
      certificate: {
        id: "cert-1",
        userId: "user-1",
        certificateNumber: "第TC051526050001号",
        issuedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      },
      pdfGenerated: true,
      mailSent: false,
    });

    render(<IssueCertificateButton userId="user-1" />);

    fireEvent.click(screen.getByRole("button", { name: "修了証明書を発行" }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        "/admin/students/user-1/certificate?warn=mail_failed"
      );
    });
  });

  it("test_IssueCertificateButton_both_failed_navigates_with_both_warn_codes", async () => {
    mockPostIssueCertificate.mockResolvedValue({
      certificate: {
        id: "cert-1",
        userId: "user-1",
        certificateNumber: "第TC051526050001号",
        issuedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      },
      pdfGenerated: false,
      mailSent: false,
    });

    render(<IssueCertificateButton userId="user-1" />);

    fireEvent.click(screen.getByRole("button", { name: "修了証明書を発行" }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        "/admin/students/user-1/certificate?warn=pdf_failed&warn=mail_failed"
      );
    });
  });

  it("test_IssueCertificateButton_api_error_shows_error_message", async () => {
    mockPostIssueCertificate.mockRejectedValue(new Error("既に発行されています"));

    render(<IssueCertificateButton userId="user-1" />);

    fireEvent.click(screen.getByRole("button", { name: "修了証明書を発行" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("既に発行されています");
    });
  });
});
