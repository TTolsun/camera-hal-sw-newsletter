#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// 이 파일은 <repo>/src/shared/tooling/cli/report-cleanup-candidates.js 입니다.
const REPO_ROOT = path.resolve(__dirname, '../../../..');
// #262 src 재구성 완료 후 구현 코드는 모두 src/ 아래에 있습니다.
const NEWSROOM_DIR = path.join(REPO_ROOT, 'src');
// 레거시 scripts/lib shim 계층은 제거되어 더 이상 존재하지 않습니다(빈 스캔으로 처리됨).
const LIB_DIR = path.join(REPO_ROOT, 'scripts', 'lib');
const TESTS_DIR = path.join(REPO_ROOT, 'tests');
const ALLOWLIST_PATH = path.join(__dirname, 'cleanup-candidates-allowlist.json');

// 함수 이름으로 인정하지 않는 패턴(동명이인 false positive allowlist)
const SIGNATURE_DUPLICATE_IGNORE_NAMES = new Set([
  'main',
  'run',
  'init',
  'load',
  'parse',
  'format',
  'validate',
  'build',
  'read',
  'write',
  'get',
  'set',
  'create',
  'check',
  'resolve',
  'normalize',
  'toJSON',
  'toString',
]);

function loadAllowlist() {
  try {
    return JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  } catch {
    return { known_alive: [], compat_surface: [], generated_artifact: [], archive_reference: [] };
  }
}

// --- export/require 파싱 정규식 ---
// 각 패턴이 인식하는 형태와 인식하지 못하는 형태를 명시한다.

// 인식: module.exports = { NAME, key: value, ... }
// 미인식: 여러 줄에 걸쳐 중첩 객체가 있는 경우, 동적 키
const PATTERN_EXPORTS_OBJECT = /module\.exports\s*=\s*\{([^}]+)\}/gs;
const PATTERN_EXPORTS_OBJECT_SHORTHAND = /^\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[,\n}]/gm;
const PATTERN_EXPORTS_OBJECT_KEYVAL = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g;

// 인식: module.exports.NAME = ...
// 미인식: Object.assign(module.exports, ...), module.exports[동적키] = ...
const PATTERN_EXPORTS_DOTPROP = /module\.exports\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g;

// 인식: exports.NAME = ...
// 미인식: exports[동적키] = ...
const PATTERN_EXPORTS_NAMED = /\bexports\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g;

// 인식: require('path') 또는 require("path") — 정적 문자열
// 미인식: require(변수), require(`template`), dynamic import()
const PATTERN_REQUIRE = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

// 비표준 export 형태 — [패턴, 이유] 튜플. 패턴과 이유를 같은 위치에 두어 변경 시 동기화 누락 방지.
const UNPARSEABLE_EXPORT_PATTERNS = Object.freeze([
  [/Object\.assign\s*\(\s*module\.exports\s*,/, 'Object.assign(module.exports, ...) — not parseable by simple regex'],
  [/module\.exports\s*\[/, 'module.exports[동적키] = ... — dynamic key, fields not collected'],
]);

// 동적 require 형태 — [패턴, 이유] 튜플
const UNPARSEABLE_REQUIRE_PATTERNS = Object.freeze([
  [/require\s*\(\s*[^'"]/, 'dynamic require(...) — caller relation not statically known'],
]);

// 디렉터리를 재귀 순회하여 .js 파일 경로 목록 반환
function collectJsFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

// 파일 경로를 repo 루트 기준 상대경로(슬래시 구분)로 변환
function toRepoRelative(absPath) {
  return absPath.replace(REPO_ROOT + path.sep, '').split(path.sep).join('/');
}

// module.exports 멤버 이름 추출 (정규식 기반, CommonJS)
function extractExports(source) {
  const names = new Set();

  for (const match of source.matchAll(PATTERN_EXPORTS_OBJECT)) {
    const block = match[1];
    for (const nameMatch of block.matchAll(PATTERN_EXPORTS_OBJECT_SHORTHAND)) {
      names.add(nameMatch[1]);
    }
    for (const nameMatch of block.matchAll(PATTERN_EXPORTS_OBJECT_KEYVAL)) {
      names.add(nameMatch[1]);
    }
  }

  for (const match of source.matchAll(PATTERN_EXPORTS_DOTPROP)) {
    names.add(match[1]);
  }

  for (const match of source.matchAll(PATTERN_EXPORTS_NAMED)) {
    names.add(match[1]);
  }

  return [...names];
}

// 튜플 배열에서 매칭된 이유 문자열 목록 반환
function findUnparseableReasons(text, patternTuples) {
  const reasons = [];
  for (const [pattern, reason] of patternTuples) {
    // g/y 플래그 추가 시 stateful test 회귀 방지
    pattern.lastIndex = 0;
    if (pattern.test(text)) reasons.push(reason);
  }
  return reasons;
}

// require() 경로 추출 — 상대경로 및 절대경로 모두
function extractRequirePaths(source) {
  const paths = [];
  for (const match of source.matchAll(PATTERN_REQUIRE)) {
    paths.push(match[1]);
  }
  return paths;
}

// require 경로를 절대 파일 경로로 정규화
function resolveRequirePath(requirePath, fromFile) {
  if (!requirePath.startsWith('.') && !requirePath.startsWith('/')) {
    return null; // node_modules — 무시
  }
  const base = path.dirname(fromFile);
  const resolved = path.resolve(base, requirePath);
  // .js 확장자 시도
  for (const candidate of [resolved, resolved + '.js', path.join(resolved, 'index.js')]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

// export 이름이 caller 파일들에서 실제로 사용되는지 확인
// destructure({ NAME }) 또는 .NAME 패턴으로 검색
function isExportUsedInSource(exportName, callerSource) {
  const pattern = new RegExp(`\\b${exportName}\\b`);
  return pattern.test(callerSource);
}

// 함수 시그니처(이름 + arity) 추출
// function NAME(arg1, arg2) 또는 const NAME = (arg1, arg2) => 또는 NAME(arg1, arg2) {
function extractFunctionSignatures(source, filePath) {
  const signatures = [];

  const patterns = [
    // function NAME(...)
    /\bfunction\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)/g,
    // const/let/var NAME = (...) =>
    /\b(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g,
    // NAME(...) { — 메서드 형태
    /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)\s*\{/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const name = match[1];
      const args = match[2];
      // 파라미터 개수(arity) 계산 — 빈 인자는 0
      const arity = args.trim() === '' ? 0 : args.split(',').length;
      signatures.push({ name, arity, filePath });
    }
  }

  return signatures;
}

// 파일 내부 호출(자기 참조)인지 확인
function isSelfReference(callerFile, targetFile) {
  return path.resolve(callerFile) === path.resolve(targetFile);
}

function main() {
  const showJson = process.argv.includes('--json');
  const allowlist = loadAllowlist();

  const knownAliveSet = new Set(allowlist.known_alive || []);
  const compatSurfaceSet = new Set(allowlist.compat_surface || []);

  // ---- 1. 파일 수집 ----
  const newsroomFiles = collectJsFiles(NEWSROOM_DIR);
  const libFiles = collectJsFiles(LIB_DIR);
  const testFiles = collectJsFiles(TESTS_DIR);

  // ---- 2. 각 파일의 source 캐시 ----
  const sourceCache = {};
  for (const f of [...newsroomFiles, ...libFiles, ...testFiles]) {
    try {
      sourceCache[f] = fs.readFileSync(f, 'utf8');
    } catch {
      sourceCache[f] = '';
    }
  }

  // ---- 3. require 그래프 구성: 파일 -> require하는 파일 목록 ----
  // key: 정규화된 절대경로, value: 해당 파일을 require하는 파일 목록
  const requireGraph = {}; // target -> [callerFile, ...]

  for (const callerFile of [...newsroomFiles, ...testFiles]) {
    const source = sourceCache[callerFile] || '';
    for (const reqPath of extractRequirePaths(source)) {
      const resolved = resolveRequirePath(reqPath, callerFile);
      if (!resolved) continue;
      if (!requireGraph[resolved]) requireGraph[resolved] = [];
      if (!isSelfReference(callerFile, resolved)) {
        requireGraph[resolved].push(callerFile);
      }
    }
  }

  // ---- 4. dead exports 탐지 ----
  const deadExports = [];

  for (const filePath of newsroomFiles) {
    const relPath = toRepoRelative(filePath);
    const source = sourceCache[filePath] || '';
    const exports = extractExports(source);

    if (exports.length === 0) continue;

    // 이 파일을 require하는 caller 목록
    const callers = (requireGraph[filePath] || []).filter(
      (c) => !isSelfReference(c, filePath)
    );

    for (const exportName of exports) {
      const key = `${relPath}#${exportName}`;

      // allowlist known_alive 제외
      if (knownAliveSet.has(key)) continue;

      // caller가 없으면 dead export
      if (callers.length === 0) {
        deadExports.push({ file: relPath, export: exportName, callers: 0 });
        continue;
      }

      // caller 파일들에서 실제로 이 export 이름이 사용되는지 확인
      const actualCallers = callers.filter((c) => isExportUsedInSource(exportName, sourceCache[c] || ''));
      if (actualCallers.length === 0) {
        deadExports.push({ file: relPath, export: exportName, callers: 0 });
      }
    }
  }

  // ---- 5. 시그니처 중복 탐지 ----
  // 모듈 내 exported 함수만 대상으로 (export 이름과 일치하는 시그니처)
  const signatureMap = {}; // "name/arity" -> [{ file, name, arity }]

  for (const filePath of newsroomFiles) {
    const relPath = toRepoRelative(filePath);
    const source = sourceCache[filePath] || '';
    const exports = new Set(extractExports(source));
    const signatures = extractFunctionSignatures(source, relPath);

    for (const sig of signatures) {
      // exported 함수만 포함하고, 무의미한 이름은 제외
      if (!exports.has(sig.name)) continue;
      if (SIGNATURE_DUPLICATE_IGNORE_NAMES.has(sig.name)) continue;

      const key = `${sig.name}/${sig.arity}`;
      if (!signatureMap[key]) signatureMap[key] = [];
      // 같은 파일 중복 제거
      if (!signatureMap[key].some((s) => s.file === relPath)) {
        signatureMap[key].push({ file: relPath, name: sig.name, arity: sig.arity });
      }
    }
  }

  const signatureClusters = Object.values(signatureMap)
    .filter((cluster) => cluster.length >= 2)
    .sort((a, b) => b.length - a.length);

  // ---- 6. shim caller-less 탐지 ----
  const shimCallerless = [];
  const shimSuppressed = [];

  for (const filePath of libFiles) {
    const relPath = toRepoRelative(filePath);

    if (compatSurfaceSet.has(relPath)) {
      shimSuppressed.push(relPath);
      continue;
    }

    // newsroom 또는 tests에서 require하는지 확인
    const callers = [];
    for (const callerFile of [...newsroomFiles, ...testFiles]) {
      const source = sourceCache[callerFile] || '';
      for (const reqPath of extractRequirePaths(source)) {
        const resolved = resolveRequirePath(reqPath, callerFile);
        if (resolved && path.resolve(resolved) === path.resolve(filePath)) {
          callers.push(toRepoRelative(callerFile));
        }
      }
    }

    if (callers.length === 0) {
      shimCallerless.push({ file: relPath, callers: 0 });
    }
  }

  // ---- 7. unparseable 파일 탐지 ----
  // 비표준 export/require 패턴을 가진 파일은 분석이 불완전할 수 있어 별도 표시한다.
  const unparseableFiles = [];
  for (const filePath of newsroomFiles) {
    const relPath = toRepoRelative(filePath);
    const source = sourceCache[filePath] || '';
    const reasons = [
      ...findUnparseableReasons(source, UNPARSEABLE_EXPORT_PATTERNS),
      ...findUnparseableReasons(source, UNPARSEABLE_REQUIRE_PATTERNS),
    ];
    if (reasons.length > 0) {
      unparseableFiles.push({ file: relPath, reasons });
    }
  }

  // ---- 8. 출력 ----
  if (showJson) {
    const result = {
      deadExports,
      signatureClusters: signatureClusters.map((cluster) => ({
        name: cluster[0].name,
        arity: cluster[0].arity,
        files: cluster.map((s) => s.file),
      })),
      shimCallerless,
      shimSuppressed,
      unparseableFiles,
    };
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(0);
  }

  // Markdown 보고서 출력
  const lines = [];
  lines.push('# Cleanup Candidates Report');
  lines.push('');
  lines.push(`생성 시각: ${new Date().toISOString()}`);
  lines.push('');

  // --- 섹션 1: Dead exports ---
  lines.push('## 1. Dead Exports (export-but-no-caller)');
  lines.push('');
  lines.push('`src/**` 파일에 export되었지만 같은 트리 내 caller가 0건인 멤버 목록입니다.');
  lines.push('');

  if (deadExports.length === 0) {
    lines.push('_(없음)_');
  } else {
    lines.push('| File | Export |');
    lines.push('| --- | --- |');
    for (const item of deadExports) {
      lines.push(`| \`${item.file}\` | \`${item.export}\` |`);
    }
  }
  lines.push('');

  // --- 섹션 2: Signature duplicates ---
  lines.push('## 2. Signature Duplicates (동일 이름 + arity, ≥2 파일)');
  lines.push('');
  lines.push('동일한 함수 이름과 파라미터 개수를 가진 exported 함수가 2개 이상의 파일에 정의된 클러스터입니다.');
  lines.push('');

  if (signatureClusters.length === 0) {
    lines.push('_(없음)_');
  } else {
    for (const cluster of signatureClusters) {
      const { name, arity } = cluster[0];
      lines.push(`### \`${name}\` (arity: ${arity}) — ${cluster.length}개 파일`);
      lines.push('');
      for (const sig of cluster) {
        lines.push(`- \`${sig.file}\``);
      }
      lines.push('');
    }
  }

  // --- 섹션 3: Shim caller-less ---
  lines.push('## 3. Shim Caller-less (legacy `scripts/lib/*.js` — 재구성 후 제거됨)');
  lines.push('');
  lines.push('`src/**` 또는 `tests/**` 에서 require하는 caller가 0건인 shim 파일입니다. (레거시 계층이 제거되어 일반적으로 비어 있습니다.)');
  lines.push('');

  if (shimCallerless.length === 0) {
    lines.push('_(없음)_');
  } else {
    lines.push('| File |');
    lines.push('| --- |');
    for (const item of shimCallerless) {
      lines.push(`| \`${item.file}\` |`);
    }
  }
  lines.push('');

  if (shimSuppressed.length > 0) {
    lines.push('### Known compat surface (suppressed)');
    lines.push('');
    lines.push('allowlist `compat_surface`에 등록되어 별도 표시합니다. PR 10에서 caller-less 최종 확인 후 삭제 검토.');
    lines.push('');
    for (const file of shimSuppressed) {
      lines.push(`- \`${file}\``);
    }
    lines.push('');
  }

  // --- 섹션 4: Unparseable files ---
  lines.push('## 4. Unparseable Files (비표준 export/require)');
  lines.push('');
  lines.push('정규식 기반 파싱으로 인식하지 못하는 export/require 형태가 있는 파일입니다. dead export 분석이 불완전할 수 있습니다.');
  lines.push('');

  if (unparseableFiles.length === 0) {
    lines.push('_(없음)_');
  } else {
    lines.push('| File | 이유 |');
    lines.push('| --- | --- |');
    for (const item of unparseableFiles) {
      lines.push(`| \`${item.file}\` | ${item.reasons.join('; ')} |`);
    }
  }
  lines.push('');

  // --- 요약 ---
  lines.push('---');
  lines.push('');
  lines.push('## 요약');
  lines.push('');
  lines.push(`- dead exports: ${deadExports.length}`);
  lines.push(`- signature duplicates: ${signatureClusters.length} clusters`);
  lines.push(`- shim caller-less: ${shimCallerless.length} (suppressed: ${shimSuppressed.length})`);
  lines.push(`- unparseable files: ${unparseableFiles.length}`);
  lines.push('');

  process.stdout.write(lines.join('\n') + '\n');
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = {
  UNPARSEABLE_EXPORT_PATTERNS,
  UNPARSEABLE_REQUIRE_PATTERNS,
  findUnparseableReasons,
};
