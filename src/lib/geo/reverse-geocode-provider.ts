import {
  dequantizeLocationFrom100MeterGridBuckets,
} from "./location-buckets";

type ReverseGeocodeProviderInput = {
  latitudeBucket100m: number;
  longitudeBucket100m: number;
};

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
        country?: string;
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

export type ReverseGeocodeProviderPayload = {
  administrativeDongCandidateNames: Array<string | null | undefined>;
  countryCode: string | null;
  overseasAdministrativeDongFallbackNames: Array<string | null | undefined>;
  sidoName: string | null;
  sigunguName: string | null;
};

const NOMINATIM_REVERSE_ENDPOINT =
  "https://nominatim.openstreetmap.org/reverse";
const REVERSE_GEOCODE_REQUEST_TIMEOUT_MS = 5000;

function firstNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (value && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function createReverseGeocodeUrl(input: ReverseGeocodeProviderInput) {
  const quantizedLocation = dequantizeLocationFrom100MeterGridBuckets(input);
  const url = new URL(NOMINATIM_REVERSE_ENDPOINT);

  url.searchParams.set("format", "geocodejson");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "18");
  url.searchParams.set("lat", String(quantizedLocation.latitude));
  url.searchParams.set("lon", String(quantizedLocation.longitude));

  return url;
}

function buildReverseGeocodeProviderPayload(
  geocoding: NonNullable<
    NonNullable<
      NonNullable<NominatimFeatureCollection["features"]>[number]["properties"]
    >["geocoding"]
  >,
): ReverseGeocodeProviderPayload {
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

  return {
    administrativeDongCandidateNames,
    countryCode,
    overseasAdministrativeDongFallbackNames:
      countryCode === "kr"
        ? []
        : [
            geocoding.city,
            geocoding.county,
            geocoding.state,
            geocoding.country,
          ],
    sidoName,
    sigunguName,
  };
}

export async function fetchReverseGeocodeProviderPayload(
  input: ReverseGeocodeProviderInput,
): Promise<ReverseGeocodeProviderPayload> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REVERSE_GEOCODE_REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(createReverseGeocodeUrl(input), {
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

    return buildReverseGeocodeProviderPayload(geocoding);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Reverse geocoding timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
