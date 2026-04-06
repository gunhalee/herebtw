import { createHmac, timingSafeEqual } from "node:crypto";
import type { PostLocation } from "../../types/post";
import { getSupabaseConfig } from "../supabase/config";
import { quantizeLocationTo100MeterGrid } from "./location-buckets";

const LOCATION_RESOLUTION_TOKEN_TTL_MS = 1000 * 60 * 10;

type LocationResolutionTokenPayload = {
  administrativeDongCode: string | null;
  formattedAdministrativeAreaName: string;
  expiresAt: number;
  latitudeBucket100m: number;
  longitudeBucket100m: number;
};

type VerifiedLocationResolution = {
  administrativeDongCode: string | null;
  formattedAdministrativeAreaName: string;
};

function getLocationResolutionTokenSecret() {
  return (
    process.env.LOCATION_RESOLUTION_TOKEN_SECRET ??
    getSupabaseConfig().serviceRoleKey ??
    null
  );
}

function encodeTokenPayload(payload: LocationResolutionTokenPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeTokenPayload(tokenPayload: string) {
  try {
    return JSON.parse(
      Buffer.from(tokenPayload, "base64url").toString("utf8"),
    ) as Partial<LocationResolutionTokenPayload>;
  } catch {
    return null;
  }
}

function signTokenPayload(tokenPayload: string, secret: string) {
  return createHmac("sha256", secret)
    .update(tokenPayload)
    .digest("base64url");
}

function isValidTokenPayload(
  payload: Partial<LocationResolutionTokenPayload> | null,
): payload is LocationResolutionTokenPayload {
  return Boolean(
    payload &&
      (typeof payload.administrativeDongCode === "string" ||
        payload.administrativeDongCode === null) &&
      typeof payload.formattedAdministrativeAreaName === "string" &&
      payload.formattedAdministrativeAreaName.trim() &&
      typeof payload.expiresAt === "number" &&
      Number.isFinite(payload.expiresAt) &&
      typeof payload.latitudeBucket100m === "number" &&
      Number.isFinite(payload.latitudeBucket100m) &&
      typeof payload.longitudeBucket100m === "number" &&
      Number.isFinite(payload.longitudeBucket100m),
  );
}

export function createLocationResolutionToken(input: {
  administrativeDongCode: string | null;
  formattedAdministrativeAreaName: string;
  location: PostLocation;
}) {
  const secret = getLocationResolutionTokenSecret();

  if (!secret || !input.formattedAdministrativeAreaName.trim()) {
    return null;
  }

  const quantizedLocation = quantizeLocationTo100MeterGrid(input.location);
  const tokenPayload = encodeTokenPayload({
    administrativeDongCode: input.administrativeDongCode,
    formattedAdministrativeAreaName:
      input.formattedAdministrativeAreaName.trim(),
    expiresAt: Date.now() + LOCATION_RESOLUTION_TOKEN_TTL_MS,
    latitudeBucket100m: quantizedLocation.latitudeBucket100m,
    longitudeBucket100m: quantizedLocation.longitudeBucket100m,
  });

  return `${tokenPayload}.${signTokenPayload(tokenPayload, secret)}`;
}

export function verifyLocationResolutionToken(
  token: string | null | undefined,
  location: PostLocation,
): VerifiedLocationResolution | null {
  const secret = getLocationResolutionTokenSecret();

  if (!secret || !token?.trim()) {
    return null;
  }

  const [tokenPayload, signature, ...rest] = token.split(".");

  if (!tokenPayload || !signature || rest.length > 0) {
    return null;
  }

  const expectedSignature = signTokenPayload(tokenPayload, secret);
  const providedSignatureBuffer = Buffer.from(signature, "utf8");
  const expectedSignatureBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    providedSignatureBuffer.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(providedSignatureBuffer, expectedSignatureBuffer)
  ) {
    return null;
  }

  const payload = decodeTokenPayload(tokenPayload);

  if (!isValidTokenPayload(payload) || payload.expiresAt < Date.now()) {
    return null;
  }

  const quantizedLocation = quantizeLocationTo100MeterGrid(location);

  if (
    payload.latitudeBucket100m !== quantizedLocation.latitudeBucket100m ||
    payload.longitudeBucket100m !== quantizedLocation.longitudeBucket100m
  ) {
    return null;
  }

  return {
    administrativeDongCode: payload.administrativeDongCode,
    formattedAdministrativeAreaName:
      payload.formattedAdministrativeAreaName.trim(),
  };
}
