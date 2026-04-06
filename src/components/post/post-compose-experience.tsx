"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { ensureRegisteredBrowserDevice } from "../../lib/device/browser-device";
import {
  readCachedAdministrativeLocation,
  writeCachedAdministrativeLocation,
} from "../../lib/geo/browser-administrative-location";
import {
  getBrowserLocationErrorMessage,
  resolveAdministrativeLocation,
  type ResolvedAdministrativeLocation,
} from "../../lib/geo/browser-administrative-location-resolver";
import { getCurrentBrowserCoordinates } from "../../lib/geo/browser-location";
import {
  uiColors,
  uiShadow,
  uiSpacing,
  uiTypography,
} from "../../lib/ui/tokens";
import type { ApiResponse } from "../../types/api";
import type { PostComposeState } from "../../types/post";

type SheetViewportLayout = {
  keyboardInset: number;
  viewportHeight: number;
};

type PostComposeExperienceProps = {
  dataSourceMode: "supabase" | "mock";
  onDismiss?: () => void;
  onSuccess?: () => void | Promise<void>;
};

function createInitialComposeState(): PostComposeState {
  return {
    content: "",
    charCount: 0,
    submitting: false,
    locationResolved: false,
    resolvedDongName: null,
    resolvedDongCode: null,
    duplicateBlocked: false,
    errorMessage: null,
  };
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
  onDismiss,
  onSuccess,
}: PostComposeExperienceProps) {
  const [composeState, setComposeState] = useState(createInitialComposeState);
  const [resolvedLocation, setResolvedLocation] =
    useState<ResolvedAdministrativeLocation | null>(null);
  const [locationStatusText, setLocationStatusText] = useState<string | null>(
    "현재 위치를 확인하는 중이에요.",
  );
  const [locationStatusTone, setLocationStatusTone] = useState<
    "neutral" | "danger"
  >("neutral");
  const [sheetPortalReady, setSheetPortalReady] = useState(false);
  const [sheetViewportLayout, setSheetViewportLayout] =
    useState<SheetViewportLayout>(readSheetViewportLayout);
  const deviceRegistrationPromiseRef = useRef<Promise<string> | null>(null);
  const touchScrollStartYRef = useRef<number | null>(null);

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
    if (typeof document === "undefined") {
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
  }, []);

  useEffect(() => {
    setSheetPortalReady(true);

    return () => {
      setSheetPortalReady(false);
    };
  }, []);

  useEffect(() => {
    if (!onDismiss || typeof window === "undefined") {
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
  }, [onDismiss]);

  useEffect(() => {
    if (typeof window === "undefined") {
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
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLocation() {
      let displayedCachedLocation = false;

      function applyResolvedLocation(
        nextLocation: ResolvedAdministrativeLocation,
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
          options?.verified ? null : "저장된 동네 정보를 다시 확인하는 중이에요.",
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
              countryCode: null,
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
          setLocationStatusText("가장 최근에 저장한 동네를 표시하고 있어요.");
          return;
        }

        setResolvedLocation(null);
        setLocationStatusTone("danger");
        setLocationStatusText(getBrowserLocationErrorMessage(error));
        setComposeState((current) => ({
          ...current,
          locationResolved: false,
          resolvedDongName: null,
          resolvedDongCode: null,
        }));
      }
    }

    void loadLocation();

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
        errorMessage: "실시간으로 글을 등록하려면 Supabase 연결이 필요해요.",
      }));
      return;
    }

    if (!resolvedLocation) {
      setComposeState((current) => ({
        ...current,
        errorMessage: "위치 확인이 끝난 뒤에 글을 등록할 수 있어요.",
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
        }),
      });
      const json = (await response.json()) as ApiResponse<{
        post: {
          id: string;
        };
      }>;

      if (!response.ok || !json.success || !json.data) {
        throw new Error(json.error?.message ?? "글을 등록하지 못했어요.");
      }

      if (onSuccess) {
        await onSuccess();
        return;
      }

      onDismiss?.();
    } catch (error) {
      setComposeState((current) => ({
        ...current,
        submitting: false,
        errorMessage:
          error instanceof Error
            ? error.message
            : "글을 등록하지 못했어요.",
      }));
    }
  }

  const submitDisabled =
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

  const sheetOverlay = (
    <div
      aria-modal="true"
      className="compose-sheet-overlay"
      role="dialog"
    >
      <button
        aria-label="글쓰기 닫기"
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
                여기 남기기
              </h2>
            </div>

            <button
              disabled={submitDisabled}
              style={{
                appearance: "none",
                background: "transparent",
                border: "none",
                color: submitDisabled ? "#9ca3af" : uiColors.buttonPrimary,
                cursor: submitDisabled ? "default" : "pointer",
                fontSize: "18px",
                fontWeight: 700,
                justifySelf: "end",
                minHeight: "40px",
                padding: `${uiSpacing.xs} 0`,
              }}
              type="submit"
            >
              {composeState.submitting ? "등록 중..." : "등록"}
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
              placeholder="지금 이 주변에서 느낀 점을 남겨보세요."
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
              같은 내용의 글이 이미 있어요. 내용을 조금 수정해 다시 시도해주세요.
            </p>
          ) : null}

          {locationStatusText ? (
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
