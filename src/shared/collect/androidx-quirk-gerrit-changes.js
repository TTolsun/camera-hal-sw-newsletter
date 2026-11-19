// AndroidX(platform/frameworks/support) Gerrit에서 "기기 우회(quirk)" 변경을 직접 가져오는 조회 모듈이다.
//
// 이 모듈이 후보 풀(collect)을 거치지 않고 Gerrit에 직접 가는 이유: AndroidX 출처는 주당 상한이 걸려 있어
// 쿼크가 아닌 패치와 자리를 다투다 쿼크 변경 대부분이 후보에서 빠진다(2026-11-20 실측: 쿼크 변경 49건 중 9건만
// 수집). 그래서 장부는 선정 규칙과 무관하게 Gerrit 목록을 따로 읽는다.
//
// 2026-11-20 실측으로 확인한 계약.
//
// 1. 서버 쪽 정규식 질의(`file:^...`)는 이 호스트가 지원하지 않는다. 그래서 `dir:camera`로 좁힌 목록을
//    받고, 쿼크 파일 경로(`/quirk/\w+Quirk.(kt|java)`)는 클라이언트에서 거른다.
// 2. `after:`는 제출 시각이 아니라 갱신 시각 기준이다. 2024~2025년에 제출된 변경이 최근 갱신 때문에 섞여
//    나온다. 제출일 창 필터는 호출자(장부 모듈)가 한다.
// 3. 커밋 메시지는 `o=CURRENT_COMMIT`을 줘야 온다. CURRENT_REVISION만으로는 파일 목록만 온다.
// 4. 쿼크 파일의 추가 줄은 변경 하나당 `/revisions/current/files/<경로>/diff`로 따로 받는다.

const { parseGoogleJson } = require('./google-json');

const ANDROIDX_GERRIT_ORIGIN = 'https://android-review.googlesource.com';
const ANDROIDX_PROJECT = 'platform/frameworks/support';
const QUIRK_FILE_PATTERN = /\/quirk\/\w+Quirk\.(kt|java)$/;

// 2026-11-20 실측: 주간 창 하나(약 100건)가 500KB 안팎이다. n=500이면 몇 주치 공백이 생겨도 한 번에 받는다.
const LIST_PAGE_SIZE = 500;
const LIST_FETCH_TIMEOUT_MS = 30000;
const DIFF_FETCH_TIMEOUT_MS = 10000;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 조회 시작일(포함)에서 하루 앞선 날짜를 `after:`에 쓴다. Gerrit이 날짜를 어느 시간대로 해석하는지
 * 응답으로 확인할 수 없어서, 시간대 차이로 창 첫날 변경이 빠지는 일을 막는 여유다. 넘치는 변경은
 * 호출자가 제출일로 다시 거른다.
 */
function listQueryUrl(windowStartDate) {
  const start = Date.parse(`${windowStartDate}T00:00:00Z`);
  if (!Number.isFinite(start)) throw new Error(`window start date must be YYYY-MM-DD: ${windowStartDate}`);
  const after = new Date(start - DAY_MS).toISOString().slice(0, 10);
  const query = `project:${ANDROIDX_PROJECT} status:merged after:${after} dir:camera`;
  const params = [
    `q=${encodeURIComponent(query)}`,
    `n=${LIST_PAGE_SIZE}`,
    'o=CURRENT_REVISION',
    'o=CURRENT_FILES',
    'o=CURRENT_COMMIT'
  ];
  return `${ANDROIDX_GERRIT_ORIGIN}/changes/?${params.join('&')}`;
}

function changeUrl(changeNumber) {
  return `${ANDROIDX_GERRIT_ORIGIN}/c/${ANDROIDX_PROJECT}/+/${changeNumber}`;
}

function currentRevision(change) {
  const revisions = change && change.revisions;
  return revisions && change.current_revision ? revisions[change.current_revision] || null : null;
}

/** 변경이 건드린 쿼크 파일을 [{ path, status }]로 돌려준다. status는 Gerrit 값(A 추가, D 삭제, 없으면 수정). */
function quirkFilesOf(change) {
  const revision = currentRevision(change);
  const files = revision && revision.files && typeof revision.files === 'object' ? revision.files : {};
  return Object.keys(files)
    .filter(filePath => QUIRK_FILE_PATTERN.test(filePath))
    .map(filePath => ({ path: filePath, status: String(files[filePath].status || 'M') }));
}

function commitMessageOf(change) {
  const revision = currentRevision(change);
  return String((revision && revision.commit && revision.commit.message) || '');
}

function totalFileCountOf(change) {
  const revision = currentRevision(change);
  return revision && revision.files ? Object.keys(revision.files).length : 0;
}

/**
 * 병합된 camera 변경 목록을 받는다. 못 읽으면 던진다 - "읽지 못함"과 "변경 없음"을 호출자가 구분해
 * 진단으로 남겨야 해서 빈 배열로 숨기지 않는다.
 */
async function fetchMergedCameraChanges(windowStartDate, fetchTextImpl) {
  const url = listQueryUrl(windowStartDate);
  const parsed = parseGoogleJson(await fetchTextImpl(url, LIST_FETCH_TIMEOUT_MS));
  if (!Array.isArray(parsed)) {
    throw new Error(`Gerrit change list is not a JSON array: ${url}`);
  }
  // Gerrit은 n을 넘기면 마지막 항목에 _more_changes를 붙인다.
  const truncated = parsed.length > 0 && parsed[parsed.length - 1]._more_changes === true;
  return { url, changes: parsed, truncated };
}

/** 쿼크 파일 하나의 diff에서 추가된 줄(새 쪽)만 모아 돌려준다. 못 읽으면 던진다. */
async function fetchQuirkAddedLines(changeNumber, filePath, fetchTextImpl) {
  const url = `${ANDROIDX_GERRIT_ORIGIN}/changes/${changeNumber}/revisions/current/files/${encodeURIComponent(filePath)}/diff`;
  const parsed = parseGoogleJson(await fetchTextImpl(url, DIFF_FETCH_TIMEOUT_MS));
  if (!parsed || !Array.isArray(parsed.content)) {
    throw new Error(`Gerrit diff is not a JSON object with content: ${url}`);
  }
  const lines = [];
  for (const block of parsed.content) {
    if (Array.isArray(block.b)) lines.push(...block.b);
  }
  return lines;
}

module.exports = {
  ANDROIDX_GERRIT_ORIGIN,
  ANDROIDX_PROJECT,
  QUIRK_FILE_PATTERN,
  changeUrl,
  commitMessageOf,
  fetchMergedCameraChanges,
  fetchQuirkAddedLines,
  listQueryUrl,
  quirkFilesOf,
  totalFileCountOf
};
