"use client";

import {
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  buildReadyPostListState,
  type PendingFeedSnapshot,
} from "./home-feed-state";
import {
  ensureRegisteredBrowserDevice,
  readBrowserAnonymousDeviceId,
} from "../../lib/device/browser-device";
import {
  useBrowserLocationSession,
  type BrowserLocationSessionState,
} from "../../lib/geo/browser-location-session";
import type { AdministrativeLocationSnapshot } from "../../lib/geo/browser-administrative-location";
import { useDocumentScrollLock } from "../../lib/hooks/use-document-scroll-lock";
import { useLatestRef } from "../../lib/hooks/use-latest-ref";
import { useMountedRef } from "../../lib/hooks/use-mounted-ref";
import type { AppShellState } from "../../types/device";
import type { PostListState, PostLocation } from "../../types/post";

const COMPOSE_PLACEHOLDER_DONG_NAME = "우리 동네";
const MOCK_RUNTIME_NOTICE =
  "Supabase 연결이 아직 설정되지 않아 샘플 데이터를 보여주고 있어요.";

type UseHomeShellStateParams = {
  dataSourceMode: "supabase" | "mock";
  initialAppShellState: AppShellState;
  initialPostListState: PostListState;
  setPostListState: Dispatch<SetStateAction<PostListState>>;
  setPendingFeedSnapshot: Dispatch<SetStateAction<PendingFeedSnapshot | null>>;
};

function applyLocationSessionToHomeShell(
  locationSession: BrowserLocationSessionState,
  options: {
    setFeedLocation: Dispatch<SetStateAction<PostLocation | null>>;
    setAdministrativeLocationSelection: (
      location: AdministrativeLocationSnapshot | null,
      state: {
        permissionMode: AppShellState["permissionMode"];
        readOnlyMode: boolean;
      },
    ) => void;
  },
) {
  if (locationSession.permissionMode === "denied") {
    options.setFeedLocation(null);
    options.setAdministrativeLocationSelection(null, {
      permissionMode: "denied",
      readOnlyMode: true,
    });
    return;
  }

  options.setFeedLocation(locationSession.coordinates);
  options.setAdministrativeLocationSelection(locationSession.resolvedLocation, {
    permissionMode: locationSession.permissionMode,
    readOnlyMode: false,
  });
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
  const locationSession = useBrowserLocationSession();
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

  useEffect(() => {
    applyLocationSessionToHomeShell(locationSession, {
      setFeedLocation,
      setAdministrativeLocationSelection,
    });
  }, [locationSession]);

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

  async function ensureDeviceReady() {
    const existingAnonymousDeviceId = appShellStateRef.current.anonymousDeviceId;

    if (existingAnonymousDeviceId) {
      return existingAnonymousDeviceId;
    }

    const localDeviceId = readBrowserAnonymousDeviceId();

    if (localDeviceId) {
      setAppShellState((current) => ({
        ...current,
        anonymousDeviceId: localDeviceId,
        deviceReady: true,
      }));

      void ensureRegisteredBrowserDevice().catch(() => undefined);

      return localDeviceId;
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
    hasInitialGlobalFeed,
    isMountedRef,
    obscureGlobalFallbackList:
      appShellState.readOnlyMode && feedSortMode === "global",
    runtimeNotice: dataSourceMode === "mock" ? MOCK_RUNTIME_NOTICE : null,
    setAppShellState,
    setFeedSortMode,
  };
}
