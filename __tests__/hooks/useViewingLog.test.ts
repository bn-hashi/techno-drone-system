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

  it("test_useViewingLog_flushes_unsent_session_when_play_stops", async () => {
    const { rerender } = renderHook(
      ({ isPlaying, currentSeconds }: { isPlaying: boolean; currentSeconds: number }) =>
        useViewingLog({ videoId: "video-1", isPlaying, currentSeconds }),
      { initialProps: { isPlaying: true, currentSeconds: 0 } }
    );

    // 5 秒視聴後（10 秒バッファ未満）に停止すると、バッチタイマーは未発火
    // → 未送信分が破棄されないよう、停止時に 1 回フラッシュされる必要がある
    await act(async () => {
      rerender({ isPlaying: true, currentSeconds: 5 });
      vi.advanceTimersByTime(5_000);
    });

    await act(async () => {
      rerender({ isPlaying: false, currentSeconds: 5 });
      await Promise.resolve();
    });

    expect(mockPostViewingLog).toHaveBeenCalledTimes(1);
  });

  it("test_useViewingLog_catches_post_rejection_without_throwing", async () => {
    // 未処理 Promise 拒否が発生しないこと（process.on("unhandledRejection")は jsdom にないので
    // テストランナーで例外が伝播しないことで担保）
    mockPostViewingLog.mockRejectedValue(new Error("network down"));
    const { rerender } = renderHook(
      ({ currentSeconds }: { currentSeconds: number }) =>
        useViewingLog({ videoId: "video-1", isPlaying: true, currentSeconds }),
      { initialProps: { currentSeconds: 0 } }
    );

    await act(async () => {
      rerender({ currentSeconds: 10 });
    });

    await act(async () => {
      vi.advanceTimersByTime(10_000);
      // .catch が無いとここで unhandled rejection になりテストランナーが落ちる
      await Promise.resolve();
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
