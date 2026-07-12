// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import { ReactPdfCertificateGenerator } from "@/lib/certificate/pdfGenerator";

// 実際に @react-pdf でレンダリングする統合テスト。
// fileWriter は戻り値を Buffer として書き込むため、
// generate() が Node ストリームではなく Buffer を返すことを保証する。
// レンダリングは高コストなので beforeAll で1回だけ生成し、検証は1テスト1アサーションに分割する。
describe("ReactPdfCertificateGenerator", () => {
  let buffer: Buffer;

  beforeAll(async () => {
    const generator = new ReactPdfCertificateGenerator();
    buffer = await generator.generate({
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
    // カバレッジ計測時は計装オーバーヘッドで60秒超かかるため余裕を持たせる
  }, 120_000);

  it("test_generate_with_valid_input_returns_buffer", () => {
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  it("test_generate_with_valid_input_returns_pdf_header", () => {
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("test_generate_with_valid_input_ends_with_eof_marker", () => {
    // 末尾に %%EOF が無い PDF はレンダリング途中で切れている
    expect(buffer.subarray(-1024).toString("latin1")).toContain("%%EOF");
  });

  it("test_generate_with_valid_input_embeds_japanese_font", () => {
    // NotoSansJP を埋め込むため、フォントなしの空 PDF (数KB) より
    // 十分大きいことを下限として検証する
    const MIN_FONT_EMBEDDED_PDF_BYTES = 20_000;
    expect(buffer.length).toBeGreaterThan(MIN_FONT_EMBEDDED_PDF_BYTES);
  });
});
