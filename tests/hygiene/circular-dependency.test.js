const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  parseRelativeRequires,
  findCircularDependencies,
  buildRequireGraph,
  formatCircularDependency
} = require('../../scripts/check-circular-dependencies');

// 임시 프로젝트 디렉터리를 만들고 테스트 종료 시 항상 정리합니다.
function makeTempProject(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'circular-dep-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, contents, 'utf8');
  }
  return root;
}

test('parseRelativeRequires extracts only relative require specifiers', () => {
  const source = [
    "const fs = require('node:fs');",
    "const pkg = require('@google/genai');",
    "const local = require('./local-helper');",
    'const parent = require("../common/paths");'
  ].join('\n');

  assert.deepEqual(parseRelativeRequires(source), ['./local-helper', '../common/paths']);
});

test('parseRelativeRequires ignores bare and scoped package specifiers', () => {
  const source = "require('fs');\nrequire('path');\nrequire('@scope/name');";

  assert.deepEqual(parseRelativeRequires(source), []);
});

test('parseRelativeRequires ignores method calls that merely end in require', () => {
  const source = "foo.require('./z');\nbarrequire('./y');";

  assert.deepEqual(parseRelativeRequires(source), []);
});

test('findCircularDependencies returns empty for an acyclic graph', () => {
  const graph = { a: ['b', 'c'], b: ['c'], c: [] };

  assert.deepEqual(findCircularDependencies(graph), []);
});

test('findCircularDependencies detects a two-node cycle', () => {
  const graph = { a: ['b'], b: ['a'] };

  assert.deepEqual(findCircularDependencies(graph), [['a', 'b']]);
});

test('findCircularDependencies detects a three-node cycle', () => {
  const graph = { a: ['b'], b: ['c'], c: ['a'] };

  assert.deepEqual(findCircularDependencies(graph), [['a', 'b', 'c']]);
});

test('findCircularDependencies reports two independent cycles in deterministic order', () => {
  const graph = { c: ['d'], d: ['c'], a: ['b'], b: ['a'] };

  assert.deepEqual(findCircularDependencies(graph), [['a', 'b'], ['c', 'd']]);
});

test('findCircularDependencies detects a self dependency', () => {
  const graph = { a: ['a'] };

  assert.deepEqual(findCircularDependencies(graph), [['a']]);
});

test('findCircularDependencies reports a self edge inside a larger cycle only once', () => {
  const graph = { a: ['b', 'a'], b: ['a'] };

  assert.deepEqual(findCircularDependencies(graph), [['a', 'b']]);
});

test('findCircularDependencies reports only the cyclic nodes when acyclic nodes exist', () => {
  const graph = { a: ['b'], b: ['a'], standalone: ['a'] };

  assert.deepEqual(findCircularDependencies(graph), [['a', 'b']]);
});

test('formatCircularDependency renders members joined by a directed arrow back to the start', () => {
  assert.equal(formatCircularDependency(['a', 'b']), 'a -> b -> a');
  assert.equal(formatCircularDependency(['a']), 'a -> a');
});

test('buildRequireGraph maps relative requires to resolved files under a root', (t) => {
  const root = makeTempProject(t, {
    'a.js': "require('./b');\n",
    'b.js': "require('./a');\nrequire('node:fs');\n"
  });

  const graph = buildRequireGraph(root);
  const cycles = findCircularDependencies(graph);

  assert.deepEqual(graph['a.js'], ['b.js']);
  assert.deepEqual(graph['b.js'], ['a.js']);
  assert.deepEqual(cycles, [['a.js', 'b.js']]);
});

test('buildRequireGraph resolves a directory require to its index.js', (t) => {
  const root = makeTempProject(t, {
    'a.js': "require('./mod');\n",
    'mod/index.js': "module.exports = {};\n"
  });

  const graph = buildRequireGraph(root);

  assert.deepEqual(graph['a.js'], ['mod/index.js']);
});

test('buildRequireGraph excludes non-javascript dependencies from the graph', (t) => {
  const root = makeTempProject(t, {
    'a.js': "require('./data.json');\n",
    'data.json': '{}\n'
  });

  const graph = buildRequireGraph(root);

  assert.deepEqual(Object.keys(graph), ['a.js']);
  assert.deepEqual(graph['a.js'], []);
});

test('the newsroom implementation has no circular dependencies', () => {
  const newsroomRoot = path.join(__dirname, '..', '..', 'scripts', 'newsroom');
  const graph = buildRequireGraph(newsroomRoot);
  const cycles = findCircularDependencies(graph);

  assert.deepEqual(
    cycles,
    [],
    `expected no circular dependencies, found:\n${cycles.map(formatCircularDependency).join('\n')}`
  );
});
