import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { VideoPlayer } from "@/components/student/VideoPlayer";

const mockUseViewingLog = vi.hoisted(() => vi.fn());
const mockUseVisibilityDetection = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useViewingLog", () => ({ useViewingLog: mockUseViewingLog }));
vi.mock("@/hooks/useVisibilityDetection", () => ({
  useVisibilityDetection: mockUseVisibilityDetection,
}));

const defaultProps = {
  videoId: "video-1",
  src: "/videos/basic.mp4",
  duration: 3600,
  initialMaxWatchedSeconds: 0,
};

describe("VideoPlayer", () => {
  beforeEach(() => {
    // HTMLMediaElement の API は jsdom に欠けるため簡易モック
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("test_VideoPlayer_renders_video_element_with_src", () => {
    const { container } = render(<VideoPlayer {...defaultProps} />);
    const video = container.querySelector("video");
    expect(video?.getAttribute("src")).toBe("/videos/basic.mp4");
  });

  it("test_VideoPlayer_renders_play_button_initially", () => {
    render(<VideoPlayer {...defaultProps} />);
    expect(screen.getByRole("button", { name: "再生" })).toBeInTheDocument();
  });

  it("test_VideoPlayer_renders_playback_rate_selector", () => {
    render(<VideoPlayer {...defaultProps} />);
    expect(screen.getByLabelText("再生速度")).toBeInTheDocument();
  });

  it("test_VideoPlayer_rate_selector_only_offers_up_to_max_rate", () => {
    render(<VideoPlayer {...defaultProps} />);
    const select = screen.getByLabelText("再生速度") as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => Number(o.value));
    expect(Math.max(...values)).toBe(1.5);
  });

  it("test_VideoPlayer_seek_within_max_watched_is_allowed", () => {
    const { container } = render(<VideoPlayer {...defaultProps} initialMaxWatchedSeconds={120} />);
    const video = container.querySelector("video") as HTMLVideoElement;

    // currentTime setter は jsdom に存在するが seeked イベントは発火しない。
    // ハンドラの巻き戻しロジックを直接検証する。
    Object.defineProperty(video, "duration", { configurable: true, value: 3600 });
    video.currentTime = 60;
    fireEvent.seeking(video);

    expect(video.currentTime).toBe(60);
  });

  it("test_VideoPlayer_seek_beyond_max_watched_is_clamped", () => {
    const { container } = render(<VideoPlayer {...defaultProps} initialMaxWatchedSeconds={120} />);
    const video = container.querySelector("video") as HTMLVideoElement;

    Object.defineProperty(video, "duration", { configurable: true, value: 3600 });
    video.currentTime = 200;
    fireEvent.seeking(video);

    expect(video.currentTime).toBe(120);
  });

  it("test_VideoPlayer_play_event_sets_isPlaying_to_true", () => {
    mockUseViewingLog.mockClear();
    const { container } = render(<VideoPlayer {...defaultProps} />);
    const video = container.querySelector("video") as HTMLVideoElement;

    // video の onPlay イベントが発火するとステートが true になる
    act(() => {
      fireEvent.play(video);
    });

    expect(mockUseViewingLog).toHaveBeenLastCalledWith(
      expect.objectContaining({ isPlaying: true })
    );
  });

  it("test_VideoPlayer_pause_event_sets_isPlaying_to_false", () => {
    mockUseViewingLog.mockClear();
    const { container } = render(<VideoPlayer {...defaultProps} />);
    const video = container.querySelector("video") as HTMLVideoElement;

    act(() => {
      fireEvent.play(video);
    });
    act(() => {
      fireEvent.pause(video);
    });

    expect(mockUseViewingLog).toHaveBeenLastCalledWith(
      expect.objectContaining({ isPlaying: false })
    );
  });

  it("test_VideoPlayer_visibility_hidden_pauses_video", () => {
    const pauseSpy = vi.fn();
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: pauseSpy,
    });
    mockUseVisibilityDetection.mockClear();

    render(<VideoPlayer {...defaultProps} />);

    // useVisibilityDetection に渡された onHidden を発火
    const lastCall = mockUseVisibilityDetection.mock.calls.at(-1);
    const { onHidden } = lastCall![0] as { onHidden: () => void };
    act(() => {
      onHidden();
    });

    expect(pauseSpy).toHaveBeenCalled();
  });

  it("test_VideoPlayer_play_promise_rejection_does_not_throw", async () => {
    // play() が reject しても unhandled rejection にならない
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn().mockRejectedValue(new DOMException("NotAllowedError")),
    });

    render(<VideoPlayer {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "再生" }));
    // 1 microtask 進めて .catch を消化
    await Promise.resolve();
    await Promise.resolve();

    // 例外が伝播しないことを確認（テストが完走すれば OK）
    expect(screen.getByRole("button", { name: "再生" })).toBeInTheDocument();
  });
});
