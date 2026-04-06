"use client";

import { useEffect, useRef, useState } from "react";
import { DongPostsScreen } from "./dong-posts-screen";
import { PostComposeExperience } from "../post/post-compose-experience";
import {
  ensureRegisteredBrowserDevice,
  getOrCreateBrowserAnonymousDeviceId,
} from "../../lib/device/browser-device";
import {
  readCachedAdministrativeLocation,
  writeCachedAdministrativeLocation,
  type AdministrativeLocationSnapshot,
} from "../../lib/geo/browser-administrative-location";
import { quantizeLocationTo100MeterGrid } from "../../lib/geo/location-buckets";
import { getCurrentBrowserCoordinates } from "../../lib/geo/browser-location";
import {
  readCachedNearbyPostList,
  readLatestCachedNearbyPostList,
  writeCachedNearbyPostList,
} from "../../lib/posts/browser-nearby-post-cache";
import {
  uiColors,
  uiRadius,
  uiSpacing,
  uiTypography,
} from "../../lib/ui/tokens";
import type { ApiResponse } from "../../types/api";
import type { AppShellState } from "../../types/device";
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

type ResolveLocationResponse = {
  location: {
    administrativeDongName: string;
    administrativeDongCode: string;
    countryCode: string | null;
  };
};

type PendingFeedSnapshot = {
  items: PostListState["items"];
  nextCursor: string | null;
  newItemsCount: number;
  requestedItemCount: number;
};

const COMPOSE_PLACEHOLDER_DONG_NAME = "우리 동네";

function getPermissionMode(error: unknown): AppShellState["permissionMode"] {
  return error instanceof Error &&
    error.message === "GEOLOCATION_PERMISSION_DENIED"
    ? "denied"
    : "unknown";
}

function isDomesticAdministrativeLocation(location: {
  countryCode: string | null;
}) {
  return location.countryCode === null || location.countryCode === "kr";
}

export type HomeScreenProps = {
  dataSourceMode: "supabase" | "mock";
  initialAppShellState: AppShellState;
  initialPostListState: PostListState;
};

function mergePostItems(
  currentItems: PostListState["items"],
  incomingItems: PostListState["items"],
) {
  const seenPostIds = new Set(currentItems.map((item) => item.id));

  return [
    ...currentItems,
    ...incomingItems.filter((item) => !seenPostIds.has(item.id)),
  ];
}

function patchPostListItems(
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

function updateSinglePostItem(
  items: PostListState["items"],
  targetPostId: string,
  updater: (item: PostListState["items"][number]) => PostListState["items"][number],
) {
  return items.map((item) => (item.id === targetPostId ? updater(item) : item));
}

async function resolveAdministrativeLocation(location: PostLocation) {
  const response = await fetch("/api/location/resolve", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      location,
    }),
  });
  const json = (await response.json()) as ApiResponse<ResolveLocationResponse>;

  if (!response.ok || !json.success || !json.data) {
    throw new Error(json.error?.message ?? "현재 위치를 행정동으로 확인하지 못했습니다.");
  }

  return json.data.location;
}

export function HomeScreen({
  dataSourceMode,
  initialAppShellState,
  initialPostListState,
}: HomeScreenProps) {
  const [appShellState, setAppShellState] = useState(initialAppShellState);
  const [postListState, setPostListState] = useState(initialPostListState);
  const [pendingFeedSnapshot, setPendingFeedSnapshot] =
    useState<PendingFeedSnapshot | null>(null);
  const [composePanelOpen, setComposePanelOpen] = useState(false);
  const [composePermissionDialogOpen, setComposePermissionDialogOpen] =
    useState(false);
  const [activeMenuPostId, setActiveMenuPostId] = useState<string | null>(null);
  const [activeReportPostId, setActiveReportPostId] = useState<string | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [agreePendingPostIds, setAgreePendingPostIds] = useState<string[]>([]);
  const [feedLocation, setFeedLocation] = useState<PostLocation | null>(null);
  const [locationResolving, setLocationResolving] = useState(false);
  const [feedSortMode, setFeedSortMode] = useState<"nearby" | "global">(
    initialPostListState.sort === "latest" || initialAppShellState.readOnlyMode
      ? "global"
      : "nearby",
  );
  const isMountedRef = useRef(true);
  const appShellStateRef = useRef(appShellState);
  const postListStateRef = useRef(postListState);
  const feedLocationRef = useRef(feedLocation);
  const syncInFlightRef = useRef(false);
  const hasInitialGlobalFeed =
    initialPostListState.sort === "latest" && !initialPostListState.loading;

  const currentDongName =
    appShellState.selectedDongName ?? COMPOSE_PLACEHOLDER_DONG_NAME;
  const shouldAnimateComposeDongPlaceholder = true;
  const runtimeNotice =
    dataSourceMode === "mock"
      ? "Supabase 환경변수가 아직 설정되지 않아 샘플 데이터를 보여주고 있어요."
      : null;

  const obscureGlobalFallbackList =
    appShellState.readOnlyMode && feedSortMode === "global";

  useEffect(() => {
    appShellStateRef.current = appShellState;
  }, [appShellState]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    postListStateRef.current = postListState;
  }, [postListState]);

  useEffect(() => {
    feedLocationRef.current = feedLocation;
  }, [feedLocation]);

  function applyAdministrativeLocationState(
    resolvedLocation: AdministrativeLocationSnapshot,
    options?: {
      final?: boolean;
    },
  ) {
    if (!isMountedRef.current) {
      return;
    }

    setAppShellState((current) => ({
      ...current,
      permissionMode: "granted",
      readOnlyMode: false,
      selectedDongCode: resolvedLocation.administrativeDongCode,
      selectedDongName: resolvedLocation.administrativeDongName,
    }));

    if (options?.final) {
      setLocationResolving(false);
    }
  }

  function startAdministrativeLocationResolution(location: PostLocation) {
    void resolveAdministrativeLocation(location)
      .then((resolvedLocation) => {
        if (!isMountedRef.current) {
          return;
        }

        if (!isDomesticAdministrativeLocation(resolvedLocation)) {
          setAppShellState((current) => ({
            ...current,
            selectedDongCode: null,
            selectedDongName: null,
          }));
          setLocationResolving(false);
          return;
        }

        applyAdministrativeLocationState(resolvedLocation, {
          final: true,
        });
        writeCachedAdministrativeLocation(
          location,
          resolvedLocation,
        );
      })
      .catch(() => {
        if (!isMountedRef.current) {
          return;
        }

        setLocationResolving(false);
      });
  }

  async function hydrateHomeLocationFromCoordinates(location: PostLocation) {
    if (!isMountedRef.current) {
      return;
    }

    setFeedLocation(location);
    setAppShellState((current) => ({
      ...current,
      permissionMode: "granted",
      readOnlyMode: false,
      selectedDongCode: null,
      selectedDongName: null,
    }));
    setLocationResolving(true);

    const cachedAdministrativeLocation =
      readCachedAdministrativeLocation(location);

    if (cachedAdministrativeLocation) {
      applyAdministrativeLocationState(cachedAdministrativeLocation);
    }

    const cachedNearbyPostList = readCachedNearbyPostList(location);

    if (cachedNearbyPostList) {
      setPendingFeedSnapshot(null);
      setFeedSortMode("nearby");
      setPostListState((current) => ({
        ...current,
        items: cachedNearbyPostList.items,
        nextCursor: cachedNearbyPostList.nextCursor,
        loading: false,
        loadingMore: false,
        empty: cachedNearbyPostList.items.length === 0,
        errorMessage: null,
        sort: "distance",
      }));
    }

    startAdministrativeLocationResolution(location);
  }

  async function fetchNearbyPostsList(
    location: PostLocation,
    cursor?: string | null,
  ) {
    const quantizedLocation = quantizeLocationTo100MeterGrid(location);
    const params = new URLSearchParams({
      limit: "10",
      latitudeBucket100m: String(quantizedLocation.latitudeBucket100m),
      longitudeBucket100m: String(quantizedLocation.longitudeBucket100m),
    });

    if (cursor) {
      params.set("cursor", cursor);
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

  async function fetchNearbyFeedSync(
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

  async function fetchGlobalPostsList(cursor?: string | null) {
    const params = new URLSearchParams({
      limit: "10",
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

  useEffect(() => {
    let cancelled = false;

    async function bootstrapDeviceAndPosts() {
      try {
        const anonymousDeviceId = getOrCreateBrowserAnonymousDeviceId();

        if (!anonymousDeviceId) {
          throw new Error("브라우저에서 디바이스를 준비하지 못했습니다.");
        }

        if (cancelled) {
          return;
        }

        setAppShellState((current) => ({
          ...current,
          anonymousDeviceId,
          deviceReady: true,
        }));

        void ensureRegisteredBrowserDevice().catch(() => undefined);

        const latestCachedNearbyPostList =
          dataSourceMode === "supabase" ? readLatestCachedNearbyPostList() : null;

        if (latestCachedNearbyPostList) {
          setPendingFeedSnapshot(null);
          setFeedSortMode("nearby");
          setLocationResolving(true);
          setPostListState((current) => ({
            ...current,
            items: latestCachedNearbyPostList.items,
            nextCursor: null,
            loading: false,
            loadingMore: false,
            empty: latestCachedNearbyPostList.items.length === 0,
            errorMessage: null,
            sort: "distance",
          }));

        }

        let resolvedCoordinates: PostLocation | undefined;

        try {
          resolvedCoordinates = await getCurrentBrowserCoordinates();

          if (cancelled) {
            return;
          }

          setFeedLocation(resolvedCoordinates);
          setAppShellState((current) => ({
            ...current,
            permissionMode: "granted",
            readOnlyMode: false,
            selectedDongCode: null,
            selectedDongName: null,
          }));
          setLocationResolving(true);

          const cachedAdministrativeLocation =
            readCachedAdministrativeLocation(resolvedCoordinates);

          if (cachedAdministrativeLocation) {
            applyAdministrativeLocationState(cachedAdministrativeLocation);
          }

          const cachedNearbyPostList = readCachedNearbyPostList(resolvedCoordinates);

          if (cachedNearbyPostList) {
            setPendingFeedSnapshot(null);
            setFeedSortMode("nearby");
            setPostListState((current) => ({
              ...current,
              items: cachedNearbyPostList.items,
              nextCursor: cachedNearbyPostList.nextCursor,
              loading: false,
              loadingMore: false,
              empty: cachedNearbyPostList.items.length === 0,
              errorMessage: null,
              sort: "distance",
            }));
          }

          startAdministrativeLocationResolution(resolvedCoordinates);
        } catch (error) {
          if (!cancelled) {
            const permissionMode = getPermissionMode(error);
            setFeedLocation(null);
            setLocationResolving(false);
            setAppShellState((current) => ({
              ...current,
              permissionMode,
              readOnlyMode: permissionMode === "denied",
              selectedDongCode: null,
              selectedDongName: null,
            }));

            if (latestCachedNearbyPostList && hasInitialGlobalFeed) {
              setFeedSortMode("global");
              setPostListState(initialPostListState);
            }
          }
        }

        if (dataSourceMode !== "supabase") {
          return;
        }

        const shouldFetchGlobalFeed = !resolvedCoordinates && !hasInitialGlobalFeed;
        const data = resolvedCoordinates
          ? await fetchNearbyPostsList(resolvedCoordinates)
          : shouldFetchGlobalFeed
            ? await fetchGlobalPostsList()
            : null;

        if (cancelled) {
          return;
        }

        setFeedSortMode(resolvedCoordinates ? "nearby" : "global");

        if (!data) {
          setPostListState((current) => ({
            ...current,
            loading: false,
            loadingMore: false,
            empty: current.items.length === 0,
            errorMessage: null,
          }));
          return;
        }

        setPendingFeedSnapshot(null);
        setPostListState((current) => ({
          ...current,
          items: data.items,
          nextCursor: data.nextCursor,
          loading: false,
          loadingMore: false,
          empty: data.items.length === 0,
          errorMessage: null,
          sort: resolvedCoordinates ? "distance" : "latest",
        }));
      } catch (error) {
        if (cancelled) {
          return;
        }

        setPostListState((current) => ({
          ...current,
          loading: false,
          loadingMore: false,
          errorMessage:
            error instanceof Error
              ? error.message
              : "피드를 불러오지 못했습니다.",
        }));
      }
    }

    void bootstrapDeviceAndPosts();

    return () => {
      cancelled = true;
    };
  }, [dataSourceMode, hasInitialGlobalFeed, initialPostListState]);

  useEffect(() => {
    if (feedSortMode === "nearby") {
      return;
    }

    setPendingFeedSnapshot(null);
  }, [feedSortMode]);

  useEffect(() => {
    if (
      dataSourceMode !== "supabase" ||
      feedSortMode !== "nearby" ||
      !feedLocation
    ) {
      return;
    }

    let cancelled = false;

    async function runNearbyFeedSync() {
      if (
        cancelled ||
        syncInFlightRef.current ||
        typeof document === "undefined" ||
        document.hidden
      ) {
        return;
      }

      const latestLocation = feedLocationRef.current;
      const latestAppShellState = appShellStateRef.current;
      const latestPostListState = postListStateRef.current;

      if (
        !latestLocation ||
        latestAppShellState.readOnlyMode ||
        latestPostListState.loading ||
        latestPostListState.loadingMore
      ) {
        return;
      }

      const loadedPostIds = latestPostListState.items.map((item) => item.id);
      const requestedItemCount = Math.max(loadedPostIds.length, 10);

      syncInFlightRef.current = true;

      try {
        const data = await fetchNearbyFeedSync(
          latestLocation,
          loadedPostIds,
          requestedItemCount,
          latestAppShellState.anonymousDeviceId ?? undefined,
        );

        if (cancelled) {
          return;
        }

        setPostListState((current) => ({
          ...current,
          items: patchPostListItems(current.items, data.items),
        }));

        const currentItemCount = postListStateRef.current.items.length;
        const hasMatchingWindow = currentItemCount === loadedPostIds.length;

        if (currentItemCount === 0 && data.items.length > 0) {
          setPendingFeedSnapshot(null);
          setPostListState((current) => ({
            ...current,
            items: data.items,
            nextCursor: data.nextCursor,
            empty: data.items.length === 0,
            errorMessage: null,
            sort: "distance",
          }));
          writeCachedNearbyPostList(latestLocation, {
            items: data.items,
            nextCursor: data.nextCursor,
          });
          return;
        }

        if (data.newItemsCount > 0 && hasMatchingWindow) {
          setPendingFeedSnapshot({
            items: data.items,
            nextCursor: data.nextCursor,
            newItemsCount: data.newItemsCount,
            requestedItemCount,
          });
          return;
        }

        if (data.newItemsCount === 0) {
          setPendingFeedSnapshot(null);
        }
      } catch {
        return;
      } finally {
        syncInFlightRef.current = false;
      }
    }

    void runNearbyFeedSync();

    const intervalId = window.setInterval(() => {
      void runNearbyFeedSync();
    }, 20000);
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void runNearbyFeedSync();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [dataSourceMode, feedLocation, feedSortMode]);

  async function ensureDeviceReady() {
    if (appShellState.anonymousDeviceId) {
      return appShellState.anonymousDeviceId;
    }

    const anonymousDeviceId = await ensureRegisteredBrowserDevice();

    setAppShellState((current) => ({
      ...current,
      anonymousDeviceId,
      deviceReady: true,
    }));

    return anonymousDeviceId;
  }

  async function handleCompose() {
    setActiveMenuPostId(null);
    setActiveReportPostId(null);
    setComposePermissionDialogOpen(false);

    if (!feedLocationRef.current) {
      try {
        const resolvedCoordinates = await getCurrentBrowserCoordinates();
        await hydrateHomeLocationFromCoordinates(resolvedCoordinates);
      } catch (error) {
        const permissionMode = getPermissionMode(error);

        if (isMountedRef.current) {
          setFeedLocation(null);
          setLocationResolving(false);
          setAppShellState((current) => ({
            ...current,
            permissionMode,
            readOnlyMode: permissionMode === "denied",
            selectedDongCode: null,
            selectedDongName: null,
          }));
          setComposePermissionDialogOpen(true);
        }

        return;
      }
    }

    if (isMountedRef.current) {
      setComposePanelOpen(true);
    }
  }

  function handleCloseComposePanel() {
    setComposePanelOpen(false);
  }

  function handleCloseComposePermissionDialog() {
    setComposePermissionDialogOpen(false);
  }

  async function handleComposeSuccess() {
    setComposePanelOpen(false);
    setPendingFeedSnapshot(null);

    if (dataSourceMode !== "supabase") {
      return;
    }

    try {
      const latestLocation = feedLocationRef.current;
      const data = latestLocation
        ? await fetchNearbyPostsList(latestLocation)
        : await fetchGlobalPostsList();

      setFeedSortMode(latestLocation ? "nearby" : "global");
      setPostListState((current) => ({
        ...current,
        items: data.items,
        nextCursor: data.nextCursor,
        loading: false,
        loadingMore: false,
        empty: data.items.length === 0,
        errorMessage: null,
        sort: latestLocation ? "distance" : "latest",
      }));
    } catch (error) {
      setPostListState((current) => ({
        ...current,
        errorMessage:
          error instanceof Error
            ? error.message
            : "등록 후 목록을 새로고침하지 못했습니다.",
      }));
    }
  }

  function handleApplyPendingFeedSnapshot() {
    if (!pendingFeedSnapshot || !feedLocation) {
      return;
    }

    const currentState = postListStateRef.current;

    if (currentState.items.length !== pendingFeedSnapshot.requestedItemCount) {
      setPendingFeedSnapshot(null);
      return;
    }

    const currentPostIdSet = new Set(currentState.items.map((item) => item.id));
    const appendedNewItems = pendingFeedSnapshot.items.filter(
      (item) => !currentPostIdSet.has(item.id),
    );
    const mergedItems = [
      ...patchPostListItems(currentState.items, pendingFeedSnapshot.items),
      ...appendedNewItems,
    ];

    setPostListState((current) => {
      if (current.items.length !== pendingFeedSnapshot.requestedItemCount) {
        return current;
      }

      return {
        ...current,
        items: mergedItems,
        nextCursor: current.nextCursor,
        empty: mergedItems.length === 0,
        errorMessage: null,
        sort: "distance",
      };
    });
    writeCachedNearbyPostList(feedLocation, {
      items: mergedItems,
      nextCursor: currentState.nextCursor,
    });
    setPendingFeedSnapshot(null);
  }

  async function handleLoadMore() {
    if (
      dataSourceMode !== "supabase" ||
      postListState.loading ||
      postListState.loadingMore ||
      !postListState.nextCursor
    ) {
      return;
    }

    try {
      setPendingFeedSnapshot(null);
      setPostListState((current) => ({
        ...current,
        loadingMore: true,
        errorMessage: null,
      }));

      setFeedSortMode(feedLocation ? "nearby" : "global");
      const data = feedLocation
        ? await fetchNearbyPostsList(feedLocation, postListState.nextCursor)
        : await fetchGlobalPostsList(postListState.nextCursor);

      setPostListState((current) => {
        const mergedItems = mergePostItems(current.items, data.items);

        return {
          ...current,
          items: mergedItems,
          nextCursor: data.nextCursor,
          loadingMore: false,
          empty: mergedItems.length === 0,
          errorMessage: null,
          sort: feedLocation ? "distance" : "latest",
        };
      });
    } catch (error) {
      setPostListState((current) => ({
        ...current,
        loadingMore: false,
        errorMessage:
          error instanceof Error
            ? error.message
            : "목록을 더 불러오지 못했습니다.",
      }));
    }
  }

  function handleOpenMenu(postId: string) {
    setActiveMenuPostId((current) => (current === postId ? null : postId));
  }

  function handleCloseMenu() {
    setActiveMenuPostId(null);
  }

  function handleSelectReport(postId: string) {
    setActiveReportPostId(postId);
    setActiveMenuPostId(null);
  }

  function handleCloseReportDialog() {
    if (reportSubmitting) {
      return;
    }

    setActiveReportPostId(null);
  }

  async function handleToggleAgree(targetPostId?: string) {
    if (!targetPostId) {
      return;
    }

    if (agreePendingPostIds.includes(targetPostId)) {
      return;
    }

    const targetItem = postListState.items.find((item) => item.id === targetPostId);

    if (!targetItem) {
      return;
    }

    const optimisticMyAgree = !targetItem.myAgree;
    const optimisticAgreeCount = Math.max(
      0,
      targetItem.agreeCount + (optimisticMyAgree ? 1 : -1),
    );

    try {
      setAgreePendingPostIds((current) => [...current, targetPostId]);
      setPostListState((current) => ({
        ...current,
        errorMessage: null,
        items: updateSinglePostItem(current.items, targetPostId, (item) => ({
          ...item,
          myAgree: optimisticMyAgree,
          agreeCount: optimisticAgreeCount,
        })),
      }));
      setPendingFeedSnapshot((current) =>
        current
          ? {
              ...current,
              items: updateSinglePostItem(current.items, targetPostId, (item) => ({
                ...item,
                myAgree: optimisticMyAgree,
                agreeCount: optimisticAgreeCount,
              })),
            }
          : null,
      );

      const anonymousDeviceId = await ensureDeviceReady();
      const response = await fetch(`/api/posts/${targetPostId}/agree/toggle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          anonymousDeviceId,
        }),
      });
      const json = (await response.json()) as ApiResponse<{
        postId: string;
        agreed: boolean;
        agreeCount: number;
      }>;

      if (!response.ok || !json.success || !json.data) {
        throw new Error(json.error?.message ?? "맞아요 상태를 반영하지 못했습니다.");
      }

      const data = json.data;

      setPostListState((current) => ({
        ...current,
        errorMessage: null,
        items: updateSinglePostItem(current.items, targetPostId, (item) => ({
          ...item,
          myAgree: data.agreed,
          agreeCount: data.agreeCount,
        })),
      }));
      setPendingFeedSnapshot((current) =>
        current
          ? {
              ...current,
              items: updateSinglePostItem(current.items, targetPostId, (item) => ({
                ...item,
                myAgree: data.agreed,
                agreeCount: data.agreeCount,
              })),
            }
          : null,
      );
    } catch (error) {
      setPostListState((current) => ({
        ...current,
        items: updateSinglePostItem(current.items, targetPostId, (item) => ({
          ...item,
          myAgree: targetItem.myAgree,
          agreeCount: targetItem.agreeCount,
        })),
        errorMessage:
          error instanceof Error
            ? error.message
            : "맞아요 상태를 반영하지 못했습니다.",
      }));
      setPendingFeedSnapshot((current) =>
        current
          ? {
              ...current,
              items: updateSinglePostItem(current.items, targetPostId, (item) => ({
                ...item,
                myAgree: targetItem.myAgree,
                agreeCount: targetItem.agreeCount,
              })),
            }
          : null,
      );
    } finally {
      setAgreePendingPostIds((current) =>
        current.filter((postId) => postId !== targetPostId),
      );
    }
  }

  async function handleReport() {
    if (!activeReportPostId) {
      return;
    }

    const postId = activeReportPostId;
    const targetItem = postListState.items.find((item) => item.id === postId);

    if (!targetItem?.canReport) {
      return;
    }

    try {
      const anonymousDeviceId = await ensureDeviceReady();
      setReportSubmitting(true);

      const response = await fetch(`/api/posts/${postId}/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          anonymousDeviceId,
          reasonCode: "other_policy",
        }),
      });
      const json = (await response.json()) as ApiResponse<{
        postId: string;
        reported: boolean;
      }>;

      if (!response.ok || !json.success || !json.data?.reported) {
        throw new Error(json.error?.message ?? "신고를 접수하지 못했습니다.");
      }

      setPostListState((current) => ({
        ...current,
        errorMessage: null,
        items: updateSinglePostItem(current.items, postId, (item) => ({
          ...item,
          canReport: false,
        })),
      }));
      setPendingFeedSnapshot((current) =>
        current
          ? {
              ...current,
              items: updateSinglePostItem(current.items, postId, (item) => ({
                ...item,
                canReport: false,
              })),
            }
          : null,
      );
      setActiveReportPostId(null);
    } catch (error) {
      setPostListState((current) => ({
        ...current,
        errorMessage:
          error instanceof Error
            ? error.message
            : "신고를 접수하지 못했습니다.",
      }));
    } finally {
      setReportSubmitting(false);
    }
  }

  return (
    <div
      style={{
        background: "#f7f4ec",
        height: "100dvh",
        overflow: "hidden",
        position: "relative",
        width: "100%",
      }}
    >
      <DongPostsScreen
        activeMenuPostId={activeMenuPostId}
        activeReportPostId={activeReportPostId}
        animateComposeDongPlaceholder={shouldAnimateComposeDongPlaceholder}
        currentDongName={currentDongName}
        onApplyPendingUpdates={handleApplyPendingFeedSnapshot}
        onCloseMenu={handleCloseMenu}
        onCloseReportDialog={handleCloseReportDialog}
        onCompose={handleCompose}
        onConfirmReport={handleReport}
        onLoadMore={handleLoadMore}
        onOpenMenu={handleOpenMenu}
        obscurePosts={obscureGlobalFallbackList}
        onSelectReport={handleSelectReport}
        onToggleAgree={handleToggleAgree}
        pendingNewItemsCount={pendingFeedSnapshot?.newItemsCount ?? 0}
        reportSubmitting={reportSubmitting}
        runtimeNotice={runtimeNotice}
        state={postListState}
      />
      {composePanelOpen ? (
        <PostComposeExperience
          dataSourceMode={dataSourceMode}
          onDismiss={handleCloseComposePanel}
          onSuccess={handleComposeSuccess}
          presentation="sheet"
        />
      ) : null}
      {composePermissionDialogOpen ? (
        <div
          aria-modal="true"
          role="dialog"
          style={{
            alignItems: "center",
            background: "rgba(17, 24, 39, 0.28)",
            display: "flex",
            inset: 0,
            justifyContent: "center",
            padding: uiSpacing.pageX,
            position: "absolute",
            zIndex: 14,
          }}
        >
          <section
            style={{
              background: "#fffdfa",
              borderRadius: uiRadius.lg,
              boxShadow: "0 18px 38px rgba(17, 24, 39, 0.18)",
              display: "flex",
              flexDirection: "column",
              gap: uiSpacing.xl,
              maxWidth: "320px",
              padding: uiSpacing.xl,
              width: "100%",
            }}
          >
            <p
              style={{
                color: uiColors.textStrong,
                fontSize: "14px",
                fontWeight: 600,
                lineHeight: 1.6,
                margin: 0,
                textAlign: "center",
              }}
            >
              글을 작성하려면 권한 허용이 필요해요.
            </p>
            <div
              style={{
                display: "grid",
                gap: uiSpacing.sm,
                gridTemplateColumns: "1fr 1fr",
              }}
            >
              <button
                onClick={handleCloseComposePermissionDialog}
                style={{
                  background: "#ffffff",
                  border: `1px solid ${uiColors.border}`,
                  borderRadius: uiRadius.pill,
                  color: uiColors.textStrong,
                  cursor: "pointer",
                  fontSize: uiTypography.body.fontSize,
                  fontWeight: 600,
                  padding: `${uiSpacing.sm} ${uiSpacing.lg}`,
                }}
                type="button"
              >
                닫기
              </button>
              <button
                onClick={() => {
                  setComposePermissionDialogOpen(false);
                  void handleCompose();
                }}
                style={{
                  background: "#ffffff",
                  border: `1px solid ${uiColors.border}`,
                  borderRadius: uiRadius.pill,
                  color: uiColors.textStrong,
                  cursor: "pointer",
                  fontSize: uiTypography.body.fontSize,
                  fontWeight: 600,
                  padding: `${uiSpacing.sm} ${uiSpacing.lg}`,
                }}
                type="button"
              >
                재시도
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
