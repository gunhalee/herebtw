import type { GridLevel } from "../../types/grid";
import {
  findRegionNodeByDongCode,
  findRegionNodeByDongName,
} from "./region-metadata";

export type ResolveGridCellInput = {
  administrativeDongCode: string;
  administrativeDongName: string;
  sidoName?: string | null;
  sigunguName?: string | null;
};

export type ResolveGridCellResult = {
  selectedGridLevel: GridLevel;
  selectedGridCellPath: string;
};

function toGridPathSegment(value: string) {
  const normalized = value.trim().toLowerCase().normalize("NFKC");
  const asciiSlug = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (asciiSlug) {
    return asciiSlug;
  }

  return encodeURIComponent(normalized).replace(/%/g, "").toLowerCase();
}

export async function resolveGridCell(
  input: ResolveGridCellInput,
): Promise<ResolveGridCellResult> {
  const knownRegion =
    findRegionNodeByDongCode(input.administrativeDongCode) ??
    findRegionNodeByDongName(input.administrativeDongName);

  if (knownRegion) {
    return {
      selectedGridLevel: "dong",
      selectedGridCellPath: knownRegion.path,
    };
  }

  const pathSegments = [
    "nation",
    toGridPathSegment(input.sidoName ?? "unknown"),
    toGridPathSegment(input.sigunguName ?? "unknown"),
    toGridPathSegment(input.administrativeDongName),
  ];

  return {
    selectedGridLevel: "dong",
    selectedGridCellPath: pathSegments.join("."),
  };
}
