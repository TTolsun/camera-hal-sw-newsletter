#!/usr/bin/env node

// 모듈 간 순환 의존성(circular dependency)을 검출하는 구조 검사입니다.
// src/** 의 상대경로 require 그래프를 만들고, 순환이 있으면 실패합니다.
// 외부 패키지에 의존하지 않도록 require 파싱과 그래프 분석을 직접 수행합니다.
//
// 한계(정적 정규식 기반): 동적 require(`require(변수)`, `require.resolve(...)`)와
// 주석/문자열 리터럴 안의 require 표기는 추적하지 않습니다. 이 검사는 src 트리에
// 순환을 추가로 만들지 않도록 막는 가드가 목적입니다.

const fs = require('node:fs');
const path = require('node:path');
const { collectJavascriptFiles, resolveRelativeRequire } = require('./require-graph');

// 이 파일은 <repo>/src/shared/tooling/check-circular-dependencies.js 입니다.
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
// 구현 코드는 #262 src 재구성 완료 후 모두 src/ 아래에 있습니다.
// src 트리만 스캔합니다. 존재하는 루트만 사용합니다.
const IMPLEMENTATION_ROOTS = [
  path.join(REPO_ROOT, 'src')
].filter((dir) => {
  try { return fs.statSync(dir).isDirectory(); } catch (error) { return false; }
});
// 앞에 식별자 문자나 `.`이 오면 `foo.require(...)` 같은 메서드 호출이므로 제외합니다.
const RELATIVE_REQUIRE_PATTERN = /(?<![A-Za-z0-9_.$])require\(\s*['"]([^'"]+)['"]\s*\)/g;

// 소스 텍스트에서 상대경로(`./`, `../`) require 지정자만 추출합니다.
function parseRelativeRequires(source) {
  const specifiers = [];
  let match;
  while ((match = RELATIVE_REQUIRE_PATTERN.exec(source)) !== null) {
    const specifier = match[1];
    if (specifier.startsWith('.')) {
      specifiers.push(specifier);
    }
  }
  return specifiers;
}

// 루트 아래 파일들의 require 그래프를 만듭니다.
// 키와 값은 모두 루트 기준 상대경로(forward slash)이며, 루트 밖 의존성은 제외합니다.
function buildRequireGraph(rootDirectory) {
  const files = collectJavascriptFiles(rootDirectory);
  const fileSet = new Set(files);
  const toKey = (absolutePath) => path.relative(rootDirectory, absolutePath).split(path.sep).join('/');

  const graph = {};
  for (const file of files) {
    graph[toKey(file)] = [];
  }

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const dependencies = [];
    for (const specifier of parseRelativeRequires(source)) {
      const resolved = resolveRelativeRequire(file, specifier);
      if (resolved && fileSet.has(resolved)) {
        const dependencyKey = toKey(resolved);
        if (!dependencies.includes(dependencyKey)) {
          dependencies.push(dependencyKey);
        }
      }
    }
    graph[toKey(file)] = dependencies;
  }

  return graph;
}

// 여러 루트 디렉터리의 파일을 하나의 require 그래프로 묶습니다.
// 키는 baseDirectory(보통 repo 루트) 기준 상대경로라서 src 하위 디렉터리 간
// 의존성도 같은 키 공간에서 해석됩니다.
function buildRequireGraphForRoots(rootDirectories, baseDirectory) {
  const files = [];
  for (const rootDirectory of rootDirectories) {
    files.push(...collectJavascriptFiles(rootDirectory));
  }
  const fileSet = new Set(files);
  const toKey = (absolutePath) => path.relative(baseDirectory, absolutePath).split(path.sep).join('/');

  const graph = {};
  for (const file of files) {
    graph[toKey(file)] = [];
  }
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const dependencies = [];
    for (const specifier of parseRelativeRequires(source)) {
      const resolved = resolveRelativeRequire(file, specifier);
      if (resolved && fileSet.has(resolved)) {
        const dependencyKey = toKey(resolved);
        if (!dependencies.includes(dependencyKey)) {
          dependencies.push(dependencyKey);
        }
      }
    }
    graph[toKey(file)] = dependencies;
  }
  return graph;
}

// Tarjan SCC로 순환을 찾습니다. 결과는 결정론을 위해 멤버와 그룹 모두 정렬합니다.
function findCircularDependencies(graph) {
  const nodes = Object.keys(graph);
  const indexByNode = new Map();
  const lowLinkByNode = new Map();
  const onStack = new Set();
  const stack = [];
  const cycles = [];
  let nextIndex = 0;

  const strongConnect = (node) => {
    indexByNode.set(node, nextIndex);
    lowLinkByNode.set(node, nextIndex);
    nextIndex += 1;
    stack.push(node);
    onStack.add(node);

    let hasSelfEdge = false;
    for (const dependency of graph[node] || []) {
      if (dependency === node) {
        hasSelfEdge = true;
      }
      if (!Object.prototype.hasOwnProperty.call(graph, dependency)) {
        continue;
      }
      if (!indexByNode.has(dependency)) {
        strongConnect(dependency);
        lowLinkByNode.set(node, Math.min(lowLinkByNode.get(node), lowLinkByNode.get(dependency)));
      } else if (onStack.has(dependency)) {
        lowLinkByNode.set(node, Math.min(lowLinkByNode.get(node), indexByNode.get(dependency)));
      }
    }

    if (lowLinkByNode.get(node) === indexByNode.get(node)) {
      const component = [];
      let member;
      do {
        member = stack.pop();
        onStack.delete(member);
        component.push(member);
      } while (member !== node);

      if (component.length > 1 || hasSelfEdge) {
        cycles.push(component.sort());
      }
    }
  };

  for (const node of nodes) {
    if (!indexByNode.has(node)) {
      strongConnect(node);
    }
  }

  return cycles.sort((a, b) => a.join().localeCompare(b.join()));
}

// 순환 그룹을 사람이 읽을 수 있는 한 줄로 표현합니다. 예: "a -> b -> a"
function formatCircularDependency(cycle) {
  return [...cycle, cycle[0]].join(' -> ');
}

function main() {
  const graph = buildRequireGraphForRoots(IMPLEMENTATION_ROOTS, REPO_ROOT);
  const cycles = findCircularDependencies(graph);

  if (cycles.length > 0) {
    console.error(`Circular dependency check found ${cycles.length} cycle(s) in src:`);
    for (const cycle of cycles) {
      console.error(`  ${formatCircularDependency(cycle)}`);
    }
    process.exit(1);
  }

  console.log(`Circular dependency check passed. ${Object.keys(graph).length} files, 0 cycles.`);
}

if (require.main === module) {
  main();
}

module.exports = {
  parseRelativeRequires,
  collectJavascriptFiles,
  resolveRelativeRequire,
  buildRequireGraph,
  buildRequireGraphForRoots,
  findCircularDependencies,
  formatCircularDependency
};
