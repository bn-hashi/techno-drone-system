import { describe, it, expect } from "vitest";
import { formatDipsStartTime, buildCircleFlyRoute } from "@/lib/dips/notificationMapper";

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

    expect(result.features[0].geometry.type).toBe("Circle");
    expect(result.features[0].geometry.center).toEqual([139.8, 35.6]);
    expect(result.features[0].properties.radius).toBe(10);
  });
});
