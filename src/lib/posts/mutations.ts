import type { PostComposeState, PostDetailState, PostLocation } from "../../types/post";
import { logAbuseEvent } from "../abuse/log-event";
import { checkDuplicateContent } from "../abuse/duplicate-check";
import { getWriteCooldownState } from "../abuse/rate-limit";
import {
  createPostRepository,
  deletePostRepository,
  toggleAgreeRepository,
} from "./repository";
import { validatePostContent } from "./validators";

const DUPLICATE_SEED_CONTENTS: string[] = [];

export async function createPostDraft(
  state: PostComposeState,
  location: PostLocation,
  anonymousDeviceId?: string,
): Promise<{
  ok: boolean;
  nextState: PostComposeState;
  detailState?: PostDetailState;
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

  const cooldownState = getWriteCooldownState(0);

  if (cooldownState.cooldownRemainingSeconds > 0) {
    await logAbuseEvent("rate_limit", {
      cooldownRemainingSeconds: cooldownState.cooldownRemainingSeconds,
    });

    return {
      ok: false,
      nextState: {
        ...state,
        cooldownRemainingSeconds: cooldownState.cooldownRemainingSeconds,
        errorMessage: `${cooldownState.cooldownRemainingSeconds}초 후 다시 작성할 수 있어요.`,
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
        errorMessage:
          "같은 내용의 글이 이미 등록되어 있어요. 내용을 조금 바꿔 다시 시도해 주세요.",
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
      administrativeDongName: state.resolvedDongName ?? "역삼1동",
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
  state: Pick<PostDetailState, "myAgree" | "agreeCount">,
  postId?: string | null,
  anonymousDeviceId?: string,
) {
  const result = await toggleAgreeRepository(
    postId ?? "post_toggle_mock",
    anonymousDeviceId,
  );

  return {
    myAgree: result.agreed,
    agreeCount: result.agreeCount,
  };
}

export async function deletePostState(state: PostDetailState) {
  if (!state.canDelete || state.deleteRemainingSeconds <= 0) {
    return {
      ok: false,
      errorMessage: "작성 후 3분이 지나 삭제할 수 없습니다.",
    };
  }

  await deletePostRepository(state.postId ?? "post_delete_mock");

  return {
    ok: true,
    postId: state.postId,
  };
}
