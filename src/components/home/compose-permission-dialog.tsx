import {
  uiColors,
  uiRadius,
  uiSpacing,
  uiTypography,
} from "../../lib/ui/tokens";

type ComposePermissionDialogProps = {
  onClose: () => void;
  onRetry: () => void;
};

export function ComposePermissionDialog({
  onClose,
  onRetry,
}: ComposePermissionDialogProps) {
  return (
    <div
      aria-modal="true"
      role="dialog"
      style={{
        alignItems: "center",
        background: "rgba(17, 24, 39, 0.28)",
        display: "flex",
        inset: 0,
        justifyContent: "center",
        padding: uiSpacing.pageX,
        position: "absolute",
        zIndex: 14,
      }}
    >
      <section
        style={{
          background: "#fffdfa",
          borderRadius: uiRadius.lg,
          boxShadow: "0 18px 38px rgba(17, 24, 39, 0.18)",
          display: "flex",
          flexDirection: "column",
          gap: uiSpacing.xl,
          maxWidth: "320px",
          padding: uiSpacing.xl,
          width: "100%",
        }}
      >
        <p
          style={{
            color: uiColors.textStrong,
            fontSize: "14px",
            fontWeight: 600,
            lineHeight: 1.6,
            margin: 0,
            textAlign: "center",
          }}
        >
          글을 작성하려면 위치 권한 허용이 필요해요.
        </p>
        <div
          style={{
            display: "grid",
            gap: uiSpacing.sm,
            gridTemplateColumns: "1fr 1fr",
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: "#ffffff",
              border: `1px solid ${uiColors.border}`,
              borderRadius: uiRadius.pill,
              color: uiColors.textStrong,
              cursor: "pointer",
              fontSize: uiTypography.body.fontSize,
              fontWeight: 600,
              padding: `${uiSpacing.sm} ${uiSpacing.lg}`,
            }}
            type="button"
          >
            닫기
          </button>
          <button
            onClick={onRetry}
            style={{
              background: "#ffffff",
              border: `1px solid ${uiColors.border}`,
              borderRadius: uiRadius.pill,
              color: uiColors.textStrong,
              cursor: "pointer",
              fontSize: uiTypography.body.fontSize,
              fontWeight: 600,
              padding: `${uiSpacing.sm} ${uiSpacing.lg}`,
            }}
            type="button"
          >
            다시 시도
          </button>
        </div>
      </section>
    </div>
  );
}
