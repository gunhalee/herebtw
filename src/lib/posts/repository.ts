import type {
  PostComposeState,
  PostListState,
  PostLocation,
} from "../../types/post";
import { quantizeLocationTo100MeterGrid } from "../geo/location-buckets";
import { hasSupabaseServerConfig } from "../supabase/config";
import {
  supabaseInsert,
  supabaseRpc,
  supabaseSelect,
  supabaseUpsert,
} from "../supabase/rest";
import { formatRelativeTime } from "../utils/datetime";
import {
  getMockPostListState,
  toggleMockPostAgree,
} from "./mock-data";

type DeviceIdentityRow = {
  id: string;
  anonymous_device_id: string;
};

type PostRow = {
  id: string;
  content: string;
  administrative_dong_name: string;
  author_device_id?: string;
  latitude?: number | null;
  longitude?: number | null;
  latitude_bucket_100m?: number | null;
  longitude_bucket_100m?: number | null;
  created_at: string;
  delete_expires_at: string;
};

const FEED_RPC_DISTANCE_FALLBACK_METERS = 2147483647;

type NearbyPostRow = PostRow & {
  distance_meters: number;
  agree_count?: number;
  my_agree?: boolean;
  can_report?: boolean;
};

type FeedScope = "nearby" | "global";

type FeedFallbackReason = "missing_rpc" | "unexpected_rpc_shape";

type PostListCursor = {
  distanceMeters: number;
  createdAt: string;
  postId: string;
};

type GlobalPostListCursor = {
  createdAt: string;
  postId: string;
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

type PostEngagementRow = {
  post_id: string;
  agree_count: number;
};

type ReactionRow = {
  id: string;
  post_id: string;
  device_id: string;
  reaction_type: string;
};

type ReportRow = {
  id: string;
  post_id: string;
  reporter_device_id: string;
  reason_code: string;
};

type ToggleAgreeRpcRow = {
  agreed: boolean;
  agree_count: number;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function ensureDeviceIdentity(anonymousDeviceId: string) {
  const rows = await supabaseUpsert<DeviceIdentityRow[]>(
    "device_identities?on_conflict=anonymous_device_id&select=id,anonymous_device_id",
    {
      anonymous_device_id: anonymousDeviceId,
    },
  );

  return rows?.[0] ?? null;
}

function buildInFilter(values: string[]) {
  return values.map((value) => `"${value}"`).join(",");
}

function getMonotonicTimeMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
}

function getElapsedTimeMs(startedAtMs: number) {
  return Math.round(getMonotonicTimeMs() - startedAtMs);
}

function buildFeedMetricsContext(input: {
  scope: FeedScope;
  anonymousDeviceId?: string;
  cursor: PostListCursor | null;
  limit: number;
  location?: PostLocation;
}) {
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
    distanceMeters: getPostDistanceMeters(post, options?.viewerLocation),
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
  },
) {
  return posts.map((post) => ({
    id: post.id,
    content: post.content,
    administrativeDongName: post.administrative_dong_name,
    distanceMeters: post.distance_meters,
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

export async function loadPostsListRepository(input: {
  anonymousDeviceId?: string;
  limit?: number;
  cursor?: string;
  location?: PostLocation;
}) {
  if (!hasSupabaseServerConfig()) {
    return getMockPostListState();
  }

  const startedAtMs = getMonotonicTimeMs();
  const limit = clampFeedLimit(input.limit);
  const cursor = decodePostListCursor(input.cursor);
  const sort: PostListState["sort"] = input.location ? "distance" : "latest";
  const metricsContext = buildFeedMetricsContext({
    scope: "nearby",
    anonymousDeviceId: input.anonymousDeviceId,
    cursor,
    limit,
    location: input.location,
  });
  const rpcResult = await loadPostsFeedRpc({
    scope: "nearby",
    anonymousDeviceId: input.anonymousDeviceId,
    limit,
    cursor,
    location: input.location,
  });
  const rpcPosts = rpcResult.rows;
  const fallbackReason = getFeedRpcFallbackReason(
    rpcPosts,
    rpcResult.fallbackReason,
  );

  if (rpcPosts && !fallbackReason) {
    const visibleRpcPosts = input.anonymousDeviceId
      ? rpcPosts.filter((post) => post.can_report !== false)
      : rpcPosts;
    const hasMore =
      visibleRpcPosts.length > limit ||
      (rpcPosts.length > limit && visibleRpcPosts.length === limit);
    const selectedPosts = hasMore
      ? visibleRpcPosts.slice(0, limit)
      : visibleRpcPosts;
    const items = buildRpcPostListItems(selectedPosts, {
      fallbackCanReport: Boolean(input.anonymousDeviceId),
    });

    logFeedMetrics("info", "load_posts_list", {
      ...metricsContext,
      path: "rpc",
      itemCount: items.length,
      hasMore,
      rpcDurationMs: rpcResult.durationMs,
      totalDurationMs: getElapsedTimeMs(startedAtMs),
    });

    return createPostListState({
      items,
      nextCursor: getNextNearbyFeedCursor(selectedPosts, hasMore),
      sort,
    });
  }

  if (fallbackReason) {
    logFeedMetrics("warn", "legacy_fallback", {
      ...metricsContext,
      fallbackReason,
      rpcDurationMs: rpcResult.durationMs,
    });
  }

  const device = input.anonymousDeviceId
    ? await ensureDeviceIdentity(input.anonymousDeviceId)
    : null;
  const posts =
    (await supabaseRpc<NearbyPostRow[]>("list_nearby_posts", {
      viewer_latitude: input.location?.latitude ?? null,
      viewer_longitude: input.location?.longitude ?? null,
      cursor_distance_meters: cursor?.distanceMeters ?? null,
      cursor_created_at: cursor?.createdAt ?? null,
      cursor_post_id: cursor?.postId ?? null,
      result_limit: limit + 1,
    })) ?? [];
  const hasMore = posts.length > limit;
  const selectedPosts = hasMore ? posts.slice(0, limit) : posts;
  const postIds = selectedPosts.map((post) => post.id);
  const [engagementRows, myReactionRows, myReportRows] = await Promise.all([
    loadEngagementRows(postIds),
    loadMyAgreeRows(device?.id, postIds),
    loadMyReportRows(device?.id, postIds),
  ]);
  const reportedPostIdSet = new Set(myReportRows.map((row) => row.post_id));
  const visiblePosts = selectedPosts.filter((post) => !reportedPostIdSet.has(post.id));
  const visiblePostIdSet = new Set(visiblePosts.map((post) => post.id));
  const items = buildPostListItems(visiblePosts, {
    viewerLocation: input.location,
    engagementRows: engagementRows.filter((row) => visiblePostIdSet.has(row.post_id)),
    myReactionRows: myReactionRows.filter((row) => visiblePostIdSet.has(row.post_id)),
  });

  logFeedMetrics("info", "load_posts_list", {
    ...metricsContext,
    path: "legacy",
    itemCount: items.length,
    hasMore,
    rpcDurationMs: rpcResult.durationMs,
    totalDurationMs: getElapsedTimeMs(startedAtMs),
  });

  return createPostListState({
    items,
    nextCursor: getNextNearbyFeedCursor(selectedPosts, hasMore),
    sort,
  });
}

export async function syncNearbyFeedRepository(input: {
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

export async function loadPostEngagementSnapshotRepository(input: {
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

export async function loadGlobalPostsListRepository(input: {
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

  const startedAtMs = getMonotonicTimeMs();
  const limit = clampFeedLimit(input.limit);
  const cursor = normalizeGlobalFeedCursor(input.cursor);
  const metricsContext = buildFeedMetricsContext({
    scope: "global",
    cursor,
    limit,
  });
  const rpcResult = await loadPostsFeedRpc({
    scope: "global",
    limit,
    cursor,
  });
  const rpcPosts = rpcResult.rows;
  const fallbackReason = getFeedRpcFallbackReason(
    rpcPosts,
    rpcResult.fallbackReason,
  );

  if (rpcPosts && !fallbackReason) {
    const hasMore = rpcPosts.length > limit;
    const selectedPosts = hasMore ? rpcPosts.slice(0, limit) : rpcPosts;
    const items = buildRpcPostListItems(selectedPosts, {
      myAgree: false,
      canReport: false,
    });

    logFeedMetrics("info", "load_posts_list", {
      ...metricsContext,
      path: "rpc",
      itemCount: items.length,
      hasMore,
      rpcDurationMs: rpcResult.durationMs,
      totalDurationMs: getElapsedTimeMs(startedAtMs),
    });

    return createPostListState({
      items,
      nextCursor: getNextNearbyFeedCursor(selectedPosts, hasMore),
      sort: "latest" as const,
    });
  }

  if (fallbackReason) {
    logFeedMetrics("warn", "legacy_fallback", {
      ...metricsContext,
      fallbackReason,
      rpcDurationMs: rpcResult.durationMs,
    });
  }

  const legacyCursor = resolveLegacyGlobalCursor(input.cursor, cursor);
  const cursorFilter = legacyCursor
    ? `&or=(created_at.lt.${encodeURIComponent(legacyCursor.createdAt)},and(created_at.eq.${encodeURIComponent(legacyCursor.createdAt)},id.gt.${legacyCursor.postId}))`
    : "";
  const posts =
    (await supabaseSelect<PostRow[]>(
      `posts?select=id,content,administrative_dong_name,created_at,delete_expires_at,latitude,longitude&status=eq.active&order=created_at.desc&order=id.asc&limit=${limit + 1}${cursorFilter}`,
    )) ?? [];
  const hasMore = posts.length > limit;
  const selectedPosts = hasMore ? posts.slice(0, limit) : posts;
  const postIds = selectedPosts.map((post) => post.id);
  const engagementRows = await loadEngagementRows(postIds);
  const items = buildPostListItems(selectedPosts, {
    engagementRows,
    canReport: false,
  });

  logFeedMetrics("info", "load_posts_list", {
    ...metricsContext,
    path: "legacy",
    itemCount: items.length,
    hasMore,
    rpcDurationMs: rpcResult.durationMs,
    totalDurationMs: getElapsedTimeMs(startedAtMs),
  });

  return createPostListState({
    items,
    nextCursor: getNextGlobalFeedCursor(selectedPosts, hasMore),
    sort: "latest" as const,
  });
}

export async function syncDeviceRepository(anonymousDeviceId: string) {
  if (!hasSupabaseServerConfig()) {
    return {
      mode: "mock" as const,
      device: {
        id: "device_uuid_mock",
        anonymous_device_id: anonymousDeviceId,
      },
    };
  }

  const device = await ensureDeviceIdentity(anonymousDeviceId);

  return {
    mode: "supabase" as const,
    device,
  };
}

export async function createPostRepository(
  state: PostComposeState,
  location: PostLocation,
  anonymousDeviceId?: string,
) {
  if (!hasSupabaseServerConfig() || !anonymousDeviceId) {
    return {
      mode: "mock" as const,
      state,
    };
  }

  const device = await ensureDeviceIdentity(anonymousDeviceId);

  if (!device) {
    throw new Error("Failed to ensure device identity.");
  }

  const quantizedLocation = quantizeLocationTo100MeterGrid(location);
  const rows = await supabaseInsert<PostRow[]>(
    "posts?select=id,content,administrative_dong_name,created_at,delete_expires_at",
    {
      author_device_id: device.id,
      content: state.content.trim(),
      administrative_dong_name: state.resolvedDongName,
      administrative_dong_code: state.resolvedDongCode,
      latitude: quantizedLocation.latitude,
      longitude: quantizedLocation.longitude,
      latitude_bucket_100m: quantizedLocation.latitudeBucket100m,
      longitude_bucket_100m: quantizedLocation.longitudeBucket100m,
    },
  );

  return {
    mode: "supabase" as const,
    state,
    post: rows?.[0] ?? null,
  };
}

export async function toggleAgreeRepository(
  postId: string,
  anonymousDeviceId?: string,
) {
  if (!hasSupabaseServerConfig() || !anonymousDeviceId) {
    return {
      mode: "mock" as const,
      ...toggleMockPostAgree(postId),
    };
  }

  const rpcRows =
    (await supabaseRpc<ToggleAgreeRpcRow[]>("toggle_post_agree", {
      target_post_id: postId,
      viewer_anonymous_device_id: anonymousDeviceId,
    })) ?? [];
  const rpcRow = rpcRows[0];

  return {
    mode: "supabase" as const,
    postId,
    agreed: Boolean(rpcRow?.agreed),
    agreeCount: Number(rpcRow?.agree_count ?? 0),
  };
}

export async function reportPostRepository(
  postId: string,
  reasonCode: string,
  anonymousDeviceId?: string,
) {
  if (!hasSupabaseServerConfig() || !anonymousDeviceId) {
    return {
      mode: "mock" as const,
      postId,
      reasonCode,
    };
  }

  const device = await ensureDeviceIdentity(anonymousDeviceId);

  if (!device) {
    throw new Error("Failed to ensure device identity.");
  }

  await supabaseUpsert(
    "post_reports?on_conflict=post_id,reporter_device_id&select=id,post_id,reporter_device_id,reason_code",
    {
      post_id: postId,
      reporter_device_id: device.id,
      reason_code: reasonCode,
    },
  );

  return {
    mode: "supabase" as const,
    postId,
    reasonCode,
  };
}
