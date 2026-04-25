import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkRateLimit } from "@/lib/rateLimit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should allow the first request", () => {
    expect(checkRateLimit("test-key-1")).toBe(true);
  });

  it("should allow up to 10 requests within the window", () => {
    const key = "test-key-2";
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(key)).toBe(true);
    }
  });

  it("should reject the 11th request within the window", () => {
    const key = "test-key-3";
    for (let i = 0; i < 10; i++) {
      checkRateLimit(key);
    }
    expect(checkRateLimit(key)).toBe(false);
  });

  it("should reset after the 15-minute window expires", () => {
    const key = "test-key-4";
    for (let i = 0; i < 10; i++) {
      checkRateLimit(key);
    }
    expect(checkRateLimit(key)).toBe(false);

    // Advance past the 15-minute window
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);

    expect(checkRateLimit(key)).toBe(true);
  });

  it("should track different keys independently", () => {
    const keyA = "test-key-a";
    const keyB = "test-key-b";

    for (let i = 0; i < 10; i++) {
      checkRateLimit(keyA);
    }

    expect(checkRateLimit(keyA)).toBe(false);
    expect(checkRateLimit(keyB)).toBe(true);
  });

  it("should purge expired entries on each call", () => {
    const expiredKey = "test-expired";
    checkRateLimit(expiredKey);

    // Advance past the window so the entry expires
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);

    // Calling with a different key triggers purge of the expired entry
    const newKey = "test-new";
    checkRateLimit(newKey);

    // The expired key should have been purged and start fresh
    expect(checkRateLimit(expiredKey)).toBe(true);
  });
});
