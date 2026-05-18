"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_PLAYBACK_RATE } from "@/lib/constants";
import { useViewingLog } from "@/hooks/useViewingLog";
import { useVisibilityDetection } from "@/hooks/useVisibilityDetection";

interface Props {
  videoId: string;
  src: string;
  duration: number;
  initialMaxWatchedSeconds: number;
}

const PLAYBACK_RATES: readonly number[] = [0.75, 1, 1.25, 1.5].filter(
  (r) => r <= MAX_PLAYBACK_RATE
);

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VideoPlayer({ videoId, src, duration, initialMaxWatchedSeconds }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const maxWatchedRef = useRef(initialMaxWatchedSeconds);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSeconds, setCurrentSeconds] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  useViewingLog({ videoId, isPlaying, currentSeconds });

  useVisibilityDetection({
    onHidden: () => {
      videoRef.current?.pause();
      // 視聴ログ送信判定との整合性のため再生状態を同期する
      setIsPlaying(false);
    },
  });

  useEffect(() => {
    const video = videoRef.current;
    if (video !== null) video.playbackRate = playbackRate;
  }, [playbackRate]);

  function handlePlay() {
    void videoRef.current?.play();
    setIsPlaying(true);
  }

  function handlePause() {
    videoRef.current?.pause();
    setIsPlaying(false);
  }

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (video === null) return;
    const t = video.currentTime;
    setCurrentSeconds(t);
    if (t > maxWatchedRef.current) {
      maxWatchedRef.current = t;
    }
  }

  function handleSeeking() {
    const video = videoRef.current;
    if (video === null) return;
    // 過去最大視聴秒数 + 1 を超えたシークは制限（巻き戻す）
    if (video.currentTime > maxWatchedRef.current + 1) {
      video.currentTime = maxWatchedRef.current;
    }
  }

  return (
    <div className="w-full">
      <video
        ref={videoRef}
        src={src}
        className="w-full max-h-[70vh] bg-black"
        onTimeUpdate={handleTimeUpdate}
        onSeeking={handleSeeking}
        onEnded={() => setIsPlaying(false)}
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {isPlaying ? (
          <button
            type="button"
            onClick={handlePause}
            className="rounded bg-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-800"
          >
            停止
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePlay}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            再生
          </button>
        )}

        <span className="text-sm text-gray-600">
          {formatTime(currentSeconds)} / {formatTime(duration)}
        </span>

        <label className="ml-auto flex items-center gap-2 text-sm text-gray-700">
          <span>再生速度</span>
          <select
            aria-label="再生速度"
            value={playbackRate}
            onChange={(e) => setPlaybackRate(Number(e.target.value))}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            {PLAYBACK_RATES.map((rate) => (
              <option key={rate} value={rate}>
                {rate}x
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
