import { describe, test, expect, vi, afterEach } from "vitest";
import { toJstIso, toJstDatetimeLocal, getJstNowAsDatetimeLocal } from "@/lib/utils/jstDatetime";

describe("toJstIso", () => {
  test("interprets a datetime-local value as JST and returns a UTC ISO string", () => {
    expect(toJstIso("2026-07-10T10:00")).toBe("2026-07-10T01:00:00.000Z");
  });

  test("handles midnight correctly across the date boundary", () => {
    expect(toJstIso("2026-07-10T00:30")).toBe("2026-07-09T15:30:00.000Z");
  });
});

describe("toJstDatetimeLocal", () => {
  test("converts a UTC ISO string to a JST datetime-local value", () => {
    expect(toJstDatetimeLocal("2026-07-10T01:00:00.000Z")).toBe("2026-07-10T10:00");
  });

  test("rolls over to the next JST day when UTC time is late in the day", () => {
    expect(toJstDatetimeLocal("2026-07-09T15:30:00.000Z")).toBe("2026-07-10T00:30");
  });

  test("round-trips with toJstIso for a datetime-local value", () => {
    const original = "2026-07-10T10:00";
    expect(toJstDatetimeLocal(toJstIso(original))).toBe(original);
  });
});

describe("getJstNowAsDatetimeLocal", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns the current time formatted as JST datetime-local (YYYY-MM-DDTHH:mm)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T01:00:00.000Z"));

    expect(getJstNowAsDatetimeLocal()).toBe("2026-07-10T10:00");
  });

  test("rolls over to the next JST day when UTC time is late in the day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T15:30:00.000Z"));

    expect(getJstNowAsDatetimeLocal()).toBe("2026-07-10T00:30");
  });
});
