// @vitest-environment node
import { describe, it, expect } from "vitest";
import { ReactPdfCertificateGenerator } from "@/lib/certificate/pdfGenerator";

// 実際に @react-pdf でレンダリングする統合テスト。
// fileWriter は戻り値を Buffer として書き込むため、
// generate() が Node ストリームではなく Buffer を返すことを保証する。
describe("ReactPdfCertificateGenerator", () => {
  it(
    "test_generate_with_valid_input_returns_pdf_buffer",
    async () => {
      const generator = new ReactPdfCertificateGenerator();

      const buffer = await generator.generate({
        certificateNumber: "第TC0000000002号",
        studentName: "テスト 花子",
        applicantNumber: "TS00000002",
        examinerName: "試験 員",
        issuedAt: new Date("2026-01-01T00:00:00Z"),
        expiresAt: new Date("2027-01-01T00:00:00Z"),
        institutionName: "登録講習機関テスト",
        institutionCode: "T0000",
        schoolName: "テクノドローンスクール",
        trainingOfficeCode: "OFFICE01",
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    },
    30000
  );
});
