import { createPostAction } from "../../../actions/posts/create-post";
import { fail, ok } from "../../../lib/api/response";
import { formatAdministrativeAreaName } from "../../../lib/geo/format-administrative-area";
import {
  isValidCoordinateInput,
  resolveLocationFromCoordinates,
} from "../../../lib/geo/resolve-location";
import type { PostComposeState } from "../../../types/post";

type CreatePostRequest = {
  anonymousDeviceId?: string;
  content?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
};

export async function POST(request: Request) {
  const body = (await request.json()) as CreatePostRequest;

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

  let resolvedLocation;

  try {
    resolvedLocation = await resolveLocationFromCoordinates(body.location);
  } catch {
    return fail(
      {
        code: "LOCATION_RESOLUTION_FAILED",
        message: "현재 위치를 확인하지 못했어요.",
      },
      502,
    );
  }

  const composeState: PostComposeState = {
    content: body.content ?? "",
    charCount: body.content?.trim().length ?? 0,
    submitting: false,
    locationResolved: true,
    resolvedDongName: formatAdministrativeAreaName({
      sidoName: resolvedLocation.sidoName,
      sigunguName: resolvedLocation.sigunguName,
      administrativeDongName: resolvedLocation.administrativeDongName,
    }),
    resolvedDongCode: resolvedLocation.administrativeDongCode,
    duplicateBlocked: false,
    errorMessage: null,
  };

  const result = await createPostAction(
    composeState,
    body.location,
    body.anonymousDeviceId,
  );

  if (!result.ok || !result.detailState) {
    return fail(
      {
        code: result.nextState.duplicateBlocked
          ? "DUPLICATE_CONTENT"
          : "VALIDATION_ERROR",
        message:
          result.nextState.errorMessage ??
          "글을 등록하지 못했습니다. 잠시 후 다시 시도해주세요.",
      },
      400,
    );
  }

  return ok({
    post: {
      id: result.detailState.postId,
      content: result.detailState.content,
      administrativeDongName: result.detailState.administrativeDongName,
      createdAt: new Date().toISOString(),
      deleteExpiresAt: new Date(
        Date.now() + result.detailState.deleteRemainingSeconds * 1000,
      ).toISOString(),
    },
  });
}
