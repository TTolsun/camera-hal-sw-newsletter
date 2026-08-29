const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// #262 phase 6(2026-06-13 머지)이 공개 출력물을 articles/ 아래로 옮겼다. 그 전에 쓰인 매니페스트는
// articles/ 기준 상대경로(content/·data/·newsletters/·sitemap.xml)를, 그 뒤에 쓰인 매니페스트는
// 저장소 루트 기준 경로(articles/…)를 기록한다. 커밋된 매니페스트는 감사 기록이라 사후에 고쳐 쓰지
// 않으므로, 각 매니페스트가 자기 날짜의 규약을 지키는지만 확인한다.
//
// schema_version은 이 차이를 표시하지 않는다(4가 두 규약에 모두 걸쳐 있다). 그래서 규약을 산문 대신
// 이 검사로 잠근다 — 새로 쓰이는 매니페스트는 반드시 저장소 루트 기준이어야 하고, 이미 커밋된 과거
// 매니페스트는 쓰이던 시점의 규약을 그대로 지켜야 한다(사후 정규화 금지).
//
// 경계 날짜는 첫 관측이 아니라 원인에 맞춘다. #262 phase 6 머지가 42fd4ba1 = 2026-06-13 12:29 KST다.
// 06-13 당일 run은 세 번 돌았는데(11:14 / 13:21 / 15:32), 머지 뒤의 두 번이 이미 루트 기준으로
// 기록했고 머지 전 옛 규약 사본은 같은 날 188c10fa가 orphan으로 지웠다. 그래서 트리에 남은 06-13
// artifact는 전부 루트 기준이고, 06-13을 옛 규약 쪽에 두면 그 날짜를 replay할 때 생산자는 루트
// 기준으로 쓰는데 검사만 옛 규약을 요구해 거짓 실패한다. 커밋된 매니페스트는 06-11(옛 규약)에서
// 06-16(루트 기준)으로 건너뛰므로 이 경계로 바뀌는 현재 판정은 없다.
const REPOSITORY_ROOT_PATH_CONVENTION_START_DATE = '2026-06-13';
const MANIFEST_PATH_ARRAYS = ['files', 'review_artifacts', 'retained_heavy_artifacts', 'committed_artifacts'];
// assets/·css/가 빠져 있는 것은 알려진 구멍이며 #958이 따로 다룬다. 여기서는 자리만 옮기고
// 판정 범위는 그대로 둔다(이 변경으로 판정이 달라지면 안 된다).
const PUBLIC_OUTPUT_ROOT_PREFIXES = ['content/', 'data/', 'newsletters/'];
const NEWSROOM_ROOT = 'articles/content/newsroom';
const DATE_DIRECTORY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// 규약 판별 대상은 #262에서 articles/ 아래로 옮겨진 공개 출력물 경로뿐이다. .tmp/·cache/·state/는
// 공개 출력물이 아니라 이동 대상이 아니었으므로 판별에 쓸 수 없다. 특히 state/는 루트 기준
// 매니페스트에만 나와 비교할 옛 형태가 아예 없다(옛 규약 시절 같은 파일은
// data/article-exposure-history.json이었다).
function isPublicOutputManifestPath(relPath) {
  const withoutArticlesPrefix = relPath.startsWith('articles/')
    ? relPath.slice('articles/'.length)
    : relPath;
  return withoutArticlesPrefix === 'sitemap.xml' ||
    PUBLIC_OUTPUT_ROOT_PREFIXES.some(prefix => withoutArticlesPrefix.startsWith(prefix));
}

function manifestPathEntries(manifest) {
  const entries = [];
  for (const key of MANIFEST_PATH_ARRAYS) {
    for (const entry of manifest[key] || []) {
      if (entry && typeof entry.path === 'string') entries.push({ key, path: entry.path });
    }
  }
  return entries;
}

/**
 * 매니페스트 하나의 경로 규약 위반 목록을 반환한다(던지지 않는다).
 * expectArticlesPrefix가 true면 공개 출력물 경로는 articles/로 시작해야 하고, false면 시작하면 안 된다.
 */
function findManifestPathConventionViolations(manifest, { label, expectArticlesPrefix }) {
  const violations = [];
  let publicOutputPathCount = 0;

  for (const entry of manifestPathEntries(manifest)) {
    if (!isPublicOutputManifestPath(entry.path)) continue;
    publicOutputPathCount += 1;
    if (entry.path.startsWith('articles/') === expectArticlesPrefix) continue;
    violations.push({
      label,
      key: entry.key,
      path: entry.path,
      reason: expectArticlesPrefix
        ? '저장소 루트 기준이 아니다. #262 이후 공개 출력물 경로는 articles/로 시작해야 한다.'
        : 'articles/ 접두가 붙었다. #262 이전 매니페스트는 기록된 규약 그대로 두어야 한다(#952).'
    });
  }

  if (publicOutputPathCount === 0) {
    violations.push({
      label,
      key: '(none)',
      path: '(none)',
      reason: '공개 출력물 경로가 하나도 없어 경로 규약을 검사하지 못했다'
    });
  }

  return violations;
}

// 커밋된 매니페스트만 검사 대상이다. 파일 시스템을 훑지 않고 Git 추적 목록을 묻는 이유는 두 가지다.
// (1) sparse checkout·partial clone처럼 디렉터리가 없는 체크아웃에서 스캔이 죽지 않는다.
// (2) "검사 대상이 0건"이 그때야 진짜 이상 신호가 된다.
function getTrackedManifestPaths(root) {
  const output = execFileSync(
    'git',
    ['-C', root, 'ls-files', `${NEWSROOM_ROOT}/*/artifact-manifest.json`],
    { encoding: 'utf8' }
  );
  return output.split('\n').map(line => line.trim()).filter(Boolean);
}

function dateDirectoryOf(relPath) {
  const segments = relPath.split('/');
  const dateDirectory = segments[segments.length - 2] || '';
  return DATE_DIRECTORY_PATTERN.test(dateDirectory) ? dateDirectory : '';
}

function checkArtifactPathConvention({ root = process.cwd(), _trackedPaths } = {}) {
  const trackedPaths = _trackedPaths !== undefined ? _trackedPaths : getTrackedManifestPaths(root);
  const violations = [];
  const warnings = [];
  let checkedManifestCount = 0;

  for (const relPath of trackedPaths) {
    const dateDirectory = dateDirectoryOf(relPath);
    if (!dateDirectory) {
      warnings.push({ path: relPath, reason: '날짜 디렉터리가 아님; 검사 건너뜀' });
      continue;
    }

    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(path.join(root, relPath), 'utf8'));
    } catch (error) {
      violations.push({ label: relPath, key: '(parse)', path: relPath, reason: `읽거나 파싱하지 못했다: ${error.message}` });
      continue;
    }

    violations.push(...findManifestPathConventionViolations(manifest, {
      label: relPath,
      expectArticlesPrefix: dateDirectory >= REPOSITORY_ROOT_PATH_CONVENTION_START_DATE
    }));
    checkedManifestCount += 1;
  }

  if (checkedManifestCount === 0) {
    violations.push({
      label: '(corpus)',
      key: '(none)',
      path: NEWSROOM_ROOT,
      reason: '커밋된 artifact-manifest.json을 하나도 읽지 못했다 — 경로 규약 검사가 무력화됐다'
    });
  }

  return {
    ok: violations.length === 0,
    checkedManifestCount,
    violations,
    warnings
  };
}

module.exports = {
  findManifestPathConventionViolations,
  checkArtifactPathConvention
};
