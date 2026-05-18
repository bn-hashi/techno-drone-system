import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useVisibilityDetection } from "@/hooks/useVisibilityDetection";

const mockPostFraudFlag = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/studentVideos", () => ({
  postFraudFlag: mockPostFraudFlag,
}));

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useVisibilityDetection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockPostFraudFlag.mockReset();
    mockPostFraudFlag.mockResolvedValue(undefined);
    setVisibility("visible");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("test_useVisibilityDetection_calls_onHidden_when_tab_becomes_hidden", () => {
    const onHidden = vi.fn();

    renderHook(() => useVisibilityDetection({ onHidden }));

    act(() => {
      setVisibility("hidden");
    });

    expect(onHidden).toHaveBeenCalledTimes(1);
  });

  it("test_useVisibilityDetection_does_not_flag_when_hidden_under_60_seconds", async () => {
    renderHook(() => useVisibilityDetection({ onHidden: vi.fn() }));

    await act(async () => {
      setVisibility("hidden");
      vi.advanceTimersByTime(30_000);
      setVisibility("visible");
      await Promise.resolve();
    });

    expect(mockPostFraudFlag).not.toHaveBeenCalled();
  });

  it("test_useVisibilityDetection_flags_TAB_LEAVE_when_hidden_over_60_seconds", async () => {
    renderHook(() => useVisibilityDetection({ onHidden: vi.fn() }));

    await act(async () => {
      setVisibility("hidden");
      vi.advanceTimersByTime(65_000);
      setVisibility("visible");
      await Promise.resolve();
    });

    expect(mockPostFraudFlag).toHaveBeenCalledWith(
      expect.objectContaining({ type: "TAB_LEAVE", durationSeconds: 65 })
    );
  });
});
