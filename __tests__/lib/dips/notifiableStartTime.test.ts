// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  isNotifiableStartTime,
  NOTIFIABLE_START_TIME_MIN_OFFSET_DAYS,
} from "@/lib/dips/notifiableStartTime";

/**
 * `isNotifiableStartTime` は JST の暦日で「今日 - 2日」より前の plannedAt を拒否する
 * (2026-09-11 人の決定。req-014 課題3)。`now` は引数注入で固定し、`vi.useFakeTimers()` に
 * 頼らない (純関数として明快にするため。lib/dips/permissionApplicationSchema.ts と同じ作法)。
 */
describe("isNotifiableStartTime", () => {
  it("test_min_offset_is_two_days", () => {
    // 人の決定 (2026-09-11): DIPS の実測制限「2日以前」に合わせる
    expect(NOTIFIABLE_START_TIME_MIN_OFFSET_DAYS).toBe(2);
  });

  const now = new Date("2026-09-11T12:00:00+09:00");

  it("test_accepts_the_current_moment", () => {
    expect(isNotifiableStartTime(now, now)).toBe(true);
  });

  it("test_accepts_a_far_future_planned_time", () => {
    const plannedAt = new Date("2027-01-01T00:00:00+09:00");
    expect(isNotifiableStartTime(plannedAt, now)).toBe(true);
  });

  it("test_accepts_exactly_the_boundary_two_days_before_today_jst_midnight", () => {
    // 今日 (2026-09-11) の JST 0:00 から2日前 = 2026-09-09 の JST 0:00 ちょうど
    const boundary = new Date("2026-09-09T00:00:00+09:00");
    expect(isNotifiableStartTime(boundary, now)).toBe(true);
  });

  it("test_rejects_one_minute_before_the_boundary", () => {
    const oneMinuteBefore = new Date("2026-09-08T23:59:00+09:00");
    expect(isNotifiableStartTime(oneMinuteBefore, now)).toBe(false);
  });

  it("test_accepts_one_minute_after_the_boundary", () => {
    const oneMinuteAfter = new Date("2026-09-09T00:01:00+09:00");
    expect(isNotifiableStartTime(oneMinuteAfter, now)).toBe(true);
  });

  it("test_rejects_a_planned_time_three_days_before_today", () => {
    const threeDaysBefore = new Date("2026-09-08T12:00:00+09:00");
    expect(isNotifiableStartTime(threeDaysBefore, now)).toBe(false);
  });

  it("test_rejects_the_four_days_before_case_observed_in_production", () => {
    // 本番の疎通確認 (2026-09-11) で実際に拒否された事例の再現 (4日前 → 拒否)
    const fourDaysBefore = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
    expect(isNotifiableStartTime(fourDaysBefore, now)).toBe(false);
  });

  // ─── JST/UTC の暦日ズレ: UTC では日付が変わっているが JST ではまだ同日 ──────────

  it("test_uses_jst_calendar_day_not_utc_calendar_day_for_the_boundary", () => {
    // now = UTC 2026-09-10T16:00:00Z は JST では 2026-09-11T01:00 (既に翌日)。
    // UTC の暦日 (09-10) を基準に2日前を計算すると誤り (09-08T00:00Z) になる。
    // 正しくは JST の暦日 (09-11) を基準にした2日前 = JST 2026-09-09T00:00
    // (= UTC 2026-09-08T15:00:00Z) が境界になる
    const nowNearJstMidnight = new Date("2026-09-10T16:00:00Z");
    const boundaryInUtc = new Date("2026-09-08T15:00:00Z");
    const oneMinuteBeforeBoundary = new Date("2026-09-08T14:59:00Z");

    expect(isNotifiableStartTime(boundaryInUtc, nowNearJstMidnight)).toBe(true);
    expect(isNotifiableStartTime(oneMinuteBeforeBoundary, nowNearJstMidnight)).toBe(false);
  });
});
