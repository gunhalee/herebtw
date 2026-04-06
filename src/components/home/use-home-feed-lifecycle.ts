"use client";

import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { applyBootstrapError, bootstrapHomeFeed } from "./home-feed-bootstrap";
import { syncHomePostEngagement, syncNearbyHomeFeed } from "./home-feed-sync";
import { type PendingFeedSnapshot } from "./home-feed-state";
import { useVisiblePolling } from "../../lib/hooks/use-visible-polling";
import type { AdministrativeLocationSnapshot } from "../../lib/geo/browser-administrative-location";
import type { AppShellState } from "../../types/device";
import type { PostListState, PostLocation } from "../../types/post";

type SetAdministrativeLocationSelection = (
  location: AdministrativeLocationSnapshot | null,
  options: {
    permissionMode: AppShellState["permissionMode"];
    readOnlyMode: boolean;
  },
) => void;

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
  getPermissionMode: (error: unknown) => AppShellState["permissionMode"];
  applyCachedNearbyPostListState: (
    input: Pick<PostListState, "items" | "nextCursor">,
  ) => void;
  hydrateHomeLocationFromCoordinates: (location: PostLocation) => void;
  setAdministrativeLocationSelection: SetAdministrativeLocationSelection;
  setAppShellState: Dispatch<SetStateAction<AppShellState>>;
  setFeedLocation: Dispatch<SetStateAction<PostLocation | null>>;
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
  getPermissionMode,
  applyCachedNearbyPostListState,
  hydrateHomeLocationFromCoordinates,
  setAdministrativeLocationSelection,
  setAppShellState,
  setFeedLocation,
  setFeedSortMode,
  setPostListState,
  setPendingFeedSnapshot,
}: UseHomeFeedLifecycleParams) {
  useEffect(() => {
    let cancelled = false;

    void bootstrapHomeFeed({
      dataSourceMode,
      hasInitialGlobalFeed,
      initialPostListState,
      isCancelled: () => cancelled,
      setAppShellState,
      setFeedLocation,
      setFeedSortMode,
      setPostListState,
      setPendingFeedSnapshot,
      applyCachedNearbyPostListState,
      hydrateHomeLocationFromCoordinates,
      setAdministrativeLocationSelection,
      getPermissionMode,
    }).catch((error) => {
      if (!cancelled) {
        applyBootstrapError(setPostListState, error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [dataSourceMode, hasInitialGlobalFeed, initialPostListState]);

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
