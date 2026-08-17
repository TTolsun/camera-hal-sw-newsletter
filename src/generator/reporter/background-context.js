const { ensureArray } = require('../../shared/common/value-coercion');
const { normalizeUrl } = require('../../shared/common/article-groups');
const {
  buildStaticBackgroundContext
} = require('./article-field-builder');

function text(value) {
  return String(value || '').trim();
}

function capsuleItems(capsuleReport = {}) {
  return [
    ...ensureArray(capsuleReport.selected_capsules),
    ...ensureArray(capsuleReport.reserve_capsules),
    ...ensureArray(capsuleReport.shortlisted_capsules)
  ];
}

function stableUniqueItems(items) {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = text(item.url || item.source_candidate_url || item.url_hash || item.source_candidate_hash);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function buildStaticBackgroundContextReport(date, capsuleReport = {}) {
  const contexts = stableUniqueItems(capsuleItems(capsuleReport)).map(capsule => ({
    title: text(capsule.title),
    url: text(capsule.url),
    source_candidate_hash: text(capsule.source_candidate_hash || capsule.url_hash),
    relevance_bucket: text(capsule.relevance_bucket),
    background_context: text(capsule.background_context_static) ||
      buildStaticBackgroundContext(capsule),
    background_basis: 'supplied article capsule metadata 기반 deterministic static fallback',
    background_confidence: 'medium',
    background_warnings: ensureArray(capsule.behavior_cleaning?.warnings)
  }));
  return {
    schema_version: 1,
    date,
    generated_at: new Date().toISOString(),
    stage: 'static-fallback',
    background_contexts: contexts
  };
}

// #908: coverage 재조정이 main 편성을 줄인 뒤, 재조정 전 편성으로 만들어진 background context를
// 그대로 editor에 넘기면 editor가 이미 main에서 빠진 기사까지 다뤄야 할 대상으로 보고
// explicitly_demoted_groups에 선언한다. 그 선언은 선택 집합 밖이라 커버리지 등식을 깨뜨린다.
// 식별자는 article-groups의 normalizeUrl(anchor 보존)을 그대로 쓴다 — 커버리지 게이트가 그룹 키를
//만들 때 쓰는 것과 같은 기준이어야 CameraX 릴리스처럼 anchor만 다른 항목이 뭉개지지 않는다.
function selectionIdentityKeys(selectedCandidates = []) {
  const keys = new Set();
  for (const candidate of ensureArray(selectedCandidates)) {
    const url = normalizeUrl(text(candidate.url || candidate.source_candidate_url));
    if (url) keys.add(`url:${url}`);
    const hash = text(candidate.source_candidate_hash || candidate.url_hash);
    if (hash) keys.add(`hash:${hash}`);
  }
  return keys;
}

function filterBackgroundContextToSelected(report = {}, selectedCandidates = []) {
  const keys = selectionIdentityKeys(selectedCandidates);
  return {
    ...report,
    background_contexts: ensureArray(report.background_contexts).filter(item => {
      const url = normalizeUrl(text(item?.url));
      const hash = text(item?.source_candidate_hash);
      return Boolean((url && keys.has(`url:${url}`)) || (hash && keys.has(`hash:${hash}`)));
    })
  };
}

module.exports = {
  buildStaticBackgroundContextReport,
  filterBackgroundContextToSelected
};
