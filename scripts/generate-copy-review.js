const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = process.cwd();
const SOURCE_ROOT = path.join(PROJECT_ROOT, "src");
const OUTPUT_PATH = path.join(PROJECT_ROOT, "docs", "copy-review.md");
const INCLUDED_EXTENSIONS = new Set([".ts", ".tsx", ".json"]);

const SECTION_RULES = [
  {
    title: "UI & Screen Copy",
    description: "사용자가 화면에서 직접 보게 되는 문구입니다.",
    match(filePath) {
      return (
        (filePath.startsWith("src/app/") && !filePath.startsWith("src/app/api/")) ||
        filePath.startsWith("src/components/") ||
        filePath.startsWith("src/lib/content/")
      );
    },
  },
  {
    title: "System & API Messages",
    description: "에러, 검증, 등록/요청 실패 등 시스템 응답 문구입니다.",
    match(filePath) {
      return (
        filePath.startsWith("src/app/api/") ||
        filePath === "src/lib/device/browser-device.ts" ||
        filePath === "src/lib/geo/browser-administrative-location-resolver.ts" ||
        filePath === "src/lib/posts/mutations.ts" ||
        filePath === "src/lib/posts/validators.ts" ||
        filePath === "src/components/home/home-feed-api.ts" ||
        filePath === "src/components/home/home-post-api.ts" ||
        filePath === "src/components/home/home-feed-bootstrap.ts" ||
        filePath === "src/components/home/use-home-compose-flow.ts" ||
        filePath === "src/components/home/use-home-agree-actions.ts" ||
        filePath === "src/components/home/use-home-feed-list-actions.ts" ||
        filePath === "src/components/home/use-home-report-actions.ts" ||
        filePath === "src/components/post/use-compose-submit.ts"
      );
    },
  },
  {
    title: "Display Labels",
    description: "시간, 거리, 상태처럼 공통 표시용 짧은 라벨입니다.",
    match(filePath) {
      return (
        filePath === "src/lib/utils/datetime.ts" ||
        filePath === "src/lib/geo/format-bucketed-distance.ts"
      );
    },
  },
  {
    title: "Sample & Placeholder Text",
    description: "샘플 데이터, placeholder, 데모용 텍스트입니다.",
    match(filePath) {
      return (
        filePath === "src/lib/posts/mock-data.ts" ||
        filePath === "src/components/home/use-compose-dong-flashcard.ts"
      );
    },
  },
  {
    title: "Reference Geographic Labels",
    description: "행정구역 표시나 동 코드처럼 운영 기준이 되는 명칭 데이터입니다.",
    match(filePath) {
      return (
        filePath === "src/lib/geo/format-administrative-area.ts" ||
        filePath === "src/lib/geo/known-dong-codes.ts" ||
        filePath === "src/lib/geo/data/known-dong-codes.json"
      );
    },
  },
];

const EXCLUDED_PATHS = new Set([
  "src/lib/geo/data/administrative-dong-map.json",
]);

function toPosixPath(value) {
  return value.replace(/\\/g, "/");
}

function walk(dirPath, files = []) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }

    if (INCLUDED_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function classifyFile(filePath) {
  let matchedRule = null;

  for (const rule of SECTION_RULES) {
    if (rule.match(filePath)) {
      matchedRule = rule;
    }
  }

  return matchedRule;
}

function normalizeSnippet(value) {
  return value.replace(/\s+/g, " ").trim();
}

function collectMatches(pattern, text, collector) {
  for (const match of text.matchAll(pattern)) {
    const value = normalizeSnippet(match[1] ?? "");

    if (value) {
      collector.push(value);
    }
  }
}

function extractLineSnippets(trimmedLine) {
  const snippets = [];

  collectMatches(/"([^"\n]*[가-힣][^"\n]*)"/g, trimmedLine, snippets);
  collectMatches(/'([^'\n]*[가-힣][^'\n]*)'/g, trimmedLine, snippets);
  collectMatches(/`([^`\n]*[가-힣][^`\n]*)`/g, trimmedLine, snippets);
  collectMatches(/>([^<>]*[가-힣][^<>]*)</g, trimmedLine, snippets);

  if (snippets.length === 0) {
    const normalizedLine = normalizeSnippet(
      trimmedLine
        .replace(/^[>{(){}\[\]\s]+/, "")
        .replace(/[<>{(){}\[\],;:\s]+$/, "")
    );

    if (
      /[가-힣]/.test(normalizedLine) &&
      !normalizedLine.includes(".test(") &&
      !normalizedLine.startsWith("return ")
    ) {
      snippets.push(normalizedLine);
    }
  }

  return [...new Set(snippets)];
}

function extractCopyEntries(text) {
  const lines = text.split(/\r?\n/);
  const entries = [];

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const trimmedLine = rawLine.trim();

    if (!trimmedLine || !/[가-힣]/.test(trimmedLine)) {
      continue;
    }

    if (
      trimmedLine.startsWith("import ") ||
      trimmedLine.startsWith("//") ||
      trimmedLine.includes("/[가-힣]/")
    ) {
      continue;
    }

    for (const snippet of extractLineSnippets(trimmedLine)) {
      entries.push({
        lineNumber: index + 1,
        text: snippet,
      });
    }
  }

  return entries;
}

function createMarkdown(inventory) {
  const lines = [
    "# Copy Review",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "이 문서는 `npm run generate:copy-review`로 생성됩니다.",
    "화면 문구, 시스템 메시지, 샘플/참조 라벨을 파일별로 모아 검토할 수 있게 정리했습니다.",
    "",
  ];

  for (const section of SECTION_RULES) {
    const sectionFiles = inventory.get(section.title) ?? [];

    if (sectionFiles.length === 0) {
      continue;
    }

    lines.push(`## ${section.title}`);
    lines.push("");
    lines.push(section.description);
    lines.push("");

    for (const fileEntry of sectionFiles) {
      lines.push(`### ${fileEntry.filePath}`);
      lines.push("");

      for (const entry of fileEntry.entries) {
        lines.push(`- L${entry.lineNumber}: ${entry.text}`);
      }

      lines.push("");
    }
  }

  return `${lines.join("\n").trim()}\n`;
}

function main() {
  const allFiles = walk(SOURCE_ROOT)
    .map((filePath) => toPosixPath(path.relative(PROJECT_ROOT, filePath)))
    .filter((filePath) => !EXCLUDED_PATHS.has(filePath))
    .sort((left, right) => left.localeCompare(right));

  const inventory = new Map();

  for (const filePath of allFiles) {
    const section = classifyFile(filePath);

    if (!section) {
      continue;
    }

    const text = fs.readFileSync(path.join(PROJECT_ROOT, filePath), "utf8");
    const entries = extractCopyEntries(text);

    if (entries.length === 0) {
      continue;
    }

    const sectionEntries = inventory.get(section.title) ?? [];
    sectionEntries.push({
      filePath,
      entries,
    });
    inventory.set(section.title, sectionEntries);
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, createMarkdown(inventory), "utf8");
  console.log(`Generated ${toPosixPath(path.relative(PROJECT_ROOT, OUTPUT_PATH))}`);
}

main();
