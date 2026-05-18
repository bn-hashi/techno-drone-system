import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VideoPlayer } from "@/components/student/VideoPlayer";

vi.mock("@/hooks/useViewingLog", () => ({ useViewingLog: vi.fn() }));
vi.mock("@/hooks/useVisibilityDetection", () => ({ useVisibilityDetection: vi.fn() }));

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
    const { container } = render(
      <VideoPlayer {...defaultProps} initialMaxWatchedSeconds={120} />
    );
    const video = container.querySelector("video") as HTMLVideoElement;

    // currentTime setter は jsdom に存在するが seeked イベントは発火しない。
    // ハンドラの巻き戻しロジックを直接検証する。
    Object.defineProperty(video, "duration", { configurable: true, value: 3600 });
    video.currentTime = 60;
    fireEvent.seeking(video);

    expect(video.currentTime).toBe(60);
  });

  it("test_VideoPlayer_seek_beyond_max_watched_is_clamped", () => {
    const { container } = render(
      <VideoPlayer {...defaultProps} initialMaxWatchedSeconds={120} />
    );
    const video = container.querySelector("video") as HTMLVideoElement;

    Object.defineProperty(video, "duration", { configurable: true, value: 3600 });
    video.currentTime = 200;
    fireEvent.seeking(video);

    expect(video.currentTime).toBe(120);
  });
});
