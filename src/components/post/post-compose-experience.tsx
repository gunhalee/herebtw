"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "../common/page-shell";
import { ensureRegisteredBrowserDevice } from "../../lib/device/browser-device";
import {
  readCachedAdministrativeLocation,
  writeCachedAdministrativeLocation,
} from "../../lib/geo/browser-administrative-location";
import { getCurrentBrowserCoordinates } from "../../lib/geo/browser-location";
import {
  uiColors,
  uiRadius,
  uiShadow,
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

export type PostComposeExperienceProps = {
  dataSourceMode: "supabase" | "mock";
  presentation?: "page" | "sheet";
  onDismiss?: () => void;
  onSuccess?: () => void | Promise<void>;
};

async function resolveAdministrativeLocation(location: {
  latitude: number;
  longitude: number;
}) {
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
    throw new Error(
      json.error?.message ?? "현재 위치를 확인하지 못했어요.",
    );
  }

  return json.data.location;
}

function createInitialComposeState(): PostComposeState {
  return {
    content: "",
    charCount: 0,
    submitting: false,
    locationResolved: false,
    resolvedDongName: null,
    resolvedDongCode: null,
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

export function PostComposeExperience({
  dataSourceMode,
  presentation = "page",
  onDismiss,
  onSuccess,
}: PostComposeExperienceProps) {
  const router = useRouter();
  const [composeState, setComposeState] = useState(createInitialComposeState);
  const [resolvedLocation, setResolvedLocation] = useState<ResolvedLocation | null>(
    null,
  );
  const [locationStatusText, setLocationStatusText] = useState<string | null>(
    "현재 위치를 확인하는 중이에요.",
  );
  const [locationStatusTone, setLocationStatusTone] = useState<
    "neutral" | "danger"
  >("neutral");
  const deviceRegistrationPromiseRef = useRef<Promise<string> | null>(null);
  const isSheet = presentation === "sheet";

  function ensureDeviceRegistrationStarted() {
    if (!deviceRegistrationPromiseRef.current) {
      deviceRegistrationPromiseRef.current = ensureRegisteredBrowserDevice().catch(
        (error) => {
          deviceRegistrationPromiseRef.current = null;
          throw error;
        },
      );
    }

    return deviceRegistrationPromiseRef.current;
  }

  useEffect(() => {
    if (dataSourceMode !== "supabase") {
      return;
    }

    void ensureDeviceRegistrationStarted().catch(() => undefined);
  }, [dataSourceMode]);

  useEffect(() => {
    if (!isSheet || typeof document === "undefined") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isSheet]);

  useEffect(() => {
    if (!isSheet || !onDismiss || typeof window === "undefined") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onDismiss();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSheet, onDismiss]);

  useEffect(() => {
    let cancelled = false;

    async function resolveLocation() {
      let displayedCachedLocation = false;

      function applyResolvedLocation(
        nextLocation: ResolvedLocation,
        options?: {
          verified?: boolean;
        },
      ) {
        if (cancelled) {
          return;
        }

        setResolvedLocation(nextLocation);
        setLocationStatusTone("neutral");
        setLocationStatusText(
          options?.verified ? null : "행정동을 다시 확인하는 중이에요.",
        );
        setComposeState((current) => ({
          ...current,
          locationResolved: true,
          resolvedDongName: nextLocation.administrativeDongName,
          resolvedDongCode: nextLocation.administrativeDongCode,
          errorMessage: null,
        }));
      }

      try {
        const coordinates = await getCurrentBrowserCoordinates();
        const cachedAdministrativeLocation =
          readCachedAdministrativeLocation(coordinates);

        if (cachedAdministrativeLocation) {
          applyResolvedLocation(
            {
              ...coordinates,
              ...cachedAdministrativeLocation,
            },
            {
              verified: false,
            },
          );
          displayedCachedLocation = true;
        }

        const verifiedLocation = await resolveAdministrativeLocation(coordinates);

        writeCachedAdministrativeLocation(coordinates, {
          administrativeDongName: verifiedLocation.administrativeDongName,
          administrativeDongCode: verifiedLocation.administrativeDongCode,
        });
        applyResolvedLocation(verifiedLocation, {
          verified: true,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (displayedCachedLocation) {
          setLocationStatusTone("neutral");
          setLocationStatusText("최근 확인한 행정동 기준으로 표시 중이에요.");
          return;
        }

        setResolvedLocation(null);
        setLocationStatusTone("danger");
        setLocationStatusText(getLocationErrorMessage(error));
        setComposeState((current) => ({
          ...current,
          locationResolved: false,
          resolvedDongName: null,
          resolvedDongCode: null,
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
      const anonymousDeviceId = await ensureDeviceRegistrationStarted();
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

      if (onSuccess) {
        await onSuccess();
        return;
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

  const introCard = (
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
  );

  const bodyContent = (
    <>
      <PostComposeForm
        {...composeState}
        locationStatusText={locationStatusText}
        locationStatusTone={locationStatusTone}
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
    </>
  );

  const sheetSubmitDisabled =
    dataSourceMode !== "supabase" ||
    composeState.submitting ||
    !composeState.locationResolved ||
    composeState.charCount < 1 ||
    composeState.charCount > 100;

  if (!isSheet) {
    return (
      <PageShell>
        {introCard}
        {bodyContent}
      </PageShell>
    );
  }

  return (
    <div
      aria-modal="true"
      className="compose-sheet-overlay"
      role="dialog"
    >
      <button
        aria-label="작성 패널 닫기"
        className="compose-sheet-overlay__backdrop"
        onClick={onDismiss}
        type="button"
      />
      <section
        className="compose-sheet-panel"
        style={{
          background: "#fffdfa",
          borderTopLeftRadius: "28px",
          borderTopRightRadius: "28px",
          boxShadow: uiShadow.sheet,
          display: "flex",
          flexDirection: "column",
          maxHeight: "min(88dvh, 760px)",
          minHeight: "min(68dvh, 620px)",
          padding: `${uiSpacing.md} ${uiSpacing.pageX} calc(${uiSpacing.xl} + env(safe-area-inset-bottom, 0px))`,
          position: "relative",
          width: "100%",
        }}
      >
        <form
          onSubmit={handleSubmit}
          style={{
            alignItems: "center",
            display: "flex",
            flexDirection: "column",
            flex: 1,
            gap: uiSpacing.lg,
            minHeight: 0,
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              width: "100%",
            }}
          >
            <button
              onClick={onDismiss}
              style={{
                appearance: "none",
                background: "transparent",
                border: "none",
                color: uiColors.textMuted,
                cursor: "pointer",
                fontSize: uiTypography.body.fontSize,
                fontWeight: 600,
                justifySelf: "start",
                padding: 0,
              }}
              type="button"
            >
              닫기
            </button>

            <div
              style={{
                justifySelf: "center",
                minWidth: 0,
              }}
            >
              <h2
                style={{
                  color: uiColors.textStrong,
                  fontSize: "18px",
                  lineHeight: 1.2,
                  margin: 0,
                  textAlign: "center",
                }}
              >
                여기 근데 올리기
              </h2>
            </div>

            <button
              disabled={sheetSubmitDisabled}
              style={{
                appearance: "none",
                background: "transparent",
                border: "none",
                color: sheetSubmitDisabled ? "#9ca3af" : uiColors.buttonPrimary,
                cursor: sheetSubmitDisabled ? "default" : "pointer",
                fontSize: uiTypography.body.fontSize,
                fontWeight: 700,
                justifySelf: "end",
                padding: 0,
              }}
              type="submit"
            >
              {composeState.submitting ? "게시 중" : "게시"}
            </button>
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              position: "relative",
            }}
          >
            <textarea
              id="sheet-post-content"
              maxLength={100}
              onChange={(event) => handleChangeContent(event.target.value)}
              placeholder="지금 이 곳에서 느끼는 감정을 적어보세요"
              style={{
                background: "transparent",
                border: "none",
                color: uiColors.textStrong,
                fontSize: "22px",
                fontWeight: 500,
                height: "100%",
                lineHeight: 1.55,
                outline: "none",
                padding: `${uiSpacing.sm} 0 calc(${uiSpacing.xl} + 18px)`,
                resize: "none",
                width: "100%",
              }}
              value={composeState.content}
            />
            <span
              style={{
                bottom: uiSpacing.sm,
                color: uiColors.textMuted,
                fontSize: uiTypography.meta.fontSize,
                fontWeight: uiTypography.meta.fontWeight,
                left: 0,
                position: "absolute",
              }}
            >
              {composeState.charCount}/100
            </span>
          </div>

          {composeState.errorMessage ? (
            <p
              style={{
                color: uiColors.danger,
                fontSize: uiTypography.meta.fontSize,
                margin: 0,
              }}
            >
              {composeState.errorMessage}
            </p>
          ) : null}

          {composeState.duplicateBlocked ? (
            <p
              style={{
                color: uiColors.danger,
                fontSize: uiTypography.meta.fontSize,
                margin: 0,
              }}
            >
              같은 내용의 글이 이미 등록되어 있어요. 내용을 조금 바꿔 다시 시도해 주세요.
            </p>
          ) : null}

          {composeState.cooldownRemainingSeconds > 0 ? (
            <p
              style={{
                color: uiColors.textMuted,
                fontSize: uiTypography.meta.fontSize,
                margin: 0,
              }}
            >
              {`${composeState.cooldownRemainingSeconds}초 뒤에 다시 작성할 수 있어요.`}
            </p>
          ) : null}

          {!composeState.locationResolved && locationStatusText ? (
            <p
              style={{
                color:
                  locationStatusTone === "danger"
                    ? uiColors.danger
                    : uiColors.textMuted,
                fontSize: uiTypography.meta.fontSize,
                margin: 0,
              }}
            >
              {locationStatusText}
            </p>
          ) : null}
        </form>
      </section>
    </div>
  );
}
