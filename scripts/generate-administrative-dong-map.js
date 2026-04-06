const fs = require("fs");
const path = require("path");

const DATASET_URL = "https://www.data.go.kr/data/15136368/fileData.do";
const DEFAULT_INPUT = path.join(
  process.cwd(),
  ".artifacts",
  "legal-to-admin-dong.csv",
);
const DEFAULT_OUTPUT = path.join(
  process.cwd(),
  "src",
  "lib",
  "geo",
  "data",
  "administrative-dong-map.json",
);

const SIDO_SHORT_NAMES = new Map([
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

function shortenSidoName(sidoName) {
  const trimmed = normalizeName(sidoName);

  if (!trimmed) {
    return "";
  }

  return SIDO_SHORT_NAMES.get(trimmed) ?? trimmed;
}

function normalizeName(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
}

function createRegionKey(sidoName, sigunguName) {
  return `${shortenSidoName(sidoName)}|${normalizeName(sigunguName)}`;
}

function addMapping(map, ambiguous, key, value) {
  if (!key) {
    return;
  }

  if (ambiguous.has(key)) {
    return;
  }

  const existing = map.get(key);

  if (!existing) {
    map.set(key, value);
    return;
  }

  if (existing[0] !== value[0] || existing[1] !== value[1]) {
    map.delete(key);
    ambiguous.add(key);
  }
}

function createSerializableObject(map) {
  return Object.fromEntries(
    Array.from(map.entries()).sort(([left], [right]) =>
      left.localeCompare(right, "ko-KR"),
    ),
  );
}

function main() {
  const inputPath = path.resolve(process.argv[2] ?? DEFAULT_INPUT);
  const outputPath = path.resolve(process.argv[3] ?? DEFAULT_OUTPUT);

  if (!fs.existsSync(inputPath)) {
    throw new Error(
      `행정동 연계 CSV를 찾지 못했습니다: ${inputPath}\n공식 원문: ${DATASET_URL}`,
    );
  }

  const buffer = fs.readFileSync(inputPath);
  const text = new TextDecoder("euc-kr").decode(buffer);
  const lines = text.split(/\r?\n/).filter(Boolean);

  if (lines.length < 2) {
    throw new Error("행정동 연계 CSV가 비어 있습니다.");
  }

  const administrativeByRegionAndName = new Map();
  const legalByRegionAndName = new Map();
  const administrativeAmbiguousKeys = new Set();
  const legalAmbiguousKeys = new Set();

  for (let index = 1; index < lines.length; index += 1) {
    const columns = lines[index].split(",");

    if (columns.length < 9) {
      continue;
    }

    const regionKey = createRegionKey(columns[0], columns[1]);
    const administrativeDongName = normalizeName(columns[2]);
    const legalDongName = normalizeName(columns[3]);
    const administrativeDongCode = normalizeName(columns[5]);

    if (!regionKey || !administrativeDongName || !administrativeDongCode) {
      continue;
    }

    const mappingValue = [
      administrativeDongCode,
      administrativeDongName,
    ];

    addMapping(
      administrativeByRegionAndName,
      administrativeAmbiguousKeys,
      `${regionKey}|${administrativeDongName}`,
      mappingValue,
    );

    if (legalDongName) {
      addMapping(
        legalByRegionAndName,
        legalAmbiguousKeys,
        `${regionKey}|${legalDongName}`,
        mappingValue,
      );
    }
  }

  const payload = {
    source: {
      datasetUrl: DATASET_URL,
      generatedAt: new Date().toISOString(),
      inputFileName: path.basename(inputPath),
      rows: lines.length - 1,
      administrativeKeys: administrativeByRegionAndName.size,
      administrativeAmbiguousKeys: administrativeAmbiguousKeys.size,
      legalKeys: legalByRegionAndName.size,
      legalAmbiguousKeys: legalAmbiguousKeys.size,
    },
    administrativeByRegionAndName: createSerializableObject(
      administrativeByRegionAndName,
    ),
    legalByRegionAndName: createSerializableObject(legalByRegionAndName),
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(payload)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        outputPath,
        ...payload.source,
      },
      null,
      2,
    ),
  );
}

main();
