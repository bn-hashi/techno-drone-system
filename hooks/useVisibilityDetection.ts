"use client";

import { useEffect, useRef } from "react";
import { postFraudFlag } from "@/lib/api/studentVideos";
import { TAB_LEAVE_THRESHOLD_SECONDS } from "@/lib/constants";
import { logger } from "@/lib/logger";

interface UseVisibilityDetectionParams {
  onHidden: () => void;
}

export function useVisibilityDetection({ onHidden }: UseVisibilityDetectionParams): void {
  const hiddenAtRef = useRef<Date | null>(null);
  const onHiddenRef = useRef(onHidden);

  useEffect(() => {
    onHiddenRef.current = onHidden;
  }, [onHidden]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = new Date();
        onHiddenRef.current();
        return;
      }

      // visible に戻った: 離脱時間を測定し、閾値超なら不正フラグ
      const hiddenAt = hiddenAtRef.current;
      if (hiddenAt === null) return;
      const elapsedSeconds = Math.floor((Date.now() - hiddenAt.getTime()) / 1000);
      hiddenAtRef.current = null;

      if (elapsedSeconds > TAB_LEAVE_THRESHOLD_SECONDS) {
        void postFraudFlag({
          type: "TAB_LEAVE",
          durationSeconds: elapsedSeconds,
        }).catch((error) => {
          logger.error("Failed to post fraud flag", error, {
            type: "TAB_LEAVE",
            durationSeconds: elapsedSeconds,
          });
        });
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);
}
