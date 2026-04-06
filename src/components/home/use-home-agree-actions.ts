"use client";

import { useState } from "react";
import { useLatestRef } from "../../lib/hooks/use-latest-ref";
import { toggleHomePostAgree } from "./home-post-api";
import type {
  HomePostItem,
  HomePostItemUpdater,
} from "./home-post-state-actions";

type UseHomeAgreeActionsParams = {
  ensureDeviceReady: () => Promise<string>;
  findPostItem: (postId: string) => HomePostItem | undefined;
  patchFeedItem: (
    targetPostId: string,
    updater: HomePostItemUpdater,
    options?: {
      errorMessage?: string | null;
    },
  ) => void;
};

export function useHomeAgreeActions({
  ensureDeviceReady,
  findPostItem,
  patchFeedItem,
}: UseHomeAgreeActionsParams) {
  const [agreePendingPostIds, setAgreePendingPostIds] = useState<string[]>([]);
  const agreePendingPostIdsRef = useLatestRef(agreePendingPostIds);

  async function handleToggleAgree(targetPostId?: string) {
    if (!targetPostId || agreePendingPostIdsRef.current.includes(targetPostId)) {
      return;
    }

    const targetItem = findPostItem(targetPostId);

    if (!targetItem) {
      return;
    }

    const optimisticMyAgree = !targetItem.myAgree;
    const optimisticAgreeCount = Math.max(
      0,
      targetItem.agreeCount + (optimisticMyAgree ? 1 : -1),
    );

    try {
      setAgreePendingPostIds((current) => [...current, targetPostId]);
      patchFeedItem(
        targetPostId,
        (item) => ({
          ...item,
          myAgree: optimisticMyAgree,
          agreeCount: optimisticAgreeCount,
        }),
        {
          errorMessage: null,
        },
      );

      const anonymousDeviceId = await ensureDeviceReady();
      const data = await toggleHomePostAgree(targetPostId, anonymousDeviceId);

      patchFeedItem(
        targetPostId,
        (item) => ({
          ...item,
          myAgree: data.agreed,
          agreeCount: data.agreeCount,
        }),
        {
          errorMessage: null,
        },
      );
    } catch (error) {
      patchFeedItem(
        targetPostId,
        (item) => ({
          ...item,
          myAgree: targetItem.myAgree,
          agreeCount: targetItem.agreeCount,
        }),
        {
          errorMessage:
            error instanceof Error
              ? error.message
              : "맞아요 상태를 반영하지 못했습니다.",
        },
      );
    } finally {
      setAgreePendingPostIds((current) =>
        current.filter((postId) => postId !== targetPostId),
      );
    }
  }

  return {
    agreePendingPostIdsRef,
    handleToggleAgree,
  };
}
