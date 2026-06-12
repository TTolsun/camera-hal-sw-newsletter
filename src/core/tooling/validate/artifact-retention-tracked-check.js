const { execFileSync } = require('child_process');
const {
  DEBUG_HEAVY,
  TRANSIENT_ATTEMPT,
  classifyArtifactPath
} = require('../../../generator/reporter/review-artifact-inventory');

const UNKNOWN_GROUP = 'unknown_artifacts';

// content/newsroom 및 content/collected-news 아래 Git 추적 경로 목록을 반환한다.
function getTrackedContentPaths(root) {
  const output = execFileSync(
    'git',
    ['-C', root, 'ls-files', 'content/newsroom', 'content/collected-news'],
    { encoding: 'utf8' }
  );
  return output.split('\n').map(line => line.trim()).filter(Boolean);
}

// DEBUG_HEAVY 또는 TRANSIENT_ATTEMPT 등급이고 unknown_artifacts 그룹이 아닌 경로는 Git 추적 불가.
function mustNotBeTracked(classification) {
  if (!classification) return false;
  const { retention_grade, group } = classification;
  return (retention_grade === DEBUG_HEAVY || retention_grade === TRANSIENT_ATTEMPT) && group !== UNKNOWN_GROUP;
}

function checkArtifactRetentionTracked({ root = process.cwd(), _trackedPaths } = {}) {
  const trackedPaths = _trackedPaths !== undefined ? _trackedPaths : getTrackedContentPaths(root);
  const violations = [];
  const warnings = [];

  for (const relPath of trackedPaths) {
    const classification = classifyArtifactPath(relPath);
    if (!classification) {
      warnings.push({ path: relPath, reason: '날짜 세그먼트 없음; 분류 건너뜀' });
      continue;
    }
    if (classification.group === UNKNOWN_GROUP) {
      warnings.push({ path: relPath, grade: classification.retention_grade, reason: '미인식 파일명; 자동 실패 처리 안 함' });
      continue;
    }
    if (mustNotBeTracked(classification)) {
      violations.push({ path: relPath, grade: classification.retention_grade, group: classification.group });
    }
  }

  return { violations, warnings, ok: violations.length === 0 };
}

module.exports = { checkArtifactRetentionTracked, mustNotBeTracked, getTrackedContentPaths };
