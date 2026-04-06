function uniqueParts(parts: Array<string | null | undefined>) {
  const seen = new Set<string>();

  return parts.filter((part): part is string => {
    if (!part) {
      return false;
    }

    const trimmed = part.trim();

    if (!trimmed || seen.has(trimmed)) {
      return false;
    }

    seen.add(trimmed);
    return true;
  });
}

function nonEmptyParts(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

const SIDO_SHORT_NAMES = new Map<string, string>([
  ["서울특별시", "서울"],
  ["부산광역시", "부산"],
  ["대구광역시", "대구"],
  ["인천광역시", "인천"],
  ["광주광역시", "광주"],
  ["대전광역시", "대전"],
  ["울산광역시", "울산"],
  ["세종특별자치시", "세종"],
  ["경기도", "경기"],
  ["강원특별자치도", "강원"],
  ["강원도", "강원"],
  ["충청북도", "충북"],
  ["충청남도", "충남"],
  ["전북특별자치도", "전북"],
  ["전라북도", "전북"],
  ["전라남도", "전남"],
  ["경상북도", "경북"],
  ["경상남도", "경남"],
  ["제주특별자치도", "제주"],
  ["제주도", "제주"],
]);

export function shortenSidoName(sidoName: string | null | undefined) {
  if (!sidoName) {
    return null;
  }

  return SIDO_SHORT_NAMES.get(sidoName.trim()) ?? sidoName.trim();
}

export function normalizeAdministrativeDongName(
  administrativeDongName: string,
) {
  const parts = nonEmptyParts(administrativeDongName);

  if (parts.length === 0) {
    return administrativeDongName.trim();
  }

  const preferredPart = parts.find((part) => /(읍|면|동)$/.test(part));

  if (preferredPart) {
    return preferredPart;
  }

  if (parts.length >= 3) {
    return parts[2];
  }

  return parts[parts.length - 1];
}

export function formatAdministrativeAreaName(input: {
  sidoName?: string | null;
  sigunguName?: string | null;
  administrativeDongName: string;
}) {
  return uniqueParts([
    shortenSidoName(input.sidoName),
    input.sigunguName,
    normalizeAdministrativeDongName(input.administrativeDongName),
  ]).join(" ");
}
