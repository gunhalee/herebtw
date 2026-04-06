"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { hydrateHomeFeedLocationFromCoordinates } from "./home-location";
import {
  buildReadyPostListState,
  type PendingFeedSnapshot,
} from "./home-feed-state";
import { ensureRegisteredBrowserDevice } from "../../lib/device/browser-device";
import type {
  AdministrativeLocationSnapshot,
} from "../../lib/geo/browser-administrative-location";
import { useDocumentScrollLock } from "../../lib/hooks/use-document-scroll-lock";
import { useLatestRef } from "../../lib/hooks/use-latest-ref";
import { useMountedRef } from "../../lib/hooks/use-mounted-ref";
import type { AppShellState } from "../../types/device";
import type { PostListState, PostLocation } from "../../types/post";

const COMPOSE_PLACEHOLDER_DONG_NAME = "우리 동네";
const MOCK_RUNTIME_NOTICE =
  "Supabase 환경변수가 아직 설정되지 않아 샘플 데이터를 보여주고 있어요.";

type UseHomeShellStateParams = {
  dataSourceMode: "supabase" | "mock";
  initialAppShellState: AppShellState;
  initialPostListState: PostListState;
  setPostListState: Dispatch<SetStateAction<PostListState>>;
  setPendingFeedSnapshot: Dispatch<SetStateAction<PendingFeedSnapshot | null>>;
};

function getHomePermissionMode(error: unknown): AppShellState["permissionMode"] {
  return error instanceof Error &&
    error.message === "GEOLOCATION_PERMISSION_DENIED"
    ? "denied"
    : "unknown";
}

export function useHomeShellState({
  dataSourceMode,
  initialAppShellState,
  initialPostListState,
  setPostListState,
  setPendingFeedSnapshot,
}: UseHomeShellStateParams) {
  const [appShellState, setAppShellState] = useState(initialAppShellState);
  const [feedLocation, setFeedLocation] = useState<PostLocation | null>(null);
  const [feedSortMode, setFeedSortMode] = useState<"nearby" | "global">(
    initialPostListState.sort === "latest" || initialAppShellState.readOnlyMode
      ? "global"
      : "nearby",
  );
  const isMountedRef = useMountedRef();
  const appShellStateRef = useLatestRef(appShellState);
  const feedLocationRef = useLatestRef(feedLocation);
  const hasInitialGlobalFeed =
    initialPostListState.sort === "latest" && !initialPostListState.loading;

  useDocumentScrollLock();

  function setAdministrativeLocationSelection(
    location: AdministrativeLocationSnapshot | null,
    options: {
      permissionMode: AppShellState["permissionMode"];
      readOnlyMode: boolean;
    },
  ) {
    setAppShellState((current) => ({
      ...current,
      permissionMode: options.permissionMode,
      readOnlyMode: options.readOnlyMode,
      selectedDongCode: location?.administrativeDongCode ?? null,
      selectedDongName: location?.administrativeDongName ?? null,
    }));
  }

  function applyCachedNearbyPostListState(
    input: Pick<PostListState, "items" | "nextCursor">,
  ) {
    setPendingFeedSnapshot(null);
    setFeedSortMode("nearby");
    setPostListState((current) =>
      buildReadyPostListState(current, {
        items: input.items,
        nextCursor: input.nextCursor,
        sort: "distance",
      }),
    );
  }

  function hydrateHomeLocationFromCoordinates(location: PostLocation) {
    hydrateHomeFeedLocationFromCoordinates({
      location,
      isMounted: () => isMountedRef.current,
      setFeedLocation,
      setAdministrativeLocationSelection,
      applyCachedNearbyPostListState,
    });
  }

  async function ensureDeviceReady() {
    const existingAnonymousDeviceId = appShellStateRef.current.anonymousDeviceId;

    if (existingAnonymousDeviceId) {
      return existingAnonymousDeviceId;
    }

    const anonymousDeviceId = await ensureRegisteredBrowserDevice();

    setAppShellState((current) => ({
      ...current,
      anonymousDeviceId,
      deviceReady: true,
    }));

    return anonymousDeviceId;
  }

  return {
    appShellStateRef,
    applyCachedNearbyPostListState,
    currentDongName:
      appShellState.selectedDongName ?? COMPOSE_PLACEHOLDER_DONG_NAME,
    ensureDeviceReady,
    feedLocation,
    feedLocationRef,
    feedSortMode,
    getPermissionMode: getHomePermissionMode,
    hasInitialGlobalFeed,
    hydrateHomeLocationFromCoordinates,
    isMountedRef,
    obscureGlobalFallbackList:
      appShellState.readOnlyMode && feedSortMode === "global",
    runtimeNotice: dataSourceMode === "mock" ? MOCK_RUNTIME_NOTICE : null,
    setAdministrativeLocationSelection,
    setAppShellState,
    setFeedLocation,
    setFeedSortMode,
  };
}
