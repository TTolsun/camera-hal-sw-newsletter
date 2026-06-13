const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  LAYER_RANK,
  parseRelativeRequires,
  layerOf,
  isProductionLayerFile,
  evaluate
} = require('../../tooling/check-layer-direction');

// 임시 프로젝트 디렉터리를 만들고 테스트 종료 시 항상 정리합니다.
function makeTempProject(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'layer-dir-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, contents, 'utf8');
  }
  return root;
}

// check-layer-direction 의 위반 판정 로직(레이어 순위 비교)을 임시 트리에서 재현합니다.
// 실제 모듈은 repo 루트에 고정되어 있어, 순수 규칙만 테스트하기 위한 작은 미러입니다.
function violationsFor(repoRelativePath, specifierLayer) {
  const fromLayer = layerOf(repoRelativePath);
  const fromRank = LAYER_RANK[fromLayer];
  const toRank = LAYER_RANK[specifierLayer];
  return toRank > fromRank;
}

test('LAYER_RANK encodes one-way direction shared<collector<discovery<generator', () => {
  assert.equal(LAYER_RANK.shared, 0);
  assert.equal(LAYER_RANK.collector, 1);
  assert.equal(LAYER_RANK.discovery, 2);
  assert.equal(LAYER_RANK.generator, 3);
});

test('layerOf maps src/<layer>/... paths and ignores non-layer paths', () => {
  assert.equal(layerOf('src/shared/domain/x.js'), 'shared');
  assert.equal(layerOf('src/generator/reporter/y.js'), 'generator');
  assert.equal(layerOf('src/unknown/z.js'), null);
  assert.equal(layerOf('docs/a.js'), null);
});

test('a generator -> shared import passes (downstream depending on upstream)', () => {
  assert.equal(violationsFor('src/generator/reporter/x.js', 'shared'), false);
});

test('a generator -> discovery import passes (M <= L)', () => {
  assert.equal(violationsFor('src/generator/reporter/x.js', 'discovery'), false);
});

test('a same-layer import passes', () => {
  assert.equal(violationsFor('src/shared/domain/a.js', 'shared'), false);
});

test('a shared -> generator import is a violation (upstream depending on downstream)', () => {
  assert.equal(violationsFor('src/shared/domain/a.js', 'generator'), true);
});

test('a discovery -> generator import is a violation', () => {
  assert.equal(violationsFor('src/discovery/gemini-client.js', 'generator'), true);
});

test('isProductionLayerFile excludes test and tooling code', () => {
  assert.equal(isProductionLayerFile('src/shared/domain/a.js'), true);
  assert.equal(isProductionLayerFile('src/generator/reporter/b.js'), true);
  assert.equal(isProductionLayerFile('src/shared/test/hygiene/c.test.js'), false);
  assert.equal(isProductionLayerFile('src/generator/test/contract/d.test.js'), false);
  assert.equal(isProductionLayerFile('src/shared/tooling/check-layer-direction.js'), false);
  assert.equal(isProductionLayerFile('src/unknown/e.js'), false);
});

test('parseRelativeRequires parses both require() and require.resolve()', () => {
  const source = [
    "const a = require('./local');",
    "const b = require.resolve('../generator/reporter/llm-client');",
    "const c = require( '../sibling' );",
    "const pkg = require('@google/genai');",
    "const node = require('node:fs');"
  ].join('\n');

  assert.deepEqual(
    parseRelativeRequires(source),
    ['./local', '../generator/reporter/llm-client', '../sibling']
  );
});

test('parseRelativeRequires ignores method calls ending in require', () => {
  const source = "foo.require('./z');\nbarrequire('./y');";
  assert.deepEqual(parseRelativeRequires(source), []);
});

test('evaluate: a baselined violation passes (no new edge)', () => {
  const current = ['src/shared/a.js -> src/generator/b.js'];
  const baseline = ['src/shared/a.js -> src/generator/b.js'];
  const { added, stale } = evaluate(current, baseline);
  assert.deepEqual(added, []);
  assert.deepEqual(stale, []);
});

test('evaluate: a NEW violation not in baseline fails (added is non-empty)', () => {
  const current = [
    'src/shared/a.js -> src/generator/b.js',
    'src/shared/new.js -> src/generator/c.js'
  ];
  const baseline = ['src/shared/a.js -> src/generator/b.js'];
  const { added } = evaluate(current, baseline);
  assert.deepEqual(added, ['src/shared/new.js -> src/generator/c.js']);
});

test('evaluate: a baseline entry no longer present is reported as stale, not failed', () => {
  const current = [];
  const baseline = ['src/shared/resolved.js -> src/generator/x.js'];
  const { added, stale } = evaluate(current, baseline);
  assert.deepEqual(added, []);
  assert.deepEqual(stale, ['src/shared/resolved.js -> src/generator/x.js']);
});

test('the production layer baseline file is in sync (current is a subset of baseline)', () => {
  // 실제 checker 모듈로 현재 위반을 계산하고, 베이스라인을 읽어 새 위반이 없는지 확인합니다.
  const checker = require('../../tooling/check-layer-direction');
  const current = checker.collectViolations();
  const baseline = checker.readBaseline();
  const { added } = checker.evaluate(current, baseline);
  assert.deepEqual(
    added,
    [],
    `unexpected NEW reverse edges not in baseline:\n${added.join('\n')}`
  );
});
