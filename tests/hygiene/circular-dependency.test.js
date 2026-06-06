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

test('findCircularDependencies returns empty for an acyclic graph', () => {
  const graph = { a: ['b', 'c'], b: ['c'], c: [] };

  assert.deepEqual(findCircularDependencies(graph), []);
});

test('findCircularDependencies detects a two-node cycle', () => {
  const graph = { a: ['b'], b: ['a'] };

  assert.deepEqual(findCircularDependencies(graph), [['a', 'b']]);
});

test('findCircularDependencies detects a self dependency', () => {
  const graph = { a: ['a'] };

  assert.deepEqual(findCircularDependencies(graph), [['a']]);
});

test('findCircularDependencies reports only the cyclic nodes when acyclic nodes exist', () => {
  const graph = { a: ['b'], b: ['a'], standalone: ['a'] };

  assert.deepEqual(findCircularDependencies(graph), [['a', 'b']]);
});

test('formatCircularDependency renders members joined by a directed arrow back to the start', () => {
  assert.equal(formatCircularDependency(['a', 'b']), 'a -> b -> a');
  assert.equal(formatCircularDependency(['a']), 'a -> a');
});

test('buildRequireGraph maps relative requires to resolved files under a root', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'circular-dep-'));
  fs.writeFileSync(path.join(root, 'a.js'), "require('./b');\n", 'utf8');
  fs.writeFileSync(path.join(root, 'b.js'), "require('./a');\nrequire('node:fs');\n", 'utf8');

  const graph = buildRequireGraph(root);
  const cycles = findCircularDependencies(graph);

  assert.deepEqual(graph['a.js'], ['b.js']);
  assert.deepEqual(graph['b.js'], ['a.js']);
  assert.deepEqual(cycles, [['a.js', 'b.js']]);

  fs.rmSync(root, { recursive: true, force: true });
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
