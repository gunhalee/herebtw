"use client";

import { useEffect, useRef, useState } from "react";

type SheetViewportLayout = {
  keyboardInset: number;
  viewportHeight: number;
};

function readSheetViewportLayout(): SheetViewportLayout {
  if (typeof window === "undefined") {
    return {
      keyboardInset: 0,
      viewportHeight: 720,
    };
  }

  const visualViewport = window.visualViewport;

  if (!visualViewport) {
    return {
      keyboardInset: 0,
      viewportHeight: window.innerHeight,
    };
  }

  const viewportHeight = Math.round(visualViewport.height);
  const layoutViewportHeight = Math.max(
    window.innerHeight,
    Math.round(visualViewport.height + visualViewport.offsetTop),
  );
  const keyboardInset = Math.max(
    0,
    layoutViewportHeight -
      Math.round(visualViewport.height + visualViewport.offsetTop),
  );

  return {
    keyboardInset,
    viewportHeight,
  };
}

type UseComposeSheetLayoutParams = {
  onDismiss?: () => void;
};

export function useComposeSheetLayout({
  onDismiss,
}: UseComposeSheetLayoutParams) {
  const [sheetPortalReady, setSheetPortalReady] = useState(false);
  const [sheetViewportLayout, setSheetViewportLayout] =
    useState<SheetViewportLayout>(readSheetViewportLayout);
  const touchScrollStartYRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    const previousRootOverflow = root.style.overflow;
    const previousRootOverscrollBehavior = root.style.overscrollBehavior;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyLeft = body.style.left;
    const previousBodyRight = body.style.right;
    const previousBodyWidth = body.style.width;
    const previousBodyOverscrollBehavior = body.style.overscrollBehavior;

    root.classList.add("compose-sheet-open");
    body.classList.add("compose-sheet-open");
    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overscrollBehavior = "none";

    const resolveScrollableTextarea = (target: EventTarget | null) => {
      if (!(target instanceof Element)) {
        return null;
      }

      const textarea = target.closest("#sheet-post-content");
      return textarea instanceof HTMLTextAreaElement ? textarea : null;
    };

    const canScrollTextarea = (
      textarea: HTMLTextAreaElement,
      deltaY: number,
    ) => {
      if (textarea.scrollHeight <= textarea.clientHeight + 1) {
        return false;
      }

      const scrollTop = textarea.scrollTop;
      const maxScrollTop = textarea.scrollHeight - textarea.clientHeight;
      const isScrollingDown = deltaY > 0;
      const isScrollingUp = deltaY < 0;
      const isAtTop = scrollTop <= 0;
      const isAtBottom = scrollTop >= maxScrollTop - 1;

      if ((isAtTop && isScrollingDown) || (isAtBottom && isScrollingUp)) {
        return false;
      }

      return true;
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        touchScrollStartYRef.current = null;
        return;
      }

      touchScrollStartYRef.current = event.touches[0]?.clientY ?? null;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const textarea = resolveScrollableTextarea(event.target);

      if (!textarea || event.touches.length !== 1) {
        event.preventDefault();
        return;
      }

      const currentTouchY = event.touches[0]?.clientY ?? null;
      const previousTouchY = touchScrollStartYRef.current;

      if (currentTouchY === null || previousTouchY === null) {
        touchScrollStartYRef.current = currentTouchY;
        return;
      }

      const deltaY = currentTouchY - previousTouchY;
      touchScrollStartYRef.current = currentTouchY;

      if (!canScrollTextarea(textarea, deltaY)) {
        event.preventDefault();
      }
    };

    const handleWheel = (event: WheelEvent) => {
      const textarea = resolveScrollableTextarea(event.target);

      if (!textarea || !canScrollTextarea(textarea, event.deltaY)) {
        event.preventDefault();
      }
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("wheel", handleWheel);
      touchScrollStartYRef.current = null;
      root.classList.remove("compose-sheet-open");
      body.classList.remove("compose-sheet-open");
      root.style.overflow = previousRootOverflow;
      root.style.overscrollBehavior = previousRootOverscrollBehavior;
      body.style.overflow = previousBodyOverflow;
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.left = previousBodyLeft;
      body.style.right = previousBodyRight;
      body.style.width = previousBodyWidth;
      body.style.overscrollBehavior = previousBodyOverscrollBehavior;
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    setSheetPortalReady(true);

    return () => {
      setSheetPortalReady(false);
    };
  }, []);

  useEffect(() => {
    if (!onDismiss || typeof window === "undefined") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onDismiss();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onDismiss]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const visualViewport = window.visualViewport;

    const syncViewportLayout = () => {
      setSheetViewportLayout(readSheetViewportLayout());
    };

    syncViewportLayout();
    window.addEventListener("resize", syncViewportLayout);
    visualViewport?.addEventListener("resize", syncViewportLayout);
    visualViewport?.addEventListener("scroll", syncViewportLayout);

    return () => {
      window.removeEventListener("resize", syncViewportLayout);
      visualViewport?.removeEventListener("resize", syncViewportLayout);
      visualViewport?.removeEventListener("scroll", syncViewportLayout);
    };
  }, []);

  return {
    sheetPortalReady,
    sheetViewportLayout,
  };
}
