"use client";

import { useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { writeCachedNearbyPostList } from "../../lib/posts/browser-nearby-post-cache";
import type { PostListState, PostLocation } from "../../types/post";
import { reportHomePost } from "./home-post-api";
import { buildPostListErrorState } from "./home-feed-state";
import type {
  HomePostItem,
  HomePostItemUpdater,
} from "./home-post-state-actions";

type UseHomeReportActionsParams = {
  closeMenu: () => void;
  ensureDeviceReady: () => Promise<string>;
  feedLocationRef: MutableRefObject<PostLocation | null>;
  findPostItem: (postId: string) => HomePostItem | undefined;
  patchFeedItem: (
    targetPostId: string,
    updater: HomePostItemUpdater,
    options?: {
      errorMessage?: string | null;
    },
  ) => void;
  removeFeedItem: (targetPostId: string) => PostListState;
  setPostListState: Dispatch<SetStateAction<PostListState>>;
};

export function useHomeReportActions({
  closeMenu,
  ensureDeviceReady,
  feedLocationRef,
  findPostItem,
  patchFeedItem,
  removeFeedItem,
  setPostListState,
}: UseHomeReportActionsParams) {
  const [activeReportPostId, setActiveReportPostId] = useState<string | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportErrorMessage, setReportErrorMessage] = useState<string | null>(null);
  const [reportSuccessMessage, setReportSuccessMessage] = useState<string | null>(
    null,
  );
  const [reportSuccessPostId, setReportSuccessPostId] = useState<string | null>(
    null,
  );

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

  async function handleReport() {
    if (!activeReportPostId) {
      return;
    }

    const postId = activeReportPostId;
    const targetItem = findPostItem(postId);

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
    reportErrorMessage,
    reportSubmitting,
    reportSuccessMessage,
    handleCloseReportDialog,
    handleCloseReportSuccessDialog,
    handleReport,
    handleSelectReport,
  };
}
