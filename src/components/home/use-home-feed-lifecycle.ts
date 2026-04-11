"use client";

import {
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { applyBootstrapError, bootstrapHomeFeed } from "./home-feed-bootstrap";
import { syncHomePostEngagement, syncNearbyHomeFeed } from "./home-feed-sync";
import { type PendingFeedSnapshot } from "./home-feed-state";
import { useVisiblePolling } from "../../lib/hooks/use-visible-polling";
import type { AppShellState } from "../../types/device";
import type { PostListState, PostLocation } from "../../types/post";

type UseHomeFeedLifecycleParams = {
  dataSourceMode: "supabase" | "mock";
  feedLocation: PostLocation | null;
  feedSortMode: "nearby" | "global";
  hasInitialGlobalFeed: boolean;
  initialPostListState: PostListState;
  appShellStateRef: MutableRefObject<AppShellState>;
  feedLocationRef: MutableRefObject<PostLocation | null>;
  postListStateRef: MutableRefObject<PostListState>;
  agreePendingPostIdsRef: MutableRefObject<string[]>;
  syncInFlightRef: MutableRefObject<boolean>;
  engagementSyncInFlightRef: MutableRefObject<boolean>;
  applyCachedNearbyPostListState: (
    input: Pick<PostListState, "items" | "nextCursor">,
  ) => void;
  setAppShellState: Dispatch<SetStateAction<AppShellState>>;
  setFeedSortMode: Dispatch<SetStateAction<"nearby" | "global">>;
  setPostListState: Dispatch<SetStateAction<PostListState>>;
  setPendingFeedSnapshot: Dispatch<SetStateAction<PendingFeedSnapshot | null>>;
};

export function useHomeFeedLifecycle({
  dataSourceMode,
  feedLocation,
  feedSortMode,
  hasInitialGlobalFeed,
  initialPostListState,
  appShellStateRef,
  feedLocationRef,
  postListStateRef,
  agreePendingPostIdsRef,
  syncInFlightRef,
  engagementSyncInFlightRef,
  applyCachedNearbyPostListState,
  setAppShellState,
  setFeedSortMode,
  setPostListState,
  setPendingFeedSnapshot,
}: UseHomeFeedLifecycleParams) {
  const bootstrapCompletedRef = useRef(false);
  const initialPostListStateRef = useRef(initialPostListState);
  const hasInitialGlobalFeedRef = useRef(hasInitialGlobalFeed);

  useEffect(() => {
    if (bootstrapCompletedRef.current) {
      return;
    }

    let cancelled = false;

    void bootstrapHomeFeed({
      dataSourceMode,
      hasInitialGlobalFeed: hasInitialGlobalFeedRef.current,
      initialPostListState: initialPostListStateRef.current,
      isCancelled: () => cancelled,
      setAppShellState,
      setFeedSortMode,
      setPostListState,
      setPendingFeedSnapshot,
      applyCachedNearbyPostListState,
    }).then(() => {
      if (!cancelled) {
        bootstrapCompletedRef.current = true;
      }
    }).catch((error) => {
      if (!cancelled) {
        applyBootstrapError(setPostListState, error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [dataSourceMode]);

  useEffect(() => {
    if (feedSortMode !== "nearby") {
      setPendingFeedSnapshot(null);
    }
  }, [feedSortMode, setPendingFeedSnapshot]);

  useVisiblePolling({
    enabled:
      dataSourceMode === "supabase" &&
      feedSortMode === "nearby" &&
      feedLocation !== null,
    intervalMs: 20000,
    label: "nearby_feed_sync",
    maxIntervalMs: 60000,
    onTick: (isCancelled) =>
      syncNearbyHomeFeed({
        isCancelled,
        syncInFlightRef,
        feedLocationRef,
        appShellStateRef,
        postListStateRef,
        setPostListState,
        setPendingFeedSnapshot,
      }),
    runImmediately: false,
  });

  useVisiblePolling({
    enabled: dataSourceMode === "supabase",
    intervalMs: 10000,
    label: "post_engagement_sync",
    maxIntervalMs: 30000,
    onTick: (isCancelled) =>
      syncHomePostEngagement({
        isCancelled,
        engagementSyncInFlightRef,
        appShellStateRef,
        postListStateRef,
        agreePendingPostIdsRef,
        setPostListState,
      }),
    runImmediately: false,
  });
}
