import { fail, ok } from "../../../lib/api/response";
import { formatAdministrativeAreaName } from "../../../lib/geo/format-administrative-area";
import { verifyLocationResolutionToken } from "../../../lib/geo/location-resolution-token";
import {
  isValidCoordinateInput,
  resolveLocationFromCoordinates,
} from "../../../lib/geo/resolve-location";
import { createPost } from "../../../lib/posts/mutations";

type CreatePostRequest = {
  anonymousDeviceId?: string;
  content?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  locationResolutionToken?: string | null;
};

async function resolveAdministrativeLocationForPost(input: {
  location: {
    latitude: number;
    longitude: number;
  };
  locationResolutionToken?: string | null;
}) {
  const verifiedLocation = verifyLocationResolutionToken(
    input.locationResolutionToken,
    input.location,
  );

  if (verifiedLocation) {
    return verifiedLocation;
  }

  const resolvedLocation = await resolveLocationFromCoordinates(input.location);

  return {
    administrativeDongCode: resolvedLocation.administrativeDongCode,
    formattedAdministrativeAreaName: formatAdministrativeAreaName({
      sidoName: resolvedLocation.sidoName,
      sigunguName: resolvedLocation.sigunguName,
      administrativeDongName: resolvedLocation.administrativeDongName,
    }),
  };
}

export async function POST(request: Request) {
  let body: CreatePostRequest;

  try {
    body = (await request.json()) as CreatePostRequest;
  } catch {
    return fail(
      {
        code: "INVALID_REQUEST",
        message: "요청 형식을 다시 확인해주세요.",
      },
      400,
    );
  }

  if (!body.anonymousDeviceId?.trim()) {
    return fail(
      {
        code: "INVALID_DEVICE_ID",
        message: "anonymousDeviceId가 필요합니다.",
      },
      400,
    );
  }

  if (!isValidCoordinateInput(body.location)) {
    return fail(
      {
        code: "INVALID_LOCATION",
        message: "유효한 위치 좌표가 필요해요.",
      },
      400,
    );
  }

  let resolvedAdministrativeLocation;

  try {
    resolvedAdministrativeLocation = await resolveAdministrativeLocationForPost({
      location: body.location,
      locationResolutionToken: body.locationResolutionToken,
    });
  } catch {
    return fail(
      {
        code: "LOCATION_RESOLUTION_FAILED",
        message: "현재 위치를 확인하지 못했어요.",
      },
      502,
    );
  }

  const result = await createPost({
    anonymousDeviceId: body.anonymousDeviceId,
    content: body.content ?? "",
    location: body.location,
    resolvedDongCode: resolvedAdministrativeLocation.administrativeDongCode,
    resolvedDongName:
      resolvedAdministrativeLocation.formattedAdministrativeAreaName,
  });

  if (!result.ok) {
    return fail(
      {
        code: result.code,
        message: result.message,
      },
      400,
    );
  }

  return ok({
    post: result.post,
  });
}
