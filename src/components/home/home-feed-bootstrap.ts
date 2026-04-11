import type { Dispatch, SetStateAction } from "react";
import {
  ensureRegisteredBrowserDevice,
  getOrCreateBrowserAnonymousDeviceId,
} from "../../lib/device/browser-device";
import {
  ensureBrowserLocationCoordinates,
  primeBrowserLocationSession,
} from "../../lib/geo/browser-location-session";
import { readLatestCachedNearbyPostList } from "../../lib/posts/browser-nearby-post-cache";
import type { AppShellState } from "../../types/device";
import type { PostListState } from "../../types/post";
import { fetchActiveHomeFeedPage } from "./home-feed-api";
import {
  buildPostListErrorState,
  buildReadyPostListState,
  type PendingFeedSnapshot,
} from "./home-feed-state";

type BootstrapHomeFeedParams = {
  dataSourceMode: "supabase" | "mock";
  hasInitialGlobalFeed: boolean;
  initialPostListState: PostListState;
  isCancelled: () => boolean;
  setAppShellState: Dispatch<SetStateAction<AppShellState>>;
  setFeedSortMode: Dispatch<SetStateAction<"nearby" | "global">>;
  setPostListState: Dispatch<SetStateAction<PostListState>>;
  setPendingFeedSnapshot: Dispatch<SetStateAction<PendingFeedSnapshot | null>>;
  applyCachedNearbyPostListState: (
    input: Pick<PostListState, "items" | "nextCursor">,
  ) => void;
};

export async function bootstrapHomeFeed({
  dataSourceMode,
  hasInitialGlobalFeed,
  initialPostListState,
  isCancelled,
  setAppShellState,
  setFeedSortMode,
  setPostListState,
  setPendingFeedSnapshot,
  applyCachedNearbyPostListState,
}: BootstrapHomeFeedParams) {
  const anonymousDeviceId = getOrCreateBrowserAnonymousDeviceId();

  if (!anonymousDeviceId) {
    throw new Error("브라우저에서 디바이스를 준비하지 못했습니다.");
  }

  if (isCancelled()) {
    return;
  }

  setAppShellState((current) => {
    if (current.anonymousDeviceId === anonymousDeviceId && current.deviceReady) {
      return current;
    }

    return {
      ...current,
      anonymousDeviceId,
      deviceReady: true,
    };
  });

  void ensureRegisteredBrowserDevice().catch(() => undefined);

  const latestCachedNearbyPostList =
    dataSourceMode === "supabase" ? readLatestCachedNearbyPostList() : null;

  if (latestCachedNearbyPostList) {
    primeBrowserLocationSession(latestCachedNearbyPostList.location);
    applyCachedNearbyPostListState({
      ...latestCachedNearbyPostList,
      nextCursor: null,
    });
  }

  const locationSession = await ensureBrowserLocationCoordinates();

  if (isCancelled()) {
    return;
  }

  const resolvedCoordinates =
    locationSession.permissionMode === "denied"
      ? null
      : locationSession.coordinates;

  if (!resolvedCoordinates && latestCachedNearbyPostList && hasInitialGlobalFeed) {
    setFeedSortMode("global");
    setPostListState(initialPostListState);
  }

  if (dataSourceMode !== "supabase") {
    return;
  }

  const shouldFetchGlobalFeed = !resolvedCoordinates && !hasInitialGlobalFeed;
  const result =
    resolvedCoordinates || shouldFetchGlobalFeed
      ? await fetchActiveHomeFeedPage(resolvedCoordinates ?? null, {
          anonymousDeviceId,
        })
      : null;

  if (isCancelled()) {
    return;
  }

  setFeedSortMode(resolvedCoordinates ? "nearby" : "global");

  if (!result) {
    setPostListState((current) =>
      buildReadyPostListState(current, {
        items: current.items,
        nextCursor: current.nextCursor,
        sort: current.sort,
      }),
    );
    return;
  }

  setPendingFeedSnapshot(null);
  setPostListState((current) =>
    buildReadyPostListState(current, {
      items: result.data.items,
      nextCursor: result.data.nextCursor,
      sort: result.postSort,
    }),
  );
}

export function applyBootstrapError(
  setPostListState: Dispatch<SetStateAction<PostListState>>,
  error: unknown,
) {
  setPostListState((current) =>
    buildPostListErrorState(
      current,
      error instanceof Error
        ? error.message
        : "피드를 불러오지 못했습니다.",
    ),
  );
}
