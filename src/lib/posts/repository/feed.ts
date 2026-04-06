import type { PostListState, PostLocation } from "../../../types/post";
import { GLOBAL_FEED_DISTANCE_SENTINEL_METERS } from "../../geo/location-buckets";
import { hasSupabaseServerConfig } from "../../supabase/config";
import { supabaseRpc, supabaseSelect } from "../../supabase/rest";
import { getMockPostListState } from "../mock-data";
import {
  buildFeedMetricsContext,
  buildPostListItems,
  buildRpcPostListItems,
  clampFeedLimit,
  createPostListState,
  decodePostListCursor,
  getFeedRpcFallbackReason,
  getNextGlobalFeedCursor,
  getNextNearbyFeedCursor,
  logFeedFallbackMetrics,
  logFeedMetrics,
  logLoadedFeedMetrics,
  normalizeGlobalFeedCursor,
  resolveLegacyGlobalCursor,
  shouldFallbackToLegacyFeedRpc,
  sliceFeedRows,
  sliceNearbyRpcRows,
  type FeedMetricsContext,
} from "./feed-helpers";
import {
  buildInFilter,
  ensureDeviceIdentity,
  getElapsedTimeMs,
  getMonotonicTimeMs,
  isUuid,
} from "./shared";
import type {
  FeedFallbackReason,
  FeedScope,
  NearbyPostRow,
  PostEngagementRow,
  PostListCursor,
  PostRow,
  ReactionRow,
  ReportRow,
} from "./types";

async function loadPostsFeedRpc(input: {
  scope: FeedScope;
  anonymousDeviceId?: string;
  limit: number;
  cursor: PostListCursor | null;
  location?: PostLocation;
}) {
  const startedAtMs = getMonotonicTimeMs();

  try {
    const rows =
      (await supabaseRpc<NearbyPostRow[]>("list_posts_feed", {
        viewer_latitude: input.location?.latitude ?? null,
        viewer_longitude: input.location?.longitude ?? null,
        viewer_anonymous_device_id: input.anonymousDeviceId ?? null,
        cursor_distance_meters: input.cursor?.distanceMeters ?? null,
        cursor_created_at: input.cursor?.createdAt ?? null,
        cursor_post_id: input.cursor?.postId ?? null,
        result_limit: input.limit + 1,
      })) ?? [];

    return {
      rows,
      durationMs: getElapsedTimeMs(startedAtMs),
      fallbackReason: null as FeedFallbackReason | null,
    };
  } catch (error) {
    if (shouldFallbackToLegacyFeedRpc(error)) {
      return {
        rows: null,
        durationMs: getElapsedTimeMs(startedAtMs),
        fallbackReason: "missing_rpc" as FeedFallbackReason,
      };
    }

    logFeedMetrics("error", "rpc_failed", {
      ...buildFeedMetricsContext(input),
      rpcDurationMs: getElapsedTimeMs(startedAtMs),
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

type PrepareFeedLoadParams = {
  scope: FeedScope;
  anonymousDeviceId?: string;
  limit?: number;
  cursor?: string;
  location?: PostLocation;
  decodeCursor?: (cursor: string | undefined) => PostListCursor | null;
};

async function prepareFeedLoad({
  scope,
  anonymousDeviceId,
  limit: rawLimit,
  cursor: rawCursor,
  location,
  decodeCursor = decodePostListCursor,
}: PrepareFeedLoadParams) {
  const startedAtMs = getMonotonicTimeMs();
  const limit = clampFeedLimit(rawLimit);
  const cursor = decodeCursor(rawCursor);
  const metricsContext = buildFeedMetricsContext({
    scope,
    anonymousDeviceId,
    cursor,
    limit,
    location,
  });
  const rpcResult = await loadPostsFeedRpc({
    scope,
    anonymousDeviceId,
    limit,
    cursor,
    location,
  });

  return {
    startedAtMs,
    limit,
    cursor,
    metricsContext,
    rpcResult,
    fallbackReason: getFeedRpcFallbackReason(
      rpcResult.rows,
      rpcResult.fallbackReason,
    ),
  };
}

type PreparedFeedLoadResult = Awaited<ReturnType<typeof prepareFeedLoad>>;

async function loadEngagementRows(postIds: string[]) {
  if (postIds.length === 0) {
    return [];
  }

  return (
    (await supabaseSelect<PostEngagementRow[]>(
      `post_engagement_view?select=post_id,agree_count&post_id=in.(${buildInFilter(postIds)})`,
    )) ?? []
  );
}

async function loadMyAgreeRows(deviceId: string | undefined, postIds: string[]) {
  if (!deviceId || postIds.length === 0) {
    return [];
  }

  return (
    (await supabaseSelect<ReactionRow[]>(
      `post_reactions?select=id,post_id,device_id,reaction_type&device_id=eq.${deviceId}&reaction_type=eq.agree&post_id=in.(${buildInFilter(postIds)})`,
    )) ?? []
  );
}

async function loadMyReportRows(deviceId: string | undefined, postIds: string[]) {
  if (!deviceId || postIds.length === 0) {
    return [];
  }

  return (
    (await supabaseSelect<ReportRow[]>(
      `post_reports?select=id,post_id,reporter_device_id,reason_code&reporter_device_id=eq.${deviceId}&post_id=in.(${buildInFilter(postIds)})`,
    )) ?? []
  );
}

function createLoggedPostListState(input: {
  metricsContext: FeedMetricsContext;
  path: "rpc" | "legacy";
  items: PostListState["items"];
  hasMore: boolean;
  rpcDurationMs: number;
  startedAtMs: number;
  sort: PostListState["sort"];
  nextCursor: string | null;
}) {
  logLoadedFeedMetrics({
    metricsContext: input.metricsContext,
    path: input.path,
    itemCount: input.items.length,
    hasMore: input.hasMore,
    rpcDurationMs: input.rpcDurationMs,
    totalDurationMs: getElapsedTimeMs(input.startedAtMs),
  });

  return createPostListState({
    items: input.items,
    nextCursor: input.nextCursor,
    sort: input.sort,
  });
}

function buildNearbyRpcPostListState(input: {
  preparedLoad: PreparedFeedLoadResult;
  anonymousDeviceId?: string;
  sort: PostListState["sort"];
}) {
  const rpcRows = input.preparedLoad.rpcResult.rows;

  if (!rpcRows || input.preparedLoad.fallbackReason) {
    return null;
  }

  const { hasMore, selectedRows } = sliceNearbyRpcRows(
    rpcRows,
    input.preparedLoad.limit,
    Boolean(input.anonymousDeviceId),
  );
  const items = buildRpcPostListItems(selectedRows, {
    fallbackCanReport: Boolean(input.anonymousDeviceId),
  });

  return createLoggedPostListState({
    metricsContext: input.preparedLoad.metricsContext,
    path: "rpc",
    items,
    hasMore,
    rpcDurationMs: input.preparedLoad.rpcResult.durationMs,
    startedAtMs: input.preparedLoad.startedAtMs,
    sort: input.sort,
    nextCursor: getNextNearbyFeedCursor(selectedRows, hasMore),
  });
}

async function loadLegacyNearbyPostListState(input: {
  preparedLoad: PreparedFeedLoadResult;
  anonymousDeviceId?: string;
  location?: PostLocation;
  sort: PostListState["sort"];
}) {
  const device = input.anonymousDeviceId
    ? await ensureDeviceIdentity(input.anonymousDeviceId)
    : null;
  const posts =
    (await supabaseRpc<NearbyPostRow[]>("list_nearby_posts", {
      viewer_latitude: input.location?.latitude ?? null,
      viewer_longitude: input.location?.longitude ?? null,
      cursor_distance_meters: input.preparedLoad.cursor?.distanceMeters ?? null,
      cursor_created_at: input.preparedLoad.cursor?.createdAt ?? null,
      cursor_post_id: input.preparedLoad.cursor?.postId ?? null,
      result_limit: input.preparedLoad.limit + 1,
    })) ?? [];
  const { hasMore, selectedRows } = sliceFeedRows(
    posts,
    input.preparedLoad.limit,
  );
  const postIds = selectedRows.map((post) => post.id);
  const [engagementRows, myReactionRows, myReportRows] = await Promise.all([
    loadEngagementRows(postIds),
    loadMyAgreeRows(device?.id, postIds),
    loadMyReportRows(device?.id, postIds),
  ]);
  const reportedPostIdSet = new Set(myReportRows.map((row) => row.post_id));
  const visiblePosts = selectedRows.filter((post) => !reportedPostIdSet.has(post.id));
  const visiblePostIdSet = new Set(visiblePosts.map((post) => post.id));
  const items = buildPostListItems(visiblePosts, {
    viewerLocation: input.location,
    engagementRows: engagementRows.filter((row) => visiblePostIdSet.has(row.post_id)),
    myReactionRows: myReactionRows.filter((row) => visiblePostIdSet.has(row.post_id)),
  });

  return createLoggedPostListState({
    metricsContext: input.preparedLoad.metricsContext,
    path: "legacy",
    items,
    hasMore,
    rpcDurationMs: input.preparedLoad.rpcResult.durationMs,
    startedAtMs: input.preparedLoad.startedAtMs,
    sort: input.sort,
    nextCursor: getNextNearbyFeedCursor(selectedRows, hasMore),
  });
}

function buildGlobalRpcPostListState(input: {
  preparedLoad: PreparedFeedLoadResult;
}) {
  const rpcRows = input.preparedLoad.rpcResult.rows;

  if (!rpcRows || input.preparedLoad.fallbackReason) {
    return null;
  }

  const { hasMore, selectedRows } = sliceFeedRows(
    rpcRows,
    input.preparedLoad.limit,
  );
  const items = buildRpcPostListItems(selectedRows, {
    myAgree: false,
    canReport: false,
    distanceMetersOverride: GLOBAL_FEED_DISTANCE_SENTINEL_METERS,
  });

  return createLoggedPostListState({
    metricsContext: input.preparedLoad.metricsContext,
    path: "rpc",
    items,
    hasMore,
    rpcDurationMs: input.preparedLoad.rpcResult.durationMs,
    startedAtMs: input.preparedLoad.startedAtMs,
    sort: "latest",
    nextCursor: getNextNearbyFeedCursor(selectedRows, hasMore),
  });
}

async function loadLegacyGlobalPostListState(input: {
  rawCursor: string | undefined;
  preparedLoad: PreparedFeedLoadResult;
}) {
  const legacyCursor = resolveLegacyGlobalCursor(
    input.rawCursor,
    input.preparedLoad.cursor,
  );
  const cursorFilter = legacyCursor
    ? `&or=(created_at.lt.${encodeURIComponent(legacyCursor.createdAt)},and(created_at.eq.${encodeURIComponent(legacyCursor.createdAt)},id.gt.${legacyCursor.postId}))`
    : "";
  const posts =
    (await supabaseSelect<PostRow[]>(
      `posts?select=id,content,administrative_dong_name,created_at,delete_expires_at,latitude,longitude&status=eq.active&order=created_at.desc&order=id.asc&limit=${input.preparedLoad.limit + 1}${cursorFilter}`,
    )) ?? [];
  const { hasMore, selectedRows } = sliceFeedRows(
    posts,
    input.preparedLoad.limit,
  );
  const postIds = selectedRows.map((post) => post.id);
  const engagementRows = await loadEngagementRows(postIds);
  const items = buildPostListItems(selectedRows, {
    engagementRows,
    canReport: false,
    distanceMetersOverride: GLOBAL_FEED_DISTANCE_SENTINEL_METERS,
  });

  return createLoggedPostListState({
    metricsContext: input.preparedLoad.metricsContext,
    path: "legacy",
    items,
    hasMore,
    rpcDurationMs: input.preparedLoad.rpcResult.durationMs,
    startedAtMs: input.preparedLoad.startedAtMs,
    sort: "latest",
    nextCursor: getNextGlobalFeedCursor(selectedRows, hasMore),
  });
}

async function loadPostsListRepository(input: {
  anonymousDeviceId?: string;
  limit?: number;
  cursor?: string;
  location?: PostLocation;
}) {
  if (!hasSupabaseServerConfig()) {
    return getMockPostListState();
  }

  const preparedLoad = await prepareFeedLoad({
    scope: "nearby",
    anonymousDeviceId: input.anonymousDeviceId,
    limit: input.limit,
    cursor: input.cursor,
    location: input.location,
  });
  const sort: PostListState["sort"] = input.location ? "distance" : "latest";
  const rpcState = buildNearbyRpcPostListState({
    preparedLoad,
    anonymousDeviceId: input.anonymousDeviceId,
    sort,
  });

  if (rpcState) {
    return rpcState;
  }

  if (preparedLoad.fallbackReason) {
    logFeedFallbackMetrics({
      metricsContext: preparedLoad.metricsContext,
      fallbackReason: preparedLoad.fallbackReason,
      rpcDurationMs: preparedLoad.rpcResult.durationMs,
    });
  }

  return loadLegacyNearbyPostListState({
    preparedLoad,
    anonymousDeviceId: input.anonymousDeviceId,
    location: input.location,
    sort,
  });
}

async function syncNearbyFeedRepository(input: {
  anonymousDeviceId?: string;
  loadedPostIds?: string[];
  limit?: number;
  location: PostLocation;
}) {
  const limit = clampFeedLimit(input.limit ?? input.loadedPostIds?.length);
  const snapshot = await loadPostsListRepository({
    anonymousDeviceId: input.anonymousDeviceId,
    limit,
    location: input.location,
  });
  const loadedPostIdSet = new Set(input.loadedPostIds ?? []);

  return {
    items: snapshot.items,
    nextCursor: snapshot.nextCursor,
    newItemsCount: snapshot.items.filter((item) => !loadedPostIdSet.has(item.id))
      .length,
  };
}

async function loadPostEngagementSnapshotRepository(input: {
  anonymousDeviceId?: string;
  postIds?: string[];
}) {
  const requestedPostIds = Array.from(
    new Set((input.postIds ?? []).filter((postId) => isUuid(postId))),
  ).slice(0, 50);

  if (requestedPostIds.length === 0) {
    return {
      items: [] as Array<{
        id: string;
        agreeCount: number;
        myAgree: boolean;
      }>,
    };
  }

  if (!hasSupabaseServerConfig()) {
    const itemMap = new Map(
      getMockPostListState().items.map((item) => [item.id, item]),
    );

    return {
      items: requestedPostIds
        .map((postId) => {
          const item = itemMap.get(postId);

          if (!item) {
            return null;
          }

          return {
            id: postId,
            agreeCount: item.agreeCount,
            myAgree: item.myAgree,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
    };
  }

  const device = input.anonymousDeviceId
    ? await ensureDeviceIdentity(input.anonymousDeviceId)
    : null;
  const [engagementRows, myReactionRows] = await Promise.all([
    loadEngagementRows(requestedPostIds),
    loadMyAgreeRows(device?.id, requestedPostIds),
  ]);
  const engagementMap = new Map(
    engagementRows.map((row) => [row.post_id, Number(row.agree_count)]),
  );
  const myAgreeSet = new Set(myReactionRows.map((row) => row.post_id));

  return {
    items: requestedPostIds.map((postId) => ({
      id: postId,
      agreeCount: engagementMap.get(postId) ?? 0,
      myAgree: myAgreeSet.has(postId),
    })),
  };
}

async function loadGlobalPostsListRepository(input: {
  limit?: number;
  cursor?: string;
}) {
  if (!hasSupabaseServerConfig()) {
    const mockState = getMockPostListState();

    return createPostListState({
      items: mockState.items,
      nextCursor: mockState.nextCursor,
      sort: "latest" as const,
    });
  }

  const preparedLoad = await prepareFeedLoad({
    scope: "global",
    limit: input.limit,
    cursor: input.cursor,
    decodeCursor: normalizeGlobalFeedCursor,
  });
  const rpcState = buildGlobalRpcPostListState({
    preparedLoad,
  });

  if (rpcState) {
    return rpcState;
  }

  if (preparedLoad.fallbackReason) {
    logFeedFallbackMetrics({
      metricsContext: preparedLoad.metricsContext,
      fallbackReason: preparedLoad.fallbackReason,
      rpcDurationMs: preparedLoad.rpcResult.durationMs,
    });
  }

  return loadLegacyGlobalPostListState({
    rawCursor: input.cursor,
    preparedLoad,
  });
}

export {
  loadGlobalPostsListRepository,
  loadPostEngagementSnapshotRepository,
  loadPostsListRepository,
  syncNearbyFeedRepository,
};
