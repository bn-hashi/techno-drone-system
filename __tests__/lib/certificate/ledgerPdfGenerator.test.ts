// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import { ReactPdfLedgerGenerator } from "@/lib/certificate/ledgerPdfGenerator";

// 実際に @react-pdf でレンダリングする統合テスト。
// API ルートは戻り値を `new Uint8Array(buffer)` で消費するため、
// generate() が Node ストリームではなく Buffer を返すことを保証する。
// レンダリングは高コストなので beforeAll で1回だけ生成し、検証は1テスト1アサーションに分割する。
describe("ReactPdfLedgerGenerator", () => {
  let buffer: Buffer;

  beforeAll(async () => {
    const generator = new ReactPdfLedgerGenerator();
    buffer = await generator.generate({
      certificateNumber: "第TC0000000001号",
      studentName: "テスト 太郎",
      applicantNumber: "TS00000001",
      issuedAt: new Date("2026-01-01T00:00:00Z"),
      expiresAt: new Date("2027-01-01T00:00:00Z"),
    });
    // カバレッジ計測時は計装オーバーヘッドで60秒超かかるため余裕を持たせる
  }, 120_000);

  it("test_generate_with_valid_input_returns_buffer", () => {
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  it("test_generate_with_valid_input_returns_pdf_header", () => {
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
