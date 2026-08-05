// 공개 AOSP는 2025년 3월 이후 main 브랜치로 개발이 흘러들지 않고, 릴리스 태그(android-N.M.P_rK)로
// 몇 달에 한 번 통째로 공개된다(2026-08-06 실측: hardware/interfaces·frameworks/av의 공개 main 최신
// 커밋이 2025-03-26에서 멈춤). 그래서 Gerrit의 진행 중 변경을 좇는 방식으로는 Camera HAL 신호가 잡히지
// 않고, 드롭에 들어온 camera 변경을 릴리스 단위로 읽어야 한다.
//
// 날짜는 커밋 시각을 쓰지 않는다. 같은 릴리스라도 저장소별 태그 커밋 시각이 흩어져 있고
// (android-17.0.0_r1 기준 frameworks/av 2026-05-14, hardware/google/camera 2026-03-28) 어느 쪽도
// "언제 공개됐는지"가 아니다. 대신 AOSP가 build-numbers 표에 직접 적어 둔 릴리스의 보안 패치 레벨을
// 쓴다. 저장소와 무관하게 하나이고 출처가 스스로 라벨한 값이다. 표에 ISO 날짜가 없는 행은 날짜를
// 추정하지 않고 건너뛴다(빌드 ID의 6자리를 날짜로 디코딩하면 773행 중 400행에서 보안 패치 레벨과
// 어긋난다 — 실측).
const GITILES_ORIGIN = 'https://android.googlesource.com';

// Camera HAL 뉴스레터가 읽을 가치가 있는 AOSP 저장소. label은 후보 제목에 들어가는 사람용 설명이다.
const WATCHED_REPOSITORIES = [
  { path: 'platform/hardware/interfaces', label: 'Camera HAL interface (AIDL)' },
  { path: 'platform/frameworks/av', label: 'camera framework / cameraserver' },
  { path: 'platform/hardware/google/camera', label: 'Google Camera HAL (GCH)' }
];

// 릴리스 델타는 저장소에 따라 수천 커밋이라 전량 조회가 비싸다. 최신 쪽부터 이만큼만 읽고,
// 다 읽지 못했으면 후보 요약에 범위를 밝힌다(집계를 전체 건수인 척하지 않는다).
const LOG_PAGE_SIZE = 100;
const MAX_LOG_PAGES = 6;

// 릴리스가 수집 창(기본 lookback 35일)에서 이미 벗어났으면 git 조회를 아예 하지 않는다.
// 드롭이 없는 대부분의 주에 이 소스를 사실상 무료로 만든다. 창 자체의 판정은 수집 단계가 하므로
// 여기서는 조금 넉넉하게 잡는다.
const RELEASE_FRESHNESS_DAYS = 45;

const MAX_SUMMARY_SUBJECTS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

// build-numbers 표의 행: 빌드 ID / 태그 / 버전 / 지원 기기 / 보안 패치 레벨.
// 보안 패치 레벨이 ISO 날짜인 행만 받는다(현지화된 표기는 날짜로 쓰지 않는다).
const RELEASE_ROW_PATTERN = /<tr>\s*<td>[^<]*<\/td>\s*<td>\s*(android-\d+\.\d+\.\d+_r\d+)\s*<\/td>\s*<td>[^<]*<\/td>\s*<td>[^<]*<\/td>\s*<td>\s*(\d{4}-\d{2}-\d{2})\s*<\/td>/g;

const CAMERA_PATH_PATTERN = /(^|\/)camera/i;
const GITILES_JSON_PREFIX_PATTERN = /^\)\]\}'\s*/;

function releaseOrder(tag) {
  const match = String(tag).match(/^android-(\d+)\.(\d+)\.(\d+)_r(\d+)$/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])];
}

function compareReleaseDesc(left, right) {
  for (let index = 0; index < left.order.length; index += 1) {
    if (left.order[index] !== right.order[index]) return right.order[index] - left.order[index];
  }
  return 0;
}

/**
 * build-numbers 페이지 HTML에서 릴리스 태그와 보안 패치 레벨을 뽑아 최신순으로 반환한다.
 * 태그가 중복된 행은 처음 것만 남긴다.
 */
function parseReleaseRows(html = '') {
  const seen = new Set();
  const releases = [];
  let match;
  RELEASE_ROW_PATTERN.lastIndex = 0;
  while ((match = RELEASE_ROW_PATTERN.exec(html)) !== null) {
    const [, tag, releaseDate] = match;
    if (seen.has(tag)) continue;
    const order = releaseOrder(tag);
    if (!order) continue;
    seen.add(tag);
    releases.push({ tag, releaseDate, order });
  }
  return releases.sort(compareReleaseDesc);
}

function isFresh(releaseDate, now) {
  const released = Date.parse(`${releaseDate}T00:00:00Z`);
  if (!Number.isFinite(released)) return false;
  const ageMs = now.getTime() - released;
  return ageMs >= 0 && ageMs <= RELEASE_FRESHNESS_DAYS * DAY_MS;
}

function parseGitilesJson(text) {
  try {
    return JSON.parse(String(text).replace(GITILES_JSON_PREFIX_PATTERN, ''));
  } catch {
    return null;
  }
}

function touchesCamera(commit) {
  const diff = Array.isArray(commit && commit.tree_diff) ? commit.tree_diff : [];
  return diff.some(entry => CAMERA_PATH_PATTERN.test(String((entry && (entry.new_path || entry.old_path)) || '')));
}

function commitSubject(commit) {
  return String((commit && commit.message) || '').split('\n')[0].replace(/\s+/g, ' ').trim();
}

function rangeLogUrl(repositoryPath, previousTag, tag, pageToken) {
  const base = `${GITILES_ORIGIN}/${repositoryPath}/+log/${previousTag}..${tag}`;
  const query = `format=JSON&n=${LOG_PAGE_SIZE}&name-status=1${pageToken ? `&s=${pageToken}` : ''}`;
  return `${base}?${query}`;
}

/**
 * 이전 릴리스 태그와 이번 릴리스 태그 사이의 커밋을 최신 쪽부터 읽어 camera 경로를 건드린 커밋만
 * 돌려준다. 페이지 상한에 걸려 끝까지 읽지 못하면 truncated로 알린다.
 * 네트워크 실패나 응답 구조 변경은 그 저장소를 조용히 건너뛰는 것으로 처리한다(graceful).
 */
async function collectCameraCommits(repositoryPath, previousTag, tag, fetchTextImpl) {
  const cameraCommits = [];
  let pageToken = '';
  let scannedCommits = 0;
  let truncated = false;

  for (let page = 0; page < MAX_LOG_PAGES; page += 1) {
    let payload;
    try {
      payload = parseGitilesJson(await fetchTextImpl(rangeLogUrl(repositoryPath, previousTag, tag, pageToken)));
    } catch {
      return { cameraCommits, scannedCommits, truncated: true };
    }
    const log = payload && Array.isArray(payload.log) ? payload.log : [];
    if (log.length === 0) break;

    scannedCommits += log.length;
    cameraCommits.push(...log.filter(touchesCamera));

    if (!payload.next) return { cameraCommits, scannedCommits, truncated: false };
    pageToken = payload.next;
    truncated = true;
  }

  return { cameraCommits, scannedCommits, truncated };
}

function buildSummary(repository, release, cameraCommits, scannedCommits, truncated) {
  const scope = truncated
    ? `the ${scannedCommits} newest commits of the ${release.previousTag}..${release.tag} range`
    : `the full ${release.previousTag}..${release.tag} range`;
  const subjects = cameraCommits
    .slice(0, MAX_SUMMARY_SUBJECTS)
    .map(commit => commitSubject(commit))
    .filter(Boolean);
  const examples = subjects.length > 0 ? ` Commit subjects: ${subjects.join('; ')}.` : '';
  return `AOSP source release ${release.tag} (security patch level ${release.releaseDate}) carries `
    + `${cameraCommits.length} commit(s) touching camera paths in ${repository.path}, counted within ${scope}.${examples}`;
}

function buildCandidate(repository, release, cameraCommits, scannedCommits, truncated, source) {
  const summary = buildSummary(repository, release, cameraCommits, scannedCommits, truncated);
  return {
    source,
    title: `AOSP ${release.tag} source release — ${cameraCommits.length} camera change(s) in ${repository.label}`,
    url: `${GITILES_ORIGIN}/${repository.path}/+log/${release.previousTag}..${release.tag}`,
    publishedAt: release.releaseDate,
    summary,
    sourceKind: 'release_note_item',
    collectionMode: 'release-note-item',
    parentUrl: source.sourceUrl || source.url,
    parentTitle: source.name,
    version_or_release: release.tag,
    api_or_component: `AOSP ${repository.path} / camera`,
    behavior_change: summary,
    relevanceBucketHint: 'direct_aosp_camera'
  };
}

/**
 * AOSP build-numbers 페이지 HTML을 받아, 가장 최신 릴리스 드롭에 들어온 camera 변경을
 * 저장소별 후보 1건씩으로 반환한다.
 *
 * - 릴리스가 창을 벗어났거나 이전 릴리스가 없으면 git 조회 없이 빈 배열을 반환한다.
 * - camera 변경이 없는 저장소는 후보를 만들지 않는다.
 */
async function resolveAospReleaseCameraChangeItems(text = '', source = {}, options = {}) {
  const fetchTextImpl = options.fetchTextImpl;
  if (typeof fetchTextImpl !== 'function') return [];
  const now = options.now instanceof Date ? options.now : new Date();

  const releases = parseReleaseRows(text);
  if (releases.length < 2) return [];

  const [newest, previous] = releases;
  if (!isFresh(newest.releaseDate, now)) return [];

  const release = { tag: newest.tag, previousTag: previous.tag, releaseDate: newest.releaseDate };
  const candidates = [];

  for (const repository of WATCHED_REPOSITORIES) {
    const { cameraCommits, scannedCommits, truncated } =
      await collectCameraCommits(repository.path, release.previousTag, release.tag, fetchTextImpl);
    if (cameraCommits.length === 0) continue;
    candidates.push(buildCandidate(repository, release, cameraCommits, scannedCommits, truncated, source));
  }

  return candidates;
}

module.exports = {
  MAX_LOG_PAGES,
  RELEASE_FRESHNESS_DAYS,
  WATCHED_REPOSITORIES,
  parseReleaseRows,
  resolveAospReleaseCameraChangeItems
};
