import type { CSSProperties } from "react";
import { EmptyState } from "../common/empty-state";
import { LoadingState } from "../common/loading-state";
import { PostListItem } from "../sheet/post-list-item";
import { homeScreenCopy } from "../../lib/content/home-copy";
import type { PostListState } from "../../types/post";
import { uiColors, uiRadius, uiSpacing } from "../../lib/ui/tokens";

type DongPostsFeedContentProps = {
  activeMenuPostId?: string | null;
  shouldObscurePosts: boolean;
  state: PostListState;
  onCloseMenu?: () => void;
  onLoadMore?: () => void;
  onOpenMenu?: (postId: string) => void;
  onSelectReport?: (postId: string) => void;
  onToggleAgree?: (postId?: string) => void;
};

function DongPostsLoadMoreButton({
  onLoadMore,
}: {
  onLoadMore?: () => void;
}) {
  return (
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
  );
}

export function DongPostsFeedContent({
  activeMenuPostId,
  shouldObscurePosts,
  state,
  onCloseMenu,
  onLoadMore,
  onOpenMenu,
  onSelectReport,
  onToggleAgree,
}: DongPostsFeedContentProps) {
  if (state.empty) {
    return (
      <EmptyState
        title={homeScreenCopy.emptyTitle}
        description={homeScreenCopy.emptyDescription}
      />
    );
  }

  return (
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
          className={shouldObscurePosts ? "global-feed-preview__card" : undefined}
          style={
            ({
              animationDelay: shouldObscurePosts ? `${index * 120}ms` : undefined,
              position: "relative",
              zIndex: item.id === activeMenuPostId ? 2 : undefined,
            } satisfies CSSProperties)
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
        <DongPostsLoadMoreButton onLoadMore={onLoadMore} />
      ) : null}
      {state.loadingMore ? <LoadingState label="더 불러오는 중" /> : null}
    </div>
  );
}
