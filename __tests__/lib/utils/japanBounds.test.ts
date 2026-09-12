import { describe, it, expect } from "vitest";
import {
  isWithinJapanBounds,
  JAPAN_LONGITUDE_MIN,
  JAPAN_LONGITUDE_MAX,
  JAPAN_LATITUDE_MIN,
  JAPAN_LATITUDE_MAX,
  OUT_OF_JAPAN_WARNING_MESSAGE,
} from "@/lib/utils/japanBounds";

describe("isWithinJapanBounds", () => {
  it("test_returns_true_for_tokyo_station_coordinates", () => {
    expect(isWithinJapanBounds(139.7671, 35.6812)).toBe(true);
  });

  // 2026-09-07 の本番疎通確認で実際に入力された事故値の回帰テスト。
  // 南太平洋の赤道上を指しており、意図した場所とはまったく異なる
  it("test_returns_false_for_the_incident_coordinates_one_one", () => {
    expect(isWithinJapanBounds(1, 1)).toBe(false);
  });

  it("test_returns_true_for_yonaguni_the_western_edge", () => {
    expect(isWithinJapanBounds(122.93, 24.45)).toBe(true);
  });

  it("test_returns_true_for_minamitorishima_the_eastern_edge", () => {
    expect(isWithinJapanBounds(153.99, 24.29)).toBe(true);
  });

  it("test_returns_true_for_okinotorishima_the_southern_edge", () => {
    expect(isWithinJapanBounds(136.07, 20.42)).toBe(true);
  });

  it("test_returns_true_for_etorofu_the_northern_edge", () => {
    expect(isWithinJapanBounds(148.75, 45.55)).toBe(true);
  });

  it("test_returns_true_at_the_longitude_min_boundary", () => {
    expect(isWithinJapanBounds(JAPAN_LONGITUDE_MIN, 35)).toBe(true);
  });

  it("test_returns_false_just_outside_the_longitude_min_boundary", () => {
    expect(isWithinJapanBounds(JAPAN_LONGITUDE_MIN - 0.1, 35)).toBe(false);
  });

  it("test_returns_true_at_the_longitude_max_boundary", () => {
    expect(isWithinJapanBounds(JAPAN_LONGITUDE_MAX, 35)).toBe(true);
  });

  it("test_returns_false_just_outside_the_longitude_max_boundary", () => {
    expect(isWithinJapanBounds(JAPAN_LONGITUDE_MAX + 0.1, 35)).toBe(false);
  });

  it("test_returns_true_at_the_latitude_min_boundary", () => {
    expect(isWithinJapanBounds(139, JAPAN_LATITUDE_MIN)).toBe(true);
  });

  it("test_returns_false_just_outside_the_latitude_min_boundary", () => {
    expect(isWithinJapanBounds(139, JAPAN_LATITUDE_MIN - 0.1)).toBe(false);
  });

  it("test_returns_true_at_the_latitude_max_boundary", () => {
    expect(isWithinJapanBounds(139, JAPAN_LATITUDE_MAX)).toBe(true);
  });

  it("test_returns_false_just_outside_the_latitude_max_boundary", () => {
    expect(isWithinJapanBounds(139, JAPAN_LATITUDE_MAX + 0.1)).toBe(false);
  });

  it("test_returns_false_for_swapped_longitude_and_latitude", () => {
    // 経度と緯度を取り違えた入力 (35.6812, 139.7671) は日本国外を指す
    expect(isWithinJapanBounds(35.6812, 139.7671)).toBe(false);
  });
});

describe("OUT_OF_JAPAN_WARNING_MESSAGE", () => {
  it("test_mentions_the_longitude_and_latitude_mixup", () => {
    expect(OUT_OF_JAPAN_WARNING_MESSAGE).toContain("経度");
    expect(OUT_OF_JAPAN_WARNING_MESSAGE).toContain("緯度");
  });
});
