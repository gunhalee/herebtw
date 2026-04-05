"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DongPostsScreen } from "./dong-posts-screen";
import { ensureRegisteredBrowserDevice } from "../../lib/device/browser-device";
import { getCurrentBrowserCoordinates } from "../../lib/geo/browser-location";
import type { ApiResponse } from "../../types/api";
import type { AppShellState } from "../../types/device";
import type { PostListState } from "../../types/post";

type PostsListResponse = {
  items: PostListState["items"];
  nextCursor: string | null;
};

type ResolveLocationResponse = {
  location: {
    administrativeDongName: string;
    administrativeDongCode: string;
  };
};

function getPermissionMode(error: unknown): AppShellState["permissionMode"] {
  return error instanceof Error &&
    error.message === "GEOLOCATION_PERMISSION_DENIED"
    ? "denied"
    : "unknown";
}

export type HomeScreenProps = {
  dataSourceMode: "supabase" | "mock";
  initialAppShellState: AppShellState;
  initialPostListState: PostListState;
};

export function HomeScreen({
  dataSourceMode,
  initialAppShellState,
  initialPostListState,
}: HomeScreenProps) {
  const router = useRouter();
  const [appShellState, setAppShellState] = useState(initialAppShellState);
  const [postListState, setPostListState] = useState(initialPostListState);
  const [activeMenuPostId, setActiveMenuPostId] = useState<string | null>(null);
  const [activeReportPostId, setActiveReportPostId] = useState<string | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const currentDongName =
    appShellState.selectedDongName ??
    postListState.items[0]?.administrativeDongName ??
    "우리 동네";
  const runtimeNotice =
    dataSourceMode === "mock"
      ? "Supabase 환경변수가 아직 설정되지 않아 샘플 데이터를 보여주고 있어요."
      : null;

  async function fetchPostsList(
    anonymousDeviceId: string,
    location?: {
      latitude: number;
      longitude: number;
    },
  ) {
    const response = await fetch("/api/posts/list", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        anonymousDeviceId,
        location,
        pagination: {
          limit: 10,
        },
      }),
    });
    const json = (await response.json()) as ApiResponse<PostsListResponse>;

    if (!response.ok || !json.success || !json.data) {
      throw new Error(
        json.error?.message ?? "동네 글을 불러오지 못했습니다.",
      );
    }

    return json.data;
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrapDeviceAndPosts() {
      try {
        const anonymousDeviceId = await ensureRegisteredBrowserDevice();

        if (cancelled) {
          return;
        }

        setAppShellState((current) => ({
          ...current,
          anonymousDeviceId,
          deviceReady: true,
        }));

        async function bootstrapLocation() {
          const coordinates = await getCurrentBrowserCoordinates();
          const locationResponse = await fetch("/api/location/resolve", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              location: coordinates,
            }),
          });
          const locationJson =
            (await locationResponse.json()) as ApiResponse<ResolveLocationResponse>;

          if (
            locationResponse.ok &&
            locationJson.success &&
            locationJson.data &&
            !cancelled
          ) {
            const resolvedLocation = locationJson.data.location;

            setAppShellState((current) => ({
              ...current,
              permissionMode: "granted",
              selectedDongCode: resolvedLocation.administrativeDongCode,
              selectedDongName: resolvedLocation.administrativeDongName,
            }));
          }

          return coordinates;
        }

        let resolvedCoordinates:
          | {
              latitude: number;
              longitude: number;
            }
          | undefined;

        try {
          resolvedCoordinates = await bootstrapLocation();
        } catch (error) {
          if (!cancelled) {
            setAppShellState((current) => ({
              ...current,
              permissionMode: getPermissionMode(error),
            }));
          }
        }

        if (dataSourceMode !== "supabase") {
          return;
        }

        const data = await fetchPostsList(anonymousDeviceId, resolvedCoordinates);

        if (cancelled) {
          return;
        }

        setPostListState((current) => ({
          ...current,
          items: data.items,
          nextCursor: data.nextCursor,
          loading: false,
          loadingMore: false,
          empty: data.items.length === 0,
          errorMessage: null,
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
              : "홈 피드를 불러오지 못했습니다.",
        }));
      }
    }

    void bootstrapDeviceAndPosts();

    return () => {
      cancelled = true;
    };
  }, [dataSourceMode]);

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

  function handleCompose() {
    router.push("/write");
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

    try {
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
        throw new Error(
          json.error?.message ?? "공감 상태를 반영하지 못했습니다.",
        );
      }

      const data = json.data;

      setPostListState((current) => ({
        ...current,
        errorMessage: null,
        items: current.items.map((item) =>
          item.id === targetPostId
            ? {
                ...item,
                myAgree: data.agreed,
                agreeCount: data.agreeCount,
              }
            : item,
        ),
      }));
    } catch (error) {
      setPostListState((current) => ({
        ...current,
        errorMessage:
          error instanceof Error
            ? error.message
            : "공감 상태를 반영하지 못했습니다.",
      }));
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
        items: current.items.map((item) =>
          item.id === postId
            ? {
                ...item,
                canReport: false,
              }
            : item,
        ),
      }));
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
        currentDongName={currentDongName}
        onCloseMenu={handleCloseMenu}
        onCloseReportDialog={handleCloseReportDialog}
        onCompose={handleCompose}
        onConfirmReport={handleReport}
        onOpenMenu={handleOpenMenu}
        onSelectReport={handleSelectReport}
        onToggleAgree={handleToggleAgree}
        reportSubmitting={reportSubmitting}
        runtimeNotice={runtimeNotice}
        state={postListState}
      />
    </div>
  );
}
