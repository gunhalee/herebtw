"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import {
  uiColors,
  uiShadow,
  uiSpacing,
  uiTypography,
} from "../../lib/ui/tokens";
import type { PostComposeState } from "../../types/post";
import { useComposeLocation } from "./use-compose-location";
import { useComposeSheetLayout } from "./use-compose-sheet-layout";
import { useComposeSubmit } from "./use-compose-submit";

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

export function PostComposeExperience({
  dataSourceMode,
  onDismiss,
  onSuccess,
}: PostComposeExperienceProps) {
  const [composeState, setComposeState] = useState(createInitialComposeState);
  const { locationStatusText, locationStatusTone, resolvedLocation } =
    useComposeLocation({
      setComposeState,
    });
  const { sheetPortalReady, sheetViewportLayout } = useComposeSheetLayout({
    onDismiss,
  });
  const { handleChangeContent, handleSubmit, submitDisabled } =
    useComposeSubmit({
      composeState,
      dataSourceMode,
      onDismiss,
      onSuccess,
      resolvedLocation,
      setComposeState,
    });

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
              placeholder="지금 여기에서 글을 남겨보세요."
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
