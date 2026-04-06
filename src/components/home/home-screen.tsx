"use client";

import { useRef, useState } from "react";
import { DongPostsScreen } from "./dong-posts-screen";
import { ComposePermissionDialog } from "./compose-permission-dialog";
import { type PendingFeedSnapshot } from "./home-feed-state";
import { useHomeComposeFlow } from "./use-home-compose-flow";
import { useHomeFeedListActions } from "./use-home-feed-list-actions";
import { useHomeFeedLifecycle } from "./use-home-feed-lifecycle";
import { useHomePostActions } from "./use-home-post-actions";
import { useHomeShellState } from "./use-home-shell-state";
import { PostComposeExperience } from "../post/post-compose-experience";
import { useLatestRef } from "../../lib/hooks/use-latest-ref";
import type { AppShellState } from "../../types/device";
import type { PostListState } from "../../types/post";

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
  const [postListState, setPostListState] = useState(initialPostListState);
  const [pendingFeedSnapshot, setPendingFeedSnapshot] =
    useState<PendingFeedSnapshot | null>(null);
  const [pendingAppliedScrollTargetPostId, setPendingAppliedScrollTargetPostId] =
    useState<string | null>(null);
  const postListStateRef = useLatestRef(postListState);
  const syncInFlightRef = useRef(false);
  const engagementSyncInFlightRef = useRef(false);
  const shouldAnimateComposeDongPlaceholder = true;

  const {
    appShellStateRef,
    applyCachedNearbyPostListState,
    currentDongName,
    ensureDeviceReady,
    feedLocation,
    feedLocationRef,
    feedSortMode,
    getPermissionMode,
    hasInitialGlobalFeed,
    hydrateHomeLocationFromCoordinates,
    isMountedRef,
    obscureGlobalFallbackList,
    runtimeNotice,
    setAdministrativeLocationSelection,
    setAppShellState,
    setFeedLocation,
    setFeedSortMode,
  } = useHomeShellState({
    dataSourceMode,
    initialAppShellState,
    initialPostListState,
    setPostListState,
    setPendingFeedSnapshot,
  });

  const {
    activeMenuPostId,
    handleApplyPendingFeedSnapshot,
    handleCloseMenu,
    handleLoadMore,
    handleOpenMenu,
  } = useHomeFeedListActions({
    dataSourceMode,
    appShellStateRef,
    postListState,
    postListStateRef,
    feedLocation,
    setFeedSortMode,
    setPostListState,
    pendingFeedSnapshot,
    setPendingFeedSnapshot,
    setPendingAppliedScrollTargetPostId,
  });

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
    closeMenu: handleCloseMenu,
  });

  const {
    composePanelOpen,
    composePermissionDialogOpen,
    handleCloseComposePanel,
    handleCloseComposePermissionDialog,
    handleCompose,
    handleComposeSuccess,
    handleRetryCompose,
  } = useHomeComposeFlow({
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
    closeMenu: handleCloseMenu,
  });

  useHomeFeedLifecycle({
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
  });

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
        obscurePosts={obscureGlobalFallbackList}
        onApplyPendingUpdates={handleApplyPendingFeedSnapshot}
        onCloseMenu={handleCloseMenu}
        onCloseReportDialog={handleCloseReportDialog}
        onCloseReportSuccessDialog={handleCloseReportSuccessDialog}
        onCompose={handleCompose}
        onConfirmReport={handleReport}
        onLoadMore={handleLoadMore}
        onOpenMenu={handleOpenMenu}
        onScrollTargetApplied={() => setPendingAppliedScrollTargetPostId(null)}
        onSelectReport={handleSelectReport}
        onToggleAgree={handleToggleAgree}
        pendingNewItemsCount={pendingFeedSnapshot?.newItemsCount ?? 0}
        reportErrorMessage={reportErrorMessage}
        reportSubmitting={reportSubmitting}
        reportSuccessMessage={reportSuccessMessage}
        runtimeNotice={runtimeNotice}
        scrollTargetPostId={pendingAppliedScrollTargetPostId}
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
          onRetry={handleRetryCompose}
        />
      ) : null}
    </div>
  );
}
