import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useViewingLog } from "@/hooks/useViewingLog";

const mockPostViewingLog = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/studentVideos", () => ({
  postViewingLog: mockPostViewingLog,
}));

describe("useViewingLog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockPostViewingLog.mockReset();
    mockPostViewingLog.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("test_useViewingLog_does_not_send_when_not_playing", () => {
    renderHook(() => useViewingLog({ videoId: "video-1", isPlaying: false, currentSeconds: 0 }));

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(mockPostViewingLog).not.toHaveBeenCalled();
  });

  it("test_useViewingLog_sends_log_every_10_seconds_when_playing", async () => {
    const { rerender } = renderHook(
      ({ currentSeconds }: { currentSeconds: number }) =>
        useViewingLog({ videoId: "video-1", isPlaying: true, currentSeconds }),
      { initialProps: { currentSeconds: 0 } }
    );

    await act(async () => {
      rerender({ currentSeconds: 10 });
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });

    expect(mockPostViewingLog).toHaveBeenCalledTimes(1);
  });

  it("test_useViewingLog_payload_includes_videoId", async () => {
    const { rerender } = renderHook(
      ({ currentSeconds }: { currentSeconds: number }) =>
        useViewingLog({ videoId: "video-42", isPlaying: true, currentSeconds }),
      { initialProps: { currentSeconds: 0 } }
    );

    // rerender とその後の useEffect コミットを先に流す
    await act(async () => {
      rerender({ currentSeconds: 10 });
    });

    // 別 act でタイマーを進める（ref は既に最新値）
    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await Promise.resolve();
    });

    expect(mockPostViewingLog).toHaveBeenCalledWith(
      expect.objectContaining({ videoId: "video-42", watchedSeconds: 10 })
    );
  });
});
