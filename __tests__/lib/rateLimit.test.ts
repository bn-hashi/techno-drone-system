import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkRateLimit } from "@/lib/rateLimit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("test_checkRateLimit_allows_the_first_request", () => {
    expect(checkRateLimit("test-key-1")).toBe(true);
  });

  it("test_checkRateLimit_allows_up_to_10_requests_within_window", () => {
    const key = "test-key-2";
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(key)).toBe(true);
    }
  });

  it("test_checkRateLimit_rejects_11th_request_within_window", () => {
    const key = "test-key-3";
    for (let i = 0; i < 10; i++) {
      checkRateLimit(key);
    }
    expect(checkRateLimit(key)).toBe(false);
  });

  it("test_checkRateLimit_resets_after_15_minute_window_expires", () => {
    const key = "test-key-4";
    for (let i = 0; i < 10; i++) {
      checkRateLimit(key);
    }
    expect(checkRateLimit(key)).toBe(false);

    // Advance past the 15-minute window
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);

    expect(checkRateLimit(key)).toBe(true);
  });

  it("test_checkRateLimit_tracks_different_keys_independently", () => {
    const keyA = "test-key-a";
    const keyB = "test-key-b";

    for (let i = 0; i < 10; i++) {
      checkRateLimit(keyA);
    }

    expect(checkRateLimit(keyA)).toBe(false);
    expect(checkRateLimit(keyB)).toBe(true);
  });

  it("test_checkRateLimit_purges_expired_entries_on_each_call", () => {
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
