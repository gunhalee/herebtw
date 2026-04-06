"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";

export const COMPOSE_DONG_PLACEHOLDER_LABEL = "우리 동네";

const PLACEHOLDER_DONG_CANDIDATES = [
  "역삼1동",
  "연남동",
  "망원1동",
  "서교동",
  "삼청동",
  "정자동",
  "광안2동",
  "봉천동",
  "평창동",
  "효자동",
  "송도2동",
] as const;
const COMPOSE_DONG_FLASHCARD_FLIP_DURATION_MS = 520;
const COMPOSE_DONG_FLASHCARD_INITIAL_DWELL_MS = 500;
const COMPOSE_DONG_FLASHCARD_DWELL_MS = 820;
const COMPOSE_DONG_FLASHCARD_RANDOM_STEP_COUNT = 3;
const PLACEHOLDER_DONG_LABEL_LENGTH = [...COMPOSE_DONG_PLACEHOLDER_LABEL].length;
const DEFAULT_PLACEHOLDER_DONG_CANDIDATES = PLACEHOLDER_DONG_CANDIDATES.filter(
  (label) => getDongLabelLength(label) <= PLACEHOLDER_DONG_LABEL_LENGTH,
);

type UseComposeDongFlashcardParams = {
  label: string;
  animatePlaceholder: boolean;
};

type UseComposeDongFlashcardResult = {
  cardWidthPx: number | null;
  currentLabel: string;
  incomingLabel: string | null;
  measureRef: MutableRefObject<HTMLSpanElement | null>;
};

type WidthMode = "placeholder" | "final";

function getDongLabelLength(label: string) {
  return [...label].length;
}

function pickRandomDongSequence(candidates: readonly string[], count: number) {
  const shuffled = candidates
    .map((label) => ({
      label,
      sortKey: Math.random(),
    }))
    .sort((left, right) => left.sortKey - right.sortKey)
    .map((item) => item.label);

  return shuffled.slice(0, count);
}

function buildIntroSequence(finalLabel: string, candidates: readonly string[]) {
  return [
    COMPOSE_DONG_PLACEHOLDER_LABEL,
    ...pickRandomDongSequence(candidates, COMPOSE_DONG_FLASHCARD_RANDOM_STEP_COUNT),
    finalLabel,
  ];
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function readCardMeasurements(measureElement: HTMLSpanElement, finalLabel: string) {
  const originalText = measureElement.textContent;

  const measureWidth = (value: string) => {
    measureElement.textContent = value;
    return Math.ceil(measureElement.getBoundingClientRect().width);
  };

  const placeholderCardWidthPx = measureWidth(COMPOSE_DONG_PLACEHOLDER_LABEL);
  const expandedCardWidthPx = Math.max(
    placeholderCardWidthPx,
    measureWidth(finalLabel),
  );
  const fittingCandidates = PLACEHOLDER_DONG_CANDIDATES.filter(
    (candidate) => measureWidth(candidate) <= placeholderCardWidthPx,
  );

  measureElement.textContent = originalText ?? COMPOSE_DONG_PLACEHOLDER_LABEL;

  return {
    expandedCardWidthPx,
    fittingCandidates,
    placeholderCardWidthPx,
  };
}

function startIntroAnimation(input: {
  applyCardWidth: (mode: WidthMode) => void;
  finalLabelRef: MutableRefObject<string>;
  hasCompletedIntroRef: MutableRefObject<boolean>;
  introSequence: string[];
  setCurrentIndex: Dispatch<SetStateAction<number>>;
  setIncomingLabel: Dispatch<SetStateAction<string | null>>;
  setSequence: Dispatch<SetStateAction<string[]>>;
}) {
  let cancelled = false;
  let dwellTimer: number | null = null;
  let flipTimer: number | null = null;

  function getStepLabel(index: number) {
    if (index === input.introSequence.length - 1) {
      return input.finalLabelRef.current;
    }

    return input.introSequence[index]!;
  }

  function queueFlip(index: number) {
    if (cancelled || index >= input.introSequence.length - 1) {
      input.hasCompletedIntroRef.current = true;
      return;
    }

    dwellTimer = window.setTimeout(() => {
      const nextIndex = index + 1;
      const nextLabel = getStepLabel(nextIndex);

      if (nextIndex >= input.introSequence.length - 1) {
        input.applyCardWidth("final");
      }

      input.setIncomingLabel(nextLabel);

      flipTimer = window.setTimeout(() => {
        if (cancelled) {
          return;
        }

        if (nextIndex >= input.introSequence.length - 1) {
          input.hasCompletedIntroRef.current = true;
          input.setSequence([input.finalLabelRef.current]);
          input.setCurrentIndex(0);
          input.setIncomingLabel(null);
          return;
        }

        input.setCurrentIndex(nextIndex);
        input.setIncomingLabel(null);
        queueFlip(nextIndex);
      }, COMPOSE_DONG_FLASHCARD_FLIP_DURATION_MS);
    }, index === 0
      ? COMPOSE_DONG_FLASHCARD_INITIAL_DWELL_MS
      : COMPOSE_DONG_FLASHCARD_DWELL_MS);
  }

  queueFlip(0);

  return () => {
    cancelled = true;

    if (dwellTimer !== null) {
      window.clearTimeout(dwellTimer);
    }

    if (flipTimer !== null) {
      window.clearTimeout(flipTimer);
    }
  };
}

export function useComposeDongFlashcard({
  label,
  animatePlaceholder,
}: UseComposeDongFlashcardParams): UseComposeDongFlashcardResult {
  const [sequence, setSequence] = useState<string[]>([label]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [incomingLabel, setIncomingLabel] = useState<string | null>(null);
  const [introRequested, setIntroRequested] = useState(animatePlaceholder);
  const [fittingCandidates, setFittingCandidates] = useState<
    readonly string[]
  >(DEFAULT_PLACEHOLDER_DONG_CANDIDATES);
  const [cardWidthPx, setCardWidthPx] = useState<number | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const finalLabelRef = useRef(label);
  const hasStartedIntroRef = useRef(false);
  const hasCompletedIntroRef = useRef(false);
  const placeholderCardWidthRef = useRef<number | null>(null);
  const expandedCardWidthRef = useRef<number | null>(null);
  const introCandidatesRef = useRef<readonly string[]>(
    DEFAULT_PLACEHOLDER_DONG_CANDIDATES,
  );

  finalLabelRef.current = label;

  function applyCardWidth(mode: WidthMode) {
    const nextWidth =
      mode === "final"
        ? expandedCardWidthRef.current ?? placeholderCardWidthRef.current
        : placeholderCardWidthRef.current ?? expandedCardWidthRef.current;

    if (typeof nextWidth !== "number") {
      return;
    }

    setCardWidthPx((current) => (current === nextWidth ? current : nextWidth));
  }

  function resetToFinalLabel() {
    setSequence([finalLabelRef.current]);
    setCurrentIndex(0);
    setIncomingLabel(null);
  }

  useLayoutEffect(() => {
    if (!measureRef.current || typeof window === "undefined") {
      return;
    }

    let cancelled = false;
    const measureElement = measureRef.current;

    const measureCandidateWidths = () => {
      const nextMeasurements = readCardMeasurements(
        measureElement,
        finalLabelRef.current,
      );

      if (cancelled) {
        return;
      }

      placeholderCardWidthRef.current = nextMeasurements.placeholderCardWidthPx;
      expandedCardWidthRef.current = nextMeasurements.expandedCardWidthPx;
      setFittingCandidates(nextMeasurements.fittingCandidates);
      applyCardWidth(
        hasStartedIntroRef.current && !hasCompletedIntroRef.current
          ? "placeholder"
          : "final",
      );
    };

    measureCandidateWidths();

    const handleResize = () => {
      measureCandidateWidths();
    };

    window.addEventListener("resize", handleResize);

    void document.fonts.ready.then(() => {
      if (!cancelled) {
        measureCandidateWidths();
      }
    });

    return () => {
      cancelled = true;
      window.removeEventListener("resize", handleResize);
    };
  }, [label]);

  useEffect(() => {
    if (animatePlaceholder) {
      setIntroRequested(true);
    }
  }, [animatePlaceholder]);

  useEffect(() => {
    if (!hasStartedIntroRef.current) {
      introCandidatesRef.current = fittingCandidates;
    }
  }, [fittingCandidates]);

  useEffect(() => {
    if (hasStartedIntroRef.current && !hasCompletedIntroRef.current) {
      setSequence((current) => {
        if (current.length <= 1) {
          return current;
        }

        const next = [...current];
        next[next.length - 1] = label;
        return next;
      });

      return;
    }

    resetToFinalLabel();
  }, [label]);

  useEffect(() => {
    if (!introRequested && !hasStartedIntroRef.current) {
      resetToFinalLabel();
      applyCardWidth("final");
      return;
    }

    if (!introRequested || hasStartedIntroRef.current) {
      return;
    }

    if (prefersReducedMotion()) {
      hasStartedIntroRef.current = true;
      hasCompletedIntroRef.current = true;
      resetToFinalLabel();
      applyCardWidth("final");
      return;
    }

    hasStartedIntroRef.current = true;
    hasCompletedIntroRef.current = false;

    const introSequence = buildIntroSequence(
      finalLabelRef.current,
      introCandidatesRef.current,
    );

    applyCardWidth("placeholder");
    setSequence(introSequence);
    setCurrentIndex(0);
    setIncomingLabel(null);

    return startIntroAnimation({
      applyCardWidth,
      finalLabelRef,
      hasCompletedIntroRef,
      introSequence,
      setCurrentIndex,
      setIncomingLabel,
      setSequence,
    });
  }, [introRequested]);

  return {
    cardWidthPx,
    currentLabel: sequence[currentIndex] ?? label,
    incomingLabel,
    measureRef,
  };
}
