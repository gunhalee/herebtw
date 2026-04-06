import type { PostListState } from "../../types/post";
import {
  removeSinglePostItem,
  updateSinglePostItem,
  type PostListItemUpdater,
} from "./home-feed-item-ops";

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
