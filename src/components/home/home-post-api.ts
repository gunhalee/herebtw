import type { ApiResponse } from "../../types/api";

type ToggleAgreeResponse = {
  postId: string;
  agreed: boolean;
  agreeCount: number;
};

type ReportPostResponse = {
  postId: string;
  reported: boolean;
};

export async function toggleHomePostAgree(
  postId: string,
  anonymousDeviceId: string,
) {
  const response = await fetch(`/api/posts/${postId}/agree/toggle`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      anonymousDeviceId,
    }),
  });
  const json = (await response.json()) as ApiResponse<ToggleAgreeResponse>;

  if (!response.ok || !json.success || !json.data) {
    throw new Error(json.error?.message ?? "맞아요 상태를 반영하지 못했습니다.");
  }

  return json.data;
}

export async function reportHomePost(
  postId: string,
  anonymousDeviceId: string,
  reasonCode = "other_policy",
) {
  const response = await fetch(`/api/posts/${postId}/report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      anonymousDeviceId,
      reasonCode,
    }),
  });
  const json = (await response.json()) as ApiResponse<ReportPostResponse>;

  if (!response.ok || !json.success || !json.data?.reported) {
    throw new Error(json.error?.message ?? "신고를 접수하지 못했습니다.");
  }

  return json.data;
}
