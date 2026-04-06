import { supabaseUpsert } from "../../supabase/rest";
import type { DeviceIdentityRow } from "./types";

const FEED_RPC_DISTANCE_FALLBACK_METERS = 2147483647;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function ensureDeviceIdentity(anonymousDeviceId: string) {
  const rows = await supabaseUpsert<DeviceIdentityRow[]>(
    "device_identities?on_conflict=anonymous_device_id&select=id,anonymous_device_id",
    {
      anonymous_device_id: anonymousDeviceId,
    },
  );

  return rows?.[0] ?? null;
}

function buildInFilter(values: string[]) {
  return values.map((value) => `"${value}"`).join(",");
}

function getMonotonicTimeMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
}

function getElapsedTimeMs(startedAtMs: number) {
  return Math.round(getMonotonicTimeMs() - startedAtMs);
}

export {
  FEED_RPC_DISTANCE_FALLBACK_METERS,
  buildInFilter,
  ensureDeviceIdentity,
  getElapsedTimeMs,
  getMonotonicTimeMs,
  isUuid,
};
