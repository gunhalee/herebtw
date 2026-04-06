"use client";

import { useEffect, useRef, useState } from "react";
import { DongPostsScreen } from "./dong-posts-screen";
import { ComposePermissionDialog } from "./compose-permission-dialog";
import { applyBootstrapError, bootstrapHomeFeed } from "./home-feed-bootstrap";
import { fetchActiveHomeFeedPage } from "./home-feed-api";
import {
  applyPendingFeedSnapshot,
  buildLoadingMorePostListState,
  buildPostListErrorState,
  buildReadyPostListState,
  mergePostItems,
  type PendingFeedSnapshot,
} from "./home-feed-state";
import { hydrateHomeFeedLocationFromCoordinates } from "./home-location";
import { useHomePostActions } from "./use-home-post-actions";
import {
  syncHomePostEngagement,
  syncNearbyHomeFeed,
} from "./home-feed-sync";
import { PostComposeExperience } from "../post/post-compose-experience";
import { ensureRegisteredBrowserDevice } from "../../lib/device/browser-device";
import type { AdministrativeLocationSnapshot } from "../../lib/geo/browser-administrative-location";
import { getCurrentBrowserCoordinates } from "../../lib/geo/browser-location";
import { writeCachedNearbyPostList } from "../../lib/posts/browser-nearby-post-cache";
import type { AppShellState } from "../../types/device";
import type { PostListState, PostLocation } from "../../types/post";

const COMPOSE_PLACEHOLDER_DONG_NAME = "우리 동네";

function getPermissionMode(error: unknown): AppShellState["permissionMode"] {
  return error instanceof Error &&
    error.message === "GEOLOCATION_PERMISSION_DENIED"
    ? "denied"
    : "unknown";
}

type HomeScreenProps = {
  dataSourceMode: "supabase" | "mock";
  initialAppShellState: AppShellState;
  initialPostListState: PostListState;
};

export function HomeScreen({
  dataSourceMode,
  initialAppShellState,
  initialPostListState,
}: HomeScreenProps) {
  const [appShellState, setAppShellState] = useState(initialAppShellState);
  const [postListState, setPostListState] = useState(initialPostListState);
  const [pendingFeedSnapshot, setPendingFeedSnapshot] =
    useState<PendingFeedSnapshot | null>(null);
  const [pendingAppliedScrollTargetPostId, setPendingAppliedScrollTargetPostId] =
    useState<string | null>(null);
  const [composePanelOpen, setComposePanelOpen] = useState(false);
  const [composePermissionDialogOpen, setComposePermissionDialogOpen] =
    useState(false);
  const [activeMenuPostId, setActiveMenuPostId] = useState<string | null>(null);
  const [feedLocation, setFeedLocation] = useState<PostLocation | null>(null);
  const [feedSortMode, setFeedSortMode] = useState<"nearby" | "global">(
    initialPostListState.sort === "latest" || initialAppShellState.readOnlyMode
      ? "global"
      : "nearby",
  );
  const isMountedRef = useRef(true);
  const appShellStateRef = useRef(appShellState);
  const postListStateRef = useRef(postListState);
  const feedLocationRef = useRef(feedLocation);
  const syncInFlightRef = useRef(false);
  const engagementSyncInFlightRef = useRef(false);
  const hasInitialGlobalFeed =
    initialPostListState.sort === "latest" && !initialPostListState.loading;

  const currentDongName =
    appShellState.selectedDongName ?? COMPOSE_PLACEHOLDER_DONG_NAME;
  const shouldAnimateComposeDongPlaceholder = true;
  const runtimeNotice =
    dataSourceMode === "mock"
      ? "Supabase 환경변수가 아직 설정되지 않아 샘플 데이터를 보여주고 있어요."
      : null;

  const obscureGlobalFallbackList =
    appShellState.readOnlyMode && feedSortMode === "global";

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
    if (appShellState.anonymousDeviceId) {
      return appShellState.anonymousDeviceId;
    }

    const anonymousDeviceId = await ensureRegisteredBrowserDevice();

    setAppShellState((current) => ({
      ...current,
      anonymousDeviceId,
      deviceReady: true,
    }));

    return anonymousDeviceId;
  }

  const {
    activeReportPostId,
    agreePendingPostIdsRef,
    reportErrorMessage,
    reportSubmitting,
    reportSuccessMessage,
    handleCloseReportDialog,
    handleCloseReportSuccessDialog,
    handleReport,
    handleSelectReport,
    handleToggleAgree,
  } = useHomePostActions({
    postListState,
    postListStateRef,
    feedLocationRef,
    setPostListState,
    setPendingFeedSnapshot,
    ensureDeviceReady,
    closeMenu: () => setActiveMenuPostId(null),
  });

  useEffect(() => {
    appShellStateRef.current = appShellState;
  }, [appShellState]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    postListStateRef.current = postListState;
  }, [postListState]);

  useEffect(() => {
    feedLocationRef.current = feedLocation;
  }, [feedLocation]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;
    const body = document.body;
    const previousRootOverflow = root.style.overflow;
    const previousRootOverscrollBehavior = root.style.overscrollBehavior;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyOverscrollBehavior = body.style.overscrollBehavior;

    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";

    return () => {
      root.style.overflow = previousRootOverflow;
      root.style.overscrollBehavior = previousRootOverscrollBehavior;
      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousBodyOverscrollBehavior;
    };
  }, []);

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
      if (cancelled) {
        return;
      }

      applyBootstrapError(setPostListState, error);
    });

    return () => {
      cancelled = true;
    };
  }, [dataSourceMode, hasInitialGlobalFeed, initialPostListState]);

  useEffect(() => {
    if (feedSortMode === "nearby") {
      return;
    }

    setPendingFeedSnapshot(null);
  }, [feedSortMode]);

  useEffect(() => {
    if (
      dataSourceMode !== "supabase" ||
      feedSortMode !== "nearby" ||
      !feedLocation
    ) {
      return;
    }

    let cancelled = false;

    const runNearbyFeedSync = () =>
      syncNearbyHomeFeed({
        isCancelled: () => cancelled,
        syncInFlightRef,
        feedLocationRef,
        appShellStateRef,
        postListStateRef,
        setPostListState,
        setPendingFeedSnapshot,
      });

    void runNearbyFeedSync();

    const intervalId = window.setInterval(() => {
      void runNearbyFeedSync();
    }, 20000);
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void runNearbyFeedSync();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [dataSourceMode, feedLocation, feedSortMode]);

  useEffect(() => {
    if (dataSourceMode !== "supabase") {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    let cancelled = false;

    const runPostEngagementSync = () =>
      syncHomePostEngagement({
        isCancelled: () => cancelled,
        engagementSyncInFlightRef,
        appShellStateRef,
        postListStateRef,
        agreePendingPostIdsRef,
        setPostListState,
      });

    void runPostEngagementSync();

    const intervalId = window.setInterval(() => {
      void runPostEngagementSync();
    }, 5000);
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void runPostEngagementSync();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [dataSourceMode]);

  async function handleCompose() {
    setActiveMenuPostId(null);
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

  function handleApplyPendingFeedSnapshot() {
    if (!pendingFeedSnapshot || !feedLocation) {
      return;
    }

    const { firstNewPostId, nextState } = applyPendingFeedSnapshot(
      postListStateRef.current,
      pendingFeedSnapshot,
    );

    postListStateRef.current = nextState;
    setPostListState(nextState);
    writeCachedNearbyPostList(feedLocation, {
      items: nextState.items,
      nextCursor: nextState.nextCursor,
    });
    setPendingAppliedScrollTargetPostId(firstNewPostId);
    setPendingFeedSnapshot(null);
  }

  async function handleLoadMore() {
    if (
      dataSourceMode !== "supabase" ||
      postListState.loading ||
      postListState.loadingMore ||
      !postListState.nextCursor
    ) {
      return;
    }

    try {
      setPendingFeedSnapshot(null);
      setPostListState((current) => buildLoadingMorePostListState(current));

      const result = await fetchActiveHomeFeedPage(feedLocation, {
        anonymousDeviceId: appShellStateRef.current.anonymousDeviceId ?? undefined,
        cursor: postListState.nextCursor,
      });

      setFeedSortMode(result.feedSortMode);
      setPostListState((current) => {
        const mergedItems = mergePostItems(current.items, result.data.items);

        return buildReadyPostListState(current, {
          items: mergedItems,
          nextCursor: result.data.nextCursor,
          sort: result.postSort,
        });
      });
    } catch (error) {
      setPostListState((current) =>
        buildPostListErrorState(
          current,
          error instanceof Error ? error.message : "목록을 더 불러오지 못했습니다.",
        ),
      );
    }
  }

  function handleOpenMenu(postId: string) {
    setActiveMenuPostId((current) => (current === postId ? null : postId));
  }

  function handleCloseMenu() {
    setActiveMenuPostId(null);
  }

  return (
    <div
      style={{
        background: "#ffffff",
        height: "100dvh",
        inset: 0,
        overflow: "hidden",
        position: "fixed",
        width: "100%",
      }}
    >
      <DongPostsScreen
        activeMenuPostId={activeMenuPostId}
        activeReportPostId={activeReportPostId}
        animateComposeDongPlaceholder={shouldAnimateComposeDongPlaceholder}
        currentDongName={currentDongName}
        interactionLocked={composePanelOpen || composePermissionDialogOpen}
        onApplyPendingUpdates={handleApplyPendingFeedSnapshot}
        onCloseMenu={handleCloseMenu}
        onCloseReportDialog={handleCloseReportDialog}
        onCloseReportSuccessDialog={handleCloseReportSuccessDialog}
        onCompose={handleCompose}
        onConfirmReport={handleReport}
        onLoadMore={handleLoadMore}
        onOpenMenu={handleOpenMenu}
        obscurePosts={obscureGlobalFallbackList}
        onSelectReport={handleSelectReport}
        onScrollTargetApplied={() => setPendingAppliedScrollTargetPostId(null)}
        scrollTargetPostId={pendingAppliedScrollTargetPostId}
        onToggleAgree={handleToggleAgree}
        pendingNewItemsCount={pendingFeedSnapshot?.newItemsCount ?? 0}
        reportErrorMessage={reportErrorMessage}
        reportSuccessMessage={reportSuccessMessage}
        reportSubmitting={reportSubmitting}
        runtimeNotice={runtimeNotice}
        state={postListState}
      />
      {composePanelOpen ? (
        <PostComposeExperience
          dataSourceMode={dataSourceMode}
          onDismiss={handleCloseComposePanel}
          onSuccess={handleComposeSuccess}
        />
      ) : null}
      {composePermissionDialogOpen ? (
        <ComposePermissionDialog
          onClose={handleCloseComposePermissionDialog}
          onRetry={() => {
            setComposePermissionDialogOpen(false);
            void handleCompose();
          }}
        />
      ) : null}
    </div>
  );
}
