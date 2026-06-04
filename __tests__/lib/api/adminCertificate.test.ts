import { describe, it, expect } from "vitest";
import { buildAdminCertificateLedgerUrl } from "@/lib/api/adminCertificate";

describe("buildAdminCertificateLedgerUrl", () => {
  it("test_buildAdminCertificateLedgerUrl_returns_ledger_path", () => {
    // Arrange & Act
    const url = buildAdminCertificateLedgerUrl("user-1");

    // Assert
    expect(url).toBe("/api/admin/students/user-1/certificate/ledger");
  });

  it("test_buildAdminCertificateLedgerUrl_encodes_user_id", () => {
    // Arrange & Act
    const url = buildAdminCertificateLedgerUrl("a/b 1");

    // Assert
    expect(url).toBe("/api/admin/students/a%2Fb%201/certificate/ledger");
  });
});
