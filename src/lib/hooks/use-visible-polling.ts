"use client";

import { useEffect } from "react";
import { useLatestRef } from "./use-latest-ref";

type VisibilityAwarePollingCallback = (
  isCancelled: () => boolean,
) => void | Promise<void>;

type UseVisiblePollingParams = {
  enabled: boolean;
  intervalMs: number;
  onTick: VisibilityAwarePollingCallback;
};

export function useVisiblePolling({
  enabled,
  intervalMs,
  onTick,
}: UseVisiblePollingParams) {
  const onTickRef = useLatestRef(onTick);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    let cancelled = false;

    const run = () => {
      void onTickRef.current(() => cancelled);
    };

    run();

    const intervalId = window.setInterval(() => {
      run();
    }, intervalMs);
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        run();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, intervalMs, onTickRef]);
}
