import type { PostLocation } from "../../../types/post";
import { quantizeLocationTo100MeterGrid } from "../../geo/location-buckets";
import { hasSupabaseServerConfig } from "../../supabase/config";
import {
  supabaseInsert,
  supabaseRpc,
  supabaseUpsert,
} from "../../supabase/rest";
import { toggleMockPostAgree } from "../mock-data";
import { ensureDeviceIdentity } from "./shared";
import type { PostRow, ToggleAgreeRpcRow } from "./types";

type CreatePostRepositoryInput = {
  anonymousDeviceId?: string;
  content: string;
  location: PostLocation;
  resolvedDongCode: string | null;
  resolvedDongName: string;
};

async function syncDeviceRepository(anonymousDeviceId: string) {
  if (!hasSupabaseServerConfig()) {
    return {
      mode: "mock" as const,
      device: {
        id: "device_uuid_mock",
        anonymous_device_id: anonymousDeviceId,
      },
    };
  }

  const device = await ensureDeviceIdentity(anonymousDeviceId);

  return {
    mode: "supabase" as const,
    device,
  };
}

async function createPostRepository(
  input: CreatePostRepositoryInput,
) {
  if (!hasSupabaseServerConfig() || !input.anonymousDeviceId) {
    return {
      mode: "mock" as const,
      post: null,
    };
  }

  const device = await ensureDeviceIdentity(input.anonymousDeviceId);

  if (!device) {
    throw new Error("Failed to ensure device identity.");
  }

  const quantizedLocation = quantizeLocationTo100MeterGrid(input.location);
  const rows = await supabaseInsert<PostRow[]>(
    "posts?select=id,content,administrative_dong_name,created_at,delete_expires_at",
    {
      author_device_id: device.id,
      content: input.content.trim(),
      administrative_dong_name: input.resolvedDongName,
      administrative_dong_code: input.resolvedDongCode,
      latitude: quantizedLocation.latitude,
      longitude: quantizedLocation.longitude,
      latitude_bucket_100m: quantizedLocation.latitudeBucket100m,
      longitude_bucket_100m: quantizedLocation.longitudeBucket100m,
    },
  );

  return {
    mode: "supabase" as const,
    post: rows?.[0] ?? null,
  };
}

async function toggleAgreeRepository(
  postId: string,
  anonymousDeviceId?: string,
) {
  if (!hasSupabaseServerConfig() || !anonymousDeviceId) {
    return {
      mode: "mock" as const,
      ...toggleMockPostAgree(postId),
    };
  }

  const rpcRows =
    (await supabaseRpc<ToggleAgreeRpcRow[]>("toggle_post_agree", {
      target_post_id: postId,
      viewer_anonymous_device_id: anonymousDeviceId,
    })) ?? [];
  const rpcRow = rpcRows[0];

  return {
    mode: "supabase" as const,
    postId,
    agreed: Boolean(rpcRow?.agreed),
    agreeCount: Number(rpcRow?.agree_count ?? 0),
  };
}

async function reportPostRepository(
  postId: string,
  reasonCode: string,
  anonymousDeviceId?: string,
) {
  if (!hasSupabaseServerConfig() || !anonymousDeviceId) {
    return {
      mode: "mock" as const,
      postId,
      reasonCode,
    };
  }

  const device = await ensureDeviceIdentity(anonymousDeviceId);

  if (!device) {
    throw new Error("Failed to ensure device identity.");
  }

  await supabaseUpsert(
    "post_reports?on_conflict=post_id,reporter_device_id&select=id,post_id,reporter_device_id,reason_code",
    {
      post_id: postId,
      reporter_device_id: device.id,
      reason_code: reasonCode,
    },
  );

  return {
    mode: "supabase" as const,
    postId,
    reasonCode,
  };
}

export {
  createPostRepository,
  reportPostRepository,
  syncDeviceRepository,
  toggleAgreeRepository,
};
