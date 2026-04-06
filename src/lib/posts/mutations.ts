import type { PostComposeState, PostLocation } from "../../types/post";
import { logAbuseEvent } from "../abuse/log-event";
import { checkDuplicateContent } from "../abuse/duplicate-check";
import { createPostRepository, toggleAgreeRepository } from "./repository";
import { validatePostContent } from "./validators";

const DUPLICATE_SEED_CONTENTS: string[] = [];

type CreatedPostDetail = {
  postId: string | null;
  open: boolean;
  loading: boolean;
  content: string;
  administrativeDongName: string;
  distanceMeters: number;
  relativeTime: string;
  agreeCount: number;
  myAgree: boolean;
  canReport: boolean;
  canDelete: boolean;
  deleteRemainingSeconds: number;
  errorMessage: string | null;
};

export async function createPostDraft(
  state: PostComposeState,
  location: PostLocation,
  anonymousDeviceId?: string,
): Promise<{
  ok: boolean;
  nextState: PostComposeState;
  detailState?: CreatedPostDetail;
}> {
  const validation = validatePostContent(state.content);

  if (!validation.valid) {
    return {
      ok: false,
      nextState: {
        ...state,
        errorMessage: validation.message,
      },
    };
  }

  const duplicateBlocked = checkDuplicateContent(
    state.content,
    DUPLICATE_SEED_CONTENTS,
  );

  if (duplicateBlocked) {
    await logAbuseEvent("duplicate_content", {
      content: state.content,
    });

    return {
      ok: false,
      nextState: {
        ...state,
        duplicateBlocked: true,
        errorMessage: "같은 내용의 글이 이미 있어요. 내용을 조금 수정해 다시 시도해주세요.",
      },
    };
  }

  const repositoryResult = await createPostRepository(
    state,
    location,
    anonymousDeviceId,
  );

  return {
    ok: true,
    nextState: {
      ...state,
      submitting: false,
      duplicateBlocked: false,
      errorMessage: null,
    },
    detailState: {
      postId:
        repositoryResult.mode === "supabase" && repositoryResult.post
          ? repositoryResult.post.id
          : "post_new",
      open: true,
      loading: false,
      content: state.content.trim(),
      administrativeDongName: state.resolvedDongName ?? "알 수 없는 동네",
      distanceMeters: 120,
      relativeTime: "방금 전",
      agreeCount: 0,
      myAgree: false,
      canReport: true,
      canDelete: true,
      deleteRemainingSeconds: 180,
      errorMessage: null,
    },
  };
}

export async function toggleAgreeState(
  postId: string,
  anonymousDeviceId?: string,
) {
  const result = await toggleAgreeRepository(postId, anonymousDeviceId);

  return {
    myAgree: result.agreed,
    agreeCount: result.agreeCount,
  };
}
