// 결정론적 '참고 / 더 읽을거리' 섹션 데이터 빌더.
// selection이 만든 후보 중 적격 버킷 + dated + sourced 항목만 골라 메인 기사와 중복을 제거하고
// 상한까지 만든다. LLM이 아니라 결정론 코드가 만들어, editor claim-binding 실패 경로를 피한다.
// 입력은 특정 창으로 한정되지 않는다: reference 창 후보와 함께 main 경쟁에서 선정되지 않은
// shortlist(primary/fallback 창) 후보도 받는다. 어느 창에서 왔는지가 아니라 버킷·증거 조건으로
// 거른다.
const { BUCKETS, BUCKET_PRIORITY } = require('../../shared/domain/aosp-camera-scope');
const { excludeParentRoundupContainers } = require('../../shared/common/article-groups');
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

// 상한(DEFAULT_LIMIT)까지만 담기 때문에 정렬 순서가 곧 노출 순서다. 받은 순서대로 담으면
// 카메라 관련도가 가장 높은 direct_aosp_camera 항목이 뒤로 밀려 잘리고(실측 2026-08-10:
// AOSP Camera ITS 문서 갱신 2건이 lore 센서 패치들에 밀려 잘림), 같은 버킷 안에서는 오래된
// reference 창 항목이 이번 주 항목보다 먼저 자리를 차지한다.
// 도메인이 이미 정의한 버킷 우선순위 → 최신 날짜 → 입력 순서로 안정 정렬한다.
function byBucketPriorityThenRecency(candidates) {
  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((left, right) => {
      const leftPriority = BUCKET_PRIORITY[candidateBucket(left.candidate)] ?? Number.MAX_SAFE_INTEGER;
      const rightPriority = BUCKET_PRIORITY[candidateBucket(right.candidate)] ?? Number.MAX_SAFE_INTEGER;
      return leftPriority - rightPriority ||
        publishedTime(right.candidate) - publishedTime(left.candidate) ||
        left.index - right.index;
    })
    .map(entry => entry.candidate);
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
  ].filter(candidate => candidate && typeof candidate === 'object');
  return excludeParentRoundupContainers(combined).kept;
}

/**
 * 참고 섹션에서 빼야 할 URL 목록.
 * 발행된 main 기사뿐 아니라 강등된 후보도 뺀다 — 강등 기록이 render보다 먼저 채워진다는
 * 실행 순서에 기대지 않고, 두 목록을 모두 보고 판단한다.
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

  for (const candidate of byBucketPriorityThenRecency(usable)) {
    if (items.length >= limit) break;

    const bucket = candidateBucket(candidate);
    if (!REFERENCE_BUCKETS.has(bucket)) continue;

    const url = pick(candidate, 'url', 'article_url', 'sourceUrl');
    const title = pick(candidate, 'title');
    const source = pick(candidate, 'source_name', 'source');
    const publishedDate = pick(candidate, 'published_date', 'publishedAt');
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

module.exports = {
  buildReferenceArticles,
  referenceArticleCandidatePool,
  referenceArticleExcludeUrls
};
