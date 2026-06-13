#!/usr/bin/env node

// 레이어 의존 방향(layer direction)을 강제하는 구조 검사입니다.
// 의도된 의존 방향은 단방향입니다: shared <- collector <- discovery <- generator.
// 즉 generator 는 discovery/collector/shared 에 의존할 수 있고, shared 는 그 무엇에도
// 의존하지 않습니다. 상위 레이어가 하위(upstream) 레이어를 import 하는 것은 정상이고,
// 하위 레이어가 상위 레이어를 import 하는 것이 "역방향 간선(reverse edge)" 위반입니다.
//
// check:circular-dependencies 는 순환만 잡고 방향은 보지 않습니다. 이 검사는 방향을
// 잠그되, 이미 존재하는 위반은 베이스라인으로 허용하고 새 위반만 실패시키는
// 래칫(ratchet) 방식입니다. 베이스라인은 후속 PR에서 줄여 나가야 할 burn-down 목록입니다.
//
// 한계(정적 정규식 기반): 동적 require(`require(변수)`)와 주석/문자열 안의 require 표기는
// 추적하지 않습니다. 상대경로 require('...') 와 require.resolve('...') 두 형태만 봅니다.

const fs = require('node:fs');
const path = require('node:path');

// 이 파일은 <repo>/src/shared/tooling/check-layer-direction.js 입니다.
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SRC_ROOT = path.join(REPO_ROOT, 'src');
const BASELINE_PATH = path.join(__dirname, 'layer-direction-baseline.json');

// 레이어 순위. 숫자가 클수록 상위(downstream) 레이어입니다.
// L 레이어 파일은 M <= L 인 레이어만 import 할 수 있습니다.
const LAYER_RANK = Object.freeze({
  shared: 0,
  collector: 1,
  discovery: 2,
  generator: 3
});

// require('...') 와 require.resolve('...') 의 상대경로 지정자를 모두 잡습니다.
// 앞에 식별자 문자나 `.`이 오면 `foo.require(...)` 같은 메서드 호출이므로 제외하되,
// `require.resolve(`는 명시적으로 허용합니다.
const REQUIRE_PATTERN = /(?<![A-Za-z0-9_.$])require\s*(?:\.\s*resolve\s*)?\(\s*['"]([^'"]+)['"]\s*\)/g;

// 소스 텍스트에서 상대경로(`./`, `../`) 지정자만 추출합니다.
function parseRelativeRequires(source) {
  const specifiers = [];
  let match;
  REQUIRE_PATTERN.lastIndex = 0;
  while ((match = REQUIRE_PATTERN.exec(source)) !== null) {
    const specifier = match[1];
    if (specifier.startsWith('.')) {
      specifiers.push(specifier);
    }
  }
  return specifiers;
}

// repo 루트 기준 상대경로(forward slash)에서 레이어 이름을 뽑습니다.
// src/<layer>/... 형태가 아니면 null 입니다.
function layerOf(repoRelativePath) {
  const parts = repoRelativePath.split('/');
  if (parts[0] !== 'src') {
    return null;
  }
  const layer = parts[1];
  return Object.prototype.hasOwnProperty.call(LAYER_RANK, layer) ? layer : null;
}

// 프로덕션 레이어 코드만 스캔 대상입니다.
// src/<layer>/**/*.js 중 src/**/test/** 와 src/shared/tooling/** 은 제외합니다.
// (test 는 픽스처/계약, tooling 은 dev/CI 하니스로 정상적으로 generator 를 구동합니다.)
function isProductionLayerFile(repoRelativePath) {
  if (!repoRelativePath.endsWith('.js')) {
    return false;
  }
  if (layerOf(repoRelativePath) === null) {
    return false;
  }
  const parts = repoRelativePath.split('/');
  if (parts.includes('test')) {
    return false;
  }
  if (parts[1] === 'shared' && parts[2] === 'tooling') {
    return false;
  }
  return true;
}

// 루트 디렉터리 아래의 모든 .js 파일 절대경로를 수집합니다.
function collectJavascriptFiles(rootDirectory) {
  const files = [];
  for (const entry of fs.readdirSync(rootDirectory, { withFileTypes: true })) {
    const entryPath = path.join(rootDirectory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJavascriptFiles(entryPath));
    } else if (entry.name.endsWith('.js')) {
      files.push(entryPath);
    }
  }
  return files;
}

// 상대경로 지정자를 실제 파일 절대경로로 해석합니다(.js / index.js). 없으면 null.
function resolveRelativeRequire(fromFile, specifier) {
  const target = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [target, `${target}.js`, path.join(target, 'index.js')];
  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch (error) {
      // 후보 경로가 없으면 다음 후보를 시도합니다.
    }
  }
  return null;
}

const toRepoKey = (absolutePath) => path.relative(REPO_ROOT, absolutePath).split(path.sep).join('/');

// 프로덕션 레이어 파일들의 역방향 간선(위반)을 모두 계산합니다.
// 위반 키 형식: "<from> -> <to>" (둘 다 repo 기준 상대경로).
function collectViolations() {
  const allFiles = collectJavascriptFiles(SRC_ROOT);
  const violations = [];

  for (const file of allFiles) {
    const fromKey = toRepoKey(file);
    if (!isProductionLayerFile(fromKey)) {
      continue;
    }
    const fromLayer = layerOf(fromKey);
    const fromRank = LAYER_RANK[fromLayer];

    const source = fs.readFileSync(file, 'utf8');
    const seen = new Set();
    for (const specifier of parseRelativeRequires(source)) {
      const resolved = resolveRelativeRequire(file, specifier);
      if (!resolved) {
        continue;
      }
      const toKey = toRepoKey(resolved);
      // src 밖(node_modules/상위 경로) 이거나 JSON 등은 layerOf 가 null 입니다.
      const toLayer = layerOf(toKey);
      if (toLayer === null) {
        continue;
      }
      const toRank = LAYER_RANK[toLayer];
      // M > L 이면 역방향(상위 레이어를 import)입니다.
      if (toRank > fromRank) {
        const key = `${fromKey} -> ${toKey}`;
        if (!seen.has(key)) {
          seen.add(key);
          violations.push(key);
        }
      }
    }
  }

  return [...new Set(violations)].sort();
}

function readBaseline() {
  let raw;
  try {
    raw = fs.readFileSync(BASELINE_PATH, 'utf8');
  } catch (error) {
    return [];
  }
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`layer-direction-baseline.json must be a JSON array of violation keys.`);
  }
  return parsed;
}

// 현재 위반을 베이스라인과 대조합니다.
// new = 현재에 있으나 베이스라인에 없는 위반(실패 대상).
// stale = 베이스라인에 있으나 더는 위반이 아닌 항목(burn-down 완료, 실패 아님).
function evaluate(current, baseline) {
  const baselineSet = new Set(baseline);
  const currentSet = new Set(current);
  const added = current.filter((key) => !baselineSet.has(key)).sort();
  const stale = baseline.filter((key) => !currentSet.has(key)).sort();
  return { added, stale };
}

function main() {
  const current = collectViolations();
  const baseline = readBaseline();
  const { added, stale } = evaluate(current, baseline);

  for (const key of stale) {
    console.log(`  resolved (remove from baseline): ${key}`);
  }

  if (added.length > 0) {
    console.error(`Layer direction check found ${added.length} NEW reverse edge(s) not in baseline:`);
    for (const key of added) {
      console.error(`  ${key}`);
    }
  }

  console.log(
    `Layer direction check: ${current.length} current violations, ${baseline.length} baseline, ` +
    `${added.length} new (fail if K>0), ${stale.length} stale.`
  );

  if (added.length > 0) {
    process.exit(1);
  }

  console.log('Layer direction check passed. Current violations are a subset of the baseline.');
}

if (require.main === module) {
  main();
}

module.exports = {
  LAYER_RANK,
  parseRelativeRequires,
  layerOf,
  isProductionLayerFile,
  collectJavascriptFiles,
  resolveRelativeRequire,
  collectViolations,
  readBaseline,
  evaluate,
  BASELINE_PATH
};
