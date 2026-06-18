// git이 추적 중인 파일 목록을 가져오는 공유 헬퍼입니다.
// 구조 검사(check-repo-hygiene, check-text-encoding)가 동일하게 사용합니다.
// 삭제 예정이지만 아직 인덱스에 남은 파일을 거르기 위해, 실제 존재하는 경로만 반환합니다.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function trackedFiles(root = process.cwd()) {
  const output = execFileSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'buffer'
  });
  return output.toString('utf8')
    .split('\0')
    .filter(Boolean)
    .filter(filePath => fs.existsSync(path.join(root, filePath)));
}

module.exports = {
  trackedFiles
};
