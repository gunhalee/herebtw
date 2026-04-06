"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "../common/empty-state";
import { ErrorState } from "../common/error-state";
import { LoadingState } from "../common/loading-state";
import { AgreeButton } from "../post/agree-button";
import { DeletePostButton } from "../post/delete-post-button";
import { ReportButton } from "../post/report-button";
import type { PostDetailState, PostListState } from "../../types/post";
import { PostListItem } from "./post-list-item";
import {
  uiColors,
  uiRadius,
  uiShadow,
  uiSpacing,
} from "../../lib/ui/tokens";

export type SlidingPostSheetProps = {
  state: PostListState;
  detailState: PostDetailState;
  onOpenItem?: (postId: string) => void;
  onCloseDetail?: () => void;
  onToggleAgree?: () => void;
  onProgressChange?: (progress: number) => void;
  onSelectReport?: (postId: string) => void;
};

export function SlidingPostSheet({
  state,
  detailState,
  onOpenItem,
  onCloseDetail,
  onToggleAgree,
  onProgressChange,
  onSelectReport,
}: SlidingPostSheetProps) {
  const [viewportHeight, setViewportHeight] = useState(800);
  const [sheetHeight, setSheetHeight] = useState(316);
  const [isDragging, setIsDragging] = useState(false);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const detailScrollRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    startY: number;
    startHeight: number;
    pointerId: number;
    source: "header" | "body";
    active: boolean;
  } | null>(null);

  const detailOpen = detailState.open;

  useEffect(() => {
    function updateViewportHeight() {
      const nextViewportHeight = window.innerHeight;
      setViewportHeight(nextViewportHeight);
      setSheetHeight((current) => {
        const collapsed = Math.min(316, Math.max(248, nextViewportHeight * 0.31));
        const expanded = Math.max(452, nextViewportHeight - 48);
        return Math.max(collapsed, Math.min(current || collapsed, expanded));
      });
    }

    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);

    return () => window.removeEventListener("resize", updateViewportHeight);
  }, []);

  const snapPoints = useMemo(() => {
    const collapsed = Math.min(316, Math.max(248, viewportHeight * 0.31));
    const mid = Math.min(540, Math.max(404, viewportHeight * 0.62));
    const expanded = Math.max(452, viewportHeight - 48);

    return { collapsed, mid, expanded };
  }, [viewportHeight]);

  useEffect(() => {
    const denominator = Math.max(1, snapPoints.expanded - snapPoints.collapsed);
    const progress = Math.max(
      0,
      Math.min(1, (sheetHeight - snapPoints.collapsed) / denominator),
    );
    onProgressChange?.(progress);
  }, [onProgressChange, sheetHeight, snapPoints.collapsed, snapPoints.expanded]);

  function snapToClosest(targetHeight: number) {
    const points = Object.values(snapPoints);
    const closest = points.reduce((nearest, point) => {
      return Math.abs(point - targetHeight) < Math.abs(nearest - targetHeight)
        ? point
        : nearest;
    }, points[0]);
    setSheetHeight(closest);
  }

  function getActiveScrollTop() {
    return detailOpen
      ? (detailScrollRef.current?.scrollTop ?? 0)
      : (listScrollRef.current?.scrollTop ?? 0);
  }

  function handlePointerDown(
    event: React.PointerEvent<HTMLElement>,
    source: "header" | "body" = "header",
  ) {
    if (source === "body" && getActiveScrollTop() > 0) {
      return;
    }

    if (
      source === "header" &&
      event.target instanceof HTMLElement &&
      event.target.closest("button, a, input, textarea, select")
    ) {
      return;
    }

    dragRef.current = {
      startY: event.clientY,
      startHeight: sheetHeight,
      pointerId: event.pointerId,
      source,
      active: source === "header",
    };

    if (source === "header") {
      setIsDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    if (!dragRef.current) return;

    const deltaY = dragRef.current.startY - event.clientY;

    if (!dragRef.current.active) {
      const threshold = dragRef.current.source === "body" ? 14 : 8;
      const bodyShouldActivate = dragRef.current.source === "body" && deltaY < -threshold;
      const headerShouldActivate =
        dragRef.current.source === "header" && Math.abs(deltaY) > threshold;

      if (!bodyShouldActivate && !headerShouldActivate) {
        return;
      }

      dragRef.current.active = true;
      setIsDragging(true);
      event.currentTarget.setPointerCapture(dragRef.current.pointerId);
    }

    if (dragRef.current.source === "body" && deltaY > 0) return;

    const nextHeight = dragRef.current.startHeight + deltaY;
    setSheetHeight(
      Math.max(snapPoints.collapsed, Math.min(nextHeight, snapPoints.expanded)),
    );
  }

  function finishDrag(event: React.PointerEvent<HTMLElement>) {
    if (!dragRef.current) return;
    const { active, pointerId } = dragRef.current;

    if (event.currentTarget.hasPointerCapture(pointerId)) {
      event.currentTarget.releasePointerCapture(pointerId);
    }

    dragRef.current = null;

    if (!active) {
      return;
    }

    const lastHeight = sheetHeight;
    setIsDragging(false);
    snapToClosest(lastHeight);
  }

  const pseudoReadCount = Math.max(12, detailState.agreeCount * 9 + 23);
  const reportPostId = detailState.postId;
  const handleSelectReport =
    reportPostId ? () => onSelectReport?.(reportPostId) : undefined;

  return (
    <section
      aria-label="sliding-post-sheet"
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      style={{
        background: uiColors.surfaceSheet,
        borderTopLeftRadius: "32px",
        borderTopRightRadius: "32px",
        bottom: 0,
        boxShadow: uiShadow.sheet,
        display: "flex",
        flexDirection: "column",
        gap: uiSpacing.lg,
        height: `${sheetHeight}px`,
        left: 0,
        overflow: "hidden",
        padding: `${uiSpacing.md} ${uiSpacing.xl} ${uiSpacing.xxxl}`,
        position: "absolute",
        right: 0,
        touchAction: "pan-y",
        transition: isDragging ? "none" : "height 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        zIndex: 3,
      }}
    >
      <header
        onDoubleClick={() => snapToClosest(snapPoints.expanded)}
        onPointerDown={(event) => handlePointerDown(event, "header")}
        style={{
          cursor: "ns-resize",
          display: "flex",
          flexDirection: "column",
          gap: uiSpacing.sm,
          paddingBottom: uiSpacing.xs,
          touchAction: "none",
        }}
      >
        <div
          style={{
            background: "#d9d6d0",
            borderRadius: uiRadius.pill,
            boxShadow: "0 1px 0 rgba(255,255,255,0.7)",
            height: "6px",
            margin: "0 auto",
            width: "58px",
          }}
        />
        {detailOpen ? (
          <div
            style={{
              alignItems: "center",
              color: uiColors.textStrong,
              display: "grid",
              gap: uiSpacing.sm,
              gridTemplateColumns: "40px 1fr",
            }}
          >
            <button
              onClick={onCloseDetail}
              style={{
                background: uiColors.surfaceChip,
                border: "none",
                borderRadius: "50%",
                color: uiColors.textStrong,
                cursor: "pointer",
                height: "40px",
                width: "40px",
              }}
              type="button"
            >
              ←
            </button>
            <div>
              <h3 style={{ color: uiColors.textStrong, fontSize: "21px", lineHeight: 1.2, margin: 0 }}>
                한마디
              </h3>
              <p style={{ color: uiColors.textMuted, fontSize: "13px", margin: `${uiSpacing.xs} 0 0` }}>
                {detailState.administrativeDongName} · 반경 2km
              </p>
            </div>
          </div>
        ) : (
          <>
            <div
              style={{
                alignItems: "baseline",
                color: uiColors.textStrong,
                display: "flex",
                gap: uiSpacing.md,
                justifyContent: "space-between",
              }}
            >
              <strong style={{ fontSize: "21px", lineHeight: 1.2 }}>근처 한마디</strong>
              <span style={{ color: uiColors.textMuted, fontSize: "13px" }}>
                반경 2km · {state.items.length}개
              </span>
            </div>
            <div
              style={{
                color: uiColors.textMuted,
                display: "flex",
                gap: uiSpacing.lg,
                overflowX: "auto",
                paddingBottom: uiSpacing.sm,
              }}
            >
              <span
                style={{
                  borderBottom: `2px solid ${uiColors.textStrong}`,
                  color: uiColors.textStrong,
                  paddingBottom: uiSpacing.xs,
                  whiteSpace: "nowrap",
                }}
              >
                거리순
              </span>
              <span style={{ whiteSpace: "nowrap" }}>많이 읽힘</span>
              <span style={{ whiteSpace: "nowrap" }}>정리된 답변</span>
            </div>
          </>
        )}
      </header>

      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", position: "relative" }}>
        <div
          style={{
            display: "flex",
            height: "100%",
            transform: detailOpen ? "translateX(-50%)" : "translateX(0%)",
            transition: "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)",
            width: "200%",
          }}
        >
          <div
            ref={listScrollRef}
            onPointerDown={(event) => handlePointerDown(event, "body")}
            style={{
              minWidth: "50%",
              overflowY: "auto",
              paddingBottom: uiSpacing.xs,
              touchAction: "pan-y",
            }}
          >
            {state.loading ? <LoadingState label="목록을 불러오는 중" /> : null}
            {state.errorMessage ? <ErrorState message={state.errorMessage} /> : null}
            {state.empty ? (
              <EmptyState
                title="아직 이 지역의 목소리가 없어요"
                description="첫 번째 목소리를 남겨보세요."
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: uiSpacing.md }}>
                {state.items.map((item) => (
                  <PostListItem key={item.id} {...item} onOpen={onOpenItem} />
                ))}
                {state.loadingMore ? <LoadingState label="더 불러오는 중" /> : null}
              </div>
            )}
          </div>

          <div
            ref={detailScrollRef}
            onPointerDown={(event) => handlePointerDown(event, "body")}
            style={{
              minWidth: "50%",
              overflowY: "auto",
              paddingBottom: uiSpacing.xs,
              paddingLeft: uiSpacing.lg,
              touchAction: "pan-y",
            }}
          >
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
              <span style={{ color: uiColors.textMuted, fontSize: "13px" }}>내 위치에서 280m</span>
            </section>

            <article
              style={{
                background: uiColors.surface,
                border: `1px solid ${uiColors.border}`,
                borderRadius: uiRadius.md,
                display: "flex",
                flexDirection: "column",
                gap: uiSpacing.lg,
                marginTop: uiSpacing.lg,
                padding: uiSpacing.xl,
              }}
            >
              <span style={{ color: uiColors.textMuted, fontSize: "13px" }}>{detailState.relativeTime}</span>
              <p
                style={{
                  color: uiColors.textStrong,
                  fontSize: "20px",
                  fontWeight: 800,
                  lineHeight: 1.55,
                  margin: 0,
                }}
              >
                {detailState.content}
              </p>
              <div style={{ display: "flex", gap: uiSpacing.md }}>
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
                  <strong style={{ display: "block", fontSize: "24px" }}>{detailState.agreeCount}</strong>
                  <span style={{ color: uiColors.textMuted, fontSize: "13px" }}>맞아요</span>
                </div>
              </div>
            </article>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: uiSpacing.sm,
                marginTop: uiSpacing.lg,
              }}
            >
              <AgreeButton
                agreed={detailState.myAgree}
                agreeCount={detailState.agreeCount}
                onToggle={onToggleAgree}
              />
              <ReportButton
                disabled={!handleSelectReport}
                onClick={handleSelectReport}
              />
              <DeletePostButton
                canDelete={detailState.canDelete}
                deleteRemainingSeconds={detailState.deleteRemainingSeconds}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
