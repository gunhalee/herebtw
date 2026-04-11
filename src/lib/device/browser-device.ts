import { createJsonPostRequestInit, fetchClientApiData } from "../api/client";

const ANONYMOUS_DEVICE_STORAGE_KEY = "shout.anonymousDeviceId";
const ANONYMOUS_DEVICE_COOKIE_KEY = "shout_anonymous_device_id";
const DEVICE_REGISTERED_AT_STORAGE_KEY = "shout.deviceRegisteredAt";
const DEVICE_REGISTER_TTL_MS = 1000 * 60 * 60 * 24;
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

type RegisterDeviceResponse = {
  device: {
    id: string | null;
    anonymousDeviceId: string;
  };
};

let registrationInflightPromise: Promise<string> | null = null;

function generateAnonymousDeviceId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `anon_${crypto.randomUUID()}`;
  }

  return `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function persistAnonymousDeviceId(anonymousDeviceId: string) {
  window.localStorage.setItem(
    ANONYMOUS_DEVICE_STORAGE_KEY,
    anonymousDeviceId,
  );
  document.cookie =
     `${ANONYMOUS_DEVICE_COOKIE_KEY}=${encodeURIComponent(anonymousDeviceId)}; ` +
     `Max-Age=${ONE_YEAR_IN_SECONDS}; Path=/; SameSite=Lax`;
}

function markBrowserDeviceRegistered() {
  window.localStorage.setItem(
    DEVICE_REGISTERED_AT_STORAGE_KEY,
    String(Date.now()),
  );
}

function hasFreshDeviceRegistration() {
  const registeredAt = window.localStorage.getItem(
    DEVICE_REGISTERED_AT_STORAGE_KEY,
  );

  if (!registeredAt) {
    return false;
  }

  const parsed = Number(registeredAt);

  return Number.isFinite(parsed) && Date.now() - parsed < DEVICE_REGISTER_TTL_MS;
}

/**
 * Read-only: returns the existing device ID from localStorage without
 * generating a new one. Safe to call at any point after hydration.
 */
export function readBrowserAnonymousDeviceId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(ANONYMOUS_DEVICE_STORAGE_KEY) ?? null;
}

export function getOrCreateBrowserAnonymousDeviceId() {
  if (typeof window === "undefined") {
    return null;
  }

  const existingAnonymousDeviceId = window.localStorage.getItem(
    ANONYMOUS_DEVICE_STORAGE_KEY,
  );

  if (existingAnonymousDeviceId) {
    persistAnonymousDeviceId(existingAnonymousDeviceId);
    return existingAnonymousDeviceId;
  }

  const nextAnonymousDeviceId = generateAnonymousDeviceId();
  persistAnonymousDeviceId(nextAnonymousDeviceId);

  return nextAnonymousDeviceId;
}

async function performDeviceRegistration(anonymousDeviceId: string): Promise<string> {
  try {
    const data = await fetchClientApiData<RegisterDeviceResponse>({
      errorMessage: "디바이스 등록에 실패했습니다.",
      init: createJsonPostRequestInit({
        anonymousDeviceId,
      }),
      path: "/api/device/register",
      timeoutErrorMessage: "기기 등록이 지연되고 있어요. 다시 시도해주세요.",
    });
    persistAnonymousDeviceId(data.device.anonymousDeviceId);
    markBrowserDeviceRegistered();
    return data.device.anonymousDeviceId;
  } catch {
    return anonymousDeviceId;
  }
}

export async function ensureRegisteredBrowserDevice(options?: { force?: boolean }) {
  const anonymousDeviceId = getOrCreateBrowserAnonymousDeviceId();

  if (!anonymousDeviceId) {
    throw new Error("브라우저에서 디바이스를 준비하지 못했습니다.");
  }

  if (
    typeof window !== "undefined" &&
    !options?.force &&
    hasFreshDeviceRegistration()
  ) {
    return anonymousDeviceId;
  }

  if (registrationInflightPromise) {
    return registrationInflightPromise;
  }

  registrationInflightPromise = performDeviceRegistration(anonymousDeviceId).finally(
    () => {
      registrationInflightPromise = null;
    },
  );

  return registrationInflightPromise;
}
