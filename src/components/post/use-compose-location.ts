"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import {
  readCachedAdministrativeLocation,
  writeCachedAdministrativeLocation,
} from "../../lib/geo/browser-administrative-location";
import {
  getBrowserLocationErrorMessage,
  resolveAdministrativeLocation,
  type ResolvedAdministrativeLocation,
} from "../../lib/geo/browser-administrative-location-resolver";
import { getCurrentBrowserCoordinates } from "../../lib/geo/browser-location";
import type { PostComposeState } from "../../types/post";

type UseComposeLocationParams = {
  setComposeState: Dispatch<SetStateAction<PostComposeState>>;
};

export function useComposeLocation({
  setComposeState,
}: UseComposeLocationParams) {
  const [resolvedLocation, setResolvedLocation] =
    useState<ResolvedAdministrativeLocation | null>(null);
  const [locationStatusText, setLocationStatusText] = useState<string | null>(
    "현재 위치를 확인하는 중이에요.",
  );
  const [locationStatusTone, setLocationStatusTone] = useState<
    "neutral" | "danger"
  >("neutral");

  useEffect(() => {
    let cancelled = false;

    async function loadLocation() {
      let displayedCachedLocation = false;

      function applyResolvedLocation(
        nextLocation: ResolvedAdministrativeLocation,
        options?: {
          verified?: boolean;
        },
      ) {
        if (cancelled) {
          return;
        }

        setResolvedLocation(nextLocation);
        setLocationStatusTone("neutral");
        setLocationStatusText(
          options?.verified ? null : "저장된 동네 정보를 다시 확인하는 중이에요.",
        );
        setComposeState((current) => ({
          ...current,
          locationResolved: true,
          resolvedDongName: nextLocation.administrativeDongName,
          resolvedDongCode: nextLocation.administrativeDongCode,
          errorMessage: null,
        }));
      }

      try {
        const coordinates = await getCurrentBrowserCoordinates();
        const cachedAdministrativeLocation =
          readCachedAdministrativeLocation(coordinates);

        if (cachedAdministrativeLocation) {
          applyResolvedLocation(
            {
              ...coordinates,
              ...cachedAdministrativeLocation,
              countryCode: null,
            },
            {
              verified: false,
            },
          );
          displayedCachedLocation = true;
        }

        const verifiedLocation = await resolveAdministrativeLocation(coordinates);

        writeCachedAdministrativeLocation(coordinates, {
          administrativeDongName: verifiedLocation.administrativeDongName,
          administrativeDongCode: verifiedLocation.administrativeDongCode,
        });
        applyResolvedLocation(verifiedLocation, {
          verified: true,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (displayedCachedLocation) {
          setLocationStatusTone("neutral");
          setLocationStatusText("가장 최근에 확인한 동네를 표시하고 있어요.");
          return;
        }

        setResolvedLocation(null);
        setLocationStatusTone("danger");
        setLocationStatusText(getBrowserLocationErrorMessage(error));
        setComposeState((current) => ({
          ...current,
          locationResolved: false,
          resolvedDongName: null,
          resolvedDongCode: null,
        }));
      }
    }

    void loadLocation();

    return () => {
      cancelled = true;
    };
  }, [setComposeState]);

  return {
    locationStatusText,
    locationStatusTone,
    resolvedLocation,
  };
}
