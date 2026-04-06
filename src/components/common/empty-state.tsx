import {
  uiColors,
  uiRadius,
  uiSpacing,
  uiTypography,
} from "../../lib/ui/tokens";

type EmptyStateProps = {
  title?: string;
  description?: string;
};

export function EmptyState({
  title = "아직 이 지역의 목소리가 없어요",
  description = "첫 번째 목소리를 남겨보세요.",
}: EmptyStateProps) {
  return (
    <section
      style={{
        background: uiColors.surfaceMuted,
        border: `1px solid ${uiColors.border}`,
        borderRadius: uiRadius.md,
        display: "flex",
        flexDirection: "column",
        gap: uiSpacing.xs,
        padding: uiSpacing.lg,
      }}
    >
      <h3
        style={{
          color: uiColors.textStrong,
          fontSize: uiTypography.title.fontSize,
          fontWeight: uiTypography.title.fontWeight,
          lineHeight: uiTypography.title.lineHeight,
          margin: 0,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          color: uiColors.textMuted,
          fontSize: uiTypography.body.fontSize,
          margin: 0,
        }}
      >
        {description}
      </p>
    </section>
  );
}
