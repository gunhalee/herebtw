import { GLOBAL_FEED_DISTANCE_SENTINEL_METERS } from "./location-buckets";

const MAX_PLAUSIBLE_DISTANCE_METERS = 20_100_000;

function roundDistanceUpToNearest100Meters(distanceMeters: number) {
  return Math.ceil(distanceMeters / 100) * 100;
}

export function formatBucketedDistance(distanceMeters: number) {
  if (distanceMeters === GLOBAL_FEED_DISTANCE_SENTINEL_METERS) {
    return "전체 피드";
  }

  if (
    !Number.isFinite(distanceMeters) ||
    distanceMeters < 0 ||
    distanceMeters > MAX_PLAUSIBLE_DISTANCE_METERS
  ) {
    return "거리 미확인";
  }

  if (distanceMeters < 100) {
    return "100m 이내";
  }

  if (distanceMeters < 1000) {
    return `${roundDistanceUpToNearest100Meters(distanceMeters)}m`;
  }

  return `${(roundDistanceUpToNearest100Meters(distanceMeters) / 1000).toFixed(1)}km`;
}
