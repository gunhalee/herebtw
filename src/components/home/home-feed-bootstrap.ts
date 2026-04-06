import type { Dispatch, SetStateAction } from "react";
import {
  ensureRegisteredBrowserDevice,
  getOrCreateBrowserAnonymousDeviceId,
} from "../../lib/device/browser-device";
import type { AdministrativeLocationSnapshot } from "../../lib/geo/browser-administrative-location";
import { getCurrentBrowserCoordinates } from "../../lib/geo/browser-location";
import { readLatestCachedNearbyPostList } from "../../lib/posts/browser-nearby-post-cache";
import type { AppShellState } from "../../types/device";
import type { PostListState, PostLocation } from "../../types/post";
import { fetchActiveHomeFeedPage } from "./home-feed-api";
import {
  buildPostListErrorState,
  buildReadyPostListState,
  type PendingFeedSnapshot,
} from "./home-feed-state";

type SetAdministrativeLocationSelection = (
  location: AdministrativeLocationSnapshot | null,
  options: {
    permissionMode: AppShellState["permissionMode"];
    readOnlyMode: boolean;
  },
) => void;

type BootstrapHomeFeedParams = {
  dataSourceMode: "supabase" | "mock";
  hasInitialGlobalFeed: boolean;
  initialPostListState: PostListState;
  isCancelled: () => boolean;
  setAppShellState: Dispatch<SetStateAction<AppShellState>>;
  setFeedLocation: Dispatch<SetStateAction<PostLocation | null>>;
  setFeedSortMode: Dispatch<SetStateAction<"nearby" | "global">>;
  setPostListState: Dispatch<SetStateAction<PostListState>>;
  setPendingFeedSnapshot: Dispatch<SetStateAction<PendingFeedSnapshot | null>>;
  applyCachedNearbyPostListState: (
    input: Pick<PostListState, "items" | "nextCursor">,
  ) => void;
  hydrateHomeLocationFromCoordinates: (location: PostLocation) => void;
  setAdministrativeLocationSelection: SetAdministrativeLocationSelection;
  getPermissionMode: (error: unknown) => AppShellState["permissionMode"];
};

export async function bootstrapHomeFeed({
  dataSourceMode,
  hasInitialGlobalFeed,
  initialPostListState,
  isCancelled,
  setAppShellState,
  setFeedLocation,
  setFeedSortMode,
  setPostListState,
  setPendingFeedSnapshot,
  applyCachedNearbyPostListState,
  hydrateHomeLocationFromCoordinates,
  setAdministrativeLocationSelection,
  getPermissionMode,
}: BootstrapHomeFeedParams) {
  const anonymousDeviceId = getOrCreateBrowserAnonymousDeviceId();

  if (!anonymousDeviceId) {
    throw new Error("브라우저에서 디바이스를 준비하지 못했습니다.");
  }

  if (isCancelled()) {
    return;
  }

  setAppShellState((current) => ({
    ...current,
    anonymousDeviceId,
    deviceReady: true,
  }));

  void ensureRegisteredBrowserDevice().catch(() => undefined);

  const latestCachedNearbyPostList =
    dataSourceMode === "supabase" ? readLatestCachedNearbyPostList() : null;

  if (latestCachedNearbyPostList) {
    applyCachedNearbyPostListState({
      ...latestCachedNearbyPostList,
      nextCursor: null,
    });
  }

  let resolvedCoordinates: PostLocation | undefined;

  try {
    resolvedCoordinates = await getCurrentBrowserCoordinates();

    if (isCancelled()) {
      return;
    }

    hydrateHomeLocationFromCoordinates(resolvedCoordinates);
  } catch (error) {
    if (!isCancelled()) {
      const permissionMode = getPermissionMode(error);

      setFeedLocation(null);
      setAdministrativeLocationSelection(null, {
        permissionMode,
        readOnlyMode: permissionMode === "denied",
      });

      if (latestCachedNearbyPostList && hasInitialGlobalFeed) {
        setFeedSortMode("global");
        setPostListState(initialPostListState);
      }
    }
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
      error instanceof Error ? error.message : "피드를 불러오지 못했습니다.",
    ),
  );
}
