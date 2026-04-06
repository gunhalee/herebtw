import { uiColors, uiRadius, uiSpacing } from "../../lib/ui/tokens";

type PendingFeedUpdatesButtonProps = {
  count: number;
  onApply?: () => void;
};

export function PendingFeedUpdatesButton({
  count,
  onApply,
}: PendingFeedUpdatesButtonProps) {
  return (
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
        onClick={onApply}
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
        새 글 {count}개 이어보기
      </button>
    </div>
  );
}
