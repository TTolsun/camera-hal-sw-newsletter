// 결정론적 '참고 / 더 읽을거리' 섹션 데이터 빌더.
// selection이 이미 만든 reference_context_candidates(22~90일 reference 윈도우)에서
// 적격 버킷 + dated + sourced 항목만 골라 메인 기사와 중복을 제거하고 상한까지 만든다.
// LLM이 아니라 결정론 코드가 만들어, editor claim-binding 실패 경로를 피한다.
const { BUCKETS } = require('../../core/domain/aosp-camera-scope');
const { normalizeUrl } = require('../select/selection-normalizers');

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

function buildReferenceArticles(referenceCandidates = [], options = {}) {
  const limit = Number.isFinite(options.limit) ? Math.max(0, options.limit) : DEFAULT_LIMIT;
  const excluded = new Set((Array.isArray(options.excludeUrls) ? options.excludeUrls : []).map(normalizeUrl));
  const seen = new Set();
  const items = [];

  for (const candidate of Array.isArray(referenceCandidates) ? referenceCandidates : []) {
    if (!candidate || typeof candidate !== 'object') continue;
    if (items.length >= limit) break;

    const bucket = pick(candidate, 'relevance_bucket', 'topic_bucket');
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
  buildReferenceArticles
};
