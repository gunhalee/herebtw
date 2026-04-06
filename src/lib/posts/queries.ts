import { unstable_cache } from "next/cache";
import type { AppShellState } from "../../types/device";
import type { PostListState } from "../../types/post";
import { hasSupabaseServerConfig } from "../supabase/config";
import {
  loadGlobalPostsListRepository,
  loadPostsListRepository,
} from "./repository";

const loadCachedGlobalPostsList = unstable_cache(
  async () => loadGlobalPostsListRepository({ limit: 10 }),
  ["posts-global-feed"],
  {
    revalidate: 10,
    tags: ["posts-global-feed"],
  },
);

function getInitialAppShellState(
  anonymousDeviceId?: string | null,
): AppShellState {
  return {
    anonymousDeviceId: anonymousDeviceId ?? null,
    deviceReady: Boolean(anonymousDeviceId),
    permissionMode: "unknown",
    readOnlyMode: false,
    selectedDongCode: null,
    selectedDongName: null,
  };
}

export async function getHomePageState(): Promise<{
  appShellState: AppShellState;
  postListState: PostListState;
}> {
  const appShellState = getInitialAppShellState();

  if (hasSupabaseServerConfig()) {
    const postListState = await loadCachedGlobalPostsList();

    return {
      appShellState,
      postListState,
    };
  }

  const postListState = await loadPostsListRepository({
    limit: 10,
  });

  return {
    appShellState,
    postListState,
  };
}
