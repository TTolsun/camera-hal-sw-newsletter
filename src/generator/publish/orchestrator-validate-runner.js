// 발행 orchestrator의 process/runtime IO 헬퍼 모음(#655).
// npm script 실행(runNpmScript)·공개 validate 실행(runValidate)·TODO 마커 스캔(containsTodo)·
// seed evidence pack 읽기(readSeedEvidencePackForDate)는 모두 process(execFileSync)나 파일시스템을
// 직접 건드리는 런타임 헬퍼라는 점에서 한 역할로 묶인다. 의존성은 module-level import(execFileSync,
// fs, readJson, seedEvidencePackPath)뿐이고 god-file-local 함수 주입이 없어 god-file을 import하지
// 않는다(순환 없음). god-file과 동일하게 root도 load 시점에 process.cwd()로 한 번 파생한다.
const fs = require('fs');
const { execFileSync } = require('child_process');
const { readJson } = require('../../shared/common/common');
const { seedEvidencePackPath } = require('../../shared/common/artifact-paths');

const root = process.cwd();

function readSeedEvidencePackForDate(date, rootDir = root) {
  const filePath = seedEvidencePackPath(rootDir, date);
  return fs.existsSync(filePath) ? readJson(filePath) : null;
}

function containsTodo(files) {
  return files.some(file => fs.existsSync(file) && /\bTODO\b/.test(fs.readFileSync(file, 'utf8')));
}

function runNpmScript(scriptName) {
  const options = {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  };
  if (process.platform === 'win32') {
    return execFileSync('cmd.exe', ['/d', '/s', '/c', `npm.cmd run ${scriptName}`], options);
  }
  return execFileSync('npm', ['run', scriptName], options);
}

function runValidate() {
  try {
    const siteOutput = runNpmScript('validate:site');
    const imageOutput = runNpmScript('validate:images');
    const output = [siteOutput, imageOutput].join('\n').trim();
    return { ok: true, text: output || 'npm run validate:site and validate:images passed.' };
  } catch (error) {
    return {
      ok: false,
      text: [error.stdout, error.stderr].filter(Boolean).join('\n').trim() || error.message
    };
  }
}

module.exports = {
  readSeedEvidencePackForDate,
  containsTodo,
  runNpmScript,
  runValidate
};
