import type { PostListState } from "../../types/post";
import type { PostEngagementSnapshotResponse } from "./home-feed-api";

export type PostListItemUpdater = (
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
