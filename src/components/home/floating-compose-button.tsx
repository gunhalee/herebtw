import { uiColors, uiRadius, uiSpacing } from "../../lib/ui/tokens";
import { VoteIcon } from "../vote-icon";

type FloatingComposeButtonProps = {
  elevated?: boolean;
  disabled?: boolean;
  onCompose?: () => void;
};

export function FloatingComposeButton({
  elevated = false,
  disabled = false,
  onCompose,
}: FloatingComposeButtonProps) {
  const baseBottomOffset = elevated ? "92px" : "20px";
  const label = "\uAE00 \uB0A8\uAE30\uAE30";

  return (
    <button
      aria-label={label}
      disabled={disabled}
      onClick={onCompose}
      style={{
        alignItems: "center",
        appearance: "none",
        backdropFilter: "blur(10px)",
        background: "linear-gradient(180deg, #fffdfa 0%, #f8f2e8 100%)",
        border: "1px solid #e7dccd",
        borderRadius: uiRadius.pill,
        bottom: `calc(${baseBottomOffset} + env(safe-area-inset-bottom, 0px))`,
        boxShadow:
          "0 18px 34px rgba(116, 94, 62, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.92)",
        cursor: disabled ? "default" : "pointer",
        display: "inline-flex",
        gap: uiSpacing.xs,
        height: "54px",
        justifyContent: "center",
        opacity: disabled ? 0.6 : 1,
        padding: `0 ${uiSpacing.md} 0 ${uiSpacing.lg}`,
        position: "absolute",
        right: uiSpacing.pageX,
        zIndex: 12,
      }}
      type="button"
    >
      <span
        style={{
          color: uiColors.textStrong,
          fontSize: "14px",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          position: "relative",
          whiteSpace: "nowrap",
          zIndex: 1,
        }}
      >
        {label}
      </span>
      <VoteIcon
        size={24}
        style={{
          color: disabled ? "#9ca3af" : uiColors.textStrong,
          filter: disabled ? "none" : "drop-shadow(0 3px 8px rgba(17, 24, 39, 0.16))",
          position: "relative",
          zIndex: 1,
        }}
      />
    </button>
  );
}
