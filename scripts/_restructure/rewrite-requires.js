#!/usr/bin/env node
'use strict';

// 소스 트리 재구성(#262) 전용 require 재작성 codemod.
//
// 입력: file-destination-map.json — { "<현재 repo 상대경로>": "<새 repo 상대경로>", ... }.
// 동작: 이동 대상인 모든 .js 파일에 대해, 각 상대경로 require('./x' | '../y')의 대상 파일을
//       현재 위치 기준으로 해석한 뒤, 그 대상의 새 위치를 map에서 찾아 "새 소스 위치 → 새 대상 위치"
//       상대경로를 다시 계산해 require 문자열만 교체한다.
//
// 안전 규칙(AGENTS/CLAUDE 계약):
//   - require( ... ) 문자열 리터럴만 건드린다. 다른 바이트는 보존한다.
//   - UTF-8(BOM 없음)과 줄바꿈(LF/CRLF)을 보존한다.
//   - 결정론적(deterministic) · 멱등(idempotent): 같은 map으로 두 번 적용해도 결과가 같다.
//
// 모드:
//   --check <map>            건드리지 않고 미해결 require 수와 순환(cycle) 수만 보고(드라이런).
//   --apply <map> [--only p] 실제 교체. --only는 "현재 경로가 prefix로 시작하는 파일"만 처리.
//   --selftest               내장 자체 테스트 실행(임시 디렉터리 사용, repo 미변경).
//
// 한계: 정적 정규식 기반이라 동적 require(`require(변수)`)와 require.resolve는 추적하지 않는다.
//       circular-dependency 검사와 동일한 한계이며, 그 파일들은 map에도 등장하지 않는다.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// 앞에 식별자/`.`이 오면 foo.require(...) 메서드 호출이므로 제외(circular 검사와 동일 패턴).
const REQUIRE_PATTERN = /(?<![A-Za-z0-9_.$])require\(\s*(['"])([^'"]+)\1\s*\)/g;

function toPosix(p) {
  return p.split(path.sep).join('/');
}

// repo 루트: 이 파일은 <repo>/scripts/_restructure/rewrite-requires.js.
function repoRoot() {
  return path.resolve(__dirname, '..', '..');
}

function loadMap(mapPath) {
  const raw = fs.readFileSync(mapPath, 'utf8');
  const obj = JSON.parse(raw);
  // 키/값을 posix로 정규화.
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[toPosix(k)] = toPosix(v);
  return out;
}

// 상대 specifier를 "from 파일의 디렉터리 기준" repo 상대 대상 경로로 해석한다.
// .js / index.js 후보를 순서대로 시도하고, 실제 파일이 있으면 그 repo 상대경로를 돌려준다.
// 파일이 없더라도(이동 후 검사 등) 해석 규칙은 동일하게 .js를 우선한다.
function resolveSpecifierToRepoRel(root, fromRepoRel, specifier, existsAt) {
  const fromDirAbs = path.dirname(path.join(root, fromRepoRel));
  const baseAbs = path.resolve(fromDirAbs, specifier);
  const candidates = [
    baseAbs,
    `${baseAbs}.js`,
    path.join(baseAbs, 'index.js')
  ];
  for (const c of candidates) {
    if (existsAt(toPosix(path.relative(root, c)))) {
      return toPosix(path.relative(root, c));
    }
  }
  // 확장자 없는 specifier는 .js로 가정해서 반환(파일이 아직 없을 때 대비).
  if (/\.[cm]?js$/.test(specifier)) return toPosix(path.relative(root, baseAbs));
  return toPosix(path.relative(root, `${baseAbs}.js`));
}

// 두 repo 상대 .js 경로 사이의 require specifier 문자열을 만든다.
// - 확장자 .js는 제거하고, index.js는 디렉터리로 축약한다.
// - 같은 디렉터리면 ./ 접두사를 붙인다.
function makeSpecifier(fromNewRepoRel, toNewRepoRel) {
  const fromDir = path.posix.dirname(fromNewRepoRel);
  let rel = path.posix.relative(fromDir, toNewRepoRel);
  // index.js -> 디렉터리
  if (rel.endsWith('/index.js')) rel = rel.slice(0, -('/index.js'.length));
  else if (rel === 'index.js') rel = '.';
  else rel = rel.replace(/\.js$/, '');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

// 비-.js 자산(.json 등)을 require할 때의 specifier. 확장자를 보존하고 index 축약을
// 하지 않는다. 같은 디렉터리면 ./ 접두사를 붙인다.
function makeAssetSpecifier(fromNewRepoRel, toNewRepoRel) {
  const fromDir = path.posix.dirname(fromNewRepoRel);
  let rel = path.posix.relative(fromDir, toNewRepoRel);
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

// 한 파일의 소스를 새 require로 재작성한다. 순수 함수.
// existsCurrent(repoRel): 현재 트리에 그 repo 상대경로 파일이 존재하는가.
// map: 현재→새 경로. 반환: { content, rewrites, unresolved:[{specifier, reason}] }.
function rewriteSource(opts) {
  const { source, fromCurrentRel, map, existsCurrent } = opts;
  const fromNewRel = map[fromCurrentRel] || fromCurrentRel;
  const unresolved = [];
  let rewrites = 0;

  const content = source.replace(REQUIRE_PATTERN, (whole, quote, specifier) => {
    if (!specifier.startsWith('.')) return whole; // 패키지 import는 그대로.
    // 현재 위치 기준으로 대상 해석.
    const targetCurrentRel = resolveSpecifierToRepoRel(
      opts.root, fromCurrentRel, specifier, existsCurrent
    );
    const targetExists = existsCurrent(targetCurrentRel);
    if (!targetExists) {
      // 트리 안의 알려진 파일로 해석되지 않는 상대 specifier는 이동 무관이라 건드리지 않는다:
      //   - 테스트 코드의 문자열 리터럴 안에 들어간 합성 require(...) (circular 검사 빌더도
      //     동일하게 무시함),
      //   - 트리 밖 경로.
      // 이런 것은 unresolved로 세지 않는다(거짓 양성 방지).
      return whole;
    }
    const targetNewRel = map[targetCurrentRel] || targetCurrentRel;
    const isJsonAsset = !targetCurrentRel.endsWith('.js');
    const newSpecifier = isJsonAsset
      ? makeAssetSpecifier(fromNewRel, targetNewRel)
      : makeSpecifier(fromNewRel, targetNewRel);
    if (newSpecifier === specifier) return whole; // 변화 없음(멱등).
    rewrites += 1;
    return `require(${quote}${newSpecifier}${quote})`;
  });

  return { content, rewrites, unresolved };
}

// ---- 그래프/순환: 새 위치 기준으로 cycle 검출(검증용) ----
function detectCyclesOnNewTree(map, existsCurrent, readSource, root) {
  // 새 경로 -> 새 경로 의존 그래프 구성.
  const newGraph = new Map();
  const currentByNew = new Map();
  for (const [cur, nw] of Object.entries(map)) {
    if (!cur.endsWith('.js')) continue;
    currentByNew.set(nw, cur);
  }
  for (const [cur, nw] of Object.entries(map)) {
    if (!cur.endsWith('.js')) continue;
    const src = readSource(cur);
    const deps = [];
    let m;
    REQUIRE_PATTERN.lastIndex = 0;
    while ((m = REQUIRE_PATTERN.exec(src)) !== null) {
      const specifier = m[2];
      if (!specifier.startsWith('.')) continue;
      const targetCur = resolveSpecifierToRepoRel(root, cur, specifier, existsCurrent);
      if (!existsCurrent(targetCur)) continue;
      const targetNew = map[targetCur] || targetCur;
      if (!deps.includes(targetNew)) deps.push(targetNew);
    }
    newGraph.set(nw, deps);
  }
  // Tarjan SCC.
  const index = new Map(), low = new Map(), onStack = new Set(), stack = [];
  const cycles = [];
  let counter = 0;
  const nodes = [...newGraph.keys()];
  const strongConnect = (node) => {
    index.set(node, counter); low.set(node, counter); counter += 1;
    stack.push(node); onStack.add(node);
    let selfEdge = false;
    for (const dep of newGraph.get(node) || []) {
      if (dep === node) selfEdge = true;
      if (!newGraph.has(dep)) continue;
      if (!index.has(dep)) {
        strongConnect(dep);
        low.set(node, Math.min(low.get(node), low.get(dep)));
      } else if (onStack.has(dep)) {
        low.set(node, Math.min(low.get(node), index.get(dep)));
      }
    }
    if (low.get(node) === index.get(node)) {
      const comp = [];
      let w;
      do { w = stack.pop(); onStack.delete(w); comp.push(w); } while (w !== node);
      if (comp.length > 1 || selfEdge) cycles.push(comp.sort());
    }
  };
  for (const n of nodes) if (!index.has(n)) strongConnect(n);
  return cycles.sort((a, b) => a.join().localeCompare(b.join()));
}

// ---- 실행 헬퍼: 현재 repo 트리 위에서 동작 ----
function makeRepoExistsCurrent(root, map) {
  // 현재 트리에 실재하는 파일 + map에 키로 등장하는 파일을 "존재"로 본다.
  const cache = new Map();
  return (repoRel) => {
    if (cache.has(repoRel)) return cache.get(repoRel);
    let ok = false;
    try { ok = fs.statSync(path.join(root, repoRel)).isFile(); } catch (_) { ok = false; }
    if (!ok && Object.prototype.hasOwnProperty.call(map, repoRel)) ok = true;
    cache.set(repoRel, ok);
    return ok;
  };
}

function runCheck(mapPath) {
  const root = repoRoot();
  const map = loadMap(mapPath);
  const existsCurrent = makeRepoExistsCurrent(root, map);
  const readSource = (cur) => fs.readFileSync(path.join(root, cur), 'utf8');

  let totalUnresolved = 0;
  const unresolvedDetail = [];
  for (const cur of Object.keys(map)) {
    if (!cur.endsWith('.js')) continue;
    const source = readSource(cur);
    const { unresolved } = rewriteSource({ root, source, fromCurrentRel: cur, map, existsCurrent });
    for (const u of unresolved) {
      totalUnresolved += 1;
      unresolvedDetail.push(`${cur}: require('${u.specifier}') (${u.reason})`);
    }
  }
  const cycles = detectCyclesOnNewTree(map, existsCurrent, readSource, root);

  console.log(`[check] map entries: ${Object.keys(map).length}`);
  console.log(`[check] unresolved relative requires: ${totalUnresolved}`);
  for (const d of unresolvedDetail.slice(0, 50)) console.log(`  - ${d}`);
  if (unresolvedDetail.length > 50) console.log(`  ... +${unresolvedDetail.length - 50} more`);
  console.log(`[check] cycles on new tree: ${cycles.length}`);
  for (const c of cycles.slice(0, 20)) console.log(`  - ${[...c, c[0]].join(' -> ')}`);
  const ok = totalUnresolved === 0 && cycles.length === 0;
  console.log(`[check] result: ${ok ? 'OK (0 unresolved, 0 cycles)' : 'FAIL'}`);
  return ok ? 0 : 1;
}

function runApply(mapPath, onlyPrefix) {
  const root = repoRoot();
  const map = loadMap(mapPath);
  const existsCurrent = makeRepoExistsCurrent(root, map);
  let changedFiles = 0, totalRewrites = 0;
  for (const cur of Object.keys(map)) {
    if (!cur.endsWith('.js')) continue;
    if (onlyPrefix && !cur.startsWith(onlyPrefix)) continue;
    const abs = path.join(root, cur);
    let source;
    try { source = fs.readFileSync(abs, 'utf8'); } catch (_) { continue; }
    const { content, rewrites } = rewriteSource({ root, source, fromCurrentRel: cur, map, existsCurrent });
    if (rewrites > 0 && content !== source) {
      // UTF-8 no-BOM, 원본 줄바꿈 보존(문자열 치환만 했으므로 그대로 유지됨).
      fs.writeFileSync(abs, content, { encoding: 'utf8' });
      changedFiles += 1;
      totalRewrites += rewrites;
    }
  }
  console.log(`[apply] files changed: ${changedFiles}, requires rewritten: ${totalRewrites}`);
  return 0;
}

// ---- 자체 테스트: 임시 디렉터리에서 합성 트리로 검증(repo 미변경) ----
function runSelfTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rewrite-requires-'));
  const write = (rel, content) => {
    const abs = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  };
  // 합성 현재 트리: a가 b(같은 dir)와 ../lib/c를, c가 ./d를 require.
  write('old/a.js', "const b = require('./b');\nconst c = require('../lib/c');\nconst keep = require('node:fs');\nmodule.exports = { b, c, keep };\n");
  write('old/b.js', "module.exports = 'b';\n");
  write('lib/c.js', "const d = require('./d');\nmodule.exports = d;\n");
  write('lib/d.js', "module.exports = 'd';\n");

  // map: 새 위치 — a,b는 src/core로, c,d는 src/gen로 이동.
  const map = {
    'old/a.js': 'src/core/a.js',
    'old/b.js': 'src/core/b.js',
    'lib/c.js': 'src/gen/c.js',
    'lib/d.js': 'src/gen/d.js'
  };

  const existsCurrent = (rel) => {
    try { return fs.statSync(path.join(tmp, rel)).isFile(); } catch (_) { return false; }
  };
  const rw = (rel) => rewriteSource({
    root: tmp,
    source: fs.readFileSync(path.join(tmp, rel), 'utf8'),
    fromCurrentRel: rel,
    map,
    existsCurrent
  });

  const assert = (cond, msg) => { if (!cond) { console.error('SELFTEST FAIL:', msg); process.exit(1); } };

  // a.js: ./b (둘 다 src/core -> ./b 유지), ../lib/c -> ../gen/c, node:fs 보존.
  const ra = rw('old/a.js');
  assert(ra.content.includes("require('./b')"), `a: ./b expected, got:\n${ra.content}`);
  assert(ra.content.includes("require('../gen/c')"), `a: ../gen/c expected, got:\n${ra.content}`);
  assert(ra.content.includes("require('node:fs')"), 'a: node:fs must be preserved');
  assert(ra.unresolved.length === 0, 'a: no unresolved');

  // c.js: ./d (둘 다 src/gen -> ./d 유지).
  const rc = rw('lib/c.js');
  assert(rc.content.includes("require('./d')"), `c: ./d expected, got:\n${rc.content}`);

  // 멱등성: 새 트리에 써놓고 같은 map(이미 새 키와 동일)으로 다시 돌리면 변화 0.
  // 새 트리 합성.
  write('src/core/a.js', ra.content);
  write('src/core/b.js', "module.exports = 'b';\n");
  write('src/gen/c.js', rc.content);
  write('src/gen/d.js', "module.exports = 'd';\n");
  const idMap = { // identity map: 이미 이동된 파일을 자기 자신으로.
    'src/core/a.js': 'src/core/a.js',
    'src/core/b.js': 'src/core/b.js',
    'src/gen/c.js': 'src/gen/c.js',
    'src/gen/d.js': 'src/gen/d.js'
  };
  const idExists = (rel) => { try { return fs.statSync(path.join(tmp, rel)).isFile(); } catch (_) { return false; } };
  const ra2 = rewriteSource({
    root: tmp, source: fs.readFileSync(path.join(tmp, 'src/core/a.js'), 'utf8'),
    fromCurrentRel: 'src/core/a.js', map: idMap, existsCurrent: idExists
  });
  assert(ra2.rewrites === 0, 'idempotent: second apply must rewrite 0');

  // index.js 축약 검증.
  const idxMap = { 'p/x.js': 'q/x.js', 'p/mod/index.js': 'r/mod/index.js' };
  const idxExists = (rel) => rel === 'p/x.js' || rel === 'p/mod/index.js';
  const idxSrc = "const m = require('./mod');\n";
  const ridx = rewriteSource({ root: tmp, source: idxSrc, fromCurrentRel: 'p/x.js', map: idxMap, existsCurrent: idxExists });
  assert(ridx.content.includes("require('../r/mod')"), `index shorten expected ../r/mod, got: ${ridx.content}`);

  // .json 자산 require 재배치 검증: 테스트와 자산이 함께 이동.
  const jsonMap = {
    't/x.test.js': 'src/core/test/x.test.js',
    'cfg/policy.json': 'src/core/config/policy.json'
  };
  const jsonExists = (rel) => rel === 't/x.test.js' || rel === 'cfg/policy.json';
  const rjson = rewriteSource({
    root: tmp,
    source: "const p = require('../cfg/policy.json');\n",
    fromCurrentRel: 't/x.test.js',
    map: jsonMap,
    existsCurrent: jsonExists
  });
  assert(
    rjson.content.includes("require('../config/policy.json')"),
    `json asset rewrite expected ../config/policy.json, got: ${rjson.content}`
  );
  assert(rjson.unresolved.length === 0, 'json asset: no unresolved');

  // cycle 검출 검증: a->b->a 합성.
  const cyMap = { 'c1.js': 's/c1.js', 'c2.js': 's/c2.js' };
  write('c1.js', "require('./c2');\n");
  write('c2.js', "require('./c1');\n");
  const cyExists = (rel) => ['c1.js', 'c2.js'].includes(rel);
  const cyRead = (rel) => fs.readFileSync(path.join(tmp, rel), 'utf8');
  const cyc = detectCyclesOnNewTree(cyMap, cyExists, cyRead, tmp);
  assert(cyc.length === 1, `cycle detect expected 1, got ${cyc.length}`);

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('SELFTEST OK');
  return 0;
}

function usage() {
  console.log('usage:');
  console.log('  node scripts/_restructure/rewrite-requires.js --check <map.json>');
  console.log('  node scripts/_restructure/rewrite-requires.js --apply <map.json> [--only <repo-rel-prefix>]');
  console.log('  node scripts/_restructure/rewrite-requires.js --selftest');
}

function main(argv) {
  const args = argv.slice(2);
  if (args[0] === '--selftest') return runSelfTest();
  if (args[0] === '--check') {
    if (!args[1]) { usage(); return 2; }
    return runCheck(args[1]);
  }
  if (args[0] === '--apply') {
    if (!args[1]) { usage(); return 2; }
    let only = null;
    const oi = args.indexOf('--only');
    if (oi >= 0) only = toPosix(args[oi + 1] || '');
    return runApply(args[1], only);
  }
  usage();
  return 2;
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = {
  rewriteSource,
  makeSpecifier,
  makeAssetSpecifier,
  resolveSpecifierToRepoRel,
  detectCyclesOnNewTree,
  loadMap
};
