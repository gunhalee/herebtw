import type { AppShellState } from "../../types/device";
import type { GridCellSummary, GridLevel } from "../../types/grid";

export type RegionCellMetadata = Pick<
  GridCellSummary,
  "gridCellPath" | "label" | "selected"
> & {
  level: GridLevel;
  dongCode?: string;
  parentPath: string | null;
};

export type RegionNode = {
  path: string;
  label: string;
  level: GridLevel;
  parentPath: string | null;
  dongCode?: string;
};

const ROOT_PATH = "nation";

const REGION_NODES: RegionNode[] = [
  { path: ROOT_PATH, label: "전국", level: "nation", parentPath: null },

  { path: "nation.seoul", label: "서울", level: "sido", parentPath: ROOT_PATH },
  { path: "nation.busan", label: "부산", level: "sido", parentPath: ROOT_PATH },
  { path: "nation.incheon", label: "인천", level: "sido", parentPath: ROOT_PATH },

  { path: "nation.seoul.gangnam", label: "강남구", level: "sigungu", parentPath: "nation.seoul" },
  { path: "nation.seoul.mapo", label: "마포구", level: "sigungu", parentPath: "nation.seoul" },
  { path: "nation.seoul.songpa", label: "송파구", level: "sigungu", parentPath: "nation.seoul" },
  { path: "nation.busan.haeundae", label: "해운대구", level: "sigungu", parentPath: "nation.busan" },
  { path: "nation.busan.suyeong", label: "수영구", level: "sigungu", parentPath: "nation.busan" },
  { path: "nation.busan.dongnae", label: "동래구", level: "sigungu", parentPath: "nation.busan" },
  { path: "nation.incheon.yeonsu", label: "연수구", level: "sigungu", parentPath: "nation.incheon" },
  { path: "nation.incheon.bupyeong", label: "부평구", level: "sigungu", parentPath: "nation.incheon" },
  { path: "nation.incheon.namdong", label: "남동구", level: "sigungu", parentPath: "nation.incheon" },

  { path: "nation.seoul.gangnam.yeoksam1", label: "역삼1동", level: "dong", parentPath: "nation.seoul.gangnam", dongCode: "11680640" },
  { path: "nation.seoul.gangnam.yeoksam2", label: "역삼2동", level: "dong", parentPath: "nation.seoul.gangnam", dongCode: "11680650" },
  { path: "nation.seoul.gangnam.nonhyeon1", label: "논현1동", level: "dong", parentPath: "nation.seoul.gangnam", dongCode: "11680521" },
  { path: "nation.seoul.mapo.seogyo", label: "서교동", level: "dong", parentPath: "nation.seoul.mapo", dongCode: "11440660" },
  { path: "nation.seoul.mapo.yeonnam", label: "연남동", level: "dong", parentPath: "nation.seoul.mapo", dongCode: "11440720" },
  { path: "nation.seoul.mapo.hapjeong", label: "합정동", level: "dong", parentPath: "nation.seoul.mapo", dongCode: "11440680" },
  { path: "nation.seoul.songpa.jamsilbon", label: "잠실본동", level: "dong", parentPath: "nation.seoul.songpa", dongCode: "11710610" },
  { path: "nation.seoul.songpa.bangi1", label: "방이1동", level: "dong", parentPath: "nation.seoul.songpa", dongCode: "11710562" },
  { path: "nation.seoul.songpa.munjeong1", label: "문정1동", level: "dong", parentPath: "nation.seoul.songpa", dongCode: "11710631" },
  { path: "nation.busan.haeundae.u1", label: "우1동", level: "dong", parentPath: "nation.busan.haeundae", dongCode: "26350510" },
  { path: "nation.busan.haeundae.jung1", label: "중1동", level: "dong", parentPath: "nation.busan.haeundae", dongCode: "26350530" },
  { path: "nation.busan.haeundae.jwa1", label: "좌1동", level: "dong", parentPath: "nation.busan.haeundae", dongCode: "26350610" },
  { path: "nation.busan.suyeong.namcheon2", label: "남천2동", level: "dong", parentPath: "nation.busan.suyeong", dongCode: "26500660" },
  { path: "nation.busan.suyeong.gwangan1", label: "광안1동", level: "dong", parentPath: "nation.busan.suyeong", dongCode: "26500530" },
  { path: "nation.busan.suyeong.millak", label: "민락동", level: "dong", parentPath: "nation.busan.suyeong", dongCode: "26500680" },
  { path: "nation.busan.dongnae.oncheon1", label: "온천1동", level: "dong", parentPath: "nation.busan.dongnae", dongCode: "26260510" },
  { path: "nation.busan.dongnae.myeongnyun", label: "명륜동", level: "dong", parentPath: "nation.busan.dongnae", dongCode: "26260570" },
  { path: "nation.busan.dongnae.sajik1", label: "사직1동", level: "dong", parentPath: "nation.busan.dongnae", dongCode: "26260610" },
  { path: "nation.incheon.yeonsu.songdo1", label: "송도1동", level: "dong", parentPath: "nation.incheon.yeonsu", dongCode: "28185820" },
  { path: "nation.incheon.yeonsu.dongchun1", label: "동춘1동", level: "dong", parentPath: "nation.incheon.yeonsu", dongCode: "28185710" },
  { path: "nation.incheon.yeonsu.yeonsu1", label: "연수1동", level: "dong", parentPath: "nation.incheon.yeonsu", dongCode: "28185600" },
  { path: "nation.incheon.bupyeong.bupyeong1", label: "부평1동", level: "dong", parentPath: "nation.incheon.bupyeong", dongCode: "28237510" },
  { path: "nation.incheon.bupyeong.samsan1", label: "삼산1동", level: "dong", parentPath: "nation.incheon.bupyeong", dongCode: "28237670" },
  { path: "nation.incheon.bupyeong.galsean1", label: "갈산1동", level: "dong", parentPath: "nation.incheon.bupyeong", dongCode: "28237620" },
  { path: "nation.incheon.namdong.guwol1", label: "구월1동", level: "dong", parentPath: "nation.incheon.namdong", dongCode: "28200530" },
  { path: "nation.incheon.namdong.nonhyeongojan", label: "논현고잔동", level: "dong", parentPath: "nation.incheon.namdong", dongCode: "28200720" },
  { path: "nation.incheon.namdong.mansu1", label: "만수1동", level: "dong", parentPath: "nation.incheon.namdong", dongCode: "28200660" },
];

const NODE_BY_PATH = new Map(REGION_NODES.map((node) => [node.path, node]));
const NODE_BY_DONG_CODE = new Map(
  REGION_NODES.flatMap((node) =>
    node.dongCode ? [[node.dongCode, node] as const] : [],
  ),
);
const NODE_BY_DONG_NAME = new Map(
  REGION_NODES.filter((node) => node.level === "dong").map((node) => [
    node.label,
    node,
  ]),
);

const NEXT_LEVEL_BY_LEVEL: Record<GridLevel, GridLevel | null> = {
  nation: "sido",
  sido: "sigungu",
  sigungu: "dong",
  dong: null,
};

export function getRootGridPath() {
  return ROOT_PATH;
}

export function getRegionNode(path: string | null | undefined) {
  if (!path) {
    return NODE_BY_PATH.get(ROOT_PATH) ?? null;
  }

  return NODE_BY_PATH.get(path) ?? null;
}

export function findRegionNodeByDongCode(dongCode: string | null | undefined) {
  if (!dongCode) {
    return null;
  }

  return NODE_BY_DONG_CODE.get(dongCode) ?? null;
}

export function findRegionNodeByDongName(dongName: string | null | undefined) {
  if (!dongName) {
    return null;
  }

  return NODE_BY_DONG_NAME.get(dongName) ?? null;
}

export function getRegionLabel(path: string | null | undefined) {
  return getRegionNode(path)?.label ?? "지역 선택";
}

export function getParentGridPath(path: string | null | undefined) {
  return getRegionNode(path)?.parentPath ?? null;
}

export function getDongCodeForGridCellPath(path: string | null | undefined) {
  return getRegionNode(path)?.dongCode ?? null;
}

export function getNextGridLevel(level: GridLevel) {
  return NEXT_LEVEL_BY_LEVEL[level];
}

export function getRegionCellMetadata(
  appShellState: Pick<AppShellState, "selectedGridLevel" | "selectedGridCellPath">,
): RegionCellMetadata[] {
  const parentPath =
    appShellState.selectedGridLevel === "dong"
      ? getParentGridPath(appShellState.selectedGridCellPath) ?? ROOT_PATH
      : (appShellState.selectedGridCellPath ?? ROOT_PATH);
  const nextLevel =
    appShellState.selectedGridLevel === "dong"
      ? "dong"
      : getNextGridLevel(appShellState.selectedGridLevel);

  if (!nextLevel) {
    return [];
  }

  return REGION_NODES.filter(
    (node) => node.parentPath === parentPath && node.level === nextLevel,
  ).map((node) => ({
    gridCellPath: node.path,
    label: node.label,
    selected: appShellState.selectedGridCellPath === node.path,
    level: node.level,
    dongCode: node.dongCode,
    parentPath: node.parentPath,
  }));
}

export function hydrateGridCells(
  appShellState: Pick<AppShellState, "selectedGridLevel" | "selectedGridCellPath">,
  summary: Array<Pick<GridCellSummary, "gridCellPath" | "activePostCount">>,
): GridCellSummary[] {
  const metadata = getRegionCellMetadata(appShellState);
  const summaryMap = new Map(
    summary.map((cell) => [cell.gridCellPath, cell.activePostCount]),
  );

  return metadata.map((cell) => ({
    gridCellPath: cell.gridCellPath,
    label: cell.label,
    selected: appShellState.selectedGridCellPath === cell.gridCellPath,
    activePostCount: summaryMap.get(cell.gridCellPath) ?? 0,
  }));
}
