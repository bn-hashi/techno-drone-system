import { describe, test, expect } from "vitest";
import { calcDurationMin } from "@/lib/utils/flightDuration";

describe("calcDurationMin", () => {
  test("returns exact minutes for a whole-minute duration", () => {
    // Arrange
    const start = new Date("2026-07-02T10:00:00+09:00");
    const end = new Date("2026-07-02T10:30:00+09:00");

    // Act
    const duration = calcDurationMin(start, end);

    // Assert
    expect(duration).toBe(30);
  });

  test("rounds partial minutes up so short flights count as one minute", () => {
    const start = new Date("2026-07-02T10:00:00+09:00");
    const end = new Date("2026-07-02T10:00:30+09:00");

    expect(calcDurationMin(start, end)).toBe(1);
  });

  test("rounds 10 minutes 1 second up to 11 minutes", () => {
    const start = new Date("2026-07-02T10:00:00+09:00");
    const end = new Date("2026-07-02T10:10:01+09:00");

    expect(calcDurationMin(start, end)).toBe(11);
  });

  test("returns 0 when end equals start", () => {
    const at = new Date("2026-07-02T10:00:00+09:00");

    expect(calcDurationMin(at, at)).toBe(0);
  });

  test("returns 0 when end is before start", () => {
    const start = new Date("2026-07-02T10:30:00+09:00");
    const end = new Date("2026-07-02T10:00:00+09:00");

    expect(calcDurationMin(start, end)).toBe(0);
  });

  test("handles a flight crossing midnight", () => {
    const start = new Date("2026-07-02T23:50:00+09:00");
    const end = new Date("2026-07-03T00:10:00+09:00");

    expect(calcDurationMin(start, end)).toBe(20);
  });
});
