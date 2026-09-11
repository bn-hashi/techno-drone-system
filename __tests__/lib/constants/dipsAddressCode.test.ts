import { describe, it, expect } from "vitest";
import {
  DIPS_COUNTRY_CODE_JAPAN,
  DIPS_PREFECTURE_OPTIONS,
  dipsPrefectureLabel,
  isKnownDipsPrefectureCode,
} from "@/lib/constants/dipsAddressCode";

describe("DIPS_COUNTRY_CODE_JAPAN", () => {
  it("test_is_the_three_digit_code_for_japan", () => {
    // 別紙1 国コードのデータ定義: 日本 = "001"
    expect(DIPS_COUNTRY_CODE_JAPAN).toBe("001");
  });
});

describe("DIPS_PREFECTURE_OPTIONS", () => {
  it("test_defines_all_47_prefecture_codes", () => {
    const codes = DIPS_PREFECTURE_OPTIONS.map((option) => option.code);
    expect(codes).toHaveLength(47);
  });

  it("test_has_no_duplicated_prefecture_codes", () => {
    const codes = DIPS_PREFECTURE_OPTIONS.map((option) => option.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("test_starts_with_hokkaido_as_code_01", () => {
    // 別紙2 都道府県コードのデータ定義: 北海道 = "01"
    expect(DIPS_PREFECTURE_OPTIONS[0]).toEqual({ code: "01", label: "北海道" });
  });

  it("test_includes_tokyo_as_code_13", () => {
    expect(DIPS_PREFECTURE_OPTIONS).toContainEqual({ code: "13", label: "東京都" });
  });

  it("test_ends_with_okinawa_as_code_47", () => {
    expect(DIPS_PREFECTURE_OPTIONS[46]).toEqual({ code: "47", label: "沖縄県" });
  });
});

describe("dipsPrefectureLabel", () => {
  it("test_returns_the_label_for_a_known_code", () => {
    expect(dipsPrefectureLabel("13")).toBe("東京都");
  });

  it("test_returns_unknown_label_for_an_undefined_code", () => {
    expect(dipsPrefectureLabel("99")).toBe("不明");
  });
});

describe("isKnownDipsPrefectureCode", () => {
  it("test_returns_true_for_a_known_code", () => {
    expect(isKnownDipsPrefectureCode("13")).toBe(true);
  });

  it("test_returns_false_for_an_undefined_code", () => {
    expect(isKnownDipsPrefectureCode("99")).toBe(false);
  });
});
