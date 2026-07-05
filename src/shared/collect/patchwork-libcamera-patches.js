// patchwork.libcamera.org는 libcamera 프로젝트의 patch-review를 REST API(/api/patches/)로 노출한다.
// 각 patch 객체는 실제 제출 date(ISO)를 가지므로 dated 후보를 만들 수 있다(docs.kernel.org처럼
// 날짜가 없는 소스와 대조). 응답은 bare JSON 배열이라 parseRss/parseHtmlPage가 못 읽어
// followed-source 리졸버로 직접 파싱한다.
//
// patch-review는 dev churn이 많으므로 여기서는 dated 후보만 만들고, 카메라 관련성 판정은 분류기
// (aosp-camera-scope)에, main 승급은 mailing-list cross-check 게이트(mailing-list-patch-eligibility)에
// 맡긴다. 두 가지를 의도적으로 하지 않는다: (1) relevanceBucketHint를 강제하지 않는다 — 제목이
// 카메라 근거를 가질 때만 분류기가 카메라 버킷으로 올린다. (2) summary에 카메라/스코어링 키워드를
// 넣지 않는다 — technicalDepth는 제목+summary를 읽으므로, summary가 키워드를 주입하면 docs/build
// 같은 churn 패치까지 technicalDepth 하한을 넘어 main 슬롯 승급 대상이 되어버린다. summary는
// 중립으로 두고 실제 patch 제목만 technicalDepth를 결정하게 한다.

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function patchCandidate(patch, source) {
  if (!patch || typeof patch !== 'object') return null;
  const title = String(patch.name || '').replace(/\s+/g, ' ').trim();
  const url = String(patch.web_url || '').trim();
  const publishedAt = String(patch.date || '').slice(0, 10);
  if (!title || !url || !DATE_ONLY_PATTERN.test(publishedAt)) return null;

  const submitterName = patch.submitter && typeof patch.submitter === 'object'
    ? String(patch.submitter.name || '').replace(/\s+/g, ' ').trim()
    : '';
  const submittedBy = submitterName ? ` (submitted by ${submitterName})` : '';
  const state = String(patch.state || 'new').replace(/\s+/g, ' ').trim();
  const summary = `Patch under review on the project patch tracker${submittedBy}; `
    + `state ${state}, a proposed change not yet landed.`;

  return {
    source,
    title,
    url,
    publishedAt,
    summary,
    sourceKind: 'rss_item',
    collectionMode: 'rss-item',
    parentUrl: source.sourceUrl || source.url,
    parentTitle: source.name
  };
}

/**
 * patchwork REST API의 patch 목록 JSON 텍스트를 받아 dated 후보 배열을 반환한다.
 * 최상위가 JSON 배열이 아니거나 파싱에 실패하면(에러 객체 응답 포함) 빈 배열을 반환하고,
 * date나 web_url이 없는 patch는 건너뛴다(graceful).
 */
function resolvePatchworkLibcameraPatchItems(text = '', source = {}) {
  let patches;
  try {
    patches = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(patches)) return [];
  return patches.map(patch => patchCandidate(patch, source)).filter(Boolean);
}

module.exports = {
  resolvePatchworkLibcameraPatchItems
};
