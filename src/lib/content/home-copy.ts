function getAdministrativeDongLabel(currentDongName: string) {
  const trimmed = currentDongName.trim();
  const parts = trimmed.split(/\s+/);
  const lastPart = parts[parts.length - 1];

  if (parts.length > 1 && /(동|읍|면|리)$/.test(lastPart)) {
    return lastPart;
  }

  return trimmed;
}

export const homeScreenCopy = {
  eyebrow: null,
  title: "여기 근데",
  titleSuffix: "한마디 할게요",
  subtitle: null,
  emptyTitle: "아직 이 근처엔 올라온 이야기가 없어요",
  emptyDescription: undefined,
  composeCta(currentDongName: string) {
    return {
      prefix: "후보님 여기 ",
      location: getAdministrativeDongLabel(currentDongName),
      suffix: " 인데요",
    };
  },
} as const;
