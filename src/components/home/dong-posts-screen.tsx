"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import { EmptyState } from "../common/empty-state";
import { ErrorState } from "../common/error-state";
import { LoadingState } from "../common/loading-state";
import penWritingImage from "../pen_writing.png";
import { PostListItem } from "../sheet/post-list-item";
import { homeScreenCopy } from "../../lib/content/home-copy";
import type { PostListState } from "../../types/post";
import { uiColors, uiRadius, uiSpacing } from "../../lib/ui/tokens";

const PLACEHOLDER_DONG_LABEL = "우리 동네";
const PLACEHOLDER_DONG_CANDIDATES = [
  "역삼1동",
  "연남동",
  "망원1동",
  "성수2가3동",
  "서교동",
  "삼청동",
  "정자동",
  "광안2동",
  "봉천동",
  "평창동",
  "효자동",
  "송도2동",
] as const;
const COMPOSE_DONG_FLASHCARD_FLIP_DURATION_MS = 520;
const COMPOSE_DONG_FLASHCARD_INITIAL_DWELL_MS = 500;
const COMPOSE_DONG_FLASHCARD_DWELL_MS = 820;
const COMPOSE_DONG_FLASHCARD_RANDOM_STEP_COUNT = 3;
const PLACEHOLDER_DONG_LABEL_LENGTH = [...PLACEHOLDER_DONG_LABEL].length;
const DEFAULT_PLACEHOLDER_DONG_CANDIDATES = PLACEHOLDER_DONG_CANDIDATES.filter(
  (label) => getDongLabelLength(label) <= PLACEHOLDER_DONG_LABEL_LENGTH,
);

function getDongLabelLength(label: string) {
  return [...label].length;
}

function pickRandomDongSequence(
  candidates: readonly string[],
  count: number,
) {
  const shuffled = candidates
    .map((label) => ({
      label,
      sortKey: Math.random(),
    }))
    .sort((left, right) => left.sortKey - right.sortKey)
    .map((item) => item.label);

  return shuffled.slice(0, count);
}

function ComposeDongFlashcard({
  label,
  animatePlaceholder,
}: {
  label: string;
  animatePlaceholder: boolean;
}) {
  const [sequence, setSequence] = useState<string[]>([label]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [incomingLabel, setIncomingLabel] = useState<string | null>(null);
  const [introRequested, setIntroRequested] = useState(animatePlaceholder);
  const [fittingCandidates, setFittingCandidates] = useState<
    readonly string[]
  >(DEFAULT_PLACEHOLDER_DONG_CANDIDATES);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const finalLabelRef = useRef(label);
  const hasStartedIntroRef = useRef(false);
  const hasCompletedIntroRef = useRef(false);
  const introCandidatesRef = useRef<readonly string[]>(
    DEFAULT_PLACEHOLDER_DONG_CANDIDATES,
  );

  useEffect(() => {
    if (!animatePlaceholder || !measureRef.current || typeof window === "undefined") {
      return;
    }

    let cancelled = false;

    const measureElement = measureRef.current;

    const measureCandidateWidths = () => {
      const originalText = measureElement.textContent;

      const measureWidth = (value: string) => {
        measureElement.textContent = value;
        return Math.ceil(measureElement.getBoundingClientRect().width);
      };

      const nextCardWidthPx = measureWidth(PLACEHOLDER_DONG_LABEL);
      const nextCandidates = PLACEHOLDER_DONG_CANDIDATES.filter(
        (candidate) => measureWidth(candidate) <= nextCardWidthPx,
      );

      measureElement.textContent = originalText ?? PLACEHOLDER_DONG_LABEL;

      if (cancelled) {
        return;
      }

      setFittingCandidates(nextCandidates);
    };

    measureCandidateWidths();

    const handleResize = () => {
      measureCandidateWidths();
    };

    window.addEventListener("resize", handleResize);

    const fontFaceSet = document.fonts;

    void fontFaceSet.ready.then(() => {
      if (!cancelled) {
        measureCandidateWidths();
      }
    });

    return () => {
      cancelled = true;
      window.removeEventListener("resize", handleResize);
    };
  }, [animatePlaceholder]);

  useEffect(() => {
    if (animatePlaceholder) {
      setIntroRequested(true);
    }
  }, [animatePlaceholder]);

  useEffect(() => {
    if (!hasStartedIntroRef.current) {
      introCandidatesRef.current = fittingCandidates;
    }
  }, [fittingCandidates]);

  useEffect(() => {
    finalLabelRef.current = label;

    if (hasStartedIntroRef.current && !hasCompletedIntroRef.current) {
      setSequence((current) => {
        if (current.length <= 1) {
          return current;
        }

        const next = [...current];
        next[next.length - 1] = label;
        return next;
      });

      return;
    }

    setSequence([label]);
    setCurrentIndex(0);
    setIncomingLabel(null);
  }, [label]);

  useEffect(() => {
    if (!introRequested && !hasStartedIntroRef.current) {
      setSequence([finalLabelRef.current]);
      setCurrentIndex(0);
      setIncomingLabel(null);
      return;
    }

    if (!introRequested || hasStartedIntroRef.current) {
      return;
    }

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      hasStartedIntroRef.current = true;
      hasCompletedIntroRef.current = true;
      setSequence([finalLabelRef.current]);
      setCurrentIndex(0);
      setIncomingLabel(null);
      return;
    }

    hasStartedIntroRef.current = true;
    hasCompletedIntroRef.current = false;

    const introSequence = [
      PLACEHOLDER_DONG_LABEL,
      ...pickRandomDongSequence(
        introCandidatesRef.current,
        COMPOSE_DONG_FLASHCARD_RANDOM_STEP_COUNT,
      ),
      finalLabelRef.current,
    ];

    setSequence(introSequence);
    setCurrentIndex(0);
    setIncomingLabel(null);

    let cancelled = false;
    let dwellTimer: number | null = null;
    let flipTimer: number | null = null;

    function getStepLabel(index: number) {
      if (index === introSequence.length - 1) {
        return finalLabelRef.current;
      }

      return introSequence[index]!;
    }

    function queueFlip(index: number) {
      if (cancelled || index >= introSequence.length - 1) {
        hasCompletedIntroRef.current = true;
        return;
      }

      dwellTimer = window.setTimeout(() => {
        const nextIndex = index + 1;
        const nextLabel = getStepLabel(nextIndex);
        setIncomingLabel(nextLabel);

        flipTimer = window.setTimeout(() => {
          if (cancelled) {
            return;
          }

          if (nextIndex >= introSequence.length - 1) {
            hasCompletedIntroRef.current = true;
            setSequence([finalLabelRef.current]);
            setCurrentIndex(0);
            setIncomingLabel(null);
            return;
          }

          setCurrentIndex(nextIndex);
          setIncomingLabel(null);
          queueFlip(nextIndex);
        }, COMPOSE_DONG_FLASHCARD_FLIP_DURATION_MS);
      }, index === 0
        ? COMPOSE_DONG_FLASHCARD_INITIAL_DWELL_MS
        : COMPOSE_DONG_FLASHCARD_DWELL_MS);
    }

    queueFlip(0);

    return () => {
      cancelled = true;

      if (dwellTimer) {
        window.clearTimeout(dwellTimer);
      }

      if (flipTimer) {
        window.clearTimeout(flipTimer);
      }
    };
  }, [introRequested]);

  const currentLabel = sequence[currentIndex] ?? label;

  return (
    <>
      <span
        aria-hidden="true"
        className="compose-dong-flashcard__card compose-dong-flashcard__card--measure"
        ref={measureRef}
      >
        {PLACEHOLDER_DONG_LABEL}
      </span>
      <span className="compose-dong-flashcard">
        <span
          aria-hidden="true"
          className="compose-dong-flashcard__card compose-dong-flashcard__card--sizer"
        >
          {PLACEHOLDER_DONG_LABEL}
        </span>
        <span
          className={`compose-dong-flashcard__card${
            incomingLabel ? " compose-dong-flashcard__card--leaving" : ""
          }`}
        >
          {currentLabel}
        </span>
        {incomingLabel ? (
          <span className="compose-dong-flashcard__card compose-dong-flashcard__card--entering">
            {incomingLabel}
          </span>
        ) : null}
      </span>
    </>
  );
}

export type DongPostsScreenProps = {
  currentDongName: string;
  animateComposeDongPlaceholder?: boolean;
  interactionLocked?: boolean;
  scrollTargetPostId?: string | null;
  state: PostListState;
  runtimeNotice?: string | null;
  pendingNewItemsCount?: number;
  activeMenuPostId?: string | null;
  activeReportPostId?: string | null;
  reportSubmitting?: boolean;
  obscurePosts?: boolean;
  onCompose?: () => void;
  onApplyPendingUpdates?: () => void;
  onLoadMore?: () => void;
  onScrollTargetApplied?: () => void;
  onToggleAgree?: (postId?: string) => void;
  onOpenMenu?: (postId: string) => void;
  onCloseMenu?: () => void;
  onSelectReport?: (postId: string) => void;
  onCloseReportDialog?: () => void;
  onConfirmReport?: () => void;
};

export function DongPostsScreen({
  currentDongName,
  animateComposeDongPlaceholder = false,
  interactionLocked = false,
  scrollTargetPostId,
  state,
  runtimeNotice,
  pendingNewItemsCount = 0,
  activeMenuPostId,
  activeReportPostId,
  reportSubmitting = false,
  obscurePosts = false,
  onCompose,
  onApplyPendingUpdates,
  onLoadMore,
  onScrollTargetApplied,
  onToggleAgree,
  onOpenMenu,
  onCloseMenu,
  onSelectReport,
  onCloseReportDialog,
  onConfirmReport,
}: DongPostsScreenProps) {
  const activeReportPost =
    state.items.find((item) => item.id === activeReportPostId) ?? null;
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const shouldObscurePosts =
    obscurePosts && !state.loading && !state.errorMessage && !state.empty;
  const shouldShowPendingUpdatesButton =
    pendingNewItemsCount > 0 && !shouldObscurePosts;
  const composeCta = homeScreenCopy.composeCta(currentDongName);
  const shouldAnimatePlaceholderDong =
    animateComposeDongPlaceholder || composeCta.location === PLACEHOLDER_DONG_LABEL;

  useEffect(() => {
    if (!scrollTargetPostId || !scrollContainerRef.current) {
      return;
    }

    let frameId = 0;

    const scrollToTarget = () => {
      const container = scrollContainerRef.current;

      if (!container) {
        return;
      }

      const targetElement = container.querySelector<HTMLElement>(
        `[data-post-id="${scrollTargetPostId}"]`,
      );

      if (!targetElement) {
        return;
      }

      const containerTop = container.getBoundingClientRect().top;
      const targetTop = targetElement.getBoundingClientRect().top;
      const nextScrollTop = container.scrollTop + (targetTop - containerTop) - 16;

      container.scrollTo({
        top: Math.max(0, nextScrollTop),
        behavior: "smooth",
      });
      onScrollTargetApplied?.();
    };

    frameId = window.requestAnimationFrame(scrollToTarget);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [onScrollTargetApplied, scrollTargetPostId]);

  return (
    <section
      aria-label="nearby-posts-screen"
      style={{
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <header
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.94))",
          backdropFilter: "blur(10px)",
          boxShadow: "0 8px 14px rgba(17, 24, 39, 0.08)",
          display: "flex",
          flexDirection: "column",
          gap: uiSpacing.md,
          padding: `calc(env(safe-area-inset-top, 0px) + ${uiSpacing.pageY}) ${uiSpacing.pageX} ${uiSpacing.xxl}`,
          position: "relative",
          zIndex: 2,
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexDirection: "column",
            gap: uiSpacing.xs,
            textAlign: "center",
          }}
        >
          <h1
            style={{
              alignItems: "baseline",
              color: uiColors.textStrong,
              display: "flex",
              flexWrap: "wrap",
              fontSize: "22px",
              fontWeight: 700,
              gap: uiSpacing.sm,
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            <span>{homeScreenCopy.title}</span>
            <span
              style={{
                color: uiColors.textMuted,
              }}
            >
              {homeScreenCopy.titleSuffix}
            </span>
          </h1>
          {homeScreenCopy.eyebrow ? (
            <span
              style={{
                color: uiColors.textStrong,
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.02em",
              }}
            >
              {homeScreenCopy.eyebrow}
            </span>
          ) : null}
          {homeScreenCopy.subtitle ? (
            <p
              style={{
                color: uiColors.textMuted,
                fontSize: "13px",
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {homeScreenCopy.subtitle}
            </p>
          ) : null}
        </div>

        {runtimeNotice ? (
          <div
            style={{
              background: "#fff7ed",
              border: "1px solid #fdba74",
              borderRadius: uiRadius.md,
              color: "#9a3412",
              fontSize: "12px",
              lineHeight: 1.5,
              padding: `${uiSpacing.sm} ${uiSpacing.md}`,
            }}
          >
            {runtimeNotice}
          </div>
        ) : null}

        <button
          onClick={onCompose}
          style={{
            alignItems: "center",
            background: "linear-gradient(180deg, #fffdfa 0%, #f8f2e8 100%)",
            border: "1px solid #e7dccd",
            borderRadius: uiRadius.pill,
            boxShadow:
              "0 14px 28px rgba(116, 94, 62, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
            color: uiColors.textStrong,
            cursor: "pointer",
            display: "grid",
            fontSize: "16px",
            fontWeight: 700,
            gridTemplateColumns: "30px minmax(0, 1fr) 30px",
            lineHeight: 1.35,
            padding: `${uiSpacing.lg} ${uiSpacing.xl}`,
            transform: "translateY(-1px)",
            width: "100%",
          }}
          type="button"
        >
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              height: "30px",
              width: "30px",
            }}
          />
          <span
            style={{
              alignItems: "center",
              display: "flex",
              gap: "0.04em",
              justifyContent: "center",
              justifySelf: "stretch",
              minWidth: 0,
              textAlign: "center",
              width: "100%",
            }}
          >
            <span
              style={{
                color: uiColors.textMuted,
              }}
            >
              {composeCta.prefix}
            </span>
            <ComposeDongFlashcard
              animatePlaceholder={shouldAnimatePlaceholderDong}
              label={composeCta.location}
            />
            <span
              style={{
                color: uiColors.textMuted,
              }}
            >
              {composeCta.suffix}
            </span>
          </span>
          <span
            style={{
              display: "inline-flex",
              justifySelf: "end",
              transform: "translateX(-2px)",
            }}
          >
            <Image alt="" src={penWritingImage} width={20} height={20} />
          </span>
        </button>
      </header>

      <div
        style={{
          background: uiColors.surface,
          display: "flex",
          flex: 1,
          flexDirection: "column",
          minHeight: 0,
          overflow: "hidden",
          pointerEvents: interactionLocked ? "none" : "auto",
          position: "relative",
          touchAction: interactionLocked ? "none" : "auto",
        }}
      >
        <div
          ref={scrollContainerRef}
          style={{
            background: uiColors.surface,
            display: "flex",
            flexDirection: "column",
            gap: uiSpacing.md,
            minHeight: 0,
            overflowY: interactionLocked ? "hidden" : "auto",
            overscrollBehaviorY: interactionLocked ? "none" : "contain",
            padding: `${uiSpacing.lg} ${uiSpacing.pageX} ${
              shouldShowPendingUpdatesButton
                ? "calc(96px + env(safe-area-inset-bottom, 0px))"
                : uiSpacing.xxxl
            }`,
            position: "relative",
            touchAction: interactionLocked ? "none" : "pan-y",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {activeMenuPostId ? (
            <button
              aria-label="메뉴 닫기"
              onClick={onCloseMenu}
              style={{
                appearance: "none",
                background: "transparent",
                border: "none",
                cursor: "default",
                inset: 0,
                padding: 0,
                position: "absolute",
                zIndex: 1,
              }}
              type="button"
            />
          ) : null}

          {state.loading ? <LoadingState label="목록을 불러오는 중" /> : null}
          {state.errorMessage ? <ErrorState message={state.errorMessage} /> : null}

          <div
            className="global-feed-preview"
            data-obscured={shouldObscurePosts ? "true" : undefined}
            style={{
              position: "relative",
            }}
          >
            <div
              className={shouldObscurePosts ? "global-feed-preview__content" : undefined}
            >
              {state.empty ? (
                <EmptyState
                  title={homeScreenCopy.emptyTitle}
                  description={homeScreenCopy.emptyDescription}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: uiSpacing.md,
                  }}
                >
                  {state.items.map((item, index) => (
                    <div
                      data-post-id={item.id}
                      key={item.id}
                      className={
                        shouldObscurePosts ? "global-feed-preview__card" : undefined
                      }
                      style={
                        shouldObscurePosts
                          ? ({
                              animationDelay: `${index * 120}ms`,
                            } satisfies CSSProperties)
                          : undefined
                      }
                    >
                      <PostListItem
                        {...item}
                        isMenuOpen={item.id === activeMenuPostId}
                        onCloseMenu={onCloseMenu}
                        onOpenMenu={onOpenMenu}
                        onSelectReport={onSelectReport}
                        onToggleAgree={onToggleAgree}
                      />
                    </div>
                  ))}
                  {state.nextCursor && !state.loadingMore ? (
                    <button
                      onClick={onLoadMore}
                      style={{
                        appearance: "none",
                        background: "#fffdfa",
                        border: "1px solid #e7dccd",
                        borderRadius: uiRadius.pill,
                        color: uiColors.textStrong,
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: 700,
                        padding: `${uiSpacing.md} ${uiSpacing.lg}`,
                        width: "100%",
                      }}
                      type="button"
                    >
                      더 보기
                    </button>
                  ) : null}
                  {state.loadingMore ? <LoadingState label="더 불러오는 중" /> : null}
                </div>
              )}
            </div>
            {shouldObscurePosts ? (
              <div aria-hidden="true" className="global-feed-preview__veil">
                <div className="global-feed-preview__badge">
                  위치를 허용하면 근처 글의 내용을 읽을 수 있어요.
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {shouldShowPendingUpdatesButton ? (
        <div
          style={{
            bottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
            display: "flex",
            justifyContent: "center",
            left: uiSpacing.pageX,
            pointerEvents: "none",
            position: "absolute",
            right: uiSpacing.pageX,
            zIndex: 12,
          }}
        >
          <button
            onClick={onApplyPendingUpdates}
            style={{
              alignItems: "center",
              appearance: "none",
              background: "linear-gradient(180deg, #60a5fa 0%, #3b82f6 100%)",
              border: "1px solid rgba(255, 255, 255, 0.34)",
              borderRadius: uiRadius.pill,
              boxShadow: "0 14px 32px rgba(96, 165, 250, 0.26)",
              color: uiColors.textInverse,
              cursor: "pointer",
              display: "inline-flex",
              fontSize: "14px",
              fontWeight: 700,
              justifyContent: "center",
              minHeight: "48px",
              padding: `${uiSpacing.md} ${uiSpacing.xxl}`,
              pointerEvents: "auto",
            }}
            type="button"
          >
            새 글 {pendingNewItemsCount}개 이어보기
          </button>
        </div>
      ) : null}

      {activeReportPost ? (
        <div
          onClick={reportSubmitting ? undefined : onCloseReportDialog}
          style={{
            alignItems: "center",
            background: "rgba(17, 24, 39, 0.28)",
            display: "flex",
            inset: 0,
            justifyContent: "center",
            padding: uiSpacing.pageX,
            position: "absolute",
            zIndex: 30,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              background: uiColors.surface,
              border: `1px solid ${uiColors.border}`,
              borderRadius: "22px",
              boxShadow: "0 12px 28px rgba(17, 24, 39, 0.14)",
              display: "flex",
              flexDirection: "column",
              gap: uiSpacing.xl,
              maxWidth: "320px",
              padding: `${uiSpacing.xl} ${uiSpacing.xl}`,
              width: "100%",
            }}
          >
            <h2
              style={{
                color: uiColors.textStrong,
                fontSize: "15px",
                fontWeight: 600,
                lineHeight: 1.4,
                margin: 0,
                textAlign: "center",
              }}
            >
              이 글을 신고할까요?
            </h2>

            <div
              style={{
                display: "flex",
                gap: uiSpacing.sm,
              }}
            >
              <button
                disabled={reportSubmitting}
                onClick={onCloseReportDialog}
                style={{
                  appearance: "none",
                  background: "#f3f5f7",
                  border: "1px solid rgba(17, 24, 39, 0.08)",
                  borderRadius: uiRadius.pill,
                  color: uiColors.textStrong,
                  cursor: reportSubmitting ? "default" : "pointer",
                  flex: 1,
                  fontSize: "14px",
                  fontWeight: 600,
                  padding: `${uiSpacing.md} ${uiSpacing.lg}`,
                }}
                type="button"
              >
                취소
              </button>
              <button
                disabled={reportSubmitting}
                onClick={onConfirmReport}
                style={{
                  appearance: "none",
                  background: "#f3f5f7",
                  border: "1px solid rgba(17, 24, 39, 0.08)",
                  borderRadius: uiRadius.pill,
                  color: uiColors.textStrong,
                  cursor: reportSubmitting ? "default" : "pointer",
                  flex: 1,
                  fontSize: "14px",
                  fontWeight: 600,
                  padding: `${uiSpacing.md} ${uiSpacing.lg}`,
                }}
                type="button"
              >
                {reportSubmitting ? "처리 중.." : "신고"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
