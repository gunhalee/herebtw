import type { PostListState } from "../../types/post";
import {
  patchPostListItems,
  removeSinglePostItem,
  updateSinglePostItem,
  type PostListItemUpdater,
} from "./home-feed-item-ops";

export type PendingFeedSnapshot = {
  items: PostListState["items"];
  nextCursor: string | null;
  newItemsCount: number;
  requestedItemCount: number;
};

export function patchPendingFeedSnapshot(
  current: PendingFeedSnapshot | null,
  targetPostId: string,
  updater: PostListItemUpdater,
) {
  return current
    ? {
        ...current,
        items: updateSinglePostItem(current.items, targetPostId, updater),
      }
    : null;
}

export function removeFromPendingFeedSnapshot(
  current: PendingFeedSnapshot | null,
  targetPostId: string,
) {
  return current
    ? {
        ...current,
        items: removeSinglePostItem(current.items, targetPostId),
      }
    : null;
}

export function applyPendingFeedSnapshot(
  current: PostListState,
  snapshot: PendingFeedSnapshot,
) {
  const currentPostIdSet = new Set(current.items.map((item) => item.id));
  const appendedNewItems = snapshot.items.filter(
    (item) => !currentPostIdSet.has(item.id),
  );
  const mergedItems = [
    ...patchPostListItems(current.items, snapshot.items),
    ...appendedNewItems,
  ];

  return {
    firstNewPostId: appendedNewItems[0]?.id ?? null,
    nextState: {
      ...current,
      items: mergedItems,
      nextCursor: current.nextCursor,
      empty: mergedItems.length === 0,
      errorMessage: null,
      sort: "distance" as const,
    },
  };
}
