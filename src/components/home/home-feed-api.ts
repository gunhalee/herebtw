import { writeCachedNearbyPostList } from "../../lib/posts/browser-nearby-post-cache";
import {
  createJsonPostRequestInit,
  fetchClientApiData,
} from "../../lib/api/client";
import { quantizeLocationTo100MeterGrid } from "../../lib/geo/location-buckets";
import type { PostListState, PostLocation } from "../../types/post";

type PostsListResponse = {
  items: PostListState["items"];
  nextCursor: string | null;
};

type NearbyFeedSyncResponse = {
  items: PostListState["items"];
  nextCursor: string | null;
  newItemsCount: number;
};

export type PostEngagementSnapshotResponse = {
  items: Array<{
    id: string;
    agreeCount: number;
    myAgree: boolean;
  }>;
};

const DEFAULT_FEED_PAGE_LIMIT = 10;

function cacheNearbyPostsList(
  location: PostLocation,
  data: PostsListResponse,
  cursor?: string | null,
) {
  if (cursor) {
    return;
  }

  writeCachedNearbyPostList(location, {
    items: data.items,
    nextCursor: data.nextCursor,
  });
}

function createNearbyFeedSearchParams(input: {
  anonymousDeviceId?: string;
  cursor?: string | null;
  limit: number;
  location: PostLocation;
}) {
  const quantizedLocation = quantizeLocationTo100MeterGrid(input.location);
  const params = new URLSearchParams({
    limit: String(input.limit),
    latitudeBucket100m: String(quantizedLocation.latitudeBucket100m),
    longitudeBucket100m: String(quantizedLocation.longitudeBucket100m),
  });

  if (input.cursor) {
    params.set("cursor", input.cursor);
  }

  if (input.anonymousDeviceId) {
    params.set("anonymousDeviceId", input.anonymousDeviceId);
  }

  return params;
}

function createGlobalFeedSearchParams(cursor?: string | null, limit = DEFAULT_FEED_PAGE_LIMIT) {
  const params = new URLSearchParams({
    limit: String(limit),
  });

  if (cursor) {
    params.set("cursor", cursor);
  }

  return params;
}

async function fetchPostsListPage(
  path: string,
  errorMessage: string,
) {
  return fetchClientApiData<PostsListResponse>({
    errorMessage,
    path,
  });
}

async function fetchNearbyPostsList(
  location: PostLocation,
  cursor?: string | null,
  anonymousDeviceId?: string,
  limit = DEFAULT_FEED_PAGE_LIMIT,
) {
  const data = await fetchPostsListPage(
    `/api/feed/nearby?${createNearbyFeedSearchParams({
      anonymousDeviceId,
      cursor,
      limit,
      location,
    }).toString()}`,
    "동네 글을 불러오지 못했습니다.",
  );

  cacheNearbyPostsList(location, data, cursor);

  return data;
}

export async function fetchNearbyFeedSync(
  location: PostLocation,
  loadedPostIds: string[],
  limit: number,
  anonymousDeviceId?: string,
) {
  return fetchClientApiData<NearbyFeedSyncResponse>({
    errorMessage: "피드 갱신에 실패했습니다.",
    init: createJsonPostRequestInit({
      anonymousDeviceId,
      loadedPostIds,
      limit,
      location,
    }),
    path: "/api/feed/nearby/sync",
  });
}

export async function fetchPostEngagementSnapshot(
  postIds: string[],
  anonymousDeviceId?: string,
) {
  return fetchClientApiData<PostEngagementSnapshotResponse>({
    errorMessage: "맞아요 상태를 갱신하지 못했습니다.",
    init: createJsonPostRequestInit({
      anonymousDeviceId,
      postIds,
    }),
    path: "/api/posts/engagement",
  });
}

async function fetchGlobalPostsList(
  cursor?: string | null,
  limit = DEFAULT_FEED_PAGE_LIMIT,
) {
  return fetchPostsListPage(
    `/api/feed/global?${createGlobalFeedSearchParams(cursor, limit).toString()}`,
    "전역 피드를 불러오지 못했습니다.",
  );
}

function createActiveHomeFeedPageResult(
  location: PostLocation | null,
  data: PostsListResponse,
) {
  return {
    data,
    feedSortMode: location ? ("nearby" as const) : ("global" as const),
    postSort: location ? ("distance" as const) : ("latest" as const),
  };
}

export async function fetchActiveHomeFeedPage(
  location: PostLocation | null,
  options?: {
    anonymousDeviceId?: string;
    cursor?: string | null;
  },
) {
  const data = location
    ? await fetchNearbyPostsList(
        location,
        options?.cursor,
        options?.anonymousDeviceId,
      )
    : await fetchGlobalPostsList(options?.cursor);

  return createActiveHomeFeedPageResult(location, data);
}
