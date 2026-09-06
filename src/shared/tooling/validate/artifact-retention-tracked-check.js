const { execFileSync } = require('child_process');
const {
  DEBUG_HEAVY,
  TRANSIENT_ATTEMPT,
  classifyArtifactPath
} = require('../../../generator/publish/review-artifact-inventory');

const UNKNOWN_GROUP = 'unknown_artifacts';

// 데일리 발행 시절에 커밋된 news-candidates.md 18건은 생성 산출물 보존 규칙에 따라 Git에 남긴다.
// 지금은 워크플로 01이 이 파일을 커밋하지 않으므로 등급은 debug_heavy이고, 아래 날짜보다 뒤의
// news-candidates.md가 새로 추적되면 등급과 실제 커밋 동작이 다시 어긋난 것이므로 위반으로 잡는다(#1062).
// 애초에 새로 추적되지 않도록 .gitignore가 이 경로를 막는다. 이 검사는 그 뒤를 받치는 사후 그물이다.
const LEGACY_NEWS_CANDIDATES_LAST_COMMITTED_DATE = '2026-06-02';

function isPreservedLegacyArtifact(relPath) {
  const match = String(relPath).match(/\/(\d{4}-\d{2}-\d{2})\/news-candidates\.md$/);
  return Boolean(match) && match[1] <= LEGACY_NEWS_CANDIDATES_LAST_COMMITTED_DATE;
}

// articles/content/newsroom 및 articles/content/collected-news 아래 Git 추적 경로 목록을 반환한다.
function getTrackedContentPaths(root) {
  const output = execFileSync(
    'git',
    ['-C', root, 'ls-files', 'articles/content/newsroom', 'articles/content/collected-news'],
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
    if (isPreservedLegacyArtifact(relPath)) continue;
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

module.exports = {
  checkArtifactRetentionTracked,
  mustNotBeTracked,
  getTrackedContentPaths
};
