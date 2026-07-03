import { describe, it, expect } from "vitest";
import {
  formatDipsStartTime,
  buildCircleFlyRoute,
  clampToDipsFlightMinutes,
} from "@/lib/dips/notificationMapper";

describe("formatDipsStartTime", () => {
  it("test_formats_utc_datetime_to_jst_yyyymmdd_hhmm", () => {
    // 2026-07-03T01:00:00Z = JST 10:00
    const result = formatDipsStartTime(new Date("2026-07-03T01:00:00Z"));

    expect(result).toBe("20260703 1000");
  });

  it("test_rolls_over_date_when_jst_crosses_midnight", () => {
    // 2026-07-03T16:00:00Z = JST 翌日 01:00
    const result = formatDipsStartTime(new Date("2026-07-03T16:00:00Z"));

    expect(result).toBe("20260704 0100");
  });

  it("test_pads_single_digit_month_and_time", () => {
    // 2026-01-05T00:05:00Z = JST 09:05
    const result = formatDipsStartTime(new Date("2026-01-05T00:05:00Z"));

    expect(result).toBe("20260105 0905");
  });
});

describe("buildCircleFlyRoute", () => {
  it("test_builds_circle_geojson_with_center_and_radius", () => {
    const result = JSON.parse(buildCircleFlyRoute(139.8, 35.6, 10));

    expect(result).toEqual({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { radius: 10 },
          geometry: { type: "Circle", center: [139.8, 35.6] },
        },
      ],
    });
  });
});

describe("clampToDipsFlightMinutes", () => {
  it("test_keeps_valid_multiple_of_five_unchanged", () => {
    expect(clampToDipsFlightMinutes(60)).toBe(60);
  });

  it("test_rounds_up_to_next_multiple_of_five", () => {
    expect(clampToDipsFlightMinutes(7)).toBe(10);
  });

  it("test_clamps_below_minimum_to_five", () => {
    expect(clampToDipsFlightMinutes(1)).toBe(5);
  });

  it("test_clamps_above_maximum_to_1440", () => {
    expect(clampToDipsFlightMinutes(1500)).toBe(1440);
  });
});
