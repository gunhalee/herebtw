"use server";

import type { PostComposeState, PostLocation } from "../../types/post";
import { createPostDraft } from "../../lib/posts/mutations";

export async function createPostAction(
  state: PostComposeState,
  location: PostLocation,
  anonymousDeviceId?: string,
) {
  return createPostDraft(state, location, anonymousDeviceId);
}
