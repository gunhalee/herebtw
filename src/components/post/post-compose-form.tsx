"use client";

import type { FormEventHandler } from "react";
import type { PostComposeState } from "../../types/post";
import {
  uiColors,
  uiRadius,
  uiSpacing,
  uiTypography,
} from "../../lib/ui/tokens";

export type PostComposeFormProps = PostComposeState & {
  locationStatusText?: string | null;
  onChangeContent?: (value: string) => void;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  submitDisabled?: boolean;
};

export function PostComposeForm({
  content,
  charCount,
  cooldownRemainingSeconds,
  duplicateBlocked,
  errorMessage,
  locationResolved,
  locationStatusText,
  resolvedDongName,
  submitting,
  onChangeContent,
  onSubmit,
  submitDisabled = false,
}: PostComposeFormProps) {
  const disabled =
    submitDisabled ||
    submitting ||
    !locationResolved ||
    charCount < 1 ||
    charCount > 100;

  return (
    <form
      onSubmit={onSubmit}
      style={{
        background: uiColors.surface,
        border: `1px solid ${uiColors.border}`,
        borderRadius: uiRadius.lg,
        display: "flex",
        flexDirection: "column",
        gap: uiSpacing.lg,
        padding: uiSpacing.xl,
      }}
    >
      <p
        style={{
          color: locationResolved ? uiColors.textStrong : uiColors.danger,
          fontSize: uiTypography.body.fontSize,
          margin: 0,
        }}
      >
        {locationResolved
          ? `${resolvedDongName}에서 작성 중이에요.`
          : (locationStatusText ?? "현재 위치를 확인하는 중이에요.")}
      </p>

      <label
        htmlFor="post-content"
        style={{
          color: uiColors.textStrong,
          fontSize: uiTypography.body.fontSize,
          fontWeight: 600,
        }}
      >
        내용
      </label>

      <textarea
        id="post-content"
        maxLength={100}
        onChange={(event) => onChangeContent?.(event.target.value)}
        placeholder="지금 있는 곳의 불편함이나 좋았던 점을 100자 안으로 적어 보세요."
        style={{
          border: `1px solid ${uiColors.border}`,
          borderRadius: uiRadius.md,
          minHeight: "160px",
          padding: uiSpacing.lg,
          resize: "vertical",
        }}
        value={content}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: uiSpacing.xs,
        }}
      >
        <span
          style={{
            color: uiColors.textMuted,
            fontSize: uiTypography.meta.fontSize,
            fontWeight: uiTypography.meta.fontWeight,
          }}
        >
          {charCount}/100
        </span>

        {cooldownRemainingSeconds > 0 ? (
          <p
            style={{
              color: uiColors.textMuted,
              fontSize: uiTypography.meta.fontSize,
              margin: 0,
            }}
          >
            {`${cooldownRemainingSeconds}초 뒤에 다시 작성할 수 있어요.`}
          </p>
        ) : null}

        {duplicateBlocked ? (
          <p
            style={{
              color: uiColors.danger,
              fontSize: uiTypography.meta.fontSize,
              margin: 0,
            }}
          >
            같은 내용의 글이 이미 등록되어 있어요. 내용을 조금 바꿔 다시
            시도해 주세요.
          </p>
        ) : null}

        {errorMessage ? (
          <p
            style={{
              color: uiColors.danger,
              fontSize: uiTypography.meta.fontSize,
              margin: 0,
            }}
          >
            {errorMessage}
          </p>
        ) : null}
      </div>

      <button
        disabled={disabled}
        style={{
          background: disabled
            ? uiColors.buttonPrimaryMuted
            : uiColors.buttonPrimary,
          border: `1px solid ${uiColors.buttonPrimary}`,
          borderRadius: uiRadius.pill,
          color: disabled ? uiColors.textMuted : uiColors.textInverse,
          display: "flex",
          justifyContent: "center",
          padding: `${uiSpacing.xs} ${uiSpacing.lg}`,
          width: "100%",
        }}
        type="submit"
      >
        {submitting ? "등록하는 중..." : "등록하기"}
      </button>
    </form>
  );
}
