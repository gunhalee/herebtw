"use client";

import Image from "next/image";
import { formatAdministrativeAreaNameForHomeDisplay } from "../../lib/geo/format-administrative-area";
import { formatBucketedDistance } from "../../lib/geo/format-bucketed-distance";
import { uiColors, uiSpacing } from "../../lib/ui/tokens";
import thumbsUpImage from "../thumbs_up.png";

type PostListItemCardProps = {
  agreeCount: number;
  administrativeDongName: string;
  content: string;
  distanceMeters: number;
  isHighlighted: boolean;
  isMenuOpen?: boolean;
  myAgree: boolean;
  relativeTime: string;
  onCloseMenu?: () => void;
  onOpenMenu?: () => void;
  onToggleAgree?: () => void;
};

export function PostListItemCard({
  agreeCount,
  administrativeDongName,
  content,
  distanceMeters,
  isHighlighted,
  isMenuOpen = false,
  myAgree,
  relativeTime,
  onCloseMenu,
  onOpenMenu,
  onToggleAgree,
}: PostListItemCardProps) {
  const displayAdministrativeDongName =
    formatAdministrativeAreaNameForHomeDisplay(administrativeDongName);
  const agreeButtonBackground = myAgree
    ? "#eef0f3"
    : "rgba(255, 255, 255, 0.96)";
  const agreeButtonBorder = myAgree ? "#d3d7dd" : uiColors.border;

  return (
    <>
      <button
        onClick={onToggleAgree}
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
          background: uiColors.surface,
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
              flex: 1,
              fontSize: "11px",
              lineHeight: 1.35,
              margin: 0,
            }}
          >
            <span
              style={{
                color: uiColors.textStrong,
                fontWeight: 500,
              }}
            >
              {displayAdministrativeDongName}
            </span>
            <span
              style={{
                color: uiColors.textMuted,
                fontWeight: 400,
              }}
            >
              {` · ${formatBucketedDistance(distanceMeters)} · ${relativeTime}`}
            </span>
          </p>

          <button
            aria-label="신고 메뉴 열기"
            onClick={isMenuOpen ? onCloseMenu : onOpenMenu}
            style={{
              appearance: "none",
              background: "transparent",
              border: "none",
              color: uiColors.textStrong,
              cursor: "pointer",
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
    </>
  );
}
