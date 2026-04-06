import { unstable_cache } from "next/cache";
import { quantizeLocationTo100MeterGrid } from "./location-buckets";
import { fetchReverseGeocodeProviderPayload } from "./reverse-geocode-provider";
import {
  buildReverseGeocodeResult,
  type ReverseGeocodeResult,
} from "./reverse-geocode-result";

const REVERSE_GEOCODE_CACHE_REVALIDATE_SECONDS = 60 * 60 * 24 * 7;

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

async function loadReverseGeocode(input: {
  latitudeBucket100m: number;
  longitudeBucket100m: number;
}): Promise<ReverseGeocodeResult> {
  const startedAt = Date.now();
  const payload = await fetchReverseGeocodeProviderPayload(input);
  const result = buildReverseGeocodeResult(payload);

  console.info("[reverse-geocode] cache_miss", {
    latitudeBucket100m: input.latitudeBucket100m,
    longitudeBucket100m: input.longitudeBucket100m,
    durationMs: Date.now() - startedAt,
  });

  return result;
}

const loadCachedReverseGeocode = unstable_cache(
  async (latitudeBucket100m: number, longitudeBucket100m: number) =>
    loadReverseGeocode({
      latitudeBucket100m,
      longitudeBucket100m,
    }),
  ["reverse-geocode-100m-v1"],
  {
    revalidate: REVERSE_GEOCODE_CACHE_REVALIDATE_SECONDS,
    tags: ["reverse-geocode"],
  },
);
