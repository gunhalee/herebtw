export type BrowserCoordinates = {
  latitude: number;
  longitude: number;
};

function makeGeolocationError(code: string) {
  return new Error(code);
}

export function canUseBrowserGeolocation() {
  return typeof window !== "undefined" && "geolocation" in navigator;
}

export function getCurrentBrowserCoordinates(
  timeoutMs = 10000,
): Promise<BrowserCoordinates> {
  if (!canUseBrowserGeolocation()) {
    return Promise.reject(makeGeolocationError("GEOLOCATION_UNAVAILABLE"));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(makeGeolocationError("GEOLOCATION_PERMISSION_DENIED"));
          return;
        }

        if (error.code === error.POSITION_UNAVAILABLE) {
          reject(makeGeolocationError("GEOLOCATION_POSITION_UNAVAILABLE"));
          return;
        }

        if (error.code === error.TIMEOUT) {
          reject(makeGeolocationError("GEOLOCATION_TIMEOUT"));
          return;
        }

        reject(makeGeolocationError("GEOLOCATION_FAILED"));
      },
      {
        enableHighAccuracy: false,
        maximumAge: 60000,
        timeout: timeoutMs,
      },
    );
  });
}
