import type { ApiResponse } from "../../types/api";
import type { PostLocation } from "../../types/post";
import type { AdministrativeLocationSnapshot } from "./browser-administrative-location";

export type ResolvedAdministrativeLocation = PostLocation &
  AdministrativeLocationSnapshot & {
    countryCode: string | null;
  };

type ResolveLocationResponse = {
  location: ResolvedAdministrativeLocation;
};

export async function resolveAdministrativeLocation(
  location: PostLocation,
): Promise<ResolvedAdministrativeLocation> {
  const response = await fetch("/api/location/resolve", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      location,
    }),
  });
  const json = (await response.json()) as ApiResponse<ResolveLocationResponse>;

  if (!response.ok || !json.success || !json.data) {
    throw new Error(
      json.error?.message ?? "현재 위치를 행정동으로 확인하지 못했습니다.",
    );
  }

  return json.data.location;
}

export function getBrowserLocationErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "현재 위치를 확인하지 못했어요. 다시 시도해주세요.";
  }

  if (error.message === "GEOLOCATION_PERMISSION_DENIED") {
    return "위치 권한을 허용하면 우리 동네에 글을 남길 수 있어요.";
  }

  if (error.message === "GEOLOCATION_TIMEOUT") {
    return "위치 확인 시간이 초과됐어요. 다시 시도해주세요.";
  }

  if (error.message === "GEOLOCATION_UNAVAILABLE") {
    return "이 브라우저에서는 위치 정보를 사용할 수 없어요.";
  }

  if (error.message === "GEOLOCATION_POSITION_UNAVAILABLE") {
    return "현재 위치를 아직 찾지 못했어요. 다시 시도해주세요.";
  }

  return "현재 위치를 확인하지 못했어요. 다시 시도해주세요.";
}
