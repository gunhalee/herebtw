import {
  createJsonPostRequestInit,
  fetchClientApiData,
} from "../../lib/api/client";

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
  return fetchClientApiData<ToggleAgreeResponse>({
    errorMessage: "맞아요 상태를 반영하지 못했습니다.",
    init: createJsonPostRequestInit({
      anonymousDeviceId,
    }),
    path: `/api/posts/${postId}/agree/toggle`,
  });
}

export async function reportHomePost(
  postId: string,
  anonymousDeviceId: string,
  reasonCode = "other_policy",
) {
  const data = await fetchClientApiData<ReportPostResponse>({
    errorMessage: "신고를 접수하지 못했습니다.",
    init: createJsonPostRequestInit({
      anonymousDeviceId,
      reasonCode,
    }),
    path: `/api/posts/${postId}/report`,
  });

  if (!data.reported) {
    throw new Error("신고를 접수하지 못했습니다.");
  }

  return data;
}
