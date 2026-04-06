"use client";

import {
  COMPOSE_DONG_PLACEHOLDER_LABEL,
  useComposeDongFlashcard,
} from "./use-compose-dong-flashcard";

export { COMPOSE_DONG_PLACEHOLDER_LABEL } from "./use-compose-dong-flashcard";

type ComposeDongFlashcardProps = {
  label: string;
  animatePlaceholder: boolean;
};

export function ComposeDongFlashcard({
  label,
  animatePlaceholder,
}: ComposeDongFlashcardProps) {
  const { cardWidthPx, currentLabel, incomingLabel, measureRef } =
    useComposeDongFlashcard({
      label,
      animatePlaceholder,
    });

  return (
    <>
      <span
        aria-hidden="true"
        className="compose-dong-flashcard__card compose-dong-flashcard__card--measure"
        ref={measureRef}
      >
        {COMPOSE_DONG_PLACEHOLDER_LABEL}
      </span>
      <span
        className="compose-dong-flashcard"
        style={cardWidthPx ? { width: `${cardWidthPx}px` } : undefined}
      >
        <span
          aria-hidden="true"
          className="compose-dong-flashcard__card compose-dong-flashcard__card--sizer"
        >
          {COMPOSE_DONG_PLACEHOLDER_LABEL}
        </span>
        <span
          className={`compose-dong-flashcard__card${
            incomingLabel ? " compose-dong-flashcard__card--leaving" : ""
          }`}
        >
          {currentLabel}
        </span>
        {incomingLabel ? (
          <span className="compose-dong-flashcard__card compose-dong-flashcard__card--entering">
            {incomingLabel}
          </span>
        ) : null}
      </span>
    </>
  );
}
