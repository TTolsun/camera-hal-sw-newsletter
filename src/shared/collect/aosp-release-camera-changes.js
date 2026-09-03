// 공개 AOSP는 2025년 3월 이후 main 브랜치로 개발이 흘러들지 않고, 릴리스 태그(android-N.M.P_rK)로
// 몇 달에 한 번 통째로 공개된다(2026-08-06 실측: hardware/interfaces·frameworks/av의 공개 main 최신
// 커밋이 2025-03-26에서 멈춤). 그래서 확정된 Camera HAL 변경은 드롭에 들어온 camera 변경을 릴리스
// 단위로 읽어야 잡힌다. 제안·리뷰 단계는 gerrit-camera-changes.js가 따로 본다(#1033) - 그쪽 층에는
// 신호가 있고, 여기서 안 잡히는 것은 공개 Gerrit에 merged camera 변경이 없기 때문이다.
//
// 날짜는 커밋 시각을 쓰지 않는다. 같은 릴리스라도 저장소별 태그 커밋 시각이 흩어져 있고
// (android-17.0.0_r1 기준 frameworks/av 2026-05-14, hardware/google/camera 2026-03-28) 어느 쪽도
// "언제 공개됐는지"가 아니다. 대신 AOSP가 build-numbers 표에 직접 적어 둔 릴리스의 보안 패치 레벨을
// 쓴다. 저장소와 무관하게 하나이고 출처가 스스로 라벨한 값이다. 표에 ISO 날짜가 없는 행은 날짜를
// 추정하지 않고 건너뛴다(빌드 ID의 6자리를 날짜로 디코딩하면 773행 중 400행에서 보안 패치 레벨과
// 어긋난다 — 실측).
const { parseGoogleJson } = require('./google-json');

const GITILES_ORIGIN = 'https://android.googlesource.com';

// Camera HAL 뉴스레터가 읽을 가치가 있는 AOSP 저장소 경로. 후보 제목에는 이 경로를 그대로 쓴다 —
// 바인딩된 gitiles URL에서 그대로 확인되는 값만 제목에 남긴다(#857). 예전에는 저장소마다 코드에
// 적어 둔 사람용 설명(label)을 제목에 넣었는데, 출처가 아니라 우리 코드가 쓴 편집 문구였다.
const WATCHED_REPOSITORY_PATHS = [
  'platform/hardware/interfaces',
  'platform/frameworks/av',
  'platform/hardware/google/camera'
];

// 릴리스 델타는 저장소에 따라 수천 커밋이라 전량 조회가 비싸다. 최신 쪽부터 이만큼만 읽고,
// 다 읽지 못했으면 건수를 하한으로 낮춰 말한다(집계를 전체 건수인 척하지 않는다).
const LOG_PAGE_SIZE = 100;
const MAX_LOG_PAGES = 6;

// gitiles 응답은 커밋별 tree_diff를 포함해 페이지당 수백 KB다. 수집 루프의 공용 fetch는 기본
// 타임아웃이 없어서, 지연 응답 하나가 수집 실행 전체를 멈춰 세울 수 있다. 그래서 이 리졸버의
// 조회에는 명시 타임아웃을 건다.
const GITILES_FETCH_TIMEOUT_MS = 8000;

const MAX_SUMMARY_SUBJECTS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;
// 수집 창을 못 받았을 때의 기본값(runtime-config의 lookbackDays 기본과 같다).
const DEFAULT_LOOKBACK_DAYS = 35;

const TABLE_ROW_PATTERN = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
const RELEASE_TAG_PATTERN = /android-\d+\.\d+\.\d+_r\d+/;
const ISO_DATE_PATTERN = /\b(\d{4}-\d{2}-\d{2})\b/;

const CAMERA_PATH_PATTERN = /(^|\/)camera/i;

function releaseOrder(tag) {
  const match = String(tag).match(/^android-(\d+)\.(\d+)\.(\d+)_r(\d+)$/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])];
}

function compareOrderDesc(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return right[index] - left[index];
  }
  return 0;
}

/**
 * build-numbers 페이지 HTML에서 릴리스 태그와 보안 패치 레벨을 뽑는다.
 * 행 단위로 자른 뒤 태그와 ISO 날짜 두 값만 각각 찾는다(쓰지도 않는 열의 마크업을 고정하지 않는다 —
 * 지원 기기 셀에 링크가 든 행 하나 때문에 릴리스가 통째로 사라지면 안 된다).
 * 같은 태그가 여러 행에 나오면(한 태그에 빌드가 여럿) 처음 것만 남긴다.
 */
function parseReleaseRows(html = '') {
  const seen = new Set();
  const releases = [];
  let row;
  TABLE_ROW_PATTERN.lastIndex = 0;
  while ((row = TABLE_ROW_PATTERN.exec(html)) !== null) {
    const cells = row[1];
    const tagMatch = cells.match(RELEASE_TAG_PATTERN);
    const dateMatch = cells.match(ISO_DATE_PATTERN);
    if (!tagMatch || !dateMatch) continue;
    const tag = tagMatch[0];
    if (seen.has(tag)) continue;
    const order = releaseOrder(tag);
    if (!order) continue;
    seen.add(tag);
    releases.push({ tag, releaseDate: dateMatch[1], order });
  }
  return releases;
}

/**
 * 조회할 릴리스 쌍을 고른다.
 *
 * newest는 보안 패치 레벨이 가장 늦은 릴리스다. 버전 태그 내림차순으로 고르면, 상위 major가 이미
 * 나온 뒤에 도착하는 하위 major 보안 드롭(예: android-17.0.0_r1 뒤의 android-16.0.0_r5)이 영영
 * newest가 되지 못해 그 드롭의 camera 변경을 통째로 놓친다.
 *
 * previous는 newest보다 버전이 낮은 것 중 가장 높은 태그다. 같은 라인의 직전 _r(16.0.0_r5 -> _r4)을
 * 자연히 고르고, 라인의 첫 릴리스(17.0.0_r1)에서는 직전 major의 마지막 태그(16.0.0_r4)를 고른다.
 * 날짜순 직전을 쓰면 다른 브랜치가 섞여 의미 없는 범위가 나온다.
 */
function selectReleasePair(releases) {
  if (releases.length < 2) return null;
  const newest = releases.reduce((best, release) => {
    if (release.releaseDate !== best.releaseDate) return release.releaseDate > best.releaseDate ? release : best;
    return compareOrderDesc(release.order, best.order) < 0 ? release : best;
  }, releases[0]);
  const previous = releases
    .filter(release => compareOrderDesc(release.order, newest.order) > 0)
    .sort((left, right) => compareOrderDesc(left.order, right.order))[0];
  if (!previous) return null;
  return { tag: newest.tag, previousTag: previous.tag, releaseDate: newest.releaseDate };
}

/**
 * 릴리스가 수집 창 안인지 본다. 창은 파이프라인이 준 now/lookbackDays에서 파생한다.
 * 창 밖이면 gitiles 조회를 아예 하지 않으므로, 드롭이 없는 대부분의 주에 이 소스는 요청 한 번으로 끝난다.
 */
function isWithinCollectionWindow(releaseDate, now, lookbackDays) {
  const released = Date.parse(`${releaseDate}T00:00:00Z`);
  if (!Number.isFinite(released)) return false;
  const ageMs = now.getTime() - released;
  return ageMs >= 0 && ageMs <= lookbackDays * DAY_MS;
}

// rename/delete 커밋은 new_path와 old_path가 다르다(삭제는 new_path가 실제 경로가 아니다).
// 둘 중 하나라도 camera를 가리키면 카메라를 건드린 것으로 본다.
function touchesCamera(commit) {
  const diff = Array.isArray(commit && commit.tree_diff) ? commit.tree_diff : [];
  return diff.some(entry => [entry && entry.new_path, entry && entry.old_path]
    .some(path => CAMERA_PATH_PATTERN.test(String(path || ''))));
}

function commitSubject(commit) {
  return String((commit && commit.message) || '').split('\n')[0].replace(/\s+/g, ' ').trim();
}

// AOSP 커밋 메시지의 Change-Id trailer. Gerrit 후보(#1033)와 같은 변경인지 판단할 유일한 공통
// 식별자다 - 드롭 후보는 저장소당 집계 1건이라 제목·URL로는 절대 겹치지 않는다.
//
// 이 매칭이 항상 성사되지는 않는다. 공개 드롭에는 내부 Gerrit(googleplex-android-review)에서
// cherry-pick된 merge 커밋이 섞여 있고, 그런 커밋의 Change-Id는 공개 Gerrit 변경의 것과 다르다
// (2026-09-02 실측: android-16.0.0_r4..android-17.0.0_r1의 최신 커밋이 그런 merge였다). 그래서
// 이건 "겹치면 반드시 잡는" 보증이 아니라 겹쳤을 때 중복 기사를 막는 안전망이다.
const CHANGE_ID_PATTERN = /^\s*Change-Id:\s*(I[0-9a-f]{40})\s*$/im;

function commitChangeId(commit) {
  const match = String((commit && commit.message) || '').match(CHANGE_ID_PATTERN);
  return match ? match[1] : '';
}

function rangeLogUrl(repositoryPath, previousTag, tag, pageToken) {
  const base = `${GITILES_ORIGIN}/${repositoryPath}/+log/${previousTag}..${tag}`;
  const query = `format=JSON&n=${LOG_PAGE_SIZE}&name-status=1${pageToken ? `&s=${pageToken}` : ''}`;
  return `${base}?${query}`;
}

/**
 * 이전 릴리스 태그와 이번 릴리스 태그 사이의 커밋을 최신 쪽부터 읽어 camera 경로를 건드린 커밋만
 * 돌려준다. 페이지 상한에 걸려 끝까지 읽지 못하면 truncated로 알린다.
 *
 * 조회 실패는 그 저장소를 건너뛰되 warn을 남긴다. 이 소스는 제너릭 폴백이 막혀 있어서, 조용히 빈
 * 배열을 돌려주면 "이번 주 드롭 없음"과 "소스 고장"이 수집 리포트에서 구분되지 않는다.
 */
async function collectCameraCommits(repositoryPath, previousTag, tag, fetchTextImpl) {
  const cameraCommits = [];
  let pageToken = '';
  let scannedCommits = 0;
  let truncated = false;

  for (let page = 0; page < MAX_LOG_PAGES; page += 1) {
    const url = rangeLogUrl(repositoryPath, previousTag, tag, pageToken);
    let payload;
    try {
      payload = parseGoogleJson(await fetchTextImpl(url, GITILES_FETCH_TIMEOUT_MS));
    } catch (error) {
      console.warn(`aosp-release-camera-changes: ${url} fetch failed (${error.message}); skipping ${repositoryPath}.`);
      return { cameraCommits, scannedCommits, truncated: true };
    }
    if (!payload) {
      console.warn(`aosp-release-camera-changes: ${url} did not return parseable gitiles JSON; skipping ${repositoryPath}.`);
      return { cameraCommits, scannedCommits, truncated: true };
    }

    const log = Array.isArray(payload.log) ? payload.log : [];
    // next 토큰을 따라갔는데 빈 페이지가 오면 델타를 다 읽은 것이다. 직전 루프에서 세운
    // truncated를 여기서 되돌리지 않으면, 전부 읽고도 하한으로 낮춰 말하게 된다.
    if (log.length === 0) return { cameraCommits, scannedCommits, truncated: false };

    scannedCommits += log.length;
    cameraCommits.push(...log.filter(touchesCamera));

    if (!payload.next) return { cameraCommits, scannedCommits, truncated: false };
    pageToken = payload.next;
    truncated = true;
  }

  return { cameraCommits, scannedCommits, truncated };
}

function buildSummary(repositoryPath, release, cameraCommits, scannedCommits, truncated, source) {
  const scope = truncated
    ? `at least ${cameraCommits.length}, counted within the ${scannedCommits} newest commits of the ${release.previousTag}..${release.tag} range`
    : `${cameraCommits.length}, counted across the full ${release.previousTag}..${release.tag} range`;
  const subjects = cameraCommits
    .slice(0, MAX_SUMMARY_SUBJECTS)
    .map(commit => commitSubject(commit))
    .filter(Boolean);
  const examples = subjects.length > 0 ? ` Commit subjects: ${subjects.join('; ')}.` : '';
  const dateSource = source.sourceUrl || source.url || '';
  // 날짜 주장(보안 패치 레벨)은 커밋 로그가 아니라 build-numbers 표에서 온다. 후보 본문이 그 출처를
  // 직접 들고 있어야 사실 확인이 바인딩된 URL 하나로 끝나지 않는다.
  const dateCitation = dateSource ? ` Security patch level per the AOSP build-numbers table (${dateSource}).` : '';
  return `AOSP source release ${release.tag} (security patch level ${release.releaseDate}) carries `
    + `${scope} commit(s) touching camera paths in ${repositoryPath}.${examples}${dateCitation}`;
}

function buildCandidate(repositoryPath, release, cameraCommits, scannedCommits, truncated, source) {
  const summary = buildSummary(repositoryPath, release, cameraCommits, scannedCommits, truncated, source);
  return {
    source,
    // 제목에는 릴리스 태그와 저장소 경로만 남긴다. 둘 다 바인딩된 gitiles URL에서 그대로 확인된다.
    // 건수는 이 코드의 경로 정규식과 페이지 상한에서 파생된 값이라 제목이 아니라 메타데이터로 둔다.
    // 세는 방법과 하한 여부는 요약문이 문장으로 설명한다(#857).
    title: `AOSP ${release.tag} source release — camera path changes in ${repositoryPath}`,
    url: `${GITILES_ORIGIN}/${repositoryPath}/+log/${release.previousTag}..${release.tag}`,
    publishedAt: release.releaseDate,
    summary,
    sourceKind: 'release_note_item',
    collectionMode: 'release-note-item',
    parentUrl: source.sourceUrl || source.url,
    parentTitle: source.name,
    version_or_release: release.tag,
    api_or_component: `AOSP ${repositoryPath} / camera`,
    behavior_change: summary,
    relevanceBucketHint: 'direct_aosp_camera',
    camera_path_commit_count: cameraCommits.length,
    camera_path_commit_count_is_lower_bound: truncated,
    // 이 드롭이 실어 온 camera 커밋의 Change-Id와 commit SHA. 같은 변경이 Gerrit 후보로도 잡혔다면
    // 선정 단계가 이 목록으로 알아채고 하나로 접는다(#1033).
    covered_gerrit_change_ids: cameraCommits.map(commitChangeId).filter(Boolean),
    covered_commit_shas: cameraCommits.map(commit => String((commit && commit.commit) || '')).filter(Boolean)
  };
}

/**
 * AOSP build-numbers 페이지 HTML을 받아, 가장 최신 릴리스 드롭에 들어온 camera 변경을
 * 저장소별 후보 1건씩으로 반환한다.
 *
 * - 릴리스가 수집 창을 벗어났거나 비교할 직전 릴리스가 없으면 git 조회 없이 빈 배열을 반환한다.
 * - camera 변경이 없는 저장소는 후보를 만들지 않는다.
 */
async function resolveAospReleaseCameraChangeItems(text = '', source = {}, options = {}) {
  const fetchTextImpl = options.fetchTextImpl;
  if (typeof fetchTextImpl !== 'function') return [];
  const now = options.now instanceof Date ? options.now : new Date();
  const lookbackDays = Number.isFinite(options.lookbackDays) && options.lookbackDays > 0
    ? options.lookbackDays
    : DEFAULT_LOOKBACK_DAYS;

  const releases = parseReleaseRows(text);
  if (releases.length < 2) {
    console.warn(`aosp-release-camera-changes: build-numbers table yielded ${releases.length} dated release row(s); cannot pick a release pair.`);
    return [];
  }

  const release = selectReleasePair(releases);
  if (!release) return [];
  if (!isWithinCollectionWindow(release.releaseDate, now, lookbackDays)) return [];

  const candidates = [];
  for (const repositoryPath of WATCHED_REPOSITORY_PATHS) {
    const { cameraCommits, scannedCommits, truncated } =
      await collectCameraCommits(repositoryPath, release.previousTag, release.tag, fetchTextImpl);
    if (cameraCommits.length === 0) continue;
    candidates.push(buildCandidate(repositoryPath, release, cameraCommits, scannedCommits, truncated, source));
  }

  return candidates;
}

module.exports = {
  MAX_LOG_PAGES,
  parseReleaseRows,
  resolveAospReleaseCameraChangeItems,
  selectReleasePair
};
