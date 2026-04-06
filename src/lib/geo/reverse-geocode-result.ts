import { resolveAdministrativeDongMapping } from "./administrative-dong-mapping";
import { normalizeAdministrativeDongName } from "./format-administrative-area";
import { findKnownDongCode } from "./known-dong-codes";
import type { ReverseGeocodeProviderPayload } from "./reverse-geocode-provider";

export type ReverseGeocodeResult = {
  administrativeDongName: string;
  administrativeDongCode: string;
  sidoName: string | null;
  sigunguName: string | null;
  countryCode: string | null;
};

function pickAdministrativeDongName(...values: Array<string | null | undefined>) {
  const normalizedValues = values
    .map((value) => (value ? normalizeAdministrativeDongName(value) : null))
    .filter((value): value is string => Boolean(value));

  return (
    normalizedValues.find((value) => /(읍|면|동)$/.test(value)) ??
    normalizedValues[0] ??
    null
  );
}

function createSyntheticDongCode(input: {
  countryCode: string | null;
  sidoName: string | null;
  sigunguName: string | null;
  administrativeDongName: string;
}) {
  return [
    "geo",
    input.countryCode ?? "xx",
    input.sidoName ?? "unknown",
    input.sigunguName ?? "unknown",
    input.administrativeDongName,
  ].join(":");
}

export function buildReverseGeocodeResult(
  payload: ReverseGeocodeProviderPayload,
): ReverseGeocodeResult {
  const mappedAdministrativeDong = resolveAdministrativeDongMapping({
    sidoName: payload.sidoName,
    sigunguName: payload.sigunguName,
    candidateNames: payload.administrativeDongCandidateNames,
  });
  const administrativeDongName =
    mappedAdministrativeDong?.administrativeDongName ??
    pickAdministrativeDongName(...payload.administrativeDongCandidateNames) ??
    pickAdministrativeDongName(...payload.overseasAdministrativeDongFallbackNames);

  if (!administrativeDongName) {
    throw new Error("Reverse geocoding could not determine a dong name.");
  }

  return {
    administrativeDongName,
    administrativeDongCode:
      mappedAdministrativeDong?.administrativeDongCode ??
      findKnownDongCode(administrativeDongName) ??
      createSyntheticDongCode({
        countryCode: payload.countryCode,
        sidoName: payload.sidoName,
        sigunguName: payload.sigunguName,
        administrativeDongName,
      }),
    countryCode: payload.countryCode,
    sidoName: payload.sidoName,
    sigunguName: payload.sigunguName,
  };
}
