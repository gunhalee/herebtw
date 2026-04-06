"use client";

import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { PostListState, PostLocation } from "../../types/post";
import type { PendingFeedSnapshot } from "./home-feed-state";
import { createHomePostStateActions } from "./home-post-state-actions";
import { useHomeAgreeActions } from "./use-home-agree-actions";
import { useHomeReportActions } from "./use-home-report-actions";

type UseHomePostActionsParams = {
  postListStateRef: MutableRefObject<PostListState>;
  feedLocationRef: MutableRefObject<PostLocation | null>;
  setPostListState: Dispatch<SetStateAction<PostListState>>;
  setPendingFeedSnapshot: Dispatch<SetStateAction<PendingFeedSnapshot | null>>;
  ensureDeviceReady: () => Promise<string>;
  closeMenu: () => void;
};

export function useHomePostActions({
  postListStateRef,
  feedLocationRef,
  setPostListState,
  setPendingFeedSnapshot,
  ensureDeviceReady,
  closeMenu,
}: UseHomePostActionsParams) {
  const stateActions = createHomePostStateActions({
    postListStateRef,
    setPostListState,
    setPendingFeedSnapshot,
  });

  const agreeActions = useHomeAgreeActions({
    ensureDeviceReady,
    findPostItem: stateActions.findPostItem,
    patchFeedItem: stateActions.patchFeedItem,
  });

  const reportActions = useHomeReportActions({
    closeMenu,
    ensureDeviceReady,
    feedLocationRef,
    findPostItem: stateActions.findPostItem,
    patchFeedItem: stateActions.patchFeedItem,
    removeFeedItem: stateActions.removeFeedItem,
    setPostListState,
  });

  return {
    ...agreeActions,
    ...reportActions,
  };
}
