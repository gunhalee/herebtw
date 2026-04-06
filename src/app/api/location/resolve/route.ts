import { fail, ok } from "../../../../lib/api/response";
import { formatAdministrativeAreaName } from "../../../../lib/geo/format-administrative-area";
import { createLocationResolutionToken } from "../../../../lib/geo/location-resolution-token";
import {
  isValidCoordinateInput,
  resolveLocationFromCoordinates,
} from "../../../../lib/geo/resolve-location";

type ResolveLocationRequest = {
  location?: {
    latitude: number;
    longitude: number;
  };
};

export async function POST(request: Request) {
  const body = (await request.json()) as ResolveLocationRequest;

  if (!isValidCoordinateInput(body.location)) {
    return fail(
      {
        code: "INVALID_LOCATION",
        message: "유효한 위치 좌표가 필요해요.",
      },
      400,
    );
  }

  try {
    const location = await resolveLocationFromCoordinates(body.location);
    const formattedAdministrativeAreaName = formatAdministrativeAreaName({
      sidoName: location.sidoName,
      sigunguName: location.sigunguName,
      administrativeDongName: location.administrativeDongName,
    });

    return ok({
      location: {
        ...location,
        formattedAdministrativeAreaName,
        locationResolutionToken: createLocationResolutionToken({
          administrativeDongCode: location.administrativeDongCode,
          formattedAdministrativeAreaName,
          location: body.location,
        }),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "INVALID_COORDINATES"
        ? "유효한 위치 좌표가 필요해요."
        : "현재 위치를 확인하지 못했어요.";
    const code =
      error instanceof Error && error.message === "INVALID_COORDINATES"
        ? "INVALID_LOCATION"
        : "LOCATION_RESOLUTION_FAILED";
    const status = code === "INVALID_LOCATION" ? 400 : 502;

    return fail(
      {
        code,
        message,
      },
      status,
    );
  }
}
