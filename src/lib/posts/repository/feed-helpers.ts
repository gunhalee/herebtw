import type { PostListState, PostLocation } from "../../../types/post";
import { formatRelativeTime } from "../../utils/datetime";
import {
  FEED_RPC_DISTANCE_FALLBACK_METERS,
  isUuid,
} from "./shared";
import type {
  FeedFallbackReason,
  FeedScope,
  GlobalPostListCursor,
  NearbyPostRow,
  PostEngagementRow,
  PostListCursor,
  PostRow,
  ReactionRow,
} from "./types";

type FeedMetricsContext = {
  scope: FeedScope;
  limit: number;
  hasCursor: boolean;
  hasViewerLocation: boolean;
  hasAnonymousDeviceId: boolean;
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function hasStoredCoordinates(post: Pick<PostRow, "latitude" | "longitude">) {
  return (
    typeof post.latitude === "number" &&
    Number.isFinite(post.latitude) &&
    typeof post.longitude === "number" &&
    Number.isFinite(post.longitude)
  );
}

function calculateDistanceMeters(from: PostLocation, to: PostLocation) {
  const earthRadiusMeters = 6371000;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return Math.round(
    2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)),
  );
}

function estimateDistanceMeters(
  post: Pick<PostRow, "latitude" | "longitude">,
  viewerLocation?: PostLocation,
) {
  if (!viewerLocation || !hasStoredCoordinates(post)) {
    return Number.MAX_SAFE_INTEGER;
  }

  return calculateDistanceMeters(viewerLocation, {
    latitude: post.latitude!,
    longitude: post.longitude!,
  });
}

function getPostDistanceMeters(
  post: Pick<PostRow, "latitude" | "longitude"> & {
    distance_meters?: number | null;
  },
  viewerLocation?: PostLocation,
) {
  if (typeof post.distance_meters === "number" && Number.isFinite(post.distance_meters)) {
    return post.distance_meters;
  }

  return estimateDistanceMeters(post, viewerLocation);
}

function encodePostListCursor(post: NearbyPostRow) {
  const payload: PostListCursor = {
    distanceMeters: post.distance_meters,
    createdAt: post.created_at,
    postId: post.id,
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePostListCursor(cursor: string | undefined) {
  if (!cursor) {
    return null;
  }

  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const payload = JSON.parse(decoded) as Partial<PostListCursor>;

    if (
      typeof payload.distanceMeters !== "number" ||
      !Number.isFinite(payload.distanceMeters) ||
      typeof payload.createdAt !== "string" ||
      !payload.createdAt ||
      typeof payload.postId !== "string" ||
      !isUuid(payload.postId)
    ) {
      return null;
    }

    return payload as PostListCursor;
  } catch {
    return null;
  }
}

function encodeGlobalPostListCursor(post: Pick<PostRow, "id" | "created_at">) {
  const payload: GlobalPostListCursor = {
    createdAt: post.created_at,
    postId: post.id,
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeGlobalPostListCursor(cursor: string | undefined) {
  if (!cursor) {
    return null;
  }

  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const payload = JSON.parse(decoded) as Partial<GlobalPostListCursor>;

    if (
      typeof payload.createdAt !== "string" ||
      !payload.createdAt ||
      typeof payload.postId !== "string" ||
      !isUuid(payload.postId)
    ) {
      return null;
    }

    return payload as GlobalPostListCursor;
  } catch {
    return null;
  }
}

function buildFeedMetricsContext(input: {
  scope: FeedScope;
  anonymousDeviceId?: string;
  cursor: PostListCursor | null;
  limit: number;
  location?: PostLocation;
}): FeedMetricsContext {
  return {
    scope: input.scope,
    limit: input.limit,
    hasCursor: Boolean(input.cursor),
    hasViewerLocation: Boolean(input.location),
    hasAnonymousDeviceId: Boolean(input.anonymousDeviceId),
  };
}

function clampFeedLimit(limit?: number) {
  return Math.min(Math.max(limit ?? 10, 1), 50);
}

function sliceFeedRows<T>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;

  return {
    hasMore,
    selectedRows: hasMore ? rows.slice(0, limit) : rows,
  };
}

function createPostListState(input: {
  items: PostListState["items"];
  nextCursor: string | null;
  sort: PostListState["sort"];
}): PostListState {
  return {
    items: input.items,
    nextCursor: input.nextCursor,
    loading: false,
    loadingMore: false,
    empty: input.items.length === 0,
    errorMessage: null,
    sort: input.sort,
  };
}

function logFeedMetrics(
  level: "info" | "warn" | "error",
  event: string,
  payload: Record<string, unknown>,
) {
  const prefix = `[posts-feed] ${event}`;

  if (level === "warn") {
    console.warn(prefix, payload);
    return;
  }

  if (level === "error") {
    console.error(prefix, payload);
    return;
  }

  console.info(prefix, payload);
}

function logLoadedFeedMetrics(input: {
  metricsContext: FeedMetricsContext;
  path: "rpc" | "legacy";
  itemCount: number;
  hasMore: boolean;
  rpcDurationMs: number;
  totalDurationMs: number;
}) {
  logFeedMetrics("info", "load_posts_list", {
    ...input.metricsContext,
    path: input.path,
    itemCount: input.itemCount,
    hasMore: input.hasMore,
    rpcDurationMs: input.rpcDurationMs,
    totalDurationMs: input.totalDurationMs,
  });
}

function logFeedFallbackMetrics(input: {
  metricsContext: FeedMetricsContext;
  fallbackReason: FeedFallbackReason;
  rpcDurationMs: number;
}) {
  logFeedMetrics("warn", "legacy_fallback", {
    ...input.metricsContext,
    fallbackReason: input.fallbackReason,
    rpcDurationMs: input.rpcDurationMs,
  });
}

function isFeedRpcRow(row: NearbyPostRow) {
  return (
    typeof row.agree_count === "number" &&
    typeof row.my_agree === "boolean" &&
    typeof row.can_report === "boolean"
  );
}

function getFeedRpcFallbackReason(
  rows: NearbyPostRow[] | null,
  fallbackReason: FeedFallbackReason | null,
) {
  return (
    fallbackReason ??
    (rows && rows.length > 0 && !isFeedRpcRow(rows[0]!)
      ? "unexpected_rpc_shape"
      : null)
  );
}

function shouldFallbackToLegacyFeedRpc(error: unknown) {
  return (
    error instanceof Error &&
    /list_posts_feed/i.test(error.message) &&
    /(404|Could not find the function|PGRST)/i.test(error.message)
  );
}

function buildPostListItems(
  posts: Array<
    Pick<PostRow, "id" | "content" | "administrative_dong_name" | "created_at" | "latitude" | "longitude"> & {
      distance_meters?: number | null;
    }
  >,
  options?: {
    viewerLocation?: PostLocation;
    engagementRows?: PostEngagementRow[];
    myReactionRows?: ReactionRow[];
    canReport?: boolean;
    distanceMetersOverride?: number;
  },
) {
  const engagementMap = new Map(
    (options?.engagementRows ?? []).map((row) => [row.post_id, Number(row.agree_count)]),
  );
  const myReactionSet = new Set(
    (options?.myReactionRows ?? []).map((row) => row.post_id),
  );

  return posts.map((post) => ({
    id: post.id,
    content: post.content,
    administrativeDongName: post.administrative_dong_name,
    distanceMeters:
      options?.distanceMetersOverride ??
      getPostDistanceMeters(post, options?.viewerLocation),
    relativeTime: formatRelativeTime(post.created_at),
    agreeCount: engagementMap.get(post.id) ?? 0,
    myAgree: myReactionSet.has(post.id),
    canReport: options?.canReport ?? true,
    isHighlighted: false,
  }));
}

function buildRpcPostListItems(
  posts: NearbyPostRow[],
  options?: {
    myAgree?: boolean;
    canReport?: boolean;
    fallbackCanReport?: boolean;
    distanceMetersOverride?: number;
  },
) {
  return posts.map((post) => ({
    id: post.id,
    content: post.content,
    administrativeDongName: post.administrative_dong_name,
    distanceMeters: options?.distanceMetersOverride ?? post.distance_meters,
    relativeTime: formatRelativeTime(post.created_at),
    agreeCount: post.agree_count ?? 0,
    myAgree: options?.myAgree ?? post.my_agree ?? false,
    canReport:
      options?.canReport ??
      post.can_report ??
      options?.fallbackCanReport ??
      true,
    isHighlighted: false,
  }));
}

function getNextNearbyFeedCursor(posts: NearbyPostRow[], hasMore: boolean) {
  if (!hasMore || posts.length === 0) {
    return null;
  }

  return encodePostListCursor(posts[posts.length - 1]!);
}

function getNextGlobalFeedCursor(
  posts: Array<Pick<PostRow, "id" | "created_at">>,
  hasMore: boolean,
) {
  if (!hasMore || posts.length === 0) {
    return null;
  }

  return encodeGlobalPostListCursor(posts[posts.length - 1]!);
}

function normalizeGlobalFeedCursor(cursor: string | undefined) {
  return (
    decodePostListCursor(cursor) ??
    (() => {
      const legacyCursor = decodeGlobalPostListCursor(cursor);

      if (!legacyCursor) {
        return null;
      }

      return {
        distanceMeters: FEED_RPC_DISTANCE_FALLBACK_METERS,
        createdAt: legacyCursor.createdAt,
        postId: legacyCursor.postId,
      } satisfies PostListCursor;
    })()
  );
}

function resolveLegacyGlobalCursor(
  rawCursor: string | undefined,
  cursor: PostListCursor | null,
) {
  return (
    decodeGlobalPostListCursor(rawCursor) ??
    (cursor
      ? {
          createdAt: cursor.createdAt,
          postId: cursor.postId,
        }
      : null)
  );
}

function sliceNearbyRpcRows(
  rows: NearbyPostRow[],
  limit: number,
  filterReportedPosts: boolean,
) {
  const visibleRows = filterReportedPosts
    ? rows.filter((post) => post.can_report !== false)
    : rows;
  const hasMore =
    visibleRows.length > limit ||
    (rows.length > limit && visibleRows.length === limit);

  return {
    hasMore,
    selectedRows: hasMore ? visibleRows.slice(0, limit) : visibleRows,
  };
}

export {
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
};
export type { FeedMetricsContext };
