"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AgreeButton } from "../post/agree-button";
import { DeletePostButton } from "../post/delete-post-button";
import { ReportButton } from "../post/report-button";
import type { PostDetailState } from "../../types/post";
import {
  uiColors,
  uiRadius,
  uiSpacing,
  uiTypography,
} from "../../lib/ui/tokens";

export type PostDetailSheetProps = {
  state: PostDetailState;
  onClose?: () => void;
  onToggleAgree?: () => void;
  onProgressChange?: (progress: number) => void;
  onSelectReport?: (postId: string) => void;
};

export function PostDetailSheet({
  state,
  onClose,
  onToggleAgree,
  onProgressChange,
  onSelectReport,
}: PostDetailSheetProps) {
  const [viewportHeight, setViewportHeight] = useState(800);
  const [sheetHeight, setSheetHeight] = useState(620);
  const [isDragging, setIsDragging] = useState(false);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    startY: number;
    startHeight: number;
    source: "header" | "body";
  } | null>(null);

  useEffect(() => {
    if (!state.open) {
      return;
    }

    function updateViewportHeight() {
      const nextViewportHeight = window.innerHeight;
      setViewportHeight(nextViewportHeight);
      setSheetHeight((current) => {
        const mid = Math.min(nextViewportHeight - 104, Math.max(540, nextViewportHeight * 0.78));
        const expanded = Math.max(620, nextViewportHeight - 12);
        return Math.max(mid, Math.min(current || mid, expanded));
      });
    }

    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);

    return () => {
      window.removeEventListener("resize", updateViewportHeight);
    };
  }, [state.open]);

  const snapPoints = useMemo(() => {
    const mid = Math.min(viewportHeight - 104, Math.max(540, viewportHeight * 0.78));
    const expanded = Math.max(620, viewportHeight - 12);

    return {
      mid,
      expanded,
    };
  }, [viewportHeight]);

  useEffect(() => {
    if (!state.open) {
      onProgressChange?.(0);
      return;
    }

    const denominator = Math.max(1, snapPoints.expanded - snapPoints.mid);
    const progress = Math.max(0, Math.min(1, (sheetHeight - snapPoints.mid) / denominator));
    onProgressChange?.(progress);
  }, [onProgressChange, sheetHeight, snapPoints.expanded, snapPoints.mid, state.open]);

  const reportPostId = state.postId;
  const handleSelectReport =
    reportPostId ? () => onSelectReport?.(reportPostId) : undefined;

  if (!state.open) {
    return null;
  }

  function snapToClosest(targetHeight: number) {
    const points = Object.values(snapPoints);
    const closest = points.reduce((nearest, point) => {
      return Math.abs(point - targetHeight) < Math.abs(nearest - targetHeight)
        ? point
        : nearest;
    }, points[0]);

    setSheetHeight(closest);
  }

  function handlePointerDown(
    event: React.PointerEvent<HTMLElement>,
    source: "header" | "body" = "header",
  ) {
    if (source === "body" && (bodyScrollRef.current?.scrollTop ?? 0) > 0) {
      return;
    }

    dragRef.current = {
      startY: event.clientY,
      startHeight: sheetHeight,
      source,
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    if (!dragRef.current) {
      return;
    }

    const deltaY = dragRef.current.startY - event.clientY;
    if (dragRef.current.source === "body" && deltaY > 0) {
      return;
    }

    const nextHeight = dragRef.current.startHeight + deltaY;
    setSheetHeight(Math.max(snapPoints.mid, Math.min(nextHeight, snapPoints.expanded)));
  }

  function finishDrag() {
    if (!dragRef.current) {
      return;
    }

    const lastHeight = sheetHeight;
    dragRef.current = null;
    setIsDragging(false);
    snapToClosest(lastHeight);
  }

  const pseudoReadCount = Math.max(12, state.agreeCount * 9 + 23);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          background: uiColors.backdrop,
          inset: 0,
          opacity: 0.72,
          position: "fixed",
          transition: "opacity 180ms ease",
          zIndex: 11,
        }}
      />
      <section
        aria-label="post-detail-sheet"
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        style={{
          background: uiColors.surfaceSheet,
          borderTopLeftRadius: "32px",
          borderTopRightRadius: "32px",
          bottom: 0,
          boxShadow: "0 -24px 56px rgba(17, 24, 39, 0.28)",
          display: "flex",
          flexDirection: "column",
          gap: uiSpacing.lg,
          height: `${sheetHeight}px`,
          left: "50%",
          maxWidth: "420px",
          overflow: "hidden",
          padding: `${uiSpacing.md} ${uiSpacing.xl} ${uiSpacing.xxxl}`,
          position: "fixed",
          touchAction: "pan-y",
          transform: "translateX(-50%)",
          transition: isDragging ? "none" : "height 220ms cubic-bezier(0.22, 1, 0.36, 1)",
          width: "calc(100vw - 12px)",
          zIndex: 12,
        }}
      >
      <header
        onDoubleClick={() => snapToClosest(snapPoints.expanded)}
        onPointerDown={(event) => handlePointerDown(event, "header")}
        style={{
          cursor: "ns-resize",
          display: "flex",
          flexDirection: "column",
          gap: uiSpacing.md,
          paddingBottom: uiSpacing.xs,
          touchAction: "none",
        }}
      >
        <div
          style={{
            background: "#d9d6d0",
            borderRadius: uiRadius.pill,
            boxShadow: "0 1px 0 rgba(255,255,255,0.7)",
            cursor: "ns-resize",
            height: "6px",
            margin: "0 auto",
            width: "58px",
          }}
        />
        <div
          style={{
            alignItems: "center",
            display: "grid",
            gap: uiSpacing.sm,
            gridTemplateColumns: "40px 1fr",
          }}
        >
        <button
          onClick={onClose}
          style={{
            background: uiColors.surfaceChip,
            border: "none",
            borderRadius: "50%",
            color: uiColors.textStrong,
            height: "40px",
            width: "40px",
          }}
          type="button"
        >
          ←
        </button>
        <div>
          <h3
            style={{
              color: uiColors.textStrong,
              fontSize: "18px",
              fontWeight: 800,
              margin: 0,
            }}
          >
            한마디
          </h3>
          <p
            style={{
              color: uiColors.textMuted,
              fontSize: "13px",
              margin: `${uiSpacing.xs} 0 0`,
            }}
          >
            {state.administrativeDongName} · 지금 여기
          </p>
        </div>
        </div>
      </header>

      <section
        style={{
          background: uiColors.surfaceChip,
          borderRadius: uiRadius.md,
          color: uiColors.textStrong,
          display: "flex",
          flexDirection: "column",
          gap: uiSpacing.xs,
          padding: uiSpacing.lg,
        }}
      >
        <strong style={{ fontSize: "16px" }}>홍대입구역 2번 출구</strong>
        <span style={{ color: uiColors.textMuted, fontSize: "13px" }}>
          내 위치에서 280m
        </span>
      </section>

      <article
        style={{
          background: uiColors.surface,
          border: `1px solid ${uiColors.border}`,
          borderRadius: uiRadius.md,
          display: "flex",
          flexDirection: "column",
          gap: uiSpacing.lg,
          padding: uiSpacing.xl,
        }}
      >
        <span style={{ color: uiColors.textMuted, fontSize: "13px" }}>{state.relativeTime}</span>
        <p
          style={{
            color: uiColors.textStrong,
            fontSize: "20px",
            fontWeight: 800,
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          {state.content}
        </p>
        <div
          style={{
            display: "flex",
            gap: uiSpacing.md,
          }}
        >
          <div
            style={{
              background: uiColors.surfaceChip,
              borderRadius: uiRadius.md,
              flex: 1,
              padding: uiSpacing.lg,
              textAlign: "center",
            }}
          >
            <strong style={{ display: "block", fontSize: "24px" }}>{pseudoReadCount}</strong>
            <span style={{ color: uiColors.textMuted, fontSize: "13px" }}>읽음</span>
          </div>
          <div
            style={{
              background: uiColors.surfaceChip,
              borderRadius: uiRadius.md,
              flex: 1,
              padding: uiSpacing.lg,
              textAlign: "center",
            }}
          >
            <strong style={{ display: "block", fontSize: "24px" }}>{state.agreeCount}</strong>
            <span style={{ color: uiColors.textMuted, fontSize: "13px" }}>맞아요</span>
          </div>
        </div>
      </article>

      <section
        style={{
          background: "#e8f0ff",
          border: `1px solid #bed3ff`,
          borderRadius: uiRadius.md,
          display: "grid",
          flexDirection: "column",
          gap: uiSpacing.sm,
          gridTemplateColumns: "44px 1fr 20px",
          padding: uiSpacing.lg,
        }}
      >
        <div
          style={{
            alignItems: "center",
            background: uiColors.buttonPrimary,
            borderRadius: "50%",
            color: uiColors.textInverse,
            display: "flex",
            fontWeight: 800,
            height: "44px",
            justifyContent: "center",
            width: "44px",
          }}
        >
          박
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: uiSpacing.xs }}>
          <strong style={{ color: uiColors.buttonPrimary, fontSize: "16px" }}>
            박○○ 마포구의원
          </strong>
          <span style={{ color: uiColors.textMuted, fontSize: "13px" }}>
            읽었어요 · 1일 전
          </span>
        </div>
        <div
          style={{
            color: uiColors.buttonPrimary,
            fontSize: "24px",
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          ✓
        </div>
      </section>

      <div
        ref={bodyScrollRef}
        onPointerDown={(event) => handlePointerDown(event, "body")}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: uiSpacing.sm,
          minHeight: 0,
          overflowY: "auto",
          touchAction: "pan-y",
        }}
      >
        <AgreeButton
          agreed={state.myAgree}
          agreeCount={state.agreeCount}
          onToggle={onToggleAgree}
        />
        <ReportButton
          disabled={!handleSelectReport}
          onClick={handleSelectReport}
        />
        <DeletePostButton
          canDelete={state.canDelete}
          deleteRemainingSeconds={state.deleteRemainingSeconds}
        />
      </div>
      </section>
    </>
  );
}
