import { homeScreenCopy } from "../../lib/content/home-copy";
import { uiColors, uiRadius, uiSpacing } from "../../lib/ui/tokens";
import {
  COMPOSE_DONG_PLACEHOLDER_LABEL,
  ComposeDongFlashcard,
} from "./compose-dong-flashcard";

type DongPostsHeaderProps = {
  currentDongName: string;
  animateComposeDongPlaceholder?: boolean;
  runtimeNotice?: string | null;
};

export function DongPostsHeader({
  currentDongName,
  animateComposeDongPlaceholder = false,
  runtimeNotice,
}: DongPostsHeaderProps) {
  const composeCta = homeScreenCopy.composeCta(currentDongName);
  const shouldAnimatePlaceholderDong =
    animateComposeDongPlaceholder ||
    composeCta.location === COMPOSE_DONG_PLACEHOLDER_LABEL;

  return (
    <header
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.94))",
        backdropFilter: "blur(10px)",
        boxShadow: "0 8px 14px rgba(17, 24, 39, 0.08)",
        display: "flex",
        flexDirection: "column",
        gap: uiSpacing.md,
        padding: `calc(env(safe-area-inset-top, 0px) + ${uiSpacing.pageY}) ${uiSpacing.pageX} 0`,
        position: "relative",
        zIndex: 2,
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          gap: uiSpacing.xs,
          textAlign: "center",
        }}
      >
        <h1
          style={{
            alignItems: "baseline",
            color: uiColors.textStrong,
            display: "flex",
            flexWrap: "wrap",
            fontSize: "22px",
            fontWeight: 700,
            gap: uiSpacing.sm,
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          <span>{homeScreenCopy.title}</span>
          <span
            style={{
              color: uiColors.textMuted,
            }}
          >
            {homeScreenCopy.titleSuffix}
          </span>
        </h1>
        {homeScreenCopy.eyebrow ? (
          <span
            style={{
              color: uiColors.textStrong,
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.02em",
            }}
          >
            {homeScreenCopy.eyebrow}
          </span>
        ) : null}
        {homeScreenCopy.subtitle ? (
          <p
            style={{
              color: uiColors.textMuted,
              fontSize: "13px",
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {homeScreenCopy.subtitle}
          </p>
        ) : null}
      </div>

      {runtimeNotice ? (
        <div
          style={{
            background: "#fff7ed",
            border: "1px solid #fdba74",
            borderRadius: uiRadius.md,
            color: "#9a3412",
            fontSize: "12px",
            lineHeight: 1.5,
            padding: `${uiSpacing.sm} ${uiSpacing.md}`,
          }}
        >
          {runtimeNotice}
        </div>
      ) : null}

      <div
        style={{
          alignItems: "center",
          background: "#f8f2e8",
          borderRadius: 0,
          color: "#000000",
          display: "flex",
          fontSize: "16px",
          fontWeight: 700,
          justifyContent: "center",
          lineHeight: 1.35,
          marginInline: `calc(-1 * ${uiSpacing.pageX})`,
          padding: `${uiSpacing.md} ${uiSpacing.pageX}`,
          width: `calc(100% + ${uiSpacing.pageX} + ${uiSpacing.pageX})`,
        }}
      >
        <span
          style={{
            alignItems: "center",
            display: "flex",
            gap: "0.04em",
            justifyContent: "center",
            minWidth: 0,
            textAlign: "center",
            width: "100%",
          }}
        >
          <span
            style={{
              color: "#000000",
            }}
          >
            {composeCta.prefix}
          </span>
          <ComposeDongFlashcard
            animatePlaceholder={shouldAnimatePlaceholderDong}
            label={composeCta.location}
          />
          <span
            style={{
              color: "#000000",
            }}
          >
            {composeCta.suffix}
          </span>
        </span>
      </div>
    </header>
  );
}
