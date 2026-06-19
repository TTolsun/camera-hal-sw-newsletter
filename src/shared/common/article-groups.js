const { ensureArray } = require('./value-coercion');
const ANDROID_NATIVE_TOOLING_GROUP_KEY = 'android_native_tooling_workflow';
const NATIVE_TOOLING_WORKFLOW_TYPE = 'native_tooling_workflow';

const CONTEXT_LABELS = Object.freeze({
  ALLOWED_SUPPORTING_CONTEXT: 'allowed_supporting_context',
  BLOCKED_CONTEXT_REFERENCE: 'blocked_context_reference',
  PARENT_ROUNDUP_CONTEXT_ONLY: 'parent_roundup_context_only',
  DEDUPE_SHADOW_CONTEXT: 'dedupe_shadow_context'
});

const EXPLICIT_DEMOTION_REASON_CODES = Object.freeze([
  'duplicate_or_near_duplicate',
  'forbidden_bucket',
  'explicit_editor_hold'
]);

const HARD_BLOCK_REASON_CODES = Object.freeze([
  'source_gap_risk',
  'missing_dated_evidence',
  'blocked_source_quality',
  'fact_check_must_fix',
  'quality_hard_blocker'
]);

const FORBIDDEN_SOURCE_READY_NATIVE_DEMOTION_REASONS = Object.freeze([
  'camera_runtime_directness_insufficient',
  'fallback_bucket',
  'supporting_only',
  'not_primary_camera_stack'
]);

function text(value) {
  return String(value || '').trim();
}

function normalizeCode(value) {
  return text(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function bool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function normalizeSourceUrlPreserveAnchor(value) {
  const raw = text(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    parsed.search = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.pathname = parsed.pathname.replace(/\/$/, '') || '/';
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return raw.replace(/[?].*$/, '').replace(/\/$/, '').toLowerCase();
  }
}

function normalizeCanonicalUrlStripAnchor(value) {
  const raw = text(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    parsed.search = '';
    parsed.hash = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.pathname = parsed.pathname.replace(/\/$/, '') || '/';
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return raw.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
  }
}

const normalizeUrl = normalizeSourceUrlPreserveAnchor;

function candidateUrl(candidate = {}) {
  return text(candidate.url || candidate.article_url || candidate.articleUrl || candidate.normalized_url);
}

function candidateTitle(candidate = {}) {
  return text(candidate.title || candidate.headline || candidate.category);
}

function isNativeToolingWorkflow(candidate = {}) {
  return text(candidate.tooling_workflow_type || candidate.toolingWorkflowType) === NATIVE_TOOLING_WORKFLOW_TYPE ||
    (
      text(candidate.relevance_bucket || candidate.relevanceBucket) === 'cpp_ai_tooling_fallback' &&
      text(candidate.article_group_key || candidate.articleGroupKey) === ANDROID_NATIVE_TOOLING_GROUP_KEY
    );
}

// lore.kernel.org 패치 시리즈는 cover letter + 각 패치가 서로 다른 message-id URL과 title로
// 도착한다. 같은 시리즈는 하나의 main 기사로 묶여야 하므로, message-id에서 시리즈 식별자를
// 뽑아 patch 번호만 떼어낸 공통 키를 만든다. 실제 데이터에서 관찰된 2가지 형식만 다룬다(YAGNI).
//   NEW-style: 20260529-glymur_camss-v1-0-bee535396d22@oss.qualcomm.com
//              => base="...-v1", patch="0", tail="bee535396d22@oss.qualcomm.com"
//              버전 토큰(-v<N>)은 선택적이다. 첫 버전을 b4/git-send-email로 보낼 때
//              20260529-glymur_camss-0-bee535396d22@oss.qualcomm.com 처럼 버전 없이 오기도 한다.
//   OLD-style: 20260527170531.383871-1-miguel.vadillo@intel.com
//              => base="20260527170531.383871", patch="1", from="miguel.vadillo@intel.com"
// 시리즈가 아니면(UUID/랜덤 message-id, 리스트 페이지) '' 를 돌려 기존 키 로직을 쓰게 한다.
const LORE_HOST = 'lore.kernel.org';
// b4/git-send-email date-slug 메시지ID: <YYYYMMDD>-<slug...>[-v<버전>]-<패치번호>-<hex해시>@<호스트>
// hex 해시@호스트 꼬리로 끝을 고정해, 버전 토큰 유무와 무관하게 시리즈를 묶고
// old-style(<날짜시각>.<pid>-...)·UUID(8자리 비-숫자 시작) 메시지ID는 매칭하지 않는다.
const LORE_NEW_STYLE = /^(\d{8}-.+?)-(\d+)-([0-9a-f]{6,}@\S+)$/;
// (8자리 이상 날짜시각.PID) + '-' + (패치번호) + '-' + (보낸사람)
const LORE_OLD_STYLE = /^(\d{8,}\.\d+)-(\d+)-(.+)$/;
const UNKNOWN_PATCH_NUMBER = Number.POSITIVE_INFINITY;

function loreMessageIdFromUrl(raw) {
  if (!raw) return '';
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return '';
  }
  if (parsed.hostname.toLowerCase() !== LORE_HOST) return '';
  const segments = parsed.pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  if (!last) return '';
  return decodeURIComponent(last);
}

function loreMessageId(candidate = {}) {
  return loreMessageIdFromUrl(candidateUrl(candidate));
}

function loreSeriesPartsFromMessageId(messageId) {
  if (!messageId) return null;
  const newStyle = messageId.match(LORE_NEW_STYLE);
  if (newStyle) {
    return { key: `lore-series:${newStyle[1]}-${newStyle[3]}`, patch: Number(newStyle[2]) };
  }
  const oldStyle = messageId.match(LORE_OLD_STYLE);
  if (oldStyle) {
    return { key: `lore-series:${oldStyle[1]}-${oldStyle[3]}`, patch: Number(oldStyle[2]) };
  }
  return null;
}

function replyParentUrl(candidate = {}) {
  return text(candidate.in_reply_to || candidate.inReplyTo || candidate.in_reply_to_url || candidate.inReplyToUrl);
}

function loreSeriesParts(candidate = {}) {
  const own = loreSeriesPartsFromMessageId(loreMessageId(candidate));
  if (own) return own;
  // 패치 시리즈의 답장(Re:)은 자체 message-id가 시리즈를 인코딩하지 않는다. atom thr:in-reply-to가
  // 가리키는 부모 패치 URL의 message-id에서 시리즈 키를 끌어와 같은 시리즈 그룹에 묶는다.
  const parentParts = loreSeriesPartsFromMessageId(loreMessageIdFromUrl(replyParentUrl(candidate)));
  if (parentParts) {
    return { key: parentParts.key, patch: UNKNOWN_PATCH_NUMBER };
  }
  return null;
}

// lore 패치 시리즈 조각 URL을 thread view(.../T/#t) URL로 바꾼다. thread view는 cover letter(0/N)부터
// 시리즈 전체(개별 패치 포함)를 보여주므로, 기사 source(개별 패치)는 그대로 두고 독자에게 전체 시리즈
// 맥락을 주는 보조 링크로 쓴다. lore 시리즈 조각이 아니면 ''을 반환한다(보조 링크 미표시).
function loreThreadUrl(url) {
  const messageUrl = text(url);
  if (!messageUrl) return '';
  if (!loreSeriesPartsFromMessageId(loreMessageIdFromUrl(messageUrl))) return '';
  // raw 문자열에 '/T/#t'를 붙이면 URL의 query(?…)나 fragment(#related 등)가 있을 때 thread 경로가
  // 그 안으로 들어가 thread view가 아닌 같은 패치로 풀린다(실데이터에 #related 프래그먼트 존재).
  // parsed origin+pathname(query·fragment 제거)에 붙여 정규 thread URL을 만든다.
  let parsed;
  try {
    parsed = new URL(messageUrl);
  } catch (_) {
    return '';
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}/T/#t`;
}

function loreSeriesKey(candidate = {}) {
  const parts = loreSeriesParts(candidate);
  return parts ? parts.key : '';
}

function loreSeriesPatchNumber(candidate = {}) {
  const parts = loreSeriesParts(candidate);
  return parts ? parts.patch : UNKNOWN_PATCH_NUMBER;
}

function fallbackGroupKey(candidate = {}) {
  const seriesKey = loreSeriesKey(candidate);
  if (seriesKey) return seriesKey;
  const key = normalizeUrl(candidateUrl(candidate)) || candidateTitle(candidate);
  return key ? `article:${key}` : '';
}

function candidateGroupKey(candidate = {}) {
  const explicit = text(candidate.article_group_key || candidate.articleGroupKey);
  if (explicit) return explicit;
  if (isNativeToolingWorkflow(candidate)) return ANDROID_NATIVE_TOOLING_GROUP_KEY;
  return fallbackGroupKey(candidate);
}

function candidateContextLabel(candidate = {}, options = {}) {
  if (options.parentRoundup === true || text(candidate.context_role) === CONTEXT_LABELS.PARENT_ROUNDUP_CONTEXT_ONLY) {
    return CONTEXT_LABELS.PARENT_ROUNDUP_CONTEXT_ONLY;
  }
  if (options.dedupeShadow === true || text(candidate.context_role) === CONTEXT_LABELS.DEDUPE_SHADOW_CONTEXT) {
    return CONTEXT_LABELS.DEDUPE_SHADOW_CONTEXT;
  }
  const eligibility = text(candidate.finalSelectionEligibility || candidate.final_selection_eligibility);
  const sourceAllowed = candidate.main_article_source_allowed === true || candidate.mainArticleSourceAllowed === true;
  const contextAllowed = candidate.context_usage_allowed === true || candidate.contextUsageAllowed === true;
  const rawSourceQualityStatus = text(candidate.source_quality_status || candidate.sourceQualityStatus);
  const sourceQualityStatus = rawSourceQualityStatus || (contextAllowed ? 'allowed' : 'unknown');
  const blocked = bool(candidate.source_gap_risk) ||
    bool(candidate.reference_only) ||
    bool(candidate.briefing_only) ||
    sourceQualityStatus === 'blocked' ||
    sourceQualityStatus === 'unknown';

  if ((contextAllowed || (['main', 'short'].includes(eligibility) && sourceAllowed)) && !blocked) {
    return CONTEXT_LABELS.ALLOWED_SUPPORTING_CONTEXT;
  }
  return CONTEXT_LABELS.BLOCKED_CONTEXT_REFERENCE;
}

function blockedReason(candidate = {}, label = '') {
  if (label === CONTEXT_LABELS.PARENT_ROUNDUP_CONTEXT_ONLY) return 'parent_roundup_context_only';
  if (label === CONTEXT_LABELS.DEDUPE_SHADOW_CONTEXT) return 'dedupe_shadow_context';
  if (bool(candidate.source_gap_risk)) return 'source_gap_risk';
  if (bool(candidate.reference_only)) return 'reference_only';
  if (bool(candidate.briefing_only)) return 'watchlist_only';
  const eligibility = text(candidate.finalSelectionEligibility || candidate.final_selection_eligibility);
  if (eligibility && !['main', 'short'].includes(eligibility)) return `${eligibility}_only`;
  const contextAllowed = candidate.context_usage_allowed === true || candidate.contextUsageAllowed === true;
  const rawSourceQualityStatus = text(candidate.source_quality_status || candidate.sourceQualityStatus);
  const sourceQualityStatus = rawSourceQualityStatus || (contextAllowed ? 'allowed' : 'unknown');
  if (sourceQualityStatus === 'blocked' || sourceQualityStatus === 'unknown') {
    return `source_quality_${sourceQualityStatus}`;
  }
  return 'tooling_context_only';
}

function contextUsageAllowed(label) {
  return label === CONTEXT_LABELS.ALLOWED_SUPPORTING_CONTEXT;
}

function compactContextCandidate(candidate = {}, options = {}) {
  const label = candidateContextLabel(candidate, options);
  const allowed = contextUsageAllowed(label);
  const rawSourceQualityStatus = text(candidate.source_quality_status || candidate.sourceQualityStatus);
  const sourceQualityStatus = rawSourceQualityStatus || (allowed ? 'allowed' : 'unknown');
  const sourceUrl = candidateUrl(candidate);
  return {
    title: candidateTitle(candidate),
    url: sourceUrl,
    normalized_url: normalizeSourceUrlPreserveAnchor(sourceUrl),
    canonical_url: normalizeCanonicalUrlStripAnchor(sourceUrl),
    source: text(candidate.source || candidate.source_name),
    published_date: text(candidate.published_date || candidate.publishedAt || candidate.published_at),
    relevance_bucket: text(candidate.relevance_bucket),
    finalSelectionEligibility: text(candidate.finalSelectionEligibility || candidate.final_selection_eligibility),
    context_role: label,
    context_usage_label: label,
    source_quality_status: sourceQualityStatus,
    context_usage_allowed: allowed,
    can_create_independent_article: false,
    blocked_from_independent_main_reason: blockedReason(candidate, label),
    article_group_key: candidateGroupKey(candidate)
  };
}

function parentRoundupContext(candidate = {}) {
  const parentUrl = text(candidate.parentUrl || candidate.parent_url);
  if (!parentUrl) return null;
  return compactContextCandidate({
    title: text(candidate.parentTitle || candidate.parent_title) || 'Parent roundup',
    url: parentUrl,
    source: text(candidate.source || candidate.source_name),
    relevance_bucket: text(candidate.relevance_bucket),
    finalSelectionEligibility: 'exclude',
    source_quality_status: 'unknown',
    article_group_key: candidateGroupKey(candidate)
  }, { parentRoundup: true });
}

// parent-roundup 컨테이너 페이지가 standalone main으로 선택되는 것을 막는다. 같은 선택 집합 안에서
// 어떤 후보의 URL이 다른 후보의 parent_roundup_context_only context(=그 후보의 부모 묶음글)와 같으면,
// 그 후보는 기사가 아니라 컨테이너다. 컨테이너를 main에서 빼면(reserve로 남음) editor가 묶음글 URL을
// 기사 source로 쓰다 blocked_context로 막히는 일을 애초에 없앤다. 개별 기사(자식)는 그대로 둔다.
function excludeParentRoundupContainers(selected = []) {
  // anchor를 보존해 매칭한다. roundup 컨테이너 URL(보통 anchor 없음)만 잡고, 같은 페이지의
  // 자식 기사(page#child-... 처럼 anchor가 다름)는 컨테이너로 오인해 제외하지 않기 위함이다.
  const parentRoundupUrls = new Set();
  for (const candidate of ensureArray(selected)) {
    for (const context of ensureArray(candidate.related_context_candidates)) {
      const role = text(context.context_role || context.context_usage_label);
      if (role !== CONTEXT_LABELS.PARENT_ROUNDUP_CONTEXT_ONLY) continue;
      const url = normalizeSourceUrlPreserveAnchor(context.url || context.normalized_url);
      if (url) parentRoundupUrls.add(url);
    }
  }
  if (parentRoundupUrls.size === 0) {
    return { kept: ensureArray(selected), demoted: [] };
  }
  const kept = [];
  const demoted = [];
  for (const candidate of ensureArray(selected)) {
    const ownUrl = normalizeSourceUrlPreserveAnchor(candidateUrl(candidate));
    if (ownUrl && parentRoundupUrls.has(ownUrl)) {
      demoted.push(candidate);
    } else {
      kept.push(candidate);
    }
  }
  return { kept, demoted };
}

function uniqueByUrlAndTitle(items = []) {
  const seen = new Set();
  const output = [];
  for (const item of ensureArray(items)) {
    const key = `${normalizeSourceUrlPreserveAnchor(item.url)}|${candidateTitle(item)}`;
    if (!key.trim() || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function attachRelatedContextToSelected(selected = [], pools = []) {
  const allCandidates = ensureArray(pools).flatMap(ensureArray);
  return ensureArray(selected).map(candidate => {
    const groupKey = candidateGroupKey(candidate);
    const selfUrl = normalizeSourceUrlPreserveAnchor(candidateUrl(candidate));
    const related = allCandidates
      .filter(item => candidateGroupKey(item) === groupKey)
      // selected candidate 자신의 exact normalized URL(anchor 포함)은 title이 달라도 제외한다.
      // 같은 article URL이 다른 title로 재카탈로그되어 related/blocked context로 새어 들어가면,
      // validateBlockedContextUsage가 자기 source를 blocked_context_url_used_as_article_source로
      // 오탐한다. anchor가 다른 sibling(#roundup-child-... 등)은 selfUrl과 달라 그대로 유지된다.
      .filter(item => normalizeSourceUrlPreserveAnchor(candidateUrl(item)) !== selfUrl)
      .map(item => compactContextCandidate(item));
    const parentContext = parentRoundupContext(candidate);
    const relatedContexts = uniqueByUrlAndTitle(parentContext ? [parentContext, ...related] : related)
      // parentRoundupContext가 self와 동일 URL인 degenerate 케이스까지 막는 post-merge guard.
      .filter(item => normalizeSourceUrlPreserveAnchor(item.url) !== selfUrl);
    return {
      ...candidate,
      article_group_key: groupKey,
      related_context_candidates: relatedContexts
    };
  });
}

function selectedRepresentativeGroupKeys(candidates = []) {
  return [...new Set(ensureArray(candidates)
    .filter(candidate => candidate.final_selected === true || candidate.selected_for_editor === true || candidate.primary_selected === true)
    .map(candidateGroupKey)
    .filter(Boolean))];
}

function inferReasonCode(value = '') {
  const normalized = normalizeCode(value);
  if (!normalized) return '';
  if (EXPLICIT_DEMOTION_REASON_CODES.includes(normalized) || HARD_BLOCK_REASON_CODES.includes(normalized)) {
    return normalized;
  }
  if (FORBIDDEN_SOURCE_READY_NATIVE_DEMOTION_REASONS.includes(normalized)) {
    return normalized;
  }
  if (/duplicate|near_duplicate/.test(normalized)) return 'duplicate_or_near_duplicate';
  if (/forbidden|bucket/.test(normalized)) return 'forbidden_bucket';
  if (/hold|editor/.test(normalized)) return 'explicit_editor_hold';
  if (/source_gap/.test(normalized)) return 'source_gap_risk';
  if (/dated|date/.test(normalized)) return 'missing_dated_evidence';
  if (/source_quality|blocked_source|unknown_source/.test(normalized)) return 'blocked_source_quality';
  // parent-roundup/blocked-context URL은 메인 기사 출처로 쓸 수 없으므로 source-quality hard-block으로 본다.
  if (/blocked_context|parent_roundup/.test(normalized)) return 'blocked_source_quality';
  if (/fact_check|must_fix/.test(normalized)) return 'fact_check_must_fix';
  if (/quality|hard_block/.test(normalized)) return 'quality_hard_blocker';
  if (/directness|runtime/.test(normalized)) return 'camera_runtime_directness_insufficient';
  if (/supporting/.test(normalized)) return 'supporting_only';
  if (/primary_camera/.test(normalized)) return 'not_primary_camera_stack';
  return normalized;
}

function explicitDemotedGroups(editor = {}) {
  return ensureArray(editor.explicitly_demoted_groups || editor.demoted_groups)
    .map(item => typeof item === 'string'
      ? { article_group_key: item, demotion_reason: '', reason_code: '' }
      : {
          article_group_key: text(item?.article_group_key || item?.group_key || item?.key),
          demotion_reason: text(item?.demotion_reason || item?.reason),
          reason_code: inferReasonCode(item?.reason_code || item?.demotion_reason_code || item?.demotion_reason || item?.reason)
        })
    .filter(item => item.article_group_key);
}

function explicitHardBlockedGroups(editor = {}) {
  return ensureArray(editor.hard_blocked_groups)
    .map(item => typeof item === 'string'
      ? { article_group_key: item, hard_block_reason: '', reason_code: '' }
      : {
          article_group_key: text(item?.article_group_key || item?.group_key || item?.key),
          hard_block_reason: text(item?.hard_block_reason || item?.reason),
          reason_code: inferReasonCode(item?.reason_code || item?.hard_block_reason_code || item?.hard_block_reason || item?.reason)
        })
    .filter(item => item.article_group_key);
}

function groupCoverageSummary({ selectedGroupKeys = [], renderedGroupKeys = [], demotedGroups = [], hardBlockedGroups = [] } = {}) {
  const selected = new Set(ensureArray(selectedGroupKeys).filter(Boolean));
  const renderedList = ensureArray(renderedGroupKeys).filter(Boolean);
  const rendered = new Set(renderedList);
  const demoted = new Set(ensureArray(demotedGroups).map(item => text(item.article_group_key || item)).filter(Boolean));
  const hardBlocked = new Set(ensureArray(hardBlockedGroups).map(item => text(item.article_group_key || item)).filter(Boolean));
  const renderedCounts = renderedList.reduce((counts, key) => counts.set(key, (counts.get(key) || 0) + 1), new Map());
  const duplicateRendered = [...renderedCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
  const missing = [...selected].filter(key => !rendered.has(key) && !demoted.has(key) && !hardBlocked.has(key));
  const overlap = [...rendered].filter(key => demoted.has(key));
  const hardBlockedRenderedOverlap = [...rendered].filter(key => hardBlocked.has(key));
  const hardBlockedDemotedOverlap = [...demoted].filter(key => hardBlocked.has(key));
  const demotionMissingReason = ensureArray(demotedGroups)
    .filter(item => selected.has(text(item.article_group_key || item)) && !text(item.demotion_reason) && !text(item.reason_code))
    .map(item => text(item.article_group_key || item));
  const hardBlockedMissingReason = ensureArray(hardBlockedGroups)
    .filter(item => selected.has(text(item.article_group_key || item)) && !text(item.hard_block_reason) && !text(item.reason_code))
    .map(item => text(item.article_group_key || item));
  return {
    selected_group_count: selected.size,
    rendered_group_count: rendered.size,
    explicitly_demoted_group_count: demoted.size,
    hard_blocked_group_count: hardBlocked.size,
    selected_representative_group_keys: [...selected],
    rendered_group_keys: [...rendered],
    duplicate_rendered_group_keys: duplicateRendered,
    explicitly_demoted_group_keys: [...demoted],
    hard_blocked_group_keys: [...hardBlocked],
    missing_group_keys: missing,
    overlapping_group_keys: overlap,
    hard_blocked_rendered_overlap_group_keys: hardBlockedRenderedOverlap,
    hard_blocked_demoted_overlap_group_keys: hardBlockedDemotedOverlap,
    demotion_missing_reason_group_keys: demotionMissingReason,
    hard_block_missing_reason_group_keys: hardBlockedMissingReason,
    ok: missing.length === 0 &&
      overlap.length === 0 &&
      hardBlockedRenderedOverlap.length === 0 &&
      hardBlockedDemotedOverlap.length === 0 &&
      duplicateRendered.length === 0 &&
      demotionMissingReason.length === 0 &&
      hardBlockedMissingReason.length === 0 &&
      selected.size === rendered.size + demoted.size + hardBlocked.size
  };
}

module.exports = {
  ANDROID_NATIVE_TOOLING_GROUP_KEY,
  CONTEXT_LABELS,
  EXPLICIT_DEMOTION_REASON_CODES,
  FORBIDDEN_SOURCE_READY_NATIVE_DEMOTION_REASONS,
  HARD_BLOCK_REASON_CODES,
  NATIVE_TOOLING_WORKFLOW_TYPE,
  attachRelatedContextToSelected,
  excludeParentRoundupContainers,
  candidateContextLabel,
  candidateGroupKey,
  compactContextCandidate,
  explicitDemotedGroups,
  explicitHardBlockedGroups,
  fallbackGroupKey,
  groupCoverageSummary,
  inferReasonCode,
  isNativeToolingWorkflow,
  loreSeriesKey,
  loreThreadUrl,
  loreSeriesPatchNumber,
  normalizeCanonicalUrlStripAnchor,
  normalizeSourceUrlPreserveAnchor,
  normalizeUrl,
  selectedRepresentativeGroupKeys
};
