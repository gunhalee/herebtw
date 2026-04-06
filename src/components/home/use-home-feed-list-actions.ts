"use client";

import { useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { fetchActiveHomeFeedPage } from "./home-feed-api";
import {
  applyPendingFeedSnapshot,
  buildLoadingMorePostListState,
  buildPostListErrorState,
  buildReadyPostListState,
  mergePostItems,
  type PendingFeedSnapshot,
} from "./home-feed-state";
import { writeCachedNearbyPostList } from "../../lib/posts/browser-nearby-post-cache";
import type { AppShellState } from "../../types/device";
import type { PostListState, PostLocation } from "../../types/post";

type UseHomeFeedListActionsParams = {
  dataSourceMode: "supabase" | "mock";
  appShellStateRef: MutableRefObject<AppShellState>;
  postListState: PostListState;
  postListStateRef: MutableRefObject<PostListState>;
  feedLocation: PostLocation | null;
  setFeedSortMode: Dispatch<SetStateAction<"nearby" | "global">>;
  setPostListState: Dispatch<SetStateAction<PostListState>>;
  pendingFeedSnapshot: PendingFeedSnapshot | null;
  setPendingFeedSnapshot: Dispatch<SetStateAction<PendingFeedSnapshot | null>>;
  setPendingAppliedScrollTargetPostId: Dispatch<SetStateAction<string | null>>;
};

export function useHomeFeedListActions({
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
}: UseHomeFeedListActionsParams) {
  const [activeMenuPostId, setActiveMenuPostId] = useState<string | null>(null);

  function handleOpenMenu(postId: string) {
    setActiveMenuPostId((current) => (current === postId ? null : postId));
  }

  function handleCloseMenu() {
    setActiveMenuPostId(null);
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

  return {
    activeMenuPostId,
    handleApplyPendingFeedSnapshot,
    handleCloseMenu,
    handleLoadMore,
    handleOpenMenu,
  };
}
