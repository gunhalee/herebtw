import { reverseGeocode } from "./reverse-geocode";

export type CoordinateInput = {
  latitude: number;
  longitude: number;
};

export type ResolvedLocation = CoordinateInput & {
  administrativeDongName: string;
  administrativeDongCode: string;
  sidoName: string | null;
  sigunguName: string | null;
  countryCode: string | null;
};

export function isValidCoordinateInput(
  location: CoordinateInput | null | undefined,
): location is CoordinateInput {
  if (!location) {
    return false;
  }

  return (
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude) &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    location.longitude >= -180 &&
    location.longitude <= 180
  );
}

export async function resolveLocationFromCoordinates(
  location: CoordinateInput,
): Promise<ResolvedLocation> {
  if (!isValidCoordinateInput(location)) {
    throw new Error("INVALID_COORDINATES");
  }

  const geocodeResult = await reverseGeocode(
    location.latitude,
    location.longitude,
  );

  return {
    latitude: location.latitude,
    longitude: location.longitude,
    administrativeDongName: geocodeResult.administrativeDongName,
    administrativeDongCode: geocodeResult.administrativeDongCode,
    sidoName: geocodeResult.sidoName,
    sigunguName: geocodeResult.sigunguName,
    countryCode: geocodeResult.countryCode,
  };
}
