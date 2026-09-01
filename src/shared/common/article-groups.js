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
// 뽑아 patch 번호만 떼어낸 공통 키를 만든다. 실제 데이터에서 관찰된 3가지 형식만 다룬다(YAGNI).
//   NEW-style: 20260529-glymur_camss-v1-0-bee535396d22@oss.qualcomm.com
//              => base="...-v1", patch="0", tail="bee535396d22@oss.qualcomm.com"
//              버전 토큰(-v<N>)은 선택적이다. 첫 버전을 b4/git-send-email로 보낼 때
//              20260529-glymur_camss-0-bee535396d22@oss.qualcomm.com 처럼 버전 없이 오기도 한다.
//   OLD-style: 20260527170531.383871-1-miguel.vadillo@intel.com
//              => base="20260527170531.383871", patch="1", from="miguel.vadillo@intel.com"
//   HASH-style: cover.1787872237.git.mauriziocasciano7@gmail.com          (커버레터)
//               34736c93669fcb...843254.1787872237.git.mauriziocasciano7@gmail.com  (개별 패치)
//              => key="lore-series:git-1787872237-mauriziocasciano7@gmail.com"
//              git-send-email이 커밋 해시로 message-id를 만들 때 나온다. 시리즈를 가르는 것은
//              한 번의 send-email 호출을 나타내는 <epoch>이고, 앞자리는 커버레터면 'cover',
//              패치면 그 패치의 커밋 해시다(2026-W35 실측: v3 6조각이 전부 1787872237,
//              v4 8조각이 전부 1787933456).
// 시리즈가 아니면(UUID/랜덤 message-id, 리스트 페이지) '' 를 돌려 기존 키 로직을 쓰게 한다.
const LORE_HOST = 'lore.kernel.org';
// 제목 브래킷 접두부의 순번: [<flags>,][v<ver>,]<patch>/<total>] — 그룹1 = patch 번호.
// lore('[PATCH v3 08/12] …')와 patchwork('[RFC,v7,1/6] …') 양쪽 표기를 모두 읽는다.
const SERIES_SEQUENCE_IN_TITLE = /^\s*\[[^\]]*?(?:v\d+\s*,\s*)?(\d+)\s*\/\s*\d+\s*\]/i;
// b4/git-send-email date-slug 메시지ID: <YYYYMMDD>-<slug...>[-v<버전>]-<패치번호>-<hex해시>@<호스트>
// hex 해시@호스트 꼬리로 끝을 고정해, 버전 토큰 유무와 무관하게 시리즈를 묶고
// old-style(<날짜시각>.<pid>-...)·UUID(8자리 비-숫자 시작) 메시지ID는 매칭하지 않는다.
const LORE_NEW_STYLE = /^(\d{8}-.+?)-(\d+)-([0-9a-f]{6,}@\S+)$/;
// (8자리 이상 날짜시각.PID) + '-' + (패치번호) + '-' + (보낸사람)
const LORE_OLD_STYLE = /^(\d{8,}\.\d+)-(\d+)-(.+)$/;
// ('cover' 또는 커밋 해시) + '.' + (epoch) + '.git.' + (보낸사람)
// 앞의 두 형식과 겹치지 않는다: 'cover'는 숫자로 시작하지 않고, 16진수 해시는 뒤에 '-'가 아니라
// '.'가 오므로 두 정규식이 요구하는 '<숫자>-<패치번호>-' 모양을 만들 수 없다.
// epoch 하한이 9자리인 것은 초 단위 unix epoch가 10자리라서다 — 짧은 숫자 토큰을 배제한다.
const LORE_HASH_STYLE = /^(cover|[0-9a-f]{8,})\.(\d{9,})\.git\.(\S+@\S+)$/;
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
  const hashStyle = messageId.match(LORE_HASH_STYLE);
  if (hashStyle) {
    // 이 형식은 message-id에 순번을 담지 않는다 — 커버레터만 'cover'로 구분되고 나머지는
    // 커밋 해시다. 커버레터는 0, 나머지는 여기서 unknown으로 두고 loreSeriesParts가 제목의
    // x/N으로 채운다(제목마저 없으면 unknown 유지).
    const patch = hashStyle[1] === 'cover' ? 0 : UNKNOWN_PATCH_NUMBER;
    return { key: `lore-series:git-${hashStyle[2]}-${hashStyle[3]}`, patch };
  }
  return null;
}

// 앞의 두 형식은 patch 번호가 message-id에 있어 커버레터가 창 밖인 주에도 대표가 결정론적이다.
// HASH-style만 그 정보가 없으므로, 같은 결정론을 주기 위해 제목 브래킷의 x/N을 읽는다.
// 주의 1: 형식마다 커버레터의 patch 번호가 다르다(HASH·b4는 0, OLD-style은 message-id가 '-1-'이라 1).
// 그래서 patch 번호는 같은 시리즈 안에서만 비교 의미가 있고, 형식이 다른 재제출끼리 비교하면
// 버전이 아니라 형식이 대표를 정할 수 있다(collect-news-candidates의 shouldPreferRerollRepresentative).
// 주의 2: 재제출 병합은 patch 번호를 버전보다 먼저 본다(#822). 그래서 양쪽 다 커버레터가 창 밖인
// 주에는 구버전의 낮은 순번(v3 02/12)이 신버전의 높은 순번(v4 09/15)을 이겨 대표가 된다.
// 이 형식만의 성질이 아니라 앞의 두 형식에서도 같은 결과이므로 규칙을 그대로 따른다.
function seriesPatchNumberFromTitle(candidate = {}) {
  const match = candidateTitle(candidate).match(SERIES_SEQUENCE_IN_TITLE);
  return match ? Number(match[1]) : UNKNOWN_PATCH_NUMBER;
}

function replyParentUrl(candidate = {}) {
  return text(candidate.in_reply_to || candidate.inReplyTo || candidate.in_reply_to_url || candidate.inReplyToUrl);
}

function loreSeriesParts(candidate = {}) {
  const own = loreSeriesPartsFromMessageId(loreMessageId(candidate));
  if (own) {
    if (own.patch !== UNKNOWN_PATCH_NUMBER) return own;
    return { key: own.key, patch: seriesPatchNumberFromTitle(candidate) };
  }
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

// patchwork.libcamera.org는 lore와 시리즈 신호 구조가 다르다. patch URL(/patch/<id>/)의 <id>는
// 패치별 고유(시리즈 아님)이고 message-id도 없어, URL·제목만으로는 시리즈를 못 묶는다. 시리즈
// 식별자는 수집기(patchwork-libcamera-patches.js)가 REST의 series id를 candidate.seriesId로 실어주고,
// patch 번호는 제목의 [..,x/N]에서 온다(lore가 message-id 하나에서 둘 다 얻는 것을 두 소스로 나눠 얻음).
const PATCHWORK_HOST = 'patchwork.libcamera.org';
// 순번은 위 SERIES_SEQUENCE_IN_TITLE로 읽는다. subject base는 시리즈 조각마다 달라
// 시리즈 키로 쓰지 않는다(시리즈 키는 seriesId). x/N이 없으면(단일 패치) 매치 실패 → 시리즈 아님.

function isPatchworkUrl(raw) {
  if (!raw) return false;
  try {
    return new URL(raw).hostname.toLowerCase() === PATCHWORK_HOST;
  } catch {
    return false;
  }
}

function candidateSeriesId(candidate = {}) {
  const raw = candidate.seriesId ?? candidate.series_id;
  return raw === undefined || raw === null ? '' : text(raw);
}

function patchworkSeriesParts(candidate = {}) {
  if (!isPatchworkUrl(candidateUrl(candidate))) return null;
  const seriesId = candidateSeriesId(candidate);
  if (!seriesId) return null;
  const match = candidateTitle(candidate).match(SERIES_SEQUENCE_IN_TITLE);
  return {
    key: `patchwork-series:${seriesId}`,
    patch: match ? Number(match[1]) : UNKNOWN_PATCH_NUMBER
  };
}

// lore/patchwork 어느 소스든 같은 패치 시리즈를 하나의 그룹으로 묶는 generic 시리즈 키/번호.
// lore를 먼저 시도하고(자기·부모 message-id), 아니면 patchwork(seriesId + 제목 x/N)로 떨어진다.
// dedup(candidatesAreDuplicate), 대표 선택(shouldPreferDuplicateCandidate), fallbackGroupKey가 모두 이걸 쓴다.
function seriesParts(candidate = {}) {
  return loreSeriesParts(candidate) || patchworkSeriesParts(candidate);
}

function seriesKey(candidate = {}) {
  const parts = seriesParts(candidate);
  return parts ? parts.key : '';
}

function seriesPatchNumber(candidate = {}) {
  const parts = seriesParts(candidate);
  return parts ? parts.patch : UNKNOWN_PATCH_NUMBER;
}

// 제목을 비교 가능한 형태로 줄인다(소문자 + 영숫자/한글 외 구분자는 공백 하나로).
// section-identity.js의 normalizeTitle과 하는 일이 비슷해 보이지만 규칙이 다르다(그쪽은 NFC
// 정규화와 발음 부호 제거를 더 한다). 의미가 다른 변형이므로 통합하지 않는다.
function titleKey(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// 시리즈 re-roll(v1 -> v2 재제출)은 patchwork series id도 lore message-id도 새로 발급받으므로
// 위 seriesKey로는 묶이지 않는다. 브래킷 접두부([PATCH v2 3/6], [RFC,v2,1/1] 등)를 뗀 제목이
// 정확히 같으면 같은 논리 시리즈로 본다. 제목을 고쳐 재제출한 시리즈는 의도적으로 병합하지
// 않는다 — 퍼지 매칭의 오병합 위험이 중복보다 나쁘다(실측된 한계 사례: Tegra VI RFC v2가
// subject에 "tegra:" prefix를 추가해 미병합).
//
// 수집 단계의 재제출 병합(collapseSeriesRerolls)과 재게재 게이트가 같은 축을 봐야 한다.
// 게이트가 이 축을 모르면 지난주 발행한 시리즈가 이번 주 새 버전 대표로 그대로 통과한다(#1036).
const SERIES_TITLE_BRACKET_PREFIX = /^\s*(?:\[[^\]]*\]\s*)+/;

function seriesSubjectKey(item = {}) {
  return titleKey(String(item.title || '').replace(SERIES_TITLE_BRACKET_PREFIX, ''));
}

// 버전은 브래킷 접두부 안에서만 읽는다 — 제목 본문의 "IPA format v3" 같은 표기를
// re-roll 버전으로 오인하면 안 된다. 접두부가 없거나 v 토큰이 없으면 첫 버전(1)이다.
function seriesRerollVersion(item = {}) {
  const prefix = String(item.title || '').match(SERIES_TITLE_BRACKET_PREFIX);
  if (!prefix) return 1;
  const version = prefix[0].match(/\bv(\d+)\b/i);
  return version ? Number(version[1]) : 1;
}

function fallbackGroupKey(candidate = {}) {
  const key = seriesKey(candidate);
  if (key) return key;
  const urlOrTitleKey = normalizeUrl(candidateUrl(candidate)) || candidateTitle(candidate);
  return urlOrTitleKey ? `article:${urlOrTitleKey}` : '';
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

// 회계의 권위 집합은 결정론 선정 집합 S 하나다. editor 출력은 신뢰할 수 없는 입력이라 S를 넓히지
// 못한다. 그래서 S 안의 것만 회계에 넣고, S 밖 기록은 진단으로만 남긴다.
//
//   회계        S = (R∩S) ⊎ (D∩S) ⊎ (H∩S)
//   치명        R−S 가 비어 있지 않음 — 선택되지 않은 소재로 기사를 만든 것이라 발행 안전 문제다
//   진단 전용   D−S, H−S — 이미 main에서 빠진 그룹에 대한 기록이라 선택 그룹의 처리와 무관하다
//
// 옛 회계는 `selected.size === rendered.size + demoted.size + hardBlocked.size` 한 줄로 위 셋을
// 뭉뚱그려, editor가 지어낸 키로 강등을 선언하기만 해도 발행 전체가 막혔다(2026-08-17 실측:
// 재조정이 5그룹을 1그룹으로 줄인 주에 editor가 `patch:uvcvideo_memory_safety` 같은 키 4개를
// 선언 → selected 1 !== rendered 1 + demoted 4). 지어낸 키는 어떤 매칭으로도 S와 이어지지 않는다.
function groupCoverageSummary({ selectedGroupKeys = [], renderedGroupKeys = [], demotedGroups = [], hardBlockedGroups = [] } = {}) {
  const selected = new Set(ensureArray(selectedGroupKeys).filter(Boolean));
  const renderedList = ensureArray(renderedGroupKeys).filter(Boolean);
  const rendered = new Set(renderedList);
  const demoted = new Set(ensureArray(demotedGroups).map(item => text(item.article_group_key || item)).filter(Boolean));
  const hardBlocked = new Set(ensureArray(hardBlockedGroups).map(item => text(item.article_group_key || item)).filter(Boolean));

  // 회계 집합(∩S)과 선택 밖 기록을 처음부터 갈라 둔다. 이렇게 해야 리포트에
  // "selected 1 / rendered 1 / demoted 4 / ok true" 같은 혼란스러운 출력이 남지 않는다.
  const renderedAccounted = [...rendered].filter(key => selected.has(key));
  const demotedAccounted = [...demoted].filter(key => selected.has(key));
  const hardBlockedAccounted = [...hardBlocked].filter(key => selected.has(key));
  const renderedOutside = [...rendered].filter(key => !selected.has(key));
  const demotedOutside = [...demoted].filter(key => !selected.has(key));
  const hardBlockedOutside = [...hardBlocked].filter(key => !selected.has(key));

  const renderedCounts = renderedList.reduce((counts, key) => counts.set(key, (counts.get(key) || 0) + 1), new Map());
  const duplicateRendered = [...renderedCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
  const missing = [...selected].filter(key => !rendered.has(key) && !demoted.has(key) && !hardBlocked.has(key));
  // 겹침은 선택된 그룹에 대해서만 본다 — S 밖 기록끼리의 겹침은 발행 결과를 바꾸지 않는다.
  const overlap = renderedAccounted.filter(key => demoted.has(key));
  const hardBlockedRenderedOverlap = renderedAccounted.filter(key => hardBlocked.has(key));
  const hardBlockedDemotedOverlap = demotedAccounted.filter(key => hardBlocked.has(key));
  // 사유 코드도 같은 계약을 따른다: S 안의 기록에만 요구하고, S 밖 기록의 사유 누락은 진단이다.
  const demotionMissingReason = ensureArray(demotedGroups)
    .filter(item => selected.has(text(item.article_group_key || item)) && !text(item.demotion_reason) && !text(item.reason_code))
    .map(item => text(item.article_group_key || item));
  const hardBlockedMissingReason = ensureArray(hardBlockedGroups)
    .filter(item => selected.has(text(item.article_group_key || item)) && !text(item.hard_block_reason) && !text(item.reason_code))
    .map(item => text(item.article_group_key || item));
  return {
    selected_group_count: selected.size,
    rendered_group_count: renderedAccounted.length,
    explicitly_demoted_group_count: demotedAccounted.length,
    hard_blocked_group_count: hardBlockedAccounted.length,
    rendered_outside_selection_count: renderedOutside.length,
    explicitly_demoted_outside_selection_count: demotedOutside.length,
    hard_blocked_outside_selection_count: hardBlockedOutside.length,
    selected_representative_group_keys: [...selected],
    rendered_group_keys: renderedAccounted,
    duplicate_rendered_group_keys: duplicateRendered,
    explicitly_demoted_group_keys: demotedAccounted,
    hard_blocked_group_keys: hardBlockedAccounted,
    rendered_outside_selection_group_keys: renderedOutside,
    explicitly_demoted_outside_selection_group_keys: demotedOutside,
    hard_blocked_outside_selection_group_keys: hardBlockedOutside,
    missing_group_keys: missing,
    overlapping_group_keys: overlap,
    hard_blocked_rendered_overlap_group_keys: hardBlockedRenderedOverlap,
    hard_blocked_demoted_overlap_group_keys: hardBlockedDemotedOverlap,
    demotion_missing_reason_group_keys: demotionMissingReason,
    hard_block_missing_reason_group_keys: hardBlockedMissingReason,
    ok: missing.length === 0 &&
      renderedOutside.length === 0 &&
      overlap.length === 0 &&
      hardBlockedRenderedOverlap.length === 0 &&
      hardBlockedDemotedOverlap.length === 0 &&
      duplicateRendered.length === 0 &&
      demotionMissingReason.length === 0 &&
      hardBlockedMissingReason.length === 0 &&
      selected.size === renderedAccounted.length + demotedAccounted.length + hardBlockedAccounted.length
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
  seriesKey,
  seriesPatchNumber,
  seriesRerollVersion,
  seriesSubjectKey,
  titleKey,
  normalizeCanonicalUrlStripAnchor,
  normalizeSourceUrlPreserveAnchor,
  normalizeUrl,
  selectedRepresentativeGroupKeys
};
