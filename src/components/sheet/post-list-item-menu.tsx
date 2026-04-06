"use client";

import { uiColors, uiSpacing } from "../../lib/ui/tokens";

type PostListItemMenuProps = {
  onSelectReport?: () => void;
};

export function PostListItemMenu({
  onSelectReport,
}: PostListItemMenuProps) {
  return (
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
          onClick={onSelectReport}
          style={{
            appearance: "none",
            background: "transparent",
            border: "none",
            color: uiColors.textStrong,
            cursor: "pointer",
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
  );
}
