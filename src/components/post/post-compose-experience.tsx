"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
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

type SheetViewportLayout = {
  keyboardInset: number;
  viewportHeight: number;
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

function readSheetViewportLayout(): SheetViewportLayout {
  if (typeof window === "undefined") {
    return {
      keyboardInset: 0,
      viewportHeight: 720,
    };
  }

  const visualViewport = window.visualViewport;

  if (!visualViewport) {
    return {
      keyboardInset: 0,
      viewportHeight: window.innerHeight,
    };
  }

  const viewportHeight = Math.round(visualViewport.height);
  const layoutViewportHeight = Math.max(
    window.innerHeight,
    Math.round(visualViewport.height + visualViewport.offsetTop),
  );
  const keyboardInset = Math.max(
    0,
    layoutViewportHeight -
      Math.round(visualViewport.height + visualViewport.offsetTop),
  );

  return {
    keyboardInset,
    viewportHeight,
  };
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
  const touchScrollStartYRef = useRef<number | null>(null);
  const isSheet = presentation === "sheet";
  const [sheetPortalReady, setSheetPortalReady] = useState(false);
  const [sheetViewportLayout, setSheetViewportLayout] =
    useState<SheetViewportLayout>(readSheetViewportLayout);

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

    const root = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    const previousRootOverflow = root.style.overflow;
    const previousRootOverscrollBehavior = root.style.overscrollBehavior;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyLeft = body.style.left;
    const previousBodyRight = body.style.right;
    const previousBodyWidth = body.style.width;
    const previousBodyOverscrollBehavior = body.style.overscrollBehavior;

    root.classList.add("compose-sheet-open");
    body.classList.add("compose-sheet-open");
    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overscrollBehavior = "none";

    const resolveScrollableTextarea = (target: EventTarget | null) => {
      if (!(target instanceof Element)) {
        return null;
      }

      const textarea = target.closest("#sheet-post-content");

      return textarea instanceof HTMLTextAreaElement ? textarea : null;
    };

    const canScrollTextarea = (
      textarea: HTMLTextAreaElement,
      deltaY: number,
    ) => {
      if (textarea.scrollHeight <= textarea.clientHeight + 1) {
        return false;
      }

      const scrollTop = textarea.scrollTop;
      const maxScrollTop = textarea.scrollHeight - textarea.clientHeight;
      const isScrollingDown = deltaY > 0;
      const isScrollingUp = deltaY < 0;
      const isAtTop = scrollTop <= 0;
      const isAtBottom = scrollTop >= maxScrollTop - 1;

      if ((isAtTop && isScrollingDown) || (isAtBottom && isScrollingUp)) {
        return false;
      }

      return true;
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        touchScrollStartYRef.current = null;
        return;
      }

      touchScrollStartYRef.current = event.touches[0]?.clientY ?? null;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const textarea = resolveScrollableTextarea(event.target);

      if (!textarea || event.touches.length !== 1) {
        event.preventDefault();
        return;
      }

      const currentTouchY = event.touches[0]?.clientY ?? null;
      const previousTouchY = touchScrollStartYRef.current;

      if (currentTouchY === null || previousTouchY === null) {
        touchScrollStartYRef.current = currentTouchY;
        return;
      }

      const deltaY = currentTouchY - previousTouchY;
      touchScrollStartYRef.current = currentTouchY;

      if (!canScrollTextarea(textarea, deltaY)) {
        event.preventDefault();
      }
    };

    const handleWheel = (event: WheelEvent) => {
      const textarea = resolveScrollableTextarea(event.target);

      if (!textarea || !canScrollTextarea(textarea, event.deltaY)) {
        event.preventDefault();
      }
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("wheel", handleWheel);
      touchScrollStartYRef.current = null;
      root.classList.remove("compose-sheet-open");
      body.classList.remove("compose-sheet-open");
      root.style.overflow = previousRootOverflow;
      root.style.overscrollBehavior = previousRootOverscrollBehavior;
      body.style.overflow = previousBodyOverflow;
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.left = previousBodyLeft;
      body.style.right = previousBodyRight;
      body.style.width = previousBodyWidth;
      body.style.overscrollBehavior = previousBodyOverscrollBehavior;
      window.scrollTo(0, scrollY);
    };
  }, [isSheet]);

  useEffect(() => {
    if (!isSheet) {
      setSheetPortalReady(false);
      return;
    }

    setSheetPortalReady(true);

    return () => {
      setSheetPortalReady(false);
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
    if (!isSheet || typeof window === "undefined") {
      return;
    }

    const visualViewport = window.visualViewport;

    const syncViewportLayout = () => {
      setSheetViewportLayout(readSheetViewportLayout());
    };

    syncViewportLayout();
    window.addEventListener("resize", syncViewportLayout);
    visualViewport?.addEventListener("resize", syncViewportLayout);
    visualViewport?.addEventListener("scroll", syncViewportLayout);

    return () => {
      window.removeEventListener("resize", syncViewportLayout);
      visualViewport?.removeEventListener("resize", syncViewportLayout);
      visualViewport?.removeEventListener("scroll", syncViewportLayout);
    };
  }, [isSheet]);

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
  const sheetViewportAvailableHeight = Math.max(
    320,
    sheetViewportLayout.viewportHeight - 12,
  );
  const sheetPreferredHeight =
    sheetViewportLayout.keyboardInset > 0
      ? sheetViewportAvailableHeight
      : Math.min(
          460,
          Math.max(360, Math.round(sheetViewportLayout.viewportHeight * 0.52)),
        );
  const sheetHeight = Math.min(
    sheetPreferredHeight,
    sheetViewportAvailableHeight,
  );

  if (!isSheet) {
    return (
      <PageShell>
        {introCard}
        {bodyContent}
      </PageShell>
    );
  }

  const sheetOverlay = (
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
          background: "#ffffff",
          borderTopLeftRadius: "28px",
          borderTopRightRadius: "28px",
          boxShadow: uiShadow.sheet,
          display: "flex",
          flexDirection: "column",
          height: `${sheetHeight}px`,
          marginBottom: `${sheetViewportLayout.keyboardInset}px`,
          maxHeight: `${sheetViewportAvailableHeight}px`,
          overflow: "hidden",
          padding: `${uiSpacing.md} ${uiSpacing.pageX} calc(${uiSpacing.lg} + env(safe-area-inset-bottom, 0px))`,
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
            gap: uiSpacing.sm,
            height: "100%",
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
                fontSize: "18px",
                fontWeight: 700,
                justifySelf: "start",
                minHeight: "40px",
                padding: `${uiSpacing.xs} 0`,
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
                fontSize: "18px",
                fontWeight: 700,
                justifySelf: "end",
                minHeight: "40px",
                padding: `${uiSpacing.xs} 0`,
              }}
              type="submit"
            >
              {composeState.submitting ? "게시 중" : "게시"}
            </button>
          </div>

          <div
            style={{
              alignSelf: "stretch",
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
                fontSize: "20px",
                fontWeight: 500,
                height: "100%",
                lineHeight: 1.55,
                minHeight: 0,
                outline: "none",
                overscrollBehavior: "contain",
                overflowY: "auto",
                padding: `${uiSpacing.sm} 0 calc(${uiSpacing.xl} + 26px)`,
                resize: "none",
                verticalAlign: "top",
                WebkitOverflowScrolling: "touch",
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
                position: "absolute",
                right: 0,
                textAlign: "right",
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

  if (!sheetPortalReady || typeof document === "undefined") {
    return null;
  }

  return createPortal(sheetOverlay, document.body);
}
