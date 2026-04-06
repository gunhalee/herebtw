import { unstable_cache } from "next/cache";
import { resolveAdministrativeDongMapping } from "./administrative-dong-mapping";
import {
  dequantizeLocationFrom100MeterGridBuckets,
  quantizeLocationTo100MeterGrid,
} from "./location-buckets";
import { normalizeAdministrativeDongName } from "./format-administrative-area";
import { findKnownDongCode } from "./known-dong-codes";

type NominatimFeatureCollection = {
  features?: Array<{
    properties?: {
      geocoding?: {
        district?: string;
        locality?: string;
        suburb?: string;
        quarter?: string;
        neighbourhood?: string;
        county?: string;
        city?: string;
        state?: string;
        country_code?: string;
        admin?: {
          level8?: string;
          level6?: string;
          level4?: string;
        };
      };
    };
  }>;
};

type ReverseGeocodeResult = {
  administrativeDongName: string;
  administrativeDongCode: string;
  sidoName: string | null;
  sigunguName: string | null;
  countryCode: string | null;
};

const NOMINATIM_REVERSE_ENDPOINT =
  "https://nominatim.openstreetmap.org/reverse";
const REVERSE_GEOCODE_REQUEST_TIMEOUT_MS = 5000;
const REVERSE_GEOCODE_CACHE_REVALIDATE_SECONDS = 60 * 60 * 24 * 7;

function firstNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (value && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

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

export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeResult> {
  const quantizedLocation = quantizeLocationTo100MeterGrid({
    latitude,
    longitude,
  });

  return loadCachedReverseGeocode(
    quantizedLocation.latitudeBucket100m,
    quantizedLocation.longitudeBucket100m,
  );
}

async function fetchReverseGeocodeFromProvider(input: {
  latitudeBucket100m: number;
  longitudeBucket100m: number;
}): Promise<ReverseGeocodeResult> {
  const startedAt = Date.now();
  const quantizedLocation = dequantizeLocationFrom100MeterGridBuckets(input);
  const url = new URL(NOMINATIM_REVERSE_ENDPOINT);
  url.searchParams.set("format", "geocodejson");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "18");
  url.searchParams.set("lat", String(quantizedLocation.latitude));
  url.searchParams.set("lon", String(quantizedLocation.longitude));

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REVERSE_GEOCODE_REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, {
      headers: {
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.6",
        "User-Agent": "herebtw-mvp/0.1",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Reverse geocoding failed with status ${response.status}.`,
      );
    }

    const json = (await response.json()) as NominatimFeatureCollection;
    const geocoding = json.features?.[0]?.properties?.geocoding;

    if (!geocoding) {
      throw new Error("Reverse geocoding returned no address data.");
    }

    const administrativeDongCandidateNames = [
      geocoding.admin?.level8,
      geocoding.district,
      geocoding.locality,
      geocoding.suburb,
      geocoding.quarter,
      geocoding.neighbourhood,
    ];
    const sigunguName = firstNonEmpty(geocoding.admin?.level6, geocoding.county);
    const sidoName = firstNonEmpty(
      geocoding.admin?.level4,
      geocoding.city,
      geocoding.state,
    );
    const countryCode = geocoding.country_code?.toLowerCase() ?? null;
    const mappedAdministrativeDong = resolveAdministrativeDongMapping({
      sidoName,
      sigunguName,
      candidateNames: administrativeDongCandidateNames,
    });
    const administrativeDongName =
      mappedAdministrativeDong?.administrativeDongName ??
      pickAdministrativeDongName(...administrativeDongCandidateNames);

    if (!administrativeDongName) {
      throw new Error("Reverse geocoding could not determine a dong name.");
    }

    const result = {
      administrativeDongName,
      administrativeDongCode:
        mappedAdministrativeDong?.administrativeDongCode ??
        findKnownDongCode(administrativeDongName) ??
        createSyntheticDongCode({
          countryCode,
          sidoName,
          sigunguName,
          administrativeDongName,
        }),
      sidoName,
      sigunguName,
      countryCode,
    };

    console.info("[reverse-geocode] cache_miss", {
      latitudeBucket100m: input.latitudeBucket100m,
      longitudeBucket100m: input.longitudeBucket100m,
      durationMs: Date.now() - startedAt,
    });

    return result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Reverse geocoding timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

const loadCachedReverseGeocode = unstable_cache(
  async (latitudeBucket100m: number, longitudeBucket100m: number) =>
    fetchReverseGeocodeFromProvider({
      latitudeBucket100m,
      longitudeBucket100m,
    }),
  ["reverse-geocode-100m-v1"],
  {
    revalidate: REVERSE_GEOCODE_CACHE_REVALIDATE_SECONDS,
    tags: ["reverse-geocode"],
  },
);
