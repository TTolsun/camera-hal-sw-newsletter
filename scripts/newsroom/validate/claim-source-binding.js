const crypto = require('crypto');

const {
  normalizeUrl,
  normalizedUrlHash
} = require('../generate/newsroom-selection');
const {
  normalizeArticleSections
} = require('../common/article-section-contract');

const CLAIM_TYPES = Object.freeze([
  'fact',
  'inference',
  'recommendation',
  'risk_note',
  'limitation'
]);

const CLAIM_TYPE_VALUES = new Set(CLAIM_TYPES);

const CLAIM_IMPACT_LEVELS = Object.freeze([
  'direct_hal_contract',
  'camera_framework_behavior',
  'app_api_or_framework_adjacent',
  'driver_image_pipeline',
  'stream_buffer_metadata',
  'cts_vts_its_cdd',
  'performance_latency_thermal',
  'soc_resource_contention',
  'native_tooling_workflow',
  'no_hal_runtime_impact',
  'unknown'
]);

const CLAIM_IMPACT_LEVEL_VALUES = new Set(CLAIM_IMPACT_LEVELS);

const OVERCLAIM_RISKS = Object.freeze([
  'low',
  'medium',
  'high',
  'unknown'
]);

const OVERCLAIM_RISK_VALUES = new Set(OVERCLAIM_RISKS);

const DIRECT_HAL_WORDING = /\b(?:direct\s+Camera\s+HAL|direct\s+HAL|HAL\s+API|HAL\s+contract|vendor\s+HAL|camera\s+provider\s+contract|HAL\s+runtime|runtime\s+behavior|driver\s+runtime)\b/i;
const DIRECT_HAL_GUARDRAIL = /\bdo\s+not\s+(?:claim|overstate|present|treat)[^.\n]{0,120}\b(?:direct\s+Camera\s+HAL|direct\s+HAL|HAL\s+API|HAL\s+contract|runtime|driver)\b|\b(?:direct\s+Camera\s+HAL|direct\s+HAL|HAL\s+API|HAL\s+contract|runtime|driver)\b[^.\n]{0,120}\b(?:do\s+not|not\s+claim|not\s+overstate|without\s+source)\b/i;
const CONCRETE_FACT_TERMS = /\b(?:version|release\s+date|published|API|component|behavior\s+change|CameraX|Camera2|Camera\s+HAL|AndroidX|libcamera|V4L2|CTS|VTS|Camera\s+ITS|stream|buffer|metadata|request|result)\b|\b20\d{2}-\d{2}-\d{2}\b|\bv?\d+\.\d+(?:\.\d+)?(?:[-\w.]*)?\b/i;
const NON_ALLOWED_EVIDENCE_STATUSES = Object.freeze(['blocked', 'failed', 'skipped', 'unsupported']);
const NON_ALLOWED_EVIDENCE_STATUS_VALUES = new Set(NON_ALLOWED_EVIDENCE_STATUSES);
const LINKED_EVIDENCE_STATUS_FIELDS = Object.freeze([
  ['blocked_linked_evidence_ids', 'blocked'],
  ['failed_linked_evidence_ids', 'failed'],
  ['skipped_linked_evidence_ids', 'skipped'],
  ['unsupported_linked_evidence_ids', 'unsupported']
]);
const POSITIVE_SUPPORT_CLAIM_TYPES = new Set(['fact', 'inference', 'recommendation']);
const LIMITATION_CLAIM_TYPES = new Set(['risk_note', 'limitation']);
const LIMITATION_WORDING = /\b(?:not\s+confirmed|not\s+resolved|not\s+fetched|fetch(?:ed)?\s+failed|failed\s+to\s+fetch|blocked|skipped|unsupported|unresolved|diagnostic(?:\s+only)?|limited|cannot\s+confirm|without\s+(?:confirmed|resolved|direct)\s+evidence|no\s+direct\s+HAL\s+impact\s+is\s+confirmed)\b/i;
const POSITIVE_SUPPORT_WORDING = /\b(?:confirms?|confirmed|proves?|verified|shows?|demonstrates?|establishes?|supports?|evidence\s+(?:shows|confirms)|direct\s+HAL\s+impact|direct\s+HAL\s+behavior|runtime\s+behavior\s+(?:changes?|changed)|changes?\s+runtime\s+behavior)\b/i;
const STREAM_BUFFER_TERMS = Object.freeze(['stream', 'buffer', 'metadata', 'request', 'result']);
const RUNTIME_TERMS = Object.freeze(['runtime', 'behavior', 'implementation', 'pipeline']);

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function text(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(text).filter(Boolean).join(' ');
  return String(value || '').trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function hashText(value, length = 12) {
  return crypto.createHash('sha256').update(text(value)).digest('hex').slice(0, length);
}

function uniqueTexts(values = []) {
  return [...new Set(ensureArray(values).map(text).filter(Boolean))];
}

function normalizeText(value) {
  return text(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\uac00-\ud7a3+.#/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sourceCandidateHash(candidate = {}) {
  const explicit = text(
    candidate.source_candidate_hash ||
    candidate.url_hash ||
    candidate.normalized_url_hash ||
    candidate.candidate_hash
  );
  if (explicit) return explicit;
  const url = text(candidate.url || candidate.article_url || candidate.articleUrl || candidate.normalized_url);
  return url ? normalizedUrlHash(url) : hashText(text(candidate.title || candidate.headline || 'unknown-candidate'), 16);
}

function sectionKeyFromSourceExtraction(group, section = {}, extraction = {}) {
  const release = objectValue(extraction.release);
  const prefix = group === 'minor_line_context' ? 'minor' : 'release';
  const parts = [
    prefix,
    release.version,
    release.date,
    release.component,
    section.category,
    section.heading,
    section.title
  ].map(normalizeText).filter(Boolean);
  return parts.length > 0 ? parts.join('-').replace(/[^a-z0-9\uac00-\ud7a3]+/g, '-').replace(/^-|-$/g, '') : prefix;
}

function stableSourceExtractionItemId(candidate = {}, sectionKey = 'source-extraction', itemText = '') {
  return `sx:${sourceCandidateHash(candidate)}:${sectionKey}:${hashText(normalizeText(itemText), 16)}`;
}

function stableLinkedEvidenceItemId(candidate = {}, item = {}) {
  const status = lower(item.fetch_status || item.fetchStatus || 'unknown') || 'unknown';
  const urlKey = canonicalUrlKey(item.url || item.source_url || item.sourceUrl) ||
    normalizeText(item.identifier || item.title || item.source_text || item.sourceText || 'no-url');
  const textKey = normalizeText(item.title || item.source_text || item.sourceText || item.raw_excerpt || item.rawExcerpt || item.identifier || item.type || status);
  return `le:${sourceCandidateHash(candidate)}:${status}:${hashText(urlKey, 16)}:${hashText(textKey, 16)}`;
}

function sourceExtractionItems(candidate = {}) {
  const extraction = objectValue(candidate.source_extraction);
  const groups = [
    ['release', objectValue(extraction.release)],
    ['minor_line_context', objectValue(extraction.minor_line_context)]
  ];
  const items = [];
  for (const [group, container] of groups) {
    for (const section of ensureArray(container.sections)) {
      const sectionKey = sectionKeyFromSourceExtraction(group, section, extraction);
      for (const item of ensureArray(section.items)) {
        const itemText = text(item.text || item.source_text || item.summary || item.behavior_change);
        if (!itemText) continue;
        items.push({
          id: text(item.evidence_id || item.source_evidence_id) ||
            stableSourceExtractionItemId(candidate, sectionKey, itemText),
          kind: 'source_extraction_item',
          status: 'allowed',
          section_key: sectionKey,
          urls: [item.url, candidate.url, candidate.article_url, candidate.articleUrl].map(text).filter(Boolean),
          texts: [itemText, container.version, container.date, container.component].map(text).filter(Boolean),
          fragment_specific: hasUrlFragment(item.url || candidate.url) && hasConcreteFactualText(itemText)
        });
      }
    }
  }
  return items;
}

function hasUrlFragment(value) {
  try {
    return Boolean(new URL(text(value)).hash);
  } catch {
    return /#/.test(text(value));
  }
}

function hasConcreteFactualText(value) {
  return CONCRETE_FACT_TERMS.test(text(value));
}

function canonicalUrlKey(value, { preserveFragment = false } = {}) {
  const raw = text(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (!preserveFragment) parsed.hash = '';
    parsed.searchParams.delete('utm_source');
    parsed.searchParams.delete('utm_medium');
    parsed.searchParams.delete('utm_campaign');
    parsed.searchParams.delete('utm_term');
    parsed.searchParams.delete('utm_content');
    parsed.searchParams.delete('hl');
    parsed.search = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    const withoutSearch = raw.replace(/\?.*$/, '');
    return preserveFragment
      ? withoutSearch.replace(/\/$/, '').toLowerCase()
      : withoutSearch.replace(/#.*$/, '').replace(/\/$/, '').toLowerCase();
  }
}

function urlKeySet(value, { preserveFragment = false } = {}) {
  const raw = text(value);
  const keys = new Set();
  if (!raw) return keys;
  keys.add(canonicalUrlKey(raw, { preserveFragment }));
  keys.add(normalizeUrl(raw));
  if (!preserveFragment) keys.add(canonicalUrlKey(raw, { preserveFragment: false }));
  return new Set([...keys].filter(Boolean));
}

function evidenceStatusRank(status) {
  if (NON_ALLOWED_EVIDENCE_STATUS_VALUES.has(status)) return 4;
  if (status === 'provenance') return 2;
  if (status === 'allowed') return 1;
  return 0;
}

function addEvidence(index, item = {}) {
  const id = text(item.id || item.evidence_id);
  if (!id) return;
  const next = {
    id,
    kind: item.kind || 'evidence',
    status: item.status || 'allowed',
    urls: uniqueTexts(item.urls),
    texts: uniqueTexts(item.texts),
    fragment_specific: item.fragment_specific === true,
    provenance_only: item.provenance_only === true
  };
  if (!index.byId.has(id)) {
    index.byId.set(id, next);
    return;
  }
  const current = index.byId.get(id);
  if (evidenceStatusRank(next.status) > evidenceStatusRank(current.status)) {
    current.status = next.status;
    current.kind = next.kind;
  }
  current.urls = item.authoritative_urls === true && next.urls.length > 0
    ? next.urls
    : uniqueTexts([...current.urls, ...next.urls]);
  current.texts = uniqueTexts([...current.texts, ...next.texts]);
  current.fragment_specific = current.fragment_specific || next.fragment_specific;
  current.provenance_only = current.provenance_only && next.provenance_only;
}

function linkedEvidenceItems(candidate = {}) {
  const entries = [
    ['linked_evidence', candidate.linked_evidence || candidate.linkedEvidence],
    ['source_aware_linked_evidence', candidate.source_aware_linked_evidence || candidate.sourceAwareLinkedEvidence]
  ];
  const items = [];
  for (const [field, values] of entries) {
    for (const raw of ensureArray(values)) {
      const item = objectValue(raw);
      const fetchStatus = lower(item.fetch_status || item.fetchStatus);
      const status = fetchStatus === 'resolved' ? 'allowed' : fetchStatus;
      if (status !== 'allowed' && !NON_ALLOWED_EVIDENCE_STATUS_VALUES.has(status)) continue;
      const itemText = text(item.source_text || item.sourceText || item.raw_excerpt || item.rawExcerpt || item.title || item.identifier);
      const itemUrl = text(item.url || item.source_url || item.sourceUrl);
      items.push({
        id: text(item.evidence_id || item.evidenceId || item.id) || stableLinkedEvidenceItemId(candidate, item),
        kind: `${field}_item`,
        status,
        urls: [itemUrl],
        texts: [itemText, item.classification_reason || item.classificationReason].map(text).filter(Boolean),
        fragment_specific: hasUrlFragment(itemUrl) && hasConcreteFactualText(itemText),
        authoritative_urls: Boolean(itemUrl)
      });
    }
  }
  return items;
}

function buildEvidenceIndex(candidate = {}, section = {}) {
  const index = {
    byId: new Map(),
    packFallback: new Map(),
    allowedSourceKeys: new Set(),
    anchorSpecificSourceKeys: new Set()
  };
  const compact = objectValue(candidate.compact_evidence);
  const compactUrls = ensureArray(compact.evidence_urls).map(text).filter(Boolean);
  const primaryTexts = ensureArray(compact.primary_facts).map(text).filter(Boolean);
  const linkedTexts = ensureArray(compact.linked_context).map(text).filter(Boolean);
  const generalEvidenceTexts = [
    ...ensureArray(candidate.evidence),
    ...ensureArray(candidate.evidence_notes),
    candidate.summary,
    candidate.behavior_change,
    candidate.version_or_release,
    candidate.published_date || candidate.publishedAt,
    candidate.api_or_component
  ].map(text).filter(Boolean);

  for (const id of ensureArray(candidate.primary_evidence_ids)) {
    addEvidence(index, {
      id,
      kind: 'primary_evidence',
      urls: compactUrls.length > 0 ? compactUrls : [candidate.url, candidate.article_url, candidate.articleUrl],
      texts: primaryTexts.length > 0 ? primaryTexts : generalEvidenceTexts,
      fragment_specific: compactUrls.some(hasUrlFragment)
    });
  }
  for (const id of ensureArray(candidate.linked_evidence_ids)) {
    addEvidence(index, {
      id,
      kind: 'linked_evidence',
      urls: compactUrls.length > 0 ? compactUrls : [candidate.url, candidate.article_url, candidate.articleUrl],
      texts: linkedTexts.length > 0 ? linkedTexts : generalEvidenceTexts,
      fragment_specific: compactUrls.some(hasUrlFragment)
    });
  }
  for (const id of ensureArray(candidate.evidence_ids)) {
    if (ensureArray(candidate.evidence_pack_ids).includes(id)) continue;
    addEvidence(index, {
      id,
      kind: 'candidate_evidence',
      urls: compactUrls.length > 0 ? compactUrls : [candidate.url, candidate.article_url, candidate.articleUrl],
      texts: generalEvidenceTexts
    });
  }
  for (const item of sourceExtractionItems(candidate)) addEvidence(index, item);
  for (const item of linkedEvidenceItems(candidate)) addEvidence(index, item);
  for (const [field, status] of LINKED_EVIDENCE_STATUS_FIELDS) {
    const urlField = field.replace(/_ids$/, '_urls');
    for (const id of ensureArray(candidate[field])) {
      addEvidence(index, {
        id,
        kind: `${status}_linked_evidence`,
        status,
        urls: ensureArray(candidate[urlField]),
        texts: []
      });
    }
  }
  const primaryIds = ensureArray(candidate.primary_evidence_ids).map(text).filter(Boolean);
  for (const id of ensureArray(candidate.evidence_pack_ids)) {
    addEvidence(index, {
      id,
      kind: 'evidence_pack',
      status: 'provenance',
      provenance_only: true,
      urls: [candidate.url, candidate.article_url, candidate.articleUrl],
      texts: []
    });
    if (primaryIds.length === 1) index.packFallback.set(text(id), primaryIds[0]);
  }

  const allowedUrls = [
    candidate.url,
    candidate.article_url,
    candidate.articleUrl,
    candidate.normalized_url,
    ...ensureArray(section.sources).map(source => source?.url),
    ...compactUrls
  ].map(text).filter(Boolean);
  for (const url of allowedUrls) {
    for (const key of urlKeySet(url)) index.allowedSourceKeys.add(key);
  }
  for (const evidence of index.byId.values()) {
    for (const url of ensureArray(evidence.urls)) {
      for (const key of urlKeySet(url, { preserveFragment: evidence.fragment_specific })) {
        if (evidence.fragment_specific) index.anchorSpecificSourceKeys.add(key);
        index.allowedSourceKeys.add(key);
      }
    }
  }
  return index;
}

function normalizeClaim(raw = {}, index) {
  const claimId = text(raw.claim_id || raw.claimId);
  return {
    raw,
    index,
    claim_id: claimId,
    internal_id: claimId || `claim-${index + 1}`,
    text: text(raw.text || raw.claim),
    claim_type: lower(raw.claim_type || raw.claimType),
    evidence_ids: ensureArray(raw.evidence_ids || raw.evidenceIds).map(text).filter(Boolean),
    source_urls: ensureArray(raw.source_urls || raw.sourceUrls).map(text).filter(Boolean),
    impact_level: lower(raw.impact_level || raw.impactLevel),
    overclaim_risk: lower(raw.overclaim_risk || raw.overclaimRisk)
  };
}

function issue(reasonCode, message, options = {}) {
  const { blocking, severity, ...extra } = options;
  return {
    reason_code: reasonCode,
    message,
    blocking: blocking !== false,
    severity: severity || (blocking === false ? 'soft' : 'hard'),
    ...extra
  };
}

function protectedTokens(value) {
  const raw = text(value);
  const tokens = new Set();
  for (const match of raw.match(/\b20\d{2}-\d{2}-\d{2}\b/g) || []) tokens.add(match.toLowerCase());
  for (const match of raw.match(/\bv?\d+\.\d+(?:\.\d+)?(?:[-\w.]*)?\b/gi) || []) tokens.add(match.toLowerCase());
  for (const match of raw.match(/\b(?:CameraX|Camera2|AndroidX|libcamera|V4L2|Camera\s+HAL|HAL\s+API|CTS|VTS|Camera\s+ITS|Media3|ImageCapture|VideoCapture|CameraPipe)\b/gi) || []) {
    tokens.add(normalizeText(match));
  }
  return [...tokens].filter(Boolean);
}

function tokenSimilarity(left, right) {
  const leftTokens = new Set(normalizeText(left).split(/\s+/).filter(token => token.length > 2));
  const rightTokens = new Set(normalizeText(right).split(/\s+/).filter(token => token.length > 2));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  const intersection = [...leftTokens].filter(token => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union > 0 ? intersection / union : 0;
}

function evidenceTextForClaim(claim, evidenceIndex) {
  return claim.evidence_ids
    .flatMap(id => {
      const item = evidenceIndex.byId.get(id) || evidenceIndex.byId.get(evidenceIndex.packFallback.get(id));
      return ensureArray(item?.texts);
    })
    .join(' ');
}

function evidenceTextForItems(items = []) {
  return ensureArray(items).flatMap(item => ensureArray(item?.texts)).join(' ');
}

function missingTermsFromEvidence(terms, claimText, evidenceText) {
  const claim = normalizeText(claimText);
  const evidence = normalizeText(evidenceText);
  return terms.filter(term => {
    const normalized = normalizeText(term);
    return claim.includes(normalized) && !evidence.includes(normalized);
  });
}

function factSupportIssues(claim, resolvedEvidenceItems = []) {
  if (claim.claim_type !== 'fact') return [];
  const allowedItems = ensureArray(resolvedEvidenceItems).filter(item => item?.status === 'allowed');
  if (allowedItems.length === 0) return [];
  const supportCheckedEvidenceIds = uniqueTexts(allowedItems.map(item => item.id));
  const evidenceText = evidenceTextForItems(allowedItems);
  const issues = [];
  const protectedMissing = protectedTokens(claim.text)
    .filter(token => !normalizeText(evidenceText).includes(normalizeText(token)));
  if (protectedMissing.length > 0) {
    issues.push(issue(
      'fact_claim_not_supported_by_evidence_text',
      'Fact claim contains protected tokens that are missing from resolved evidence text.',
      {
        support_checked_evidence_ids: supportCheckedEvidenceIds,
        support_missing_terms: protectedMissing
      }
    ));
  }
  const runtimeMissing = missingTermsFromEvidence(RUNTIME_TERMS, claim.text, evidenceText);
  if (runtimeMissing.length > 0) {
    issues.push(issue(
      'runtime_claim_without_runtime_evidence',
      'Runtime or behavior fact claim lacks matching runtime evidence terms.',
      {
        support_checked_evidence_ids: supportCheckedEvidenceIds,
        support_missing_terms: runtimeMissing
      }
    ));
  }
  const streamBufferMissing = missingTermsFromEvidence(STREAM_BUFFER_TERMS, claim.text, evidenceText);
  if (streamBufferMissing.length > 0) {
    issues.push(issue(
      'stream_buffer_metadata_without_stream_buffer_metadata_evidence',
      'Stream/buffer/metadata fact claim lacks matching evidence terms.',
      {
        support_checked_evidence_ids: supportCheckedEvidenceIds,
        support_missing_terms: streamBufferMissing
      }
    ));
  }
  return issues;
}

function factCoveredByClaim(factText, claim, evidenceIndex) {
  const fact = normalizeText(factText);
  const claimText = normalizeText(claim.text);
  const evidenceText = normalizeText(evidenceTextForClaim(claim, evidenceIndex));
  if (!fact || !claimText) {
    return { covered: false, confidence: 0, reason_code: 'empty_fact_or_claim' };
  }
  const tokens = protectedTokens(factText);
  const tokenHaystack = `${claimText} ${evidenceText}`;
  const missingTokens = tokens.filter(token => !tokenHaystack.includes(normalizeText(token)));
  if (missingTokens.length > 0) {
    return {
      covered: false,
      confidence: 0,
      reason_code: 'protected_token_mismatch',
      missing_tokens: missingTokens
    };
  }
  if (claimText.includes(fact) || fact.includes(claimText)) {
    return { covered: true, confidence: 1, reason_code: 'substring_match' };
  }
  const similarity = tokenSimilarity(fact, claimText);
  if (similarity >= 0.72) {
    return { covered: true, confidence: similarity, reason_code: 'token_similarity' };
  }
  return { covered: false, confidence: similarity, reason_code: 'missing_matching_fact_claim' };
}

function factsToCover(section = {}) {
  const articleSections = normalizeArticleSections(section);
  const facts = [];
  for (const [index, value] of ensureArray(articleSections.verified_facts).entries()) {
    facts.push({ field: `article_sections.verified_facts[${index}]`, text: value });
  }
  for (const [index, value] of ensureArray(section.confirmed_facts).entries()) {
    facts.push({ field: `confirmed_facts[${index}]`, text: value });
  }
  if (hasConcreteFactualText(section.evidence_summary)) {
    facts.push({ field: 'evidence_summary', text: section.evidence_summary });
  }
  return facts.filter(item => text(item.text));
}

function claimContradictsGuardrail(claim, guardrails) {
  const claimText = text(claim.text);
  if (!DIRECT_HAL_WORDING.test(claimText)) return null;
  if (
    LIMITATION_CLAIM_TYPES.has(claim.claim_type) &&
    LIMITATION_WORDING.test(claimText) &&
    !hasPositiveSupportWording(claimText)
  ) {
    return null;
  }
  const guardrail = ensureArray(guardrails).map(text).find(item => DIRECT_HAL_GUARDRAIL.test(item));
  if (!guardrail) return null;
  return guardrail;
}

function hasPositiveSupportWording(value) {
  return POSITIVE_SUPPORT_WORDING.test(value) &&
    !/\b(?:not\s+confirmed|not\s+resolved|cannot\s+confirm|no\s+direct\s+HAL\s+impact\s+is\s+confirmed)\b/i.test(value);
}

function evidenceHasDirectHalSupport(claim, evidenceIndex, candidate = {}) {
  if (text(candidate.impact_claim_level) === 'direct_hal_change') return true;
  const evidenceText = evidenceTextForClaim(claim, evidenceIndex);
  return DIRECT_HAL_WORDING.test(evidenceText);
}

function claimSourceMatchesEvidenceItem(claim, item) {
  const itemUrls = uniqueTexts(item?.urls);
  if (itemUrls.length === 0) return true;
  const itemKeys = new Set();
  for (const url of itemUrls) {
    for (const key of urlKeySet(url, { preserveFragment: item.fragment_specific })) itemKeys.add(key);
  }
  return claim.source_urls.some(url =>
    [...urlKeySet(url, { preserveFragment: item.fragment_specific })].some(key => itemKeys.has(key))
  );
}

function nonAllowedEvidenceIssueOptions(claim, item) {
  const checkedIds = [item.id].filter(Boolean);
  if (claim.claim_type === 'fact') {
    return {
      blocking: true,
      severity: 'hard',
      support_checked_evidence_ids: checkedIds
    };
  }
  if (POSITIVE_SUPPORT_CLAIM_TYPES.has(claim.claim_type) || LIMITATION_CLAIM_TYPES.has(claim.claim_type)) {
    const limitation = LIMITATION_WORDING.test(claim.text);
    const positiveSupport = hasPositiveSupportWording(claim.text);
    return {
      blocking: !(limitation && !positiveSupport),
      severity: limitation && !positiveSupport ? 'soft' : 'hard',
      support_checked_evidence_ids: checkedIds,
      non_allowed_evidence_usage: limitation && !positiveSupport ? 'limitation' : 'positive_support'
    };
  }
  return {
    blocking: true,
    severity: 'hard',
    support_checked_evidence_ids: checkedIds
  };
}

function validateClaimEvidence(claim, evidenceIndex, candidate, strict) {
  const issues = [];
  const resolvedEvidenceIds = [];
  const resolvedEvidenceItems = [];
  let derivedEvidenceMapping = false;
  if (!claim.claim_id) issues.push(issue('missing_claim_id', 'Claim is missing claim_id.'));
  if (!claim.text) issues.push(issue('empty_claim_text', 'Claim text is empty.'));
  if (!CLAIM_TYPE_VALUES.has(claim.claim_type)) {
    issues.push(issue('invalid_claim_type', `Invalid claim_type: ${claim.claim_type || 'empty'}.`));
  }
  if (claim.impact_level && !CLAIM_IMPACT_LEVEL_VALUES.has(claim.impact_level)) {
    issues.push(issue('invalid_impact_level', `Invalid impact_level: ${claim.impact_level}.`));
  }
  if (claim.overclaim_risk && !OVERCLAIM_RISK_VALUES.has(claim.overclaim_risk)) {
    issues.push(issue('invalid_overclaim_risk', `Invalid overclaim_risk: ${claim.overclaim_risk}.`));
  }
  if (claim.source_urls.length === 0 && (strict || claim.claim_type === 'fact')) {
    issues.push(issue('missing_source_urls', 'Claim is missing source_urls.'));
  }
  for (const sourceUrl of claim.source_urls) {
    const keys = urlKeySet(sourceUrl);
    const matchesAllowed = [...keys].some(key => evidenceIndex.allowedSourceKeys.has(key));
    if (!matchesAllowed) {
      issues.push(issue('source_url_mismatch', `Claim source_url does not match bound candidate evidence: ${sourceUrl}.`));
    }
  }

  if (claim.claim_type === 'fact' && claim.evidence_ids.length === 0) {
    issues.push(issue('missing_fact_evidence_ids', 'Fact claim is missing item-level evidence_ids.'));
  }
  for (const evidenceId of claim.evidence_ids) {
    let item = evidenceIndex.byId.get(evidenceId);
    if ((!item || item.provenance_only) && evidenceIndex.packFallback.has(evidenceId)) {
      item = evidenceIndex.byId.get(evidenceIndex.packFallback.get(evidenceId));
      derivedEvidenceMapping = true;
    }
    if (!item) {
      const reason = /keyword|hint/i.test(evidenceId)
        ? 'keyword_hint_is_not_evidence'
        : /gemini.*proposal|proposal/i.test(evidenceId)
          ? 'gemini_proposal_is_not_evidence'
          : 'unknown_evidence_id';
      issues.push(issue(reason, `Claim references unresolved evidence_id: ${evidenceId}.`));
      continue;
    }
    if (item.provenance_only && !evidenceIndex.packFallback.has(evidenceId)) {
      issues.push(issue('provenance_id_without_item_evidence', `Claim references provenance-only evidence id: ${evidenceId}.`));
      continue;
    }
    resolvedEvidenceIds.push(item.id);
    resolvedEvidenceItems.push(item);
    if (!claimSourceMatchesEvidenceItem(claim, item)) {
      issues.push(issue(
        item.fragment_specific ? 'source_url_fragment_mismatch' : 'evidence_source_url_mismatch',
        item.fragment_specific
          ? 'Claim source_urls do not preserve the release/version/section fragment required by the evidence item.'
          : `Claim source_urls do not match evidence_id ${evidenceId}.`,
        { support_checked_evidence_ids: [item.id] }
      ));
    }
    if (item.status !== 'allowed') {
      const options = nonAllowedEvidenceIssueOptions(claim, item);
      issues.push(issue(
        'blocked_or_failed_evidence_id',
        `Claim references ${item.status} evidence_id: ${evidenceId}.`,
        options
      ));
      continue;
    }
  }
  issues.push(...factSupportIssues(claim, resolvedEvidenceItems));
  if (derivedEvidenceMapping) {
    issues.push(issue(
      'derived_evidence_mapping',
      'Claim used migration-only pack-level fallback mapping; new generated claims must reference item-level evidence ids.',
      { blocking: false, severity: 'soft' }
    ));
  }
  if (claim.impact_level === 'direct_hal_contract' && !evidenceHasDirectHalSupport(claim, evidenceIndex, candidate)) {
    issues.push(issue(
      'direct_hal_claim_without_direct_evidence',
      'direct_hal_contract claim lacks direct HAL source evidence.'
    ));
  }
  return {
    issues,
    resolvedEvidenceIds,
    resolvedEvidenceItems,
    derivedEvidenceMapping
  };
}

function overclaimRiskFromResults(claimResults) {
  if (claimResults.some(result => result.issues.some(item =>
    ['direct_hal_claim_without_direct_evidence', 'do_not_claim_violation', 'do_not_overstate_violation'].includes(item.reason_code)
  ))) return 'high';
  if (claimResults.some(result => result.issues.some(item => item.blocking !== false))) return 'medium';
  if (claimResults.length > 0) return 'low';
  return 'unknown';
}

function validateArticleClaims({
  section = {},
  candidate = {},
  articleIndex = 0,
  strict = false
} = {}) {
  const evidenceIndex = buildEvidenceIndex(candidate, section);
  const guardrails = [
    ...ensureArray(candidate.do_not_claim),
    ...ensureArray(objectValue(candidate.compact_evidence).do_not_claim),
    ...ensureArray(objectValue(candidate.derived_editorial_hints).do_not_claim),
    ...ensureArray(section.do_not_overstate),
    ...ensureArray(objectValue(section.hal_signal_capsule).do_not_overstate)
  ];
  const rawClaims = ensureArray(section.claims);
  const claims = rawClaims.map(normalizeClaim);
  const claimResults = [];
  const articleIssues = [];
  const claimIds = new Set();
  const facts = factsToCover(section);

  if (strict && rawClaims.length === 0) {
    articleIssues.push(issue('missing_claims', 'Strict target main article is missing claims[].'));
  }
  const factClaims = claims.filter(claim => claim.claim_type === 'fact');
  if (strict && facts.length > 0 && factClaims.length === 0) {
    articleIssues.push(issue('missing_fact_claim', 'Strict target article has factual fields but no claim_type=fact claim.'));
  }

  for (const claim of claims) {
    const issues = [];
    if (claim.claim_id) {
      if (claimIds.has(claim.claim_id)) issues.push(issue('duplicate_claim_id', `Duplicate claim_id in article: ${claim.claim_id}.`));
      claimIds.add(claim.claim_id);
    }
    const evidence = validateClaimEvidence(claim, evidenceIndex, candidate, strict);
    issues.push(...evidence.issues);
    const guardrail = claimContradictsGuardrail(claim, guardrails);
    if (guardrail) {
      issues.push(issue(
        claim.claim_type === 'fact' ? 'do_not_claim_violation' : 'do_not_overstate_violation',
        `Claim contradicts guardrail: ${guardrail}.`
      ));
    }
    claimResults.push({
      article_index: articleIndex + 1,
      claim_id: claim.internal_id,
      claim_type: claim.claim_type || 'unknown',
      impact_level: claim.impact_level || 'unknown',
      overclaim_risk: claim.overclaim_risk || 'unknown',
      text: claim.text,
      evidence_ids: claim.evidence_ids,
      resolved_evidence_ids: [...new Set(evidence.resolvedEvidenceIds)],
      source_urls: claim.source_urls,
      bound: claim.claim_type === 'fact' &&
        evidence.resolvedEvidenceIds.length > 0 &&
        issues.every(item => item.blocking === false),
      derived_evidence_mapping: evidence.derivedEvidenceMapping,
      issues
    });
  }

  const uncoveredFacts = [];
  for (const fact of facts) {
    const matches = factClaims
      .map(claim => ({
        claim,
        match: factCoveredByClaim(fact.text, claim, evidenceIndex)
      }))
      .filter(item => item.match.covered)
      .sort((left, right) => right.match.confidence - left.match.confidence);
    if (matches.length === 0) {
      uncoveredFacts.push({
        article_index: articleIndex + 1,
        field: fact.field,
        text: fact.text,
        reason_code: 'missing_matching_fact_claim'
      });
    }
  }
  if (strict) {
    for (const uncovered of uncoveredFacts) {
      articleIssues.push(issue(
        uncovered.reason_code,
        `Factual field is not covered by a claim_type=fact claim: ${uncovered.field}.`
      ));
    }
  }

  const allIssues = [
    ...articleIssues,
    ...claimResults.flatMap(result => result.issues)
  ];
  const boundClaims = claimResults.filter(result => result.bound).length;
  const status = claimResults.length === 0
    ? 'not_available'
    : allIssues.some(item => item.blocking !== false)
      ? 'needs_fix'
      : 'available';

  return {
    article_index: articleIndex + 1,
    headline: text(section.headline || section.category || `article ${articleIndex + 1}`),
    status,
    strict,
    bound_claims: boundClaims,
    total_claims: claimResults.length,
    fact_claim_count: factClaims.length,
    derived_evidence_mapping_count: claimResults.filter(result => result.derived_evidence_mapping).length,
    overclaim_risk: overclaimRiskFromResults(claimResults),
    claim_results: claimResults,
    uncovered_facts: uncoveredFacts,
    issues: articleIssues
  };
}

function summarizeClaimValidation(articleValidations = []) {
  const validations = ensureArray(articleValidations);
  const boundClaims = validations.reduce((sum, item) => sum + Number(item.bound_claims || 0), 0);
  const totalClaims = validations.reduce((sum, item) => sum + Number(item.total_claims || 0), 0);
  const derivedCount = validations.reduce((sum, item) => sum + Number(item.derived_evidence_mapping_count || 0), 0);
  const riskRank = new Map([['unknown', 0], ['low', 1], ['medium', 2], ['high', 3]]);
  const overclaimRisk = validations
    .map(item => item.overclaim_risk || 'unknown')
    .sort((left, right) => (riskRank.get(right) || 0) - (riskRank.get(left) || 0))[0] || 'unknown';
  const availableCount = validations.filter(item => item.status && item.status !== 'not_available').length;
  const needsFixCount = validations.filter(item => item.status === 'needs_fix').length;
  return {
    status: validations.length === 0 || availableCount === 0
      ? 'not_available'
      : needsFixCount > 0
        ? 'needs_fix'
        : availableCount < validations.length
          ? 'partial'
          : 'available',
    bound_claims: totalClaims > 0 ? boundClaims : null,
    total_claims: totalClaims > 0 ? totalClaims : null,
    derived_evidence_mapping_count: derivedCount,
    overclaim_risk: overclaimRisk,
    available_article_count: availableCount,
    not_available_article_count: validations.length - availableCount
  };
}

module.exports = {
  CLAIM_IMPACT_LEVELS,
  CLAIM_TYPES,
  OVERCLAIM_RISKS,
  buildEvidenceIndex,
  stableLinkedEvidenceItemId,
  stableSourceExtractionItemId,
  summarizeClaimValidation,
  validateArticleClaims
};
