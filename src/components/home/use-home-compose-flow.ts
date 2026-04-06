"use client";

import { useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { fetchActiveHomeFeedPage } from "./home-feed-api";
import {
  buildPostListErrorState,
  buildReadyPostListState,
  type PendingFeedSnapshot,
} from "./home-feed-state";
import type { AdministrativeLocationSnapshot } from "../../lib/geo/browser-administrative-location";
import { getCurrentBrowserCoordinates } from "../../lib/geo/browser-location";
import type { AppShellState } from "../../types/device";
import type { PostListState, PostLocation } from "../../types/post";

type SetAdministrativeLocationSelection = (
  location: AdministrativeLocationSnapshot | null,
  options: {
    permissionMode: AppShellState["permissionMode"];
    readOnlyMode: boolean;
  },
) => void;

type UseHomeComposeFlowParams = {
  dataSourceMode: "supabase" | "mock";
  isMountedRef: MutableRefObject<boolean>;
  appShellStateRef: MutableRefObject<AppShellState>;
  feedLocationRef: MutableRefObject<PostLocation | null>;
  setFeedLocation: Dispatch<SetStateAction<PostLocation | null>>;
  setFeedSortMode: Dispatch<SetStateAction<"nearby" | "global">>;
  setPostListState: Dispatch<SetStateAction<PostListState>>;
  setPendingFeedSnapshot: Dispatch<SetStateAction<PendingFeedSnapshot | null>>;
  hydrateHomeLocationFromCoordinates: (location: PostLocation) => void;
  setAdministrativeLocationSelection: SetAdministrativeLocationSelection;
  getPermissionMode: (error: unknown) => AppShellState["permissionMode"];
  closeMenu: () => void;
};

export function useHomeComposeFlow({
  dataSourceMode,
  isMountedRef,
  appShellStateRef,
  feedLocationRef,
  setFeedLocation,
  setFeedSortMode,
  setPostListState,
  setPendingFeedSnapshot,
  hydrateHomeLocationFromCoordinates,
  setAdministrativeLocationSelection,
  getPermissionMode,
  closeMenu,
}: UseHomeComposeFlowParams) {
  const [composePanelOpen, setComposePanelOpen] = useState(false);
  const [composePermissionDialogOpen, setComposePermissionDialogOpen] =
    useState(false);

  async function handleCompose() {
    closeMenu();
    setComposePermissionDialogOpen(false);

    if (!feedLocationRef.current) {
      try {
        const resolvedCoordinates = await getCurrentBrowserCoordinates();
        hydrateHomeLocationFromCoordinates(resolvedCoordinates);
      } catch (error) {
        const permissionMode = getPermissionMode(error);

        if (isMountedRef.current) {
          setFeedLocation(null);
          setAdministrativeLocationSelection(null, {
            permissionMode,
            readOnlyMode: permissionMode === "denied",
          });
          setComposePermissionDialogOpen(true);
        }

        return;
      }
    }

    if (isMountedRef.current) {
      setComposePanelOpen(true);
    }
  }

  function handleCloseComposePanel() {
    setComposePanelOpen(false);
  }

  function handleCloseComposePermissionDialog() {
    setComposePermissionDialogOpen(false);
  }

  function handleRetryCompose() {
    setComposePermissionDialogOpen(false);
    void handleCompose();
  }

  async function handleComposeSuccess() {
    setComposePanelOpen(false);
    setPendingFeedSnapshot(null);

    if (dataSourceMode !== "supabase") {
      return;
    }

    try {
      const latestLocation = feedLocationRef.current;
      const result = await fetchActiveHomeFeedPage(latestLocation, {
        anonymousDeviceId: appShellStateRef.current.anonymousDeviceId ?? undefined,
      });

      setFeedSortMode(result.feedSortMode);
      setPostListState((current) =>
        buildReadyPostListState(current, {
          items: result.data.items,
          nextCursor: result.data.nextCursor,
          sort: result.postSort,
        }),
      );
    } catch (error) {
      setPostListState((current) =>
        buildPostListErrorState(
          current,
          error instanceof Error
            ? error.message
            : "등록 후 목록을 새로고침하지 못했습니다.",
        ),
      );
    }
  }

  return {
    composePanelOpen,
    composePermissionDialogOpen,
    handleCloseComposePanel,
    handleCloseComposePermissionDialog,
    handleCompose,
    handleComposeSuccess,
    handleRetryCompose,
  };
}
