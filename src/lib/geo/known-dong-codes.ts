import knownDongCodeData from "./data/known-dong-codes.json";

type KnownDongCodesPayload = Record<string, string>;

const knownDongCodes = knownDongCodeData as KnownDongCodesPayload;

export function findKnownDongCode(dongName: string | null | undefined) {
  if (!dongName) {
    return null;
  }

  return knownDongCodes[dongName.trim()] ?? null;
}
