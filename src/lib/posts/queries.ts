import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import type { AppShellState } from "../../types/device";
import type { PostListState } from "../../types/post";
import { hasSupabaseServerConfig } from "../supabase/config";
import {
  loadGlobalPostsListRepository,
  loadPostsListRepository,
} from "./repository";

const ANONYMOUS_DEVICE_COOKIE_KEY = "shout_anonymous_device_id";

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

async function readDeviceCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(ANONYMOUS_DEVICE_COOKIE_KEY)?.value;
    if (!raw) return null;
    const decoded = decodeURIComponent(raw).trim();
    return decoded || null;
  } catch {
    return null;
  }
}

export async function getHomePageState(): Promise<{
  appShellState: AppShellState;
  postListState: PostListState;
}> {
  const anonymousDeviceId = await readDeviceCookie();
  const appShellState = getInitialAppShellState(anonymousDeviceId);

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
