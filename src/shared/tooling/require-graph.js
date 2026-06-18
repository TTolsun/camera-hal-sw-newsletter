// require 그래프 구조 검사들(check-circular-dependencies, check-layer-direction)이
// 공유하는 파일 탐색/require 해석 헬퍼입니다. 두 검사 모두 src/** 트리를 걸어
// .js 파일을 모으고 상대경로 require 지정자를 실제 파일로 해석합니다.
//
// 상대경로 require 지정자 추출(parseRelativeRequires)은 검사마다 다릅니다
// (layer-direction은 require.resolve(...)도 추적하고 circular은 require(...)만 봅니다).
// 그래서 그 부분은 각 검사에 남기고, 동일한 파일-수집/해석만 여기로 모읍니다.

const fs = require('node:fs');
const path = require('node:path');

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

// 상대경로 require 지정자를 실제 파일 절대경로로 해석합니다(.js / index.js). 없으면 null.
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

module.exports = {
  collectJavascriptFiles,
  resolveRelativeRequire
};
