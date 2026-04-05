"use client";

import Image from "next/image";
import type { PostListItem as PostListItemModel } from "../../types/post";
import thumbsUpImage from "../thumbs_up.png";
import { uiColors, uiSpacing } from "../../lib/ui/tokens";

export type PostListItemProps = PostListItemModel;

function formatDistance(distanceMeters: number) {
  if (!Number.isFinite(distanceMeters) || distanceMeters >= 900000) {
    return "거리 미확인";
  }

  if (distanceMeters < 1000) {
    return `${distanceMeters}m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)}km`;
}

export function PostListItem({
  id,
  content,
  administrativeDongName,
  distanceMeters,
  relativeTime,
  agreeCount,
  myAgree,
  canReport,
  isHighlighted,
  isMenuOpen,
  onToggleAgree,
  onOpenMenu,
  onCloseMenu,
  onSelectReport,
}: PostListItemProps & {
  onOpen?: (postId: string) => void;
  isMenuOpen?: boolean;
  onToggleAgree?: (postId: string) => void;
  onOpenMenu?: (postId: string) => void;
  onCloseMenu?: () => void;
  onSelectReport?: (postId: string) => void;
}) {
  const bubbleBackground = uiColors.surface;
  const agreeButtonBackground = myAgree
    ? "#eef0f3"
    : "rgba(255, 255, 255, 0.96)";
  const agreeButtonBorder = myAgree ? "#d3d7dd" : uiColors.border;

  return (
    <article
      data-highlighted={isHighlighted}
      style={{
        alignItems: "stretch",
        display: "flex",
        flexDirection: "column",
        gap: uiSpacing.xs,
      }}
    >
      <div
        style={{
          alignSelf: "stretch",
          paddingBottom: "10px",
          position: "relative",
          width: "100%",
        }}
      >
        <button
          onClick={() => onToggleAgree?.(id)}
          style={{
            alignItems: "center",
            background: agreeButtonBackground,
            border: `1px solid ${agreeButtonBorder}`,
            borderRadius: "999px",
            boxShadow: "0 8px 18px rgba(17, 24, 39, 0.12)",
            color: uiColors.textStrong,
            cursor: "pointer",
            display: "inline-flex",
            gap: "6px",
            padding: "6px 10px",
            position: "absolute",
            right: uiSpacing.md,
            bottom: 0,
            transform: "translateY(18%)",
            zIndex: 1,
          }}
          type="button"
        >
          <Image alt="" src={thumbsUpImage} width={14} height={14} />
          <span
            style={{
              color: myAgree ? uiColors.textStrong : uiColors.textMuted,
              fontSize: "12px",
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            {agreeCount}
          </span>
        </button>

        <div
          style={{
            background: bubbleBackground,
            border: isHighlighted
              ? "1px solid rgba(17, 24, 39, 0.14)"
              : "1px solid rgba(17, 24, 39, 0.08)",
            borderRadius: "22px",
            boxShadow: isHighlighted
              ? "0 4px 12px rgba(17, 24, 39, 0.07)"
              : "0 2px 8px rgba(17, 24, 39, 0.04)",
            boxSizing: "border-box",
            color: uiColors.textStrong,
            padding: `${uiSpacing.lg} ${uiSpacing.xl}`,
            width: "100%",
          }}
        >
          <div
            style={{
              alignItems: "flex-start",
              display: "flex",
              gap: uiSpacing.sm,
              justifyContent: "space-between",
              marginBottom: uiSpacing.sm,
            }}
          >
            <p
              style={{
                color: uiColors.textMuted,
                flex: 1,
                fontSize: "11px",
                fontWeight: 400,
                lineHeight: 1.35,
                margin: 0,
              }}
            >
              여기{" "}
              <span style={{ color: uiColors.textStrong }}>
                {administrativeDongName}
              </span>
              {` 근데 · ${formatDistance(distanceMeters)} · ${relativeTime}`}
            </p>

            <button
              aria-label="신고 메뉴 열기"
              disabled={!canReport}
              onClick={() => (isMenuOpen ? onCloseMenu?.() : onOpenMenu?.(id))}
              style={{
                appearance: "none",
                background: "transparent",
                border: "none",
                color: canReport ? uiColors.textStrong : "#c1c7d0",
                cursor: canReport ? "pointer" : "default",
                flexShrink: 0,
                fontSize: "16px",
                fontWeight: 500,
                lineHeight: 1,
                margin: 0,
                padding: 0,
                textAlign: "right",
                transform: "translateY(-1px)",
              }}
              type="button"
            >
              ⋯
            </button>
          </div>

          <p
            style={{
              color: uiColors.textStrong,
              fontSize: "15px",
              fontWeight: 500,
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {content}
          </p>
        </div>

        {isMenuOpen ? (
          <div
            style={{
              position: "absolute",
              right: uiSpacing.xs,
              top: "-8px",
              zIndex: 3,
            }}
          >
            <div
              style={{
                background: uiColors.surface,
                border: "1px solid rgba(17, 24, 39, 0.08)",
                borderRadius: "12px",
                boxShadow: "0 6px 16px rgba(17, 24, 39, 0.08)",
                padding: "4px",
              }}
            >
              <button
                disabled={!canReport}
                onClick={() => onSelectReport?.(id)}
                style={{
                  appearance: "none",
                  background: "transparent",
                  border: "none",
                  color: canReport ? uiColors.textStrong : "#c1c7d0",
                  cursor: canReport ? "pointer" : "default",
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 500,
                  margin: 0,
                  padding: "7px 10px",
                  whiteSpace: "nowrap",
                }}
                type="button"
              >
                신고하기
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
