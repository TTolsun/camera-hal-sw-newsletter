// 결정론적 '참고 / 더 읽을거리' 섹션 데이터 빌더.
// selection이 만든 후보 중 적격 버킷 + dated + sourced 항목만 골라 메인 기사와 중복을 제거하고
// 상한까지 만든다. LLM이 아니라 결정론 코드가 만들어, editor claim-binding 실패 경로를 피한다.
// 입력은 특정 창으로 한정되지 않는다: reference 창 후보와 함께 main 경쟁에서 선정되지 않은
// shortlist(primary/fallback 창) 후보도 받는다. 어느 창에서 왔는지가 아니라 버킷·증거 조건으로
// 거른다. 다만 상한을 채우는 순서는 창을 먼저 본다(아래 정렬 주석).
const { BUCKETS, BUCKET_PRIORITY } = require('../../shared/domain/aosp-camera-scope');
const { excludeParentRoundupContainers } = require('../../shared/common/article-groups');
const { isCoverageWeekWindow } = require('../../shared/common/coverage-week');
const { displayDate } = require('../../shared/common/date-signals');
const { normalizeUrl } = require('../../shared/common/selection-normalizers');
const { ensureArray } = require('../../shared/common/value-coercion');

// generic_tech_watchlist를 뺀 모든 도메인 버킷이 참고 섹션 적격이다.
// 도메인 enum에서 파생해 버킷이 바뀌어도 동기화가 유지되도록 한다.
const REFERENCE_BUCKETS = new Set(
  Object.values(BUCKETS).filter(bucket => bucket !== BUCKETS.GENERIC_TECH_WATCHLIST)
);

const BUCKET_NOTE = {
  [BUCKETS.DIRECT_AOSP_CAMERA]: 'AOSP Camera 프레임워크 관련 참고',
  [BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE]: '카메라 드라이버 / 이미지 파이프라인 참고',
  [BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT]: 'Android 플랫폼 · 카메라 인접 주제 참고',
  [BUCKETS.ANDROID_MULTIMEDIA_CAMERA_OUTPUT]: '미디어 / 카메라 출력 관련 참고',
  [BUCKETS.SOC_PLATFORM_SIGNAL]: 'SoC 플랫폼 신호 참고',
  [BUCKETS.CPP_AI_TOOLING_FALLBACK]: 'C++ / AI 네이티브 툴링 참고'
};

const DEFAULT_LIMIT = 4;

function pick(candidate, ...keys) {
  for (const key of keys) {
    const value = candidate[key];
    if (value != null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

function isHttpUrl(value) {
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function candidateBucket(candidate) {
  return pick(candidate, 'relevance_bucket', 'topic_bucket');
}

function publishedTime(candidate) {
  const parsed = Date.parse(pick(candidate, 'published_date', 'publishedAt'));
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

// 참고 섹션 표시 날짜가 만들어지는 유일한 지점이다. markdown·HTML 두 렌더 경로는 이 값을
// 가공 없이 그대로 찍으므로, 원문 표기를 여기서 맞춰야 두 경로가 함께 맞는다.
// 소스마다 원문 표기가 다르다(ISO 타임스탬프 / 'July 01, 2026' / RSS pubDate). 그대로 두면
// 한 목록 안에서 정밀도가 뒤섞인다(실측 2026-08-03호: 'July 01, 2026' 바로 다음 줄이
// '2026-07-10T11:12:38+01:00'). displayDate로 YYYY-MM-DD 하나로 통일한다.
// month 정밀도 후보(AOSP Site Updates의 월별 묶음 행)는 그 달 어느 날인지 모르는 채 날짜가
// 달의 1일로 채워져 있다. 그대로 렌더링하면 'July 2026'만 아는 신호를 '2026-07-01'이라는
// 더 높은 정밀도로 발행하게 된다. 아는 만큼만(YYYY-MM) 표기한다.
function displayPublishedDate(candidate) {
  const display = displayDate(pick(candidate, 'published_date', 'publishedAt'));
  const precision = pick(candidate, 'date_precision', 'datePrecision').toLowerCase();
  // displayDate는 '' 아니면 YYYY-MM-DD만 돌려주므로 앞 7자가 곧 YYYY-MM이다.
  return precision === 'month' ? display.slice(0, 7) : display;
}

// 커버리지 주 안인가. 후보의 freshness_window는 select/newsroom-selection.js의
// freshnessWindowMetadata가 붙이고, 그 등급을 만드는 정본은 coverage-week.js의
// classifyCoverageWindow다. 등급 리터럴을 여기서 다시 적으면 정본이 등급을 추가·개명했을 때
// render만 조용히 "창 밖"으로 판정하므로, 정본이 export하는 술어를 그대로 쓴다.
// 여기서 나이를 다시 재지 않는다.
function isWithinCoverageWeek(candidate) {
  return isCoverageWeekWindow(pick(candidate, 'freshness_window'));
}

// 상한(DEFAULT_LIMIT)까지만 담기 때문에 정렬 순서가 곧 노출 순서다.
// 창 안(primary) → 버킷 우선순위 → 최신 날짜 → 입력 순서로 안정 정렬한다.
//
// 버킷 우선순위를 최신성 앞에 둔 것은 2026-08-10 결정이다. 받은 순서대로 담으면 카메라
// 관련도가 가장 높은 direct_aosp_camera 항목이 뒤로 밀려 잘렸다(실측 2026-08-10: AOSP
// Camera ITS 문서 갱신 2건이 lore 센서 패치들에 밀려 잘림). 그 결정은 그대로 살아 있다.
//
// 그 위에 "창 안" 항을 얹는 이유는 상위 계약이 "주간호는 그 주를 다룬다"이기 때문이다.
// 버킷 우선순위만으로 채우면 커버리지 주 밖 항목이 먼저 자리를 차지한다 — 실측 2026-08-24호
// (커버리지 주 08-17~08-23): 참고 4칸 중 3칸이 창 밖이었다(CameraX 08-12, ITS 문서 2건 2026-07).
// 창 항을 맨 앞에 둬도 버킷 우선순위는 폐기되지 않고 적용 범위만 좁아진다. 창 안 집합 안에서,
// 그리고 창 밖 집합 안에서 각각 그대로 작동한다. 대가는 창 안 후보만으로 상한이 차는 주에는
// 창 밖 ITS 문서류가 다시 잘린다는 것이고, 이 대가는 render 테스트에 잠겨 있다.
function byCoverageWeekThenBucketPriority(candidates) {
  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((left, right) => {
      const leftPriority = BUCKET_PRIORITY[candidateBucket(left.candidate)] ?? Number.MAX_SAFE_INTEGER;
      const rightPriority = BUCKET_PRIORITY[candidateBucket(right.candidate)] ?? Number.MAX_SAFE_INTEGER;
      return (isWithinCoverageWeek(right.candidate) ? 1 : 0) - (isWithinCoverageWeek(left.candidate) ? 1 : 0) ||
        leftPriority - rightPriority ||
        publishedTime(right.candidate) - publishedTime(left.candidate) ||
        left.index - right.index;
    })
    .map(entry => entry.candidate);
}

// 참고 섹션도 발행물의 링크다. catch-up 레인이 reference 후보를 승급할 때 쓰는 것과 같은
// 하한을 적용해, 증거가 약해 main에서 막힌 후보(source_gap_risk / main_article_score_eligible)를
// 링크로만 우회 노출하지 않는다.
function meetsReferenceEvidenceFloor(candidate) {
  return candidate.main_article_score_eligible !== false && candidate.source_gap_risk !== true;
}

/**
 * shortlistReport에서 참고 섹션 후보 풀을 조립한다.
 * 선정되지 않은 shortlist 후보와 reference 창 후보를 함께 보되, selection이 "기사 source로
 * 쓰면 안 되는 묶음글 컨테이너"로 판정한 후보는 main과 같은 단일 출처 헬퍼로 뺀다.
 */
function referenceArticleCandidatePool(shortlistReport = {}) {
  const combined = [
    ...ensureArray(shortlistReport.shortlisted_candidates),
    ...ensureArray(shortlistReport.reference_context_candidates)
  ].filter(candidate => candidate && typeof candidate === 'object' && meetsReferenceEvidenceFloor(candidate));
  return excludeParentRoundupContainers(combined).kept;
}

/**
 * 참고 섹션에서 빼야 할 URL 목록.
 * 현재 main 집합과 강등 기록을 모두 본다 — 강등 기록이 render보다 먼저 채워진다는 실행 순서에
 * 기대지 않는다.
 * 다만 demoted_candidates가 모든 강등을 담지는 않는다. 여기에 실리는 것은 attempt 루프에서
 * 떨어진 섹션뿐이고(orchestrator-finalize.js), LLM coverage 재조정으로 main에서 빠진 후보는
 * 어디에도 남지 않는다 — gemini-newsroom-newsletter.js는 생존자만 selected_articles에 되쓰고,
 * coverage-reconciliation.json의 강등 기록은 candidate_key만 담고 커밋되지도 않는다.
 * 그래서 재조정으로 빠진 후보는 참고 풀에 다시 들어와 상한을 두고 경쟁한다. 이건 선재 동작이고
 * 이 모듈이 고칠 수 있는 범위 밖이지만, 정렬이 무엇을 줄 세우는지 오해하지 않도록 적어 둔다.
 */
function referenceArticleExcludeUrls(shortlistReport = {}) {
  return [
    ...ensureArray(shortlistReport.selected_articles),
    ...ensureArray(shortlistReport.demoted_candidates)
  ]
    .map(item => item && (item.url || item.article_url))
    .filter(Boolean);
}

function buildReferenceArticles(candidates = [], options = {}) {
  const limit = Number.isFinite(options.limit) ? Math.max(0, options.limit) : DEFAULT_LIMIT;
  const excluded = new Set((Array.isArray(options.excludeUrls) ? options.excludeUrls : []).map(normalizeUrl));
  const seen = new Set();
  const items = [];
  const usable = (Array.isArray(candidates) ? candidates : [])
    .filter(candidate => candidate && typeof candidate === 'object');

  for (const candidate of byCoverageWeekThenBucketPriority(usable)) {
    if (items.length >= limit) break;

    const bucket = candidateBucket(candidate);
    if (!REFERENCE_BUCKETS.has(bucket)) continue;

    const url = pick(candidate, 'url', 'article_url', 'sourceUrl');
    const title = pick(candidate, 'title');
    const source = pick(candidate, 'source_name', 'source');
    const publishedDate = displayPublishedDate(candidate);
    if (!url || !title || !source || !publishedDate || !isHttpUrl(url)) continue;

    const key = normalizeUrl(url);
    if (!key || excluded.has(key) || seen.has(key)) continue;
    seen.add(key);

    items.push({
      title,
      url,
      source,
      published_date: publishedDate,
      note: BUCKET_NOTE[bucket] || '참고 자료'
    });
  }

  return items;
}

/**
 * 참고 섹션 데이터를 shortlistReport 하나에서 끝까지 만든다.
 * 발행 파이프라인은 이 함수만 부른다 — 풀 조립·제외·상한·정렬 규칙이 호출부로 새면
 * 배선을 되돌려도 단위 테스트가 전부 통과하는 상태가 된다(2026-08-11 리뷰 지적).
 */
function buildReferenceArticlesForIssue(shortlistReport = {}, options = {}) {
  return buildReferenceArticles(referenceArticleCandidatePool(shortlistReport), {
    ...options,
    excludeUrls: referenceArticleExcludeUrls(shortlistReport)
  });
}

module.exports = {
  buildReferenceArticles,
  buildReferenceArticlesForIssue,
  referenceArticleCandidatePool,
  referenceArticleExcludeUrls
};
