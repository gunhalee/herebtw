import type { PostListState } from "../../types/post";
import type { PostEngagementSnapshotResponse } from "./home-feed-api";

export type PendingFeedSnapshot = {
  items: PostListState["items"];
  nextCursor: string | null;
  newItemsCount: number;
  requestedItemCount: number;
};

type PostListItemUpdater = (
  item: PostListState["items"][number],
) => PostListState["items"][number];

export function mergePostItems(
  currentItems: PostListState["items"],
  incomingItems: PostListState["items"],
) {
  const seenPostIds = new Set(currentItems.map((item) => item.id));

  return [
    ...currentItems,
    ...incomingItems.filter((item) => !seenPostIds.has(item.id)),
  ];
}

export function patchPostListItems(
  currentItems: PostListState["items"],
  incomingItems: PostListState["items"],
) {
  const incomingItemMap = new Map(incomingItems.map((item) => [item.id, item]));

  return currentItems.map((item) => {
    const incomingItem = incomingItemMap.get(item.id);

    if (!incomingItem) {
      return item;
    }

    return {
      ...item,
      relativeTime: incomingItem.relativeTime,
      agreeCount: incomingItem.agreeCount,
      myAgree: incomingItem.myAgree,
      canReport: incomingItem.canReport,
    };
  });
}

export function patchPostEngagementItems(
  currentItems: PostListState["items"],
  incomingItems: PostEngagementSnapshotResponse["items"],
  options?: {
    excludedPostIds?: Set<string>;
  },
) {
  const incomingItemMap = new Map(incomingItems.map((item) => [item.id, item]));

  return currentItems.map((item) => {
    if (options?.excludedPostIds?.has(item.id)) {
      return item;
    }

    const incomingItem = incomingItemMap.get(item.id);

    if (!incomingItem) {
      return item;
    }

    return {
      ...item,
      agreeCount: incomingItem.agreeCount,
      myAgree: incomingItem.myAgree,
    };
  });
}

export function updateSinglePostItem(
  items: PostListState["items"],
  targetPostId: string,
  updater: PostListItemUpdater,
) {
  return items.map((item) => (item.id === targetPostId ? updater(item) : item));
}

export function removeSinglePostItem(
  items: PostListState["items"],
  targetPostId: string,
) {
  return items.filter((item) => item.id !== targetPostId);
}

export function matchesLoadedPostIds(
  items: PostListState["items"],
  loadedPostIds: string[],
) {
  return (
    items.length === loadedPostIds.length &&
    items.every((item, index) => item.id === loadedPostIds[index])
  );
}

export function buildReadyPostListState(
  current: PostListState,
  input: {
    items: PostListState["items"];
    nextCursor: string | null;
    sort: PostListState["sort"];
  },
): PostListState {
  return {
    ...current,
    items: input.items,
    nextCursor: input.nextCursor,
    loading: false,
    loadingMore: false,
    empty: input.items.length === 0,
    errorMessage: null,
    sort: input.sort,
  };
}

export function buildLoadingMorePostListState(current: PostListState): PostListState {
  return {
    ...current,
    loadingMore: true,
    errorMessage: null,
  };
}

export function buildPostListErrorState(
  current: PostListState,
  errorMessage: string,
): PostListState {
  return {
    ...current,
    loading: false,
    loadingMore: false,
    errorMessage,
  };
}

export function buildPatchedPostListState(
  current: PostListState,
  targetPostId: string,
  updater: PostListItemUpdater,
  options?: {
    errorMessage?: string | null;
  },
): PostListState {
  return {
    ...current,
    ...(options && "errorMessage" in options
      ? { errorMessage: options.errorMessage ?? null }
      : {}),
    items: updateSinglePostItem(current.items, targetPostId, updater),
  };
}

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

export function buildRemovedPostListState(
  current: PostListState,
  targetPostId: string,
): PostListState {
  const nextItems = removeSinglePostItem(current.items, targetPostId);

  return {
    ...current,
    items: nextItems,
    empty: nextItems.length === 0,
    errorMessage: null,
  };
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
