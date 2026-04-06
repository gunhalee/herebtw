import type { RefObject } from "react";
import { ErrorState } from "../common/error-state";
import { LoadingState } from "../common/loading-state";
import type { PostListState } from "../../types/post";
import { uiColors, uiSpacing } from "../../lib/ui/tokens";
import { DongPostsFeedContent } from "./dong-posts-feed-content";
import { DongPostsFeedVeil } from "./dong-posts-feed-veil";

type DongPostsFeedProps = {
  activeMenuPostId?: string | null;
  interactionLocked?: boolean;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  shouldObscurePosts: boolean;
  shouldShowPendingUpdatesButton: boolean;
  state: PostListState;
  onCloseMenu?: () => void;
  onLoadMore?: () => void;
  onOpenMenu?: (postId: string) => void;
  onSelectReport?: (postId: string) => void;
  onToggleAgree?: (postId?: string) => void;
};

export function DongPostsFeed({
  activeMenuPostId,
  interactionLocked = false,
  scrollContainerRef,
  shouldObscurePosts,
  shouldShowPendingUpdatesButton,
  state,
  onCloseMenu,
  onLoadMore,
  onOpenMenu,
  onSelectReport,
  onToggleAgree,
}: DongPostsFeedProps) {
  return (
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
              pointerEvents: "none",
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
            <DongPostsFeedContent
              activeMenuPostId={activeMenuPostId}
              shouldObscurePosts={shouldObscurePosts}
              state={state}
              onCloseMenu={onCloseMenu}
              onLoadMore={onLoadMore}
              onOpenMenu={onOpenMenu}
              onSelectReport={onSelectReport}
              onToggleAgree={onToggleAgree}
            />
          </div>
          {shouldObscurePosts ? <DongPostsFeedVeil /> : null}
        </div>
      </div>
    </div>
  );
}
