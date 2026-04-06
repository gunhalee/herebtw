import {
  uiColors,
  uiRadius,
  uiSpacing,
  uiTypography,
} from "../../lib/ui/tokens";

type ErrorStateProps = {
  message?: string;
};

export function ErrorState({
  message = "문제가 발생했어요. 잠시 후 다시 시도해주세요.",
}: ErrorStateProps) {
  return (
    <section
      role="alert"
      style={{
        background: uiColors.surfaceError,
        border: `1px solid ${uiColors.dangerSoft}`,
        borderRadius: uiRadius.md,
        padding: uiSpacing.lg,
      }}
    >
      <p
        style={{
          color: uiColors.danger,
          fontSize: uiTypography.body.fontSize,
          fontWeight: 600,
          margin: 0,
        }}
      >
        {message}
      </p>
    </section>
  );
}
