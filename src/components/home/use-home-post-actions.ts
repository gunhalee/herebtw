"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { writeCachedNearbyPostList } from "../../lib/posts/browser-nearby-post-cache";
import type { PostListState, PostLocation } from "../../types/post";
import { reportHomePost, toggleHomePostAgree } from "./home-post-api";
import {
  buildPatchedPostListState,
  buildPostListErrorState,
  buildRemovedPostListState,
  patchPendingFeedSnapshot,
  removeFromPendingFeedSnapshot,
  type PendingFeedSnapshot,
} from "./home-feed-state";

type UseHomePostActionsParams = {
  postListState: PostListState;
  postListStateRef: MutableRefObject<PostListState>;
  feedLocationRef: MutableRefObject<PostLocation | null>;
  setPostListState: Dispatch<SetStateAction<PostListState>>;
  setPendingFeedSnapshot: Dispatch<SetStateAction<PendingFeedSnapshot | null>>;
  ensureDeviceReady: () => Promise<string>;
  closeMenu: () => void;
};

export function useHomePostActions({
  postListState,
  postListStateRef,
  feedLocationRef,
  setPostListState,
  setPendingFeedSnapshot,
  ensureDeviceReady,
  closeMenu,
}: UseHomePostActionsParams) {
  const [activeReportPostId, setActiveReportPostId] = useState<string | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportErrorMessage, setReportErrorMessage] = useState<string | null>(null);
  const [reportSuccessMessage, setReportSuccessMessage] = useState<string | null>(
    null,
  );
  const [reportSuccessPostId, setReportSuccessPostId] = useState<string | null>(
    null,
  );
  const [agreePendingPostIds, setAgreePendingPostIds] = useState<string[]>([]);
  const agreePendingPostIdsRef = useRef(agreePendingPostIds);

  useEffect(() => {
    agreePendingPostIdsRef.current = agreePendingPostIds;
  }, [agreePendingPostIds]);

  function patchFeedItem(
    targetPostId: string,
    updater: (item: PostListState["items"][number]) => PostListState["items"][number],
    options?: {
      errorMessage?: string | null;
    },
  ) {
    setPostListState((current) =>
      buildPatchedPostListState(current, targetPostId, updater, options),
    );
    setPendingFeedSnapshot((current) =>
      patchPendingFeedSnapshot(current, targetPostId, updater),
    );
  }

  function removeFeedItem(targetPostId: string) {
    const currentState = postListStateRef.current;
    const nextState = buildRemovedPostListState(currentState, targetPostId);

    postListStateRef.current = nextState;
    setPostListState(nextState);
    setPendingFeedSnapshot((current) =>
      removeFromPendingFeedSnapshot(current, targetPostId),
    );

    return nextState;
  }

  function handleSelectReport(postId: string) {
    setReportErrorMessage(null);
    setReportSuccessMessage(null);
    setReportSuccessPostId(null);
    setActiveReportPostId(postId);
    closeMenu();
  }

  function handleCloseReportDialog() {
    if (reportSubmitting) {
      return;
    }

    setReportErrorMessage(null);
    setActiveReportPostId(null);
  }

  function handleCloseReportSuccessDialog() {
    const targetPostId = reportSuccessPostId;

    if (targetPostId) {
      const nextState = removeFeedItem(targetPostId);
      const latestLocation = feedLocationRef.current;

      if (latestLocation) {
        writeCachedNearbyPostList(latestLocation, {
          items: nextState.items,
          nextCursor: nextState.nextCursor,
        });
      }
    }

    setReportSuccessPostId(null);
    setReportSuccessMessage(null);
  }

  async function handleToggleAgree(targetPostId?: string) {
    if (!targetPostId) {
      return;
    }

    if (agreePendingPostIds.includes(targetPostId)) {
      return;
    }

    const targetItem = postListState.items.find((item) => item.id === targetPostId);

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

  async function handleReport() {
    if (!activeReportPostId) {
      return;
    }

    const postId = activeReportPostId;
    const targetItem = postListState.items.find((item) => item.id === postId);

    if (!targetItem) {
      return;
    }

    try {
      setReportSubmitting(true);
      setReportErrorMessage(null);
      setReportSuccessMessage(null);
      const anonymousDeviceId = await ensureDeviceReady();
      await reportHomePost(postId, anonymousDeviceId);

      patchFeedItem(
        postId,
        (item) => ({
          ...item,
          canReport: false,
        }),
        {
          errorMessage: null,
        },
      );
      setReportErrorMessage(null);
      setReportSuccessPostId(postId);
      setReportSuccessMessage("신고가 접수되었어요.");
      setActiveReportPostId(null);
    } catch (error) {
      const nextErrorMessage =
        error instanceof Error ? error.message : "신고를 접수하지 못했습니다.";

      setReportErrorMessage(nextErrorMessage);
      setPostListState((current) =>
        buildPostListErrorState(current, nextErrorMessage),
      );
    } finally {
      setReportSubmitting(false);
    }
  }

  return {
    activeReportPostId,
    agreePendingPostIdsRef,
    reportErrorMessage,
    reportSubmitting,
    reportSuccessMessage,
    handleCloseReportDialog,
    handleCloseReportSuccessDialog,
    handleReport,
    handleSelectReport,
    handleToggleAgree,
  };
}
