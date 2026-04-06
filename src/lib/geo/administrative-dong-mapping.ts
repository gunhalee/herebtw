import mappingData from "./data/administrative-dong-map.json";
import {
  normalizeAdministrativeDongName,
  shortenSidoName,
} from "./format-administrative-area";

type AdministrativeDongMappingPayload = {
  administrativeByRegionAndName: Record<string, readonly string[]>;
  legalByRegionAndName: Record<string, readonly string[]>;
};

type ResolvedAdministrativeDong = {
  administrativeDongCode: string;
  administrativeDongName: string;
};

const administrativeDongMapping =
  mappingData as unknown as AdministrativeDongMappingPayload;

function normalizeRegionPart(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value.trim();
}

function createRegionKeys(input: {
  sidoName: string | null | undefined;
  sigunguName: string | null | undefined;
}) {
  const shortenedSidoName = shortenSidoName(input.sidoName);
  const sigunguName = normalizeRegionPart(input.sigunguName);

  if (!shortenedSidoName && !sigunguName) {
    return [];
  }

  const regionKeys = new Set<string>();

  regionKeys.add(`${shortenedSidoName ?? ""}|${sigunguName}`);

  if (sigunguName && shortenedSidoName === sigunguName) {
    regionKeys.add(`${shortenedSidoName}|`);
  }

  return Array.from(regionKeys);
}

function createCandidateNames(
  candidateNames: Array<string | null | undefined>,
) {
  const normalizedCandidates = new Set<string>();

  for (const candidateName of candidateNames) {
    if (!candidateName) {
      continue;
    }

    const trimmedCandidate = candidateName.replace(/\s+/g, " ").trim();

    if (!trimmedCandidate) {
      continue;
    }

    normalizedCandidates.add(trimmedCandidate);
    normalizedCandidates.add(normalizeAdministrativeDongName(trimmedCandidate));
  }

  return Array.from(normalizedCandidates);
}

function parseMappingValue(value: readonly string[] | undefined) {
  if (!value || value.length < 2) {
    return null;
  }

  return {
    administrativeDongCode: value[0],
    administrativeDongName: value[1],
  } satisfies ResolvedAdministrativeDong;
}

export function resolveAdministrativeDongMapping(input: {
  sidoName: string | null | undefined;
  sigunguName: string | null | undefined;
  candidateNames: Array<string | null | undefined>;
}) {
  const regionKeys = createRegionKeys(input);
  const candidateNames = createCandidateNames(input.candidateNames);

  for (const regionKey of regionKeys) {
    for (const candidateName of candidateNames) {
      const match = parseMappingValue(
        administrativeDongMapping.administrativeByRegionAndName[
          `${regionKey}|${candidateName}`
        ],
      );

      if (match) {
        return match;
      }
    }
  }

  for (const regionKey of regionKeys) {
    for (const candidateName of candidateNames) {
      const match = parseMappingValue(
        administrativeDongMapping.legalByRegionAndName[
          `${regionKey}|${candidateName}`
        ],
      );

      if (match) {
        return match;
      }
    }
  }

  return null;
}
