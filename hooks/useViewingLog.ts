"use client";

import { useEffect, useRef } from "react";
import { postViewingLog } from "@/lib/api/studentVideos";
import { VIEWING_LOG_BUFFER_SECONDS } from "@/lib/constants";
import { logger } from "@/lib/logger";

interface UseViewingLogParams {
  videoId: string;
  isPlaying: boolean;
  currentSeconds: number;
}

const BUFFER_MS = VIEWING_LOG_BUFFER_SECONDS * 1000;

function sendLog(videoId: string, startedAt: Date, endedAt: Date, watchedSeconds: number): void {
  void postViewingLog({
    videoId,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    watchedSeconds,
  }).catch((error) => {
    logger.error("Failed to post viewing log", error, { videoId });
  });
}

export function useViewingLog({ videoId, isPlaying, currentSeconds }: UseViewingLogParams): void {
  const sessionStartRef = useRef<Date | null>(null);
  const currentSecondsRef = useRef(currentSeconds);

  // 最新の currentSeconds をタイマーから参照できるよう ref に保持
  useEffect(() => {
    currentSecondsRef.current = currentSeconds;
  }, [currentSeconds]);

  useEffect(() => {
    if (!isPlaying) return;

    sessionStartRef.current = new Date();

    const intervalId = setInterval(() => {
      const startedAt = sessionStartRef.current;
      if (startedAt === null) return;
      const endedAt = new Date();
      sendLog(videoId, startedAt, endedAt, Math.floor(currentSecondsRef.current));
      // 次セッションの起点をリセット
      sessionStartRef.current = endedAt;
    }, BUFFER_MS);

    return () => {
      clearInterval(intervalId);
      // 停止・アンマウント・動画切替時に未送信セッションを 1 回フラッシュ
      // (バッチタイマー未発火分を取り逃さない)
      const pending = sessionStartRef.current;
      if (pending !== null) {
        sendLog(videoId, pending, new Date(), Math.floor(currentSecondsRef.current));
        sessionStartRef.current = null;
      }
    };
  }, [isPlaying, videoId]);

  // ページ離脱時の最終送信（sendBeacon）
  useEffect(() => {
    function handleUnload() {
      const startedAt = sessionStartRef.current;
      if (startedAt === null) return;
      const payload = JSON.stringify({
        videoId,
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        watchedSeconds: Math.floor(currentSecondsRef.current),
      });
      navigator.sendBeacon?.(
        "/api/student/viewing-log",
        new Blob([payload], { type: "application/json" })
      );
    }

    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [videoId]);
}
