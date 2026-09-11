import { describe, it, expect } from "vitest";
import { DIPS_AIRCRAFT_TYPE_OPTIONS, dipsUaTypeLabel } from "@/lib/constants/dipsAircraftType";

describe("DIPS_AIRCRAFT_TYPE_OPTIONS", () => {
  it("test_defines_all_6_aircraft_type_codes", () => {
    expect(DIPS_AIRCRAFT_TYPE_OPTIONS.map((option) => option.code)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("test_has_no_duplicated_aircraft_type_codes", () => {
    const codes = DIPS_AIRCRAFT_TYPE_OPTIONS.map((option) => option.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("dipsUaTypeLabel", () => {
  it("test_returns_the_label_for_the_multirotor_type_code", () => {
    expect(dipsUaTypeLabel(3)).toBe("回転翼航空機（マルチローター）");
  });

  it("test_returns_unknown_label_for_an_undefined_type_code", () => {
    expect(dipsUaTypeLabel(99)).toBe("不明");
  });

  it("test_returns_unknown_label_for_null", () => {
    expect(dipsUaTypeLabel(null)).toBe("不明");
  });
});
