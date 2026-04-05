"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "../common/page-shell";
import { ensureRegisteredBrowserDevice } from "../../lib/device/browser-device";
import { getCurrentBrowserCoordinates } from "../../lib/geo/browser-location";
import {
  uiColors,
  uiRadius,
  uiSpacing,
  uiTypography,
} from "../../lib/ui/tokens";
import type { ApiResponse } from "../../types/api";
import type { PostComposeState } from "../../types/post";
import { PostComposeForm } from "./post-compose-form";

type ResolvedLocation = {
  latitude: number;
  longitude: number;
  administrativeDongName: string;
  administrativeDongCode: string;
};

type ResolveLocationResponse = {
  location: ResolvedLocation;
};

function createInitialComposeState(): PostComposeState {
  return {
    content: "",
    charCount: 0,
    submitting: false,
    locationResolved: false,
    resolvedDongName: null,
    resolvedDongCode: null,
    resolvedGridCellPath: null,
    cooldownRemainingSeconds: 0,
    duplicateBlocked: false,
    errorMessage: null,
  };
}

function getLocationErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "현재 위치를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.";
  }

  if (error.message === "GEOLOCATION_PERMISSION_DENIED") {
    return "브라우저 위치 권한을 허용하면 이 동네에 글을 남길 수 있어요.";
  }

  if (error.message === "GEOLOCATION_TIMEOUT") {
    return "위치 확인 시간이 초과됐어요. 잠시 후 다시 시도해 주세요.";
  }

  if (error.message === "GEOLOCATION_UNAVAILABLE") {
    return "이 브라우저에서는 위치 확인을 사용할 수 없어요.";
  }

  return "현재 위치를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

type WriteScreenProps = {
  dataSourceMode: "supabase" | "mock";
};

export function WriteScreen({ dataSourceMode }: WriteScreenProps) {
  const router = useRouter();
  const [composeState, setComposeState] = useState(createInitialComposeState);
  const [resolvedLocation, setResolvedLocation] = useState<ResolvedLocation | null>(
    null,
  );
  const [locationStatusText, setLocationStatusText] = useState<string | null>(
    "현재 위치를 확인하는 중이에요.",
  );

  useEffect(() => {
    let cancelled = false;

    async function resolveLocation() {
      try {
        const coordinates = await getCurrentBrowserCoordinates();
        const response = await fetch("/api/location/resolve", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            location: coordinates,
          }),
        });
        const json = (await response.json()) as ApiResponse<ResolveLocationResponse>;

        if (!response.ok || !json.success || !json.data) {
          throw new Error(
            json.error?.message ?? "현재 위치를 확인하지 못했어요.",
          );
        }

        if (cancelled) {
          return;
        }

        const nextLocation = json.data.location;
        setResolvedLocation(nextLocation);
        setLocationStatusText(null);
        setComposeState((current) => ({
          ...current,
          locationResolved: true,
          resolvedDongName: nextLocation.administrativeDongName,
          resolvedDongCode: nextLocation.administrativeDongCode,
          resolvedGridCellPath: null,
          errorMessage: null,
        }));
      } catch (error) {
        if (cancelled) {
          return;
        }

        setResolvedLocation(null);
        setLocationStatusText(getLocationErrorMessage(error));
        setComposeState((current) => ({
          ...current,
          locationResolved: false,
          resolvedDongName: null,
          resolvedDongCode: null,
          resolvedGridCellPath: null,
        }));
      }
    }

    void resolveLocation();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleChangeContent(value: string) {
    setComposeState((current) => ({
      ...current,
      content: value,
      charCount: value.trim().length,
      duplicateBlocked: false,
      errorMessage: null,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (dataSourceMode !== "supabase") {
      setComposeState((current) => ({
        ...current,
        errorMessage:
          "Supabase 환경변수를 먼저 설정해야 실제로 글을 등록할 수 있어요.",
      }));
      return;
    }

    if (!resolvedLocation) {
      setComposeState((current) => ({
        ...current,
        errorMessage:
          "현재 위치를 확인해야 글을 등록할 수 있어요. 위치 권한을 확인해 주세요.",
      }));
      return;
    }

    setComposeState((current) => ({
      ...current,
      submitting: true,
      errorMessage: null,
    }));

    try {
      const anonymousDeviceId = await ensureRegisteredBrowserDevice();
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          anonymousDeviceId,
          content: composeState.content,
          location: {
            latitude: resolvedLocation.latitude,
            longitude: resolvedLocation.longitude,
          },
          clientResolved: {
            administrativeDongName: resolvedLocation.administrativeDongName,
            administrativeDongCode: resolvedLocation.administrativeDongCode,
          },
        }),
      });
      const json = (await response.json()) as ApiResponse<{
        post: {
          id: string;
        };
      }>;

      if (!response.ok || !json.success || !json.data) {
        throw new Error(json.error?.message ?? "글을 등록하지 못했습니다.");
      }

      router.replace("/");
    } catch (error) {
      setComposeState((current) => ({
        ...current,
        submitting: false,
        errorMessage:
          error instanceof Error
            ? error.message
            : "글을 등록하지 못했습니다.",
      }));
    }
  }

  return (
    <PageShell>
      <header
        style={{
          background: uiColors.surfaceMuted,
          border: `1px solid ${uiColors.border}`,
          borderRadius: uiRadius.lg,
          display: "flex",
          flexDirection: "column",
          gap: uiSpacing.xs,
          padding: uiSpacing.xl,
        }}
      >
        <h1
          style={{
            color: uiColors.textStrong,
            fontSize: "22px",
            lineHeight: 1.3,
            margin: 0,
          }}
        >
          여기 근데 올리기
        </h1>

        <p
          style={{
            color: uiColors.textMuted,
            fontSize: uiTypography.body.fontSize,
            margin: 0,
          }}
        >
          지금 있는 위치에서 느낀 문제나 좋았던 점을 100자 안으로 남겨 주세요.
        </p>

        <div
          style={{
            background: dataSourceMode === "supabase" ? "#eff6ff" : "#fff7ed",
            border: `1px solid ${
              dataSourceMode === "supabase" ? "#93c5fd" : "#fdba74"
            }`,
            borderRadius: uiRadius.md,
            color: dataSourceMode === "supabase" ? "#1d4ed8" : "#9a3412",
            fontSize: "12px",
            lineHeight: 1.5,
            marginTop: uiSpacing.sm,
            padding: `${uiSpacing.sm} ${uiSpacing.md}`,
          }}
        >
          {dataSourceMode === "supabase"
            ? "위치를 실제로 확인한 뒤 가까운 피드에 글이 올라가요."
            : "샘플 모드예요. Supabase 환경변수를 연결해야 글이 실제로 저장돼요."}
        </div>
      </header>

      <PostComposeForm
        {...composeState}
        locationStatusText={locationStatusText}
        onChangeContent={handleChangeContent}
        onSubmit={handleSubmit}
        submitDisabled={dataSourceMode !== "supabase"}
      />

      <section
        style={{
          background: uiColors.surface,
          border: `1px solid ${uiColors.border}`,
          borderRadius: uiRadius.lg,
          display: "flex",
          flexDirection: "column",
          gap: uiSpacing.sm,
          padding: uiSpacing.xl,
        }}
      >
        <p
          style={{
            color: uiColors.textStrong,
            fontSize: uiTypography.body.fontSize,
            margin: 0,
          }}
        >
          이제 글 등록은 브라우저 위치와 서버 위치 해석 결과를 같이 사용합니다.
        </p>
        <p
          style={{
            color: uiColors.textMuted,
            fontSize: uiTypography.meta.fontSize,
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          위치 권한이 없으면 작성할 수 없고, 서버에서 현재 좌표를 다시 확인해
          동 이름과 좌표를 함께 저장해요.
        </p>
      </section>
    </PageShell>
  );
}
