import { writeCachedNearbyPostList } from "../../lib/posts/browser-nearby-post-cache";
import { quantizeLocationTo100MeterGrid } from "../../lib/geo/location-buckets";
import type { ApiResponse } from "../../types/api";
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

async function fetchNearbyPostsList(
  location: PostLocation,
  cursor?: string | null,
  anonymousDeviceId?: string,
  limit = 10,
) {
  const quantizedLocation = quantizeLocationTo100MeterGrid(location);
  const params = new URLSearchParams({
    limit: String(limit),
    latitudeBucket100m: String(quantizedLocation.latitudeBucket100m),
    longitudeBucket100m: String(quantizedLocation.longitudeBucket100m),
  });

  if (cursor) {
    params.set("cursor", cursor);
  }

  if (anonymousDeviceId) {
    params.set("anonymousDeviceId", anonymousDeviceId);
  }

  const response = await fetch(`/api/feed/nearby?${params.toString()}`);
  const json = (await response.json()) as ApiResponse<PostsListResponse>;

  if (!response.ok || !json.success || !json.data) {
    throw new Error(json.error?.message ?? "동네 글을 불러오지 못했습니다.");
  }

  if (!cursor) {
    writeCachedNearbyPostList(location, {
      items: json.data.items,
      nextCursor: json.data.nextCursor,
    });
  }

  return json.data;
}

export async function fetchNearbyFeedSync(
  location: PostLocation,
  loadedPostIds: string[],
  limit: number,
  anonymousDeviceId?: string,
) {
  const response = await fetch("/api/feed/nearby/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      anonymousDeviceId,
      loadedPostIds,
      limit,
      location,
    }),
  });
  const json = (await response.json()) as ApiResponse<NearbyFeedSyncResponse>;

  if (!response.ok || !json.success || !json.data) {
    throw new Error(json.error?.message ?? "피드 갱신에 실패했습니다.");
  }

  return json.data;
}

export async function fetchPostEngagementSnapshot(
  postIds: string[],
  anonymousDeviceId?: string,
) {
  const response = await fetch("/api/posts/engagement", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      anonymousDeviceId,
      postIds,
    }),
  });
  const json =
    (await response.json()) as ApiResponse<PostEngagementSnapshotResponse>;

  if (!response.ok || !json.success || !json.data) {
    throw new Error(json.error?.message ?? "맞아요 상태를 갱신하지 못했습니다.");
  }

  return json.data;
}

async function fetchGlobalPostsList(cursor?: string | null, limit = 10) {
  const params = new URLSearchParams({
    limit: String(limit),
  });

  if (cursor) {
    params.set("cursor", cursor);
  }

  const response = await fetch(`/api/feed/global?${params.toString()}`);
  const json = (await response.json()) as ApiResponse<PostsListResponse>;

  if (!response.ok || !json.success || !json.data) {
    throw new Error(json.error?.message ?? "전역 피드를 불러오지 못했습니다.");
  }

  return json.data;
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

  return {
    data,
    feedSortMode: location ? ("nearby" as const) : ("global" as const),
    postSort: location ? ("distance" as const) : ("latest" as const),
  };
}
