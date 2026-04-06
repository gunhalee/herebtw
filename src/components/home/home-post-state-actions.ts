"use client";

import type {
  Dispatch,
  MutableRefObject,
  SetStateAction,
} from "react";
import type { PostListState } from "../../types/post";
import {
  buildPatchedPostListState,
  buildRemovedPostListState,
  patchPendingFeedSnapshot,
  removeFromPendingFeedSnapshot,
  type PendingFeedSnapshot,
} from "./home-feed-state";

export type HomePostItem = PostListState["items"][number];
export type HomePostItemUpdater = (item: HomePostItem) => HomePostItem;

type CreateHomePostStateActionsParams = {
  postListStateRef: MutableRefObject<PostListState>;
  setPostListState: Dispatch<SetStateAction<PostListState>>;
  setPendingFeedSnapshot: Dispatch<SetStateAction<PendingFeedSnapshot | null>>;
};

export function createHomePostStateActions({
  postListStateRef,
  setPostListState,
  setPendingFeedSnapshot,
}: CreateHomePostStateActionsParams) {
  function findPostItem(targetPostId: string) {
    return postListStateRef.current.items.find((item) => item.id === targetPostId);
  }

  function patchFeedItem(
    targetPostId: string,
    updater: HomePostItemUpdater,
    options?: {
      errorMessage?: string | null;
    },
  ) {
    setPostListState((current) =>
      buildPatchedPostListState(current, targetPostId, updater, options),
    );
    setPendingFeedSnapshot((current) =>
      patchPendingFeedSnapshot(current, targetPostId, updater),
    );
  }

  function removeFeedItem(targetPostId: string) {
    const currentState = postListStateRef.current;
    const nextState = buildRemovedPostListState(currentState, targetPostId);

    postListStateRef.current = nextState;
    setPostListState(nextState);
    setPendingFeedSnapshot((current) =>
      removeFromPendingFeedSnapshot(current, targetPostId),
    );

    return nextState;
  }

  return {
    findPostItem,
    patchFeedItem,
    removeFeedItem,
  };
}
