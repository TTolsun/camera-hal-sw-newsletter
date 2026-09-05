// Gerrit(android-review.googlesource.com, chromium-review.googlesource.com)는 카메라 스택의
// 변경 제안과 리뷰를 REST API(/changes/?q=...)로 공개한다. 릴리스 소스 드롭이 "공개된 확정 변경"을
// 몇 달에 한 번 통째로 보여 준다면, Gerrit은 그보다 앞선 제안·리뷰 단계를 날짜와 상태가 붙은 채로
// 보여 준다. 둘은 대체가 아니라 proposal -> landed 관계이므로 함께 본다(#1033).
//
// 이 리졸버가 반드시 지켜야 하는 계약 세 가지.
//
// 1. 날짜는 상태가 정한다. MERGED는 submitted, NEW는 created를 쓰고 updated는 절대 쓰지 않는다.
//    updated는 댓글 한 줄에도 갱신되므로, 그걸 기사 날짜로 쓰면 2024년 변경이 매주 "이번 주 소식"으로
//    되살아나고 patchset 갱신마다 같은 변경이 다시 기사가 된다. created/submitted를 쓰면 같은 변경은
//    수집 창(기본 35일) 안에서 한 번만 후보가 되고 그 뒤로는 창 밖으로 빠져 다시 돌아오지 않는다.
//
// 2. 변경 페이지 본문은 받아올 수 없다. Gerrit UI는 PolyGerrit(클라이언트 렌더링)이라 change URL을
//    그대로 받으면 "To use PolyGerrit, please enable JavaScript"라는 97자만 온다(2026-09-02 실측).
//    그래서 후보 요약은 REST 응답에서 읽은 사실만으로 스스로 완결돼야 한다 — 요약을 템플릿 문구로
//    채우고 본문 확인을 뒤 단계에 미루면, 근거 없는 기사가 그대로 발행까지 간다.
//
// 3. Camera 경로를 건드렸다는 사실만으로는 카메라 뉴스가 아니다. 2026-09-02 실측한
//    chromium-review 8269206("platform2: Remove ENABLE_IPCZ_ON_CHROMEOS guards")은 23개 파일 중
//    camera/ 아래가 4개뿐인 트리 전역 리팩터링이었다. 그래서 실질 변경 파일의 절반 이상이 카메라
//    경로일 때만 후보로 삼는다.
//
// 2026-09-02 실측 신호량: AOSP 세 저장소의 camera 변경은 90~180일 동안 MERGED 0건이고 창 안 NEW가
// 3건이며, 그 3건 모두 Code-Review 표가 하나도 없다. 즉 지금 이 소스가 만드는 후보는 대부분
// watchlist다. 그것이 정답이다 - 리뷰가 붙지 않은 제안을 main 기사로 올리지 않는 것이 이 소스의 목적이다.

const { parseGoogleJson } = require('./google-json');

const DAY_MS = 24 * 60 * 60 * 1000;
// 수집 창을 못 받았을 때의 기본값(runtime-config의 lookbackDays 기본과 같다).
const DEFAULT_LOOKBACK_DAYS = 35;

// 목록 응답은 옵션 없이 128KB / 1.1초다(2026-09-02 실측). 상세는 변경 하나당 24~55KB이므로 창 안
// 후보에만 건다. 창 안 후보가 이 상한을 넘으면 최신 쪽부터 읽고 잘렸다고 알린다.
const MAX_DETAIL_FETCHES = 12;
const DETAIL_FETCH_TIMEOUT_MS = 8000;

// 등록부 목록 URL이 한 번에 받아야 하는 최소 변경 수. 2026-09-02 실측에서 n=100이 AOSP 약 24개월,
// ChromeOS 약 22개월을 덮어 35일 창을 크게 넘겼다. 등록부의 n을 이보다 낮추면 목록 한 페이지가
// 수집 창을 못 덮는 쪽으로 되돌아가므로 gerrit-camera-changes.test.js가 이 값을 잠근다.
const MIN_LIST_PAGE_SIZE = 100;

// 요약에 나열할 파일 수 상한. 나머지는 건수로만 말한다(요약이 500자에서 잘리면 뒤 문장이 통째로 사라진다).
const MAX_SUMMARY_FILES = 4;

// Gerrit 타임스탬프는 "2026-08-13 15:04:14.000000000" 형태의 UTC다(타임존 표기가 없다).
const GERRIT_TIMESTAMP_PATTERN = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})/;
const CAMERA_PATH_PATTERN = /(^|\/)camera/i;

// diff 목록에만 나오는 가짜 경로. 변경 파일 수에 넣으면 OWNERS 한 줄짜리 변경이 "파일 2개"가 된다.
const COMMIT_MESSAGE_PATH = '/COMMIT_MSG';

// 그 자체로는 Camera HAL 동작을 바꾸지 않는 파일들. 이것만 바뀐 변경은 후보가 아니다.
const NON_SUBSTANTIVE_BASENAMES = new Set([
  'OWNERS',
  'TEST_MAPPING',
  'METADATA',
  'PREUPLOAD.cfg',
  '.clang-format',
  'CMakeLists.txt',
  'BUILD.gn'
]);
const NON_SUBSTANTIVE_EXTENSION_PATTERN = /\.(bp|mk|gni|gyp|ebuild)$/i;

// 제목만으로 걸러지는 시험용 변경. 2026-09-02 실측으로 확인된 것만 담는다
// (hardware/interfaces 4058016 "fake subject", frameworks/av 4259503 "Test commit").
const NOISE_SUBJECT_PATTERNS = [
  /\bDO NOT SUBMIT\b/i,
  /^\s*(?:test|fake)\b/i
];

// 리뷰 표는 Gerrit이 계산해 주는 approved/recommended/rejected/disliked 축약 필드로만 읽는다 -
// all[] 원표에는 봇의 0점 투표가 섞여 있어(실측: Code-Review.all에 Lint 봇의 value 0) 직접 세면
// "리뷰가 붙었다"를 잘못 판정한다.
//
// 긍정 근거로 인정하는 것은 사람 리뷰 label인 Code-Review 하나뿐이다. 이 코드는 표를 던진 주체를
// 확인하지 않으므로, label 이름이 사람 리뷰를 뜻하는 것만 사람 리뷰라고 말할 수 있다.
// Open-Source-Licensing을 근거에서 뺀 것과 같은 이유다 - 외부 기여마다 자동으로 +1이 붙는 라이선스
// 봇 label이다(실측: 창 안 NEW 3건 전부 이 label만 +1).
const HUMAN_REVIEW_LABEL = 'Code-Review';

// 이름이 사람 리뷰를 뜻하지 않는 검증 label. 검증 통과 여부를 말할 뿐 사람이 코드를 봤다는 뜻은
// 아니므로 긍정 근거로 세지 않는다. 부정 표는 아래에서 함께 본다.
const VERIFICATION_LABELS = ['Verified', 'Presubmit-Verified'];

// 부정 표를 보는 label. 검증 label의 rejected는 "이 변경은 빌드·검증을 통과하지 못했다"는 뜻이라,
// 그걸 무시하면 리뷰어 +1 하나로 빌드가 깨진 제안이 main 기사가 된다.
const BLOCKING_VOTE_LABELS = [HUMAN_REVIEW_LABEL, ...VERIFICATION_LABELS];

function noop() {}

function parseGerritChangeList(text) {
  const parsed = parseGoogleJson(text);
  return Array.isArray(parsed) ? parsed : null;
}

function parseGerritDetail(text) {
  const parsed = parseGoogleJson(text);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
}

function gerritTimeMs(value) {
  const match = String(value || '').match(GERRIT_TIMESTAMP_PATTERN);
  if (!match) return NaN;
  return Date.parse(`${match[1]}T${match[2]}Z`);
}

/**
 * 후보 날짜와 그 날짜가 어느 필드에서 왔는지 돌려준다.
 * MERGED는 submitted, NEW는 created다. 해당 필드가 없으면 날짜를 다른 필드로 대신하지 않고 버린다 -
 * updated로 대신하는 순간 위 계약 1이 깨진다.
 */
function effectiveDate(change) {
  const status = String((change && change.status) || '').toUpperCase();
  const field = status === 'MERGED' ? 'submitted' : status === 'NEW' ? 'created' : '';
  if (!field) return null;
  const timeMs = gerritTimeMs(change[field]);
  if (!Number.isFinite(timeMs)) return null;
  return { field, timeMs, date: new Date(timeMs).toISOString().slice(0, 10) };
}

// WIP와 ABANDONED는 기사 후보에서 제외한다(#1033). 상태 전환 자체는 Gerrit에 남으므로 과거 기사를
// 사후에 고쳐 쓸 필요가 없다 - 여기서는 "지금 기사로 낼 수 있는가"만 본다.
function hasEligibleState(change) {
  if (!change || change.work_in_progress === true) return false;
  const status = String(change.status || '').toUpperCase();
  return status === 'MERGED' || status === 'NEW';
}

function subjectIsNoise(subject) {
  const text = String(subject || '');
  return NOISE_SUBJECT_PATTERNS.some(pattern => pattern.test(text));
}

function basename(filePath) {
  const parts = String(filePath || '').split('/');
  return parts[parts.length - 1] || '';
}

function isSubstantiveFile(filePath) {
  if (filePath === COMMIT_MESSAGE_PATH) return false;
  const name = basename(filePath);
  if (!name) return false;
  if (NON_SUBSTANTIVE_BASENAMES.has(name)) return false;
  return !NON_SUBSTANTIVE_EXTENSION_PATTERN.test(name);
}

/**
 * 저장소 자체가 카메라 저장소면(platform/hardware/google/camera) 그 안의 모든 파일이 카메라 경로다.
 * 그 저장소의 실제 경로에는 camera 세그먼트가 없어서(common/hal/...), 파일 경로만 보면 이 저장소는
 * 통째로 후보에서 사라진다.
 */
function isCameraScopedFile(project, filePath) {
  return CAMERA_PATH_PATTERN.test(String(project || '')) || CAMERA_PATH_PATTERN.test(String(filePath || ''));
}

function currentRevision(detail) {
  const revisions = detail && detail.revisions;
  if (!revisions || typeof revisions !== 'object') return null;
  const key = detail.current_revision && revisions[detail.current_revision]
    ? detail.current_revision
    : Object.keys(revisions)[0];
  if (!key) return null;
  return { sha: key, info: revisions[key] || {} };
}

/**
 * 카메라 변경으로 볼 수 있는지 파일 목록으로 판정한다.
 * - 실질 파일이 하나도 없으면(OWNERS/TEST_MAPPING/빌드 파일만) 후보가 아니다.
 * - 실질 파일의 절반 미만이 카메라 경로면 카메라를 스쳐 간 공통 리팩터링이다.
 */
function cameraFileScope(project, filePaths) {
  const substantive = filePaths.filter(isSubstantiveFile);
  const camera = substantive.filter(filePath => isCameraScopedFile(project, filePath));
  const cameraMajority = camera.length > 0 && camera.length * 2 >= substantive.length;
  return { substantive, camera, isCameraChange: substantive.length > 0 && cameraMajority };
}

function hasNegativeVote(label) {
  return Boolean(label) && (label.rejected != null || label.disliked != null);
}

function hasPositiveVote(label) {
  return Boolean(label) && (label.approved != null || label.recommended != null);
}

/**
 * 리뷰 근거를 label의 approved/recommended/rejected/disliked 축약 필드로만 읽는다.
 * 문구에는 점수를 쓰지 않는다 - approved는 "그 label의 최대값"이라는 뜻이고 최대값은 프로젝트 설정에
 * 달려 있어서, +2라고 적으면 코드가 확인하지 않은 값을 후보가 주장하게 된다.
 *
 * positive는 사람 리뷰가 붙었을 때만 참이다. buildCandidate가 이 값으로 NEW 변경의 main 자격을
 * 정하므로, 검증 label의 표를 여기에 세면 사람이 아무도 보지 않은 제안이 main 기사가 된다(#1061).
 */
function reviewSignals(labels = {}) {
  const votes = labels || {};
  const negativeLabels = BLOCKING_VOTE_LABELS.filter(name => hasNegativeVote(votes[name]));
  const verifiedLabels = VERIFICATION_LABELS.filter(name => hasPositiveVote(votes[name]));
  const negative = negativeLabels.length > 0;
  const positive = !negative && hasPositiveVote(votes[HUMAN_REVIEW_LABEL]);
  let phrase;
  if (negative) {
    phrase = `Not reviewed clean: ${negativeLabels.join(', ')} carries a negative vote.`;
  } else if (positive) {
    phrase = `Reviewed: ${HUMAN_REVIEW_LABEL} carries an approving or recommending vote.`;
  } else if (verifiedLabels.length > 0) {
    phrase = `Verification only: ${verifiedLabels.join(', ')} carries an approving or recommending vote, but no ${HUMAN_REVIEW_LABEL} vote has been cast.`;
  } else {
    phrase = 'No Code-Review or verification vote has been cast yet.';
  }
  return { positive, negative, phrase };
}

function gerritOrigin(source) {
  try {
    return new URL(String(source.sourceUrl || source.url || '')).origin;
  } catch {
    return '';
  }
}

function changeUrl(origin, project, changeNumber) {
  return `${origin}/c/${project}/+/${changeNumber}`;
}

function detailUrl(origin, changeNumber) {
  return `${origin}/changes/${changeNumber}/detail?o=CURRENT_REVISION&o=CURRENT_FILES`;
}

// 파일 경로는 저장소 경로를 붙여 트리 전체 경로로 적는다. Gerrit이 주는 경로는 저장소 기준이라
// 그것만으로는 어느 트리인지 알 수 없다 - platform/hardware/interfaces의 `camera/device/...`와
// chromiumos/platform2의 `camera/hal_adapter/...`가 같은 모양이 된다. 전체 경로여야 사실 확인이
// 가능하고, 카메라 스코프 분류기도 AOSP 트리와 그 밖을 가를 수 있다.
function repositoryPaths(project, files) {
  return files.map(filePath => `${project}/${filePath}`);
}

function fileListPhrase(files) {
  const shown = files.slice(0, MAX_SUMMARY_FILES);
  const rest = files.length - shown.length;
  return rest > 0 ? `${shown.join(', ')} and ${rest} more file(s)` : shown.join(', ');
}

function changeSubject(detail) {
  return String((detail && detail.subject) || '').replace(/\s+/g, ' ').trim();
}

/**
 * api_or_component에 쓸 컴포넌트 라벨. 파일 목록을 이어 붙이지 않는다 - 저장소 경로를 붙인 파일
 * 네 개면 300자가 넘어, 파이프라인의 다른 컴포넌트 라벨(componentFromText의 상한 48자)과 자릿수가
 * 달라지고 기사 캡슐과 reporter prompt에 경로 덩어리가 실린다. 첫 카메라 파일이 있는 디렉터리가
 * 그 변경의 컴포넌트다. 파일 전체 목록은 요약이 문장으로 말한다.
 */
function cameraComponentLabel(project, cameraFiles) {
  const first = String(cameraFiles[0] || '');
  const directory = first.includes('/') ? first.slice(0, first.lastIndexOf('/')) : '';
  return directory ? `${project}/${directory}` : project;
}

/**
 * 후보의 behavior_change. 제목을 그대로 쓰지 않는다 - Gerrit 제목은 "VirtualCamera: prevent integer
 * underflow in outBufferSize"처럼 무엇이 바뀌는지 동사로 말하지 않는 경우가 많아, 근거 채점이
 * "동작 변경 서술 없음"으로 읽고 후보를 source_gap_risk로 떨어뜨린다(실측). 대신 REST 응답에서 읽은
 * 사실(상태, 카메라 파일 수, 삽입·삭제 줄 수, 제목)을 그대로 문장으로 쓴다. 후보를 통과시키려고
 * 없는 사실을 쓰는 게 아니라, 이미 가진 사실을 문장으로 옮기는 것이다 - OWNERS/빌드 전용 변경은
 * 여기 오기 전에 걸러져 있어 "카메라 소스 파일 N개를 바꾼다"는 서술이 항상 참이다.
 */
function behaviorChange(detail, scope) {
  const counts = `+${Number(detail.insertions) || 0}/-${Number(detail.deletions) || 0}`;
  const lead = detail.status === 'MERGED'
    ? 'Merged change updates'
    : 'Proposed change would update';
  return `${lead} ${scope.camera.length} camera source file(s) in ${detail.project} ${counts}: ${changeSubject(detail)}.`;
}

/**
 * 요약의 문장 순서가 계약이다. normalizeCandidate가 summary를 500자에서 자르므로, 잘릴 수 있는
 * 것은 맨 뒤에 와야 한다. 예전에는 파일 목록이 가운데 있고 Change-Id·리비전이 뒤에 있었는데,
 * 저장소 경로를 붙이면서 2개 파일짜리 변경도 521자가 되어 리비전 SHA가 통째로 잘렸다(실측).
 * 그래서 정체성(Change-Id, 리비전)과 상태·리뷰 판정을 앞에 두고, 길이가 변하는 파일 목록만
 * 뒤에 남긴다. 잘리더라도 잃는 것은 파일 이름 몇 개뿐이다.
 */
function buildSummary(detail, scope, review, dateInfo, revisionSha) {
  const statusPhrase = detail.status === 'MERGED'
    ? `merged (submitted ${dateInfo.date})`
    : `proposed and not merged (status NEW, created ${dateInfo.date})`;
  const counts = `+${Number(detail.insertions) || 0}/-${Number(detail.deletions) || 0}`;
  return `Gerrit change ${detail._number} on ${detail.project} (branch ${detail.branch}) is ${statusPhrase}. `
    + `Change-Id ${detail.change_id}; current revision ${String(revisionSha).slice(0, 12)}. ${review.phrase} `
    + `It changes ${scope.substantive.length} file(s) ${counts}, of which ${scope.camera.length} are camera paths: `
    + `${fileListPhrase(repositoryPaths(detail.project, scope.camera))}.`;
}

/**
 * 후보 하나를 만든다.
 *
 * MERGED이거나 사람 리뷰(Code-Review)가 붙은 NEW는 등록부의 소스 정책(conditional)을 그대로 따른다.
 * 그 밖의 NEW는 검증 label 표만 있는 것까지 포함해 mainArticlePolicy를 watchlist_only로 내린다. 이 값은
 * source-quality-classifier가 소스 정책보다 우선해 읽으므로, 그 후보는 blocker 없이 blocked가 되고
 * (blocker가 비어 있어 mailing-list 강한-근거 승급도 걸리지 않는다) briefing 재료로만 남는다.
 */
function buildCandidate(source, origin, detail, scope, review, dateInfo, revisionSha) {
  const mainEligible = detail.status === 'MERGED' || review.positive;
  const subject = changeSubject(detail);
  const candidate = {
    source,
    title: `${subject} - ${detail.project}`,
    url: changeUrl(origin, detail.project, detail._number),
    publishedAt: dateInfo.date,
    summary: buildSummary(detail, scope, review, dateInfo, revisionSha),
    sourceKind: 'rss_item',
    collectionMode: 'rss-item',
    parentUrl: source.sourceUrl || source.url,
    parentTitle: source.name,
    api_or_component: cameraComponentLabel(detail.project, scope.camera),
    behavior_change: behaviorChange(detail, scope),
    gerrit_change_id: String(detail.change_id || ''),
    gerrit_change_number: Number(detail._number) || null,
    gerrit_change_status: String(detail.status || ''),
    gerrit_commit_sha: String(revisionSha || ''),
    gerrit_effective_date_field: dateInfo.field
  };
  if (!mainEligible) candidate.mainArticlePolicy = 'watchlist_only';
  return candidate;
}

/**
 * Gerrit /changes 목록 JSON을 받아 카메라 변경 후보를 반환한다.
 *
 * 목록(collector가 이미 받아 둔 `text`)은 상태와 세 날짜만 담고 파일·리뷰는 담지 않는다. 그래서
 * 상태와 수집 창으로 먼저 좁힌 뒤, 남은 변경에만 상세를 건다. 목록 한 페이지(n=100)는 2026-09-02
 * 실측에서 AOSP 약 24개월, ChromeOS 약 22개월을 덮었다 - 35일 창은 그 안에 깊이 들어간다. 그래도
 * 페이지가 창을 다 못 덮으면 조용히 넘기지 않고 알린다(그 상태는 "이번 주 신호 없음"과 산출물에서
 * 똑같이 보인다).
 */
async function resolveGerritCameraChangeItems(text = '', source = {}, options = {}) {
  const changes = parseGerritChangeList(text);
  if (!changes) {
    console.warn('gerrit-camera-changes: source index did not return a Gerrit change array; skipping.');
    return [];
  }
  const fetchTextImpl = options.fetchTextImpl;
  if (typeof fetchTextImpl !== 'function') return [];
  const origin = gerritOrigin(source);
  if (!origin) {
    console.warn('gerrit-camera-changes: source has no parseable sourceUrl origin; skipping.');
    return [];
  }

  const now = options.now instanceof Date ? options.now : new Date();
  const lookbackDays = Number.isFinite(options.lookbackDays) && options.lookbackDays > 0
    ? options.lookbackDays
    : DEFAULT_LOOKBACK_DAYS;
  const cutoffMs = now.getTime() - lookbackDays * DAY_MS;

  // 절단 사실을 console.warn과 진단 이벤트 두 곳에 낸다(#1059). Actions 로그는 커밋되지 않으므로
  // warn만으로는 "창을 다 못 읽었다"와 "이번 주 신호 없음"이 커밋된 산출물에서 같은 모양이 된다.
  // 이 이벤트는 dated_article_collection.events[]에 실려 후보 산출물까지 간다. source_id를 싣는
  // 이유는 이 소스가 fetchClient를 쓰지 않아 리포트의 소스별 표에 행이 생기지 않기 때문이다.
  const emit = typeof options.onDiagnostic === 'function' ? options.onDiagnostic : noop;
  const listUrl = String(source.sourceUrl || source.url || '');
  const announceTruncation = (detail) => emit({
    kind: 'collection_window_truncated',
    url: listUrl,
    receivedBytes: 0,
    limitedBy: '',
    source_id: String(source.id || ''),
    lookback_days: lookbackDays,
    detail
  });

  // 목록은 updated 내림차순이다. 페이지의 가장 오래된 updated가 아직 창 안이면 창을 다 읽지 못한
  // 것이다(effective date는 updated보다 이르거나 같으므로 updated로 경계를 판단할 수 있다).
  const listedUpdateTimes = changes.map(change => gerritTimeMs(change && change.updated)).filter(Number.isFinite);
  if (listedUpdateTimes.length > 0 && Math.min(...listedUpdateTimes) > cutoffMs) {
    console.warn(`gerrit-camera-changes: the ${changes.length}-change list page does not reach back to the `
      + `${lookbackDays}-day window; the collected changes are a lower bound, not the whole window.`);
    announceTruncation(`the ${changes.length}-change list page does not reach back to the ${lookbackDays}-day window; `
      + 'the collected changes are a lower bound, not the whole window');
  }

  const collectable = changes
    .filter(change => hasEligibleState(change))
    .filter(change => !subjectIsNoise(change.subject));

  // 기사로 낼 수 있는 상태인데 날짜 필드가 없으면 그 변경은 여기서 사라진다. 조용히 버리면
  // "이번 주 카메라 신호 없음"과 산출물에서 같은 모양이 되므로(이 리졸버의 다른 포기 경로는 전부
  // 알린다) 소리를 낸다. MERGED인데 submitted가 없는 오래된 변경에서 실제로 일어난다.
  for (const change of collectable.filter(change => effectiveDate(change) === null)) {
    console.warn(`gerrit-camera-changes: change ${change._number} is ${change.status} but carries no usable `
      + `${change.status === 'MERGED' ? 'submitted' : 'created'} timestamp; skipping it rather than dating it from updated.`);
  }

  const inWindow = collectable
    .map(change => ({ change, dateInfo: effectiveDate(change) }))
    .filter(entry => entry.dateInfo !== null)
    .filter(entry => entry.dateInfo.timeMs >= cutoffMs && entry.dateInfo.timeMs <= now.getTime())
    .sort((left, right) => right.dateInfo.timeMs - left.dateInfo.timeMs);

  const targets = inWindow.slice(0, MAX_DETAIL_FETCHES);
  if (inWindow.length > targets.length) {
    console.warn(`gerrit-camera-changes: ${inWindow.length} change(s) are inside the ${lookbackDays}-day window but only `
      + `the newest ${MAX_DETAIL_FETCHES} are read; the remainder is not collected this run.`);
    announceTruncation(`${inWindow.length} change(s) are inside the ${lookbackDays}-day window but only the newest `
      + `${MAX_DETAIL_FETCHES} are read; the remainder is not collected this run`);
  }

  const candidates = [];
  for (const { change } of targets) {
    const url = detailUrl(origin, change._number);
    let detail;
    try {
      detail = parseGerritDetail(await fetchTextImpl(url, DETAIL_FETCH_TIMEOUT_MS));
    } catch (error) {
      console.warn(`gerrit-camera-changes: ${url} fetch failed (${error.message}); skipping change ${change._number}.`);
      continue;
    }
    if (!detail) {
      console.warn(`gerrit-camera-changes: ${url} did not return parseable Gerrit JSON; skipping change ${change._number}.`);
      continue;
    }
    // 상태와 날짜는 상세 응답에서 다시 읽는다. 목록은 스냅숏이고 상세는 그보다 나중이라, 그 사이에
    // 변경이 병합되거나 WIP로 바뀔 수 있다. 목록의 값을 그대로 쓰면 병합된 변경의 요약이 created
    // 날짜를 "submitted"라고 말하고(날짜 필드는 created인 채로) main 승격까지 열린다.
    const detailDate = effectiveDate(detail);
    if (!hasEligibleState(detail) || !detailDate) {
      console.warn(`gerrit-camera-changes: change ${change._number} moved from ${change.status} to `
        + `${detail.status}${detail.work_in_progress === true ? '/WIP' : ''} between the list and detail reads; skipping.`);
      continue;
    }
    const revision = currentRevision(detail);
    if (!revision || !revision.info.files) {
      console.warn(`gerrit-camera-changes: change ${change._number} detail carries no current revision file list; skipping.`);
      continue;
    }
    const scope = cameraFileScope(detail.project, Object.keys(revision.info.files));
    if (!scope.isCameraChange) continue;
    candidates.push(buildCandidate(
      source, origin, detail, scope, reviewSignals(detail.labels), detailDate, revision.sha
    ));
  }
  return candidates;
}

module.exports = {
  MAX_DETAIL_FETCHES,
  MIN_LIST_PAGE_SIZE,
  cameraFileScope,
  effectiveDate,
  hasEligibleState,
  resolveGerritCameraChangeItems,
  reviewSignals,
  subjectIsNoise
};
