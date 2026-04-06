import {
  uiColors,
  uiRadius,
  uiSpacing,
  uiTypography,
} from "../../lib/ui/tokens";

type LoadingStateProps = {
  label?: string;
};

export function LoadingState({
  label = "불러오는 중입니다",
}: LoadingStateProps) {
  return (
    <section
      aria-busy="true"
      style={{
        background: uiColors.surfaceLoading,
        border: `1px solid ${uiColors.border}`,
        borderRadius: uiRadius.md,
        padding: uiSpacing.lg,
      }}
    >
      <p
        style={{
          color: uiColors.textMuted,
          fontSize: uiTypography.body.fontSize,
          margin: 0,
        }}
      >
        {label}
      </p>
    </section>
  );
}
