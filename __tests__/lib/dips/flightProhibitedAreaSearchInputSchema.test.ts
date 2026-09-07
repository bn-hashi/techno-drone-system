import { describe, it, expect } from "vitest";
import { DipsFlightProhibitedAreaSearchInputSchema } from "@/lib/dips/flightProhibitedAreaSearchInputSchema";

/**
 * I9 (2026-09-06 レビュー): 以前は `z.number().int().min(1).max(11)` という範囲チェックの
 * みで、ガイドラインで欠番の種別コード 3・4 もそのまま通り、重複指定 ([5, 5, 5]) も
 * 弾いていなかった。`DIPS_FLIGHT_PROHIBITED_AREA_TYPE_OPTIONS`
 * (lib/constants/dipsFlightProhibitedAreaType.ts) の実在コード (1,2,5,6,7,8,9,10,11) から
 * 導出したバリデーションが、これらを正しく拒否することを確認する。
 */
const baseInput = {
  centerLongitude: 139.7671,
  centerLatitude: 35.6812,
  radiusMeters: 1000,
};

describe("DipsFlightProhibitedAreaSearchInputSchema", () => {
  it.each([1, 2, 5, 6, 7, 8, 9, 10, 11])(
    "test_accepts_existing_area_type_code_%i",
    (code) => {
      const result = DipsFlightProhibitedAreaSearchInputSchema.safeParse({
        ...baseInput,
        flightProhibitedAreaTypeIds: [code],
      });

      expect(result.success).toBe(true);
    }
  );

  it.each([3, 4])(
    "test_rejects_missing_area_type_code_%i",
    (code) => {
      // ガイドラインで欠番の種別コード。以前は範囲チェックのみで通ってしまっていた
      const result = DipsFlightProhibitedAreaSearchInputSchema.safeParse({
        ...baseInput,
        flightProhibitedAreaTypeIds: [code],
      });

      expect(result.success).toBe(false);
    }
  );

  it("test_rejects_out_of_range_area_type_code", () => {
    const result = DipsFlightProhibitedAreaSearchInputSchema.safeParse({
      ...baseInput,
      flightProhibitedAreaTypeIds: [999],
    });

    expect(result.success).toBe(false);
  });

  it("test_rejects_duplicate_area_type_codes", () => {
    // 以前は重複指定 ([5, 5, 5]) もそのまま DIPS へ転送していた
    const result = DipsFlightProhibitedAreaSearchInputSchema.safeParse({
      ...baseInput,
      flightProhibitedAreaTypeIds: [5, 5, 5],
    });

    expect(result.success).toBe(false);
  });

  it("test_accepts_multiple_distinct_existing_codes", () => {
    const result = DipsFlightProhibitedAreaSearchInputSchema.safeParse({
      ...baseInput,
      flightProhibitedAreaTypeIds: [5, 6, 7],
    });

    expect(result.success).toBe(true);
  });

  it("test_rejects_empty_area_type_id_list", () => {
    const result = DipsFlightProhibitedAreaSearchInputSchema.safeParse({
      ...baseInput,
      flightProhibitedAreaTypeIds: [],
    });

    expect(result.success).toBe(false);
  });
});
