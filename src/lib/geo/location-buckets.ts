import type { PostLocation } from "../../types/post";

const METERS_PER_DEGREE_LATITUDE = 111320;
const LOCATION_BUCKET_SIZE_METERS = 100;
export const GLOBAL_FEED_DISTANCE_SENTINEL_METERS = -1;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function getMetersPerDegreeLongitude(latitude: number) {
  return Math.max(
    METERS_PER_DEGREE_LATITUDE * Math.cos(toRadians(latitude)),
    0.000001,
  );
}

type QuantizedLocation100MeterGrid = PostLocation & {
  latitudeBucket100m: number;
  longitudeBucket100m: number;
};

function getLatitudeBucket100m(latitude: number) {
  return Math.round(
    (latitude * METERS_PER_DEGREE_LATITUDE) / LOCATION_BUCKET_SIZE_METERS,
  );
}

function getLongitudeBucket100m(longitude: number, latitude: number) {
  return Math.round(
    (longitude * getMetersPerDegreeLongitude(latitude)) / LOCATION_BUCKET_SIZE_METERS,
  );
}

export function quantizeLocationTo100MeterGrid(
  location: PostLocation,
): QuantizedLocation100MeterGrid {
  const latitudeBucket100m = getLatitudeBucket100m(location.latitude);
  const snappedLatitude =
    (latitudeBucket100m * LOCATION_BUCKET_SIZE_METERS) /
    METERS_PER_DEGREE_LATITUDE;
  const metersPerDegreeLongitude = getMetersPerDegreeLongitude(location.latitude);
  const longitudeBucket100m = getLongitudeBucket100m(
    location.longitude,
    location.latitude,
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
}): QuantizedLocation100MeterGrid {
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
