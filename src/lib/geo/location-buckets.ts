import type { PostLocation } from "../../types/post";

const METERS_PER_DEGREE_LATITUDE = 111320;
const LOCATION_BUCKET_SIZE_METERS = 100;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getMetersPerDegreeLongitude(latitude: number) {
  return Math.max(
    METERS_PER_DEGREE_LATITUDE * Math.cos(toRadians(latitude)),
    0.000001,
  );
}

type QuantizedLocation = PostLocation & {
  latitudeBucket100m: number;
  longitudeBucket100m: number;
};

export function quantizeLocationTo100MeterGrid(
  location: PostLocation,
): QuantizedLocation {
  const latitudeBucket100m = Math.round(
    (location.latitude * METERS_PER_DEGREE_LATITUDE) /
      LOCATION_BUCKET_SIZE_METERS,
  );
  const snappedLatitude =
    (latitudeBucket100m * LOCATION_BUCKET_SIZE_METERS) /
    METERS_PER_DEGREE_LATITUDE;
  const metersPerDegreeLongitude = getMetersPerDegreeLongitude(location.latitude);
  const longitudeBucket100m = Math.round(
    (location.longitude * metersPerDegreeLongitude) /
      LOCATION_BUCKET_SIZE_METERS,
  );
  const snappedLongitude =
    (longitudeBucket100m * LOCATION_BUCKET_SIZE_METERS) /
    metersPerDegreeLongitude;

  return {
    latitude: snappedLatitude,
    longitude: snappedLongitude,
    latitudeBucket100m,
    longitudeBucket100m,
  };
}

export function dequantizeLocationFrom100MeterGridBuckets(input: {
  latitudeBucket100m: number;
  longitudeBucket100m: number;
}): QuantizedLocation {
  const latitude =
    (input.latitudeBucket100m * LOCATION_BUCKET_SIZE_METERS) /
    METERS_PER_DEGREE_LATITUDE;
  const metersPerDegreeLongitude = getMetersPerDegreeLongitude(latitude);
  const longitude =
    (input.longitudeBucket100m * LOCATION_BUCKET_SIZE_METERS) /
    metersPerDegreeLongitude;

  return {
    latitude,
    longitude,
    latitudeBucket100m: input.latitudeBucket100m,
    longitudeBucket100m: input.longitudeBucket100m,
  };
}

export function formatBucketedDistance(distanceMeters: number) {
  if (!Number.isFinite(distanceMeters) || distanceMeters >= 900000) {
    return "거리 미확인";
  }

  if (distanceMeters < 100) {
    return "100m 이내";
  }

  if (distanceMeters < 1000) {
    return `${Math.ceil(distanceMeters / 100) * 100}m`;
  }

  const bucketedMeters = Math.ceil(distanceMeters / 100) * 100;
  return `${(bucketedMeters / 1000).toFixed(1)}km`;
}
