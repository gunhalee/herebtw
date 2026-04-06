import type { Dispatch, SetStateAction } from "react";
import {
  readCachedAdministrativeLocation,
  writeCachedAdministrativeLocation,
  type AdministrativeLocationSnapshot,
} from "../../lib/geo/browser-administrative-location";
import { resolveAdministrativeLocation } from "../../lib/geo/browser-administrative-location-resolver";
import { readCachedNearbyPostList } from "../../lib/posts/browser-nearby-post-cache";
import type { AppShellState } from "../../types/device";
import type { PostListState, PostLocation } from "../../types/post";

type SetAdministrativeLocationSelection = (
  location: AdministrativeLocationSnapshot | null,
  options: {
    permissionMode: AppShellState["permissionMode"];
    readOnlyMode: boolean;
  },
) => void;

type HydrateHomeFeedLocationParams = {
  location: PostLocation;
  isMounted: () => boolean;
  setFeedLocation: Dispatch<SetStateAction<PostLocation | null>>;
  setAdministrativeLocationSelection: SetAdministrativeLocationSelection;
  applyCachedNearbyPostListState: (
    input: Pick<PostListState, "items" | "nextCursor">,
  ) => void;
};

function applyGrantedAdministrativeSelection(
  setAdministrativeLocationSelection: SetAdministrativeLocationSelection,
  location: AdministrativeLocationSnapshot | null,
) {
  setAdministrativeLocationSelection(location, {
    permissionMode: "granted",
    readOnlyMode: false,
  });
}

function isDomesticAdministrativeLocation(location: {
  countryCode: string | null;
}) {
  return location.countryCode === null || location.countryCode === "kr";
}

function refreshAdministrativeLocation(
  location: PostLocation,
  options: {
    isMounted: () => boolean;
    setAdministrativeLocationSelection: SetAdministrativeLocationSelection;
  },
) {
  void resolveAdministrativeLocation(location)
    .then((resolvedLocation) => {
      if (!options.isMounted()) {
        return;
      }

      if (!isDomesticAdministrativeLocation(resolvedLocation)) {
        applyGrantedAdministrativeSelection(
          options.setAdministrativeLocationSelection,
          null,
        );
        return;
      }

      applyGrantedAdministrativeSelection(
        options.setAdministrativeLocationSelection,
        resolvedLocation,
      );
      writeCachedAdministrativeLocation(location, resolvedLocation);
    })
    .catch(() => undefined);
}

export function hydrateHomeFeedLocationFromCoordinates({
  location,
  isMounted,
  setFeedLocation,
  setAdministrativeLocationSelection,
  applyCachedNearbyPostListState,
}: HydrateHomeFeedLocationParams) {
  if (!isMounted()) {
    return;
  }

  setFeedLocation(location);
  applyGrantedAdministrativeSelection(setAdministrativeLocationSelection, null);

  const cachedAdministrativeLocation = readCachedAdministrativeLocation(location);

  if (cachedAdministrativeLocation) {
    applyGrantedAdministrativeSelection(
      setAdministrativeLocationSelection,
      cachedAdministrativeLocation,
    );
  }

  const cachedNearbyPostList = readCachedNearbyPostList(location);

  if (cachedNearbyPostList) {
    applyCachedNearbyPostListState(cachedNearbyPostList);
  }

  refreshAdministrativeLocation(location, {
    isMounted,
    setAdministrativeLocationSelection,
  });
}
