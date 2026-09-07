import { describe, it, expect, vi, beforeEach } from "vitest";
import { normalizeFlightProhibitedAreasWithDiagnostics } from "@/lib/dips/flightProhibitedAreaSchema";
import { DipsApiError } from "@/lib/dips/errors";
import { logger } from "@/lib/logger";

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

/** ガイドライン 2.3.7 レスポンスボディサンプル (正常時) に準拠した1件分 */
const validAreaEntry = {
  flightProhibitedAreaId: "20221105_FISSikou0015",
  name: "東京国際空港 空港の区域",
  range: {
    type: "Polygon",
    coordinates: [
      [139.779031, 35.569748],
      [139.782776, 35.574085],
    ],
    center: [],
    radius: 0,
  },
  detail: "小型無人機等飛行禁止法に基づく飛行禁止空域",
  url: "https://www.mlit.go.jp/koku/koku_tk2_000023.html",
  flightProhibitedAreaTypeId: 5,
  startTime: "2022-10-01T09:00:00",
  finishTime: "9999-12-31T23:59:00",
};

describe("normalizeFlightProhibitedAreasWithDiagnostics", () => {
  it("test_normalizes_valid_entry_into_flight_prohibited_area_info", () => {
    const result = normalizeFlightProhibitedAreasWithDiagnostics({
      flightProhibitedAreaInfo: [validAreaEntry],
      totalCount: 1,
    });

    expect(result).toEqual({
      areas: [
        {
          areaId: "20221105_FISSikou0015",
          name: "東京国際空港 空港の区域",
          detail: "小型無人機等飛行禁止法に基づく飛行禁止空域",
          url: "https://www.mlit.go.jp/koku/koku_tk2_000023.html",
          areaTypeId: 5,
          startTime: "2022-10-01T09:00:00",
          finishTime: "9999-12-31T23:59:00",
          range: validAreaEntry.range,
        },
      ],
      excludedCount: 0,
    });
  });

  it("test_empty_array_is_a_valid_zero_result_response", () => {
    const result = normalizeFlightProhibitedAreasWithDiagnostics({
      flightProhibitedAreaInfo: [],
      totalCount: 0,
    });

    expect(result).toEqual({ areas: [], excludedCount: 0 });
  });

  it("test_explicit_null_is_treated_as_zero_result", () => {
    const result = normalizeFlightProhibitedAreasWithDiagnostics({
      flightProhibitedAreaInfo: null,
    });

    expect(result).toEqual({ areas: [], excludedCount: 0 });
  });

  it("test_missing_key_throws_dips_api_error", () => {
    expect(() => normalizeFlightProhibitedAreasWithDiagnostics({ totalCount: 0 })).toThrow(
      DipsApiError
    );
  });

  it("test_non_array_non_null_value_throws_dips_api_error", () => {
    expect(() =>
      normalizeFlightProhibitedAreasWithDiagnostics({ flightProhibitedAreaInfo: "invalid" })
    ).toThrow(DipsApiError);
  });

  it("test_top_level_array_response_throws_dips_api_error", () => {
    expect(() => normalizeFlightProhibitedAreasWithDiagnostics([validAreaEntry])).toThrow(
      DipsApiError
    );
  });

  it("test_drops_only_the_invalid_entry_and_keeps_valid_ones", () => {
    const invalidEntry = { ...validAreaEntry, flightProhibitedAreaTypeId: "not-a-number" };

    const result = normalizeFlightProhibitedAreasWithDiagnostics({
      flightProhibitedAreaInfo: [validAreaEntry, invalidEntry],
    });

    expect(result.areas).toHaveLength(1);
    expect(result.excludedCount).toBe(1);
  });

  it("test_all_entries_invalid_throws_dips_api_error_instead_of_returning_empty_array", () => {
    const invalidEntry = { ...validAreaEntry, flightProhibitedAreaTypeId: "not-a-number" };

    expect(() =>
      normalizeFlightProhibitedAreasWithDiagnostics({ flightProhibitedAreaInfo: [invalidEntry] })
    ).toThrow(DipsApiError);
  });

  it("test_circle_geometry_defaults_missing_coordinates_to_empty_array", () => {
    const circleEntry = {
      ...validAreaEntry,
      range: { type: "Circle", center: [139.7686, 35.6803], radius: 1000 },
    };

    const result = normalizeFlightProhibitedAreasWithDiagnostics({
      flightProhibitedAreaInfo: [circleEntry],
    });

    expect(result.areas[0].range).toEqual({
      type: "Circle",
      center: [139.7686, 35.6803],
      radius: 1000,
      coordinates: [],
    });
  });

  it("test_logs_dropped_entry_indices_and_issue_paths_without_the_invalid_value_itself", () => {
    const invalidEntry = { ...validAreaEntry, flightProhibitedAreaTypeId: "not-a-number" };

    normalizeFlightProhibitedAreasWithDiagnostics({
      flightProhibitedAreaInfo: [validAreaEntry, invalidEntry],
    });

    expect(logger.error).toHaveBeenCalledTimes(1);
    const [, , context] = vi.mocked(logger.error).mock.calls[0];
    const serialized = JSON.stringify(context);
    expect(serialized).not.toContain("not-a-number");
    expect(serialized).toContain("flightProhibitedAreaTypeId");
  });
});
