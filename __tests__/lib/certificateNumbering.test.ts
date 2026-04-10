/**
 * 修了証明書採番ロジックテスト
 *
 * TDD: RED フェーズ
 * - 採番フォーマット: 第TC{機関コード4桁}{年2桁}{月2桁}{連番4桁}号
 * - 有効期限計算: 修了日から1年後の前日
 */

import { describe, it, expect } from "vitest";
import {
  formatCertificateNumber,
  calculateExpiryDate,
  parseCertificateNumber,
} from "@/lib/certificateNumbering";

// ===========================
// 採番フォーマットテスト
// ===========================

describe("formatCertificateNumber", () => {
  it("test_format_certificate_number_basic_format", () => {
    const result = formatCertificateNumber({
      institutionCode: "0515",
      issuedAt: new Date("2024-09-25"),
      sequence: 1142,
    });
    expect(result).toBe("第TC051524091142号");
  });

  it("test_format_certificate_number_pads_sequence_to_four_digits", () => {
    const result = formatCertificateNumber({
      institutionCode: "0515",
      issuedAt: new Date("2024-01-01"),
      sequence: 1,
    });
    expect(result).toBe("第TC051524010001号");
  });

  it("test_format_certificate_number_pads_month_to_two_digits", () => {
    const result = formatCertificateNumber({
      institutionCode: "0515",
      issuedAt: new Date("2024-03-15"),
      sequence: 5,
    });
    expect(result).toBe("第TC051524030005号");
  });

  it("test_format_certificate_number_year_is_two_digits", () => {
    const result = formatCertificateNumber({
      institutionCode: "0515",
      issuedAt: new Date("2026-12-31"),
      sequence: 9999,
    });
    expect(result).toBe("第TC051526129999号");
  });

  it("test_format_certificate_number_starts_with_daichi_tc", () => {
    const result = formatCertificateNumber({
      institutionCode: "0515",
      issuedAt: new Date("2024-09-25"),
      sequence: 1,
    });
    expect(result).toMatch(/^第TC/);
    expect(result).toMatch(/号$/);
  });

  it("test_format_certificate_number_total_length_is_correct", () => {
    // 第(1) + T(1) + C(1) + 0515(4) + 24(2) + 09(2) + 1142(4) + 号(1) = 16文字
    const result = formatCertificateNumber({
      institutionCode: "0515",
      issuedAt: new Date("2024-09-25"),
      sequence: 1142,
    });
    expect(result).toHaveLength(16);
  });
});

// ===========================
// 有効期限計算テスト
// ===========================

describe("calculateExpiryDate", () => {
  it("test_calculate_expiry_date_is_one_year_minus_one_day", () => {
    const issuedAt = new Date("2024-09-25");
    const expiry = calculateExpiryDate(issuedAt);
    // 2024/09/25 修了 → 2025/09/24 まで有効
    expect(expiry.getFullYear()).toBe(2025);
    expect(expiry.getMonth()).toBe(8); // 0-indexed: 8 = September
    expect(expiry.getDate()).toBe(24);
  });

  it("test_calculate_expiry_date_for_last_day_of_year", () => {
    const issuedAt = new Date("2024-12-31");
    const expiry = calculateExpiryDate(issuedAt);
    // 2024/12/31 修了 → 2025/12/30 まで有効
    expect(expiry.getFullYear()).toBe(2025);
    expect(expiry.getMonth()).toBe(11); // December
    expect(expiry.getDate()).toBe(30);
  });

  it("test_calculate_expiry_date_for_leap_year_feb_29", () => {
    const issuedAt = new Date("2024-02-29");
    const expiry = calculateExpiryDate(issuedAt);
    // 2024/02/29 修了 → 2025/02/28 まで有効 (2025年は閏年でない)
    expect(expiry.getFullYear()).toBe(2025);
    expect(expiry.getMonth()).toBe(1); // February
    expect(expiry.getDate()).toBe(28);
  });
});

// ===========================
// 証明書番号パーステスト
// ===========================

describe("parseCertificateNumber", () => {
  it("test_parse_certificate_number_extracts_institution_code", () => {
    const parsed = parseCertificateNumber("第TC051524091142号");
    expect(parsed.institutionCode).toBe("0515");
  });

  it("test_parse_certificate_number_extracts_year", () => {
    const parsed = parseCertificateNumber("第TC051524091142号");
    expect(parsed.year).toBe("24");
  });

  it("test_parse_certificate_number_extracts_month", () => {
    const parsed = parseCertificateNumber("第TC051524091142号");
    expect(parsed.month).toBe("09");
  });

  it("test_parse_certificate_number_extracts_sequence", () => {
    const parsed = parseCertificateNumber("第TC051524091142号");
    expect(parsed.sequence).toBe(1142);
  });

  it("test_parse_certificate_number_throws_on_invalid_format", () => {
    expect(() => parseCertificateNumber("INVALID-FORMAT")).toThrow();
  });
});
