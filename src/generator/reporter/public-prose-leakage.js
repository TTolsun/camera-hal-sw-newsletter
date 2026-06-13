// 공개 산문(reader-facing prose) 누설 탐지 책임 모듈.
// public-article-contract.js에서 leakage-detection 상수/헬퍼만 분리한 것으로,
// 동작은 원본과 동일하다(순수 추출).

function text(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(text).filter(Boolean).join(' ');
  return String(value || '').trim();
}

function compactText(value) {
  return text(value).replace(/\s+/g, ' ').trim();
}

const HARD_PUBLIC_IDENTIFIERS = Object.freeze([
  'story_contract_version',
  'source_subtitle',
  'source_links',
  'decision_metadata',
  'editorial_story',
  'reader_scenario',
  'what_happened',
  'why_it_matters',
  'field_scenario',
  'not_to_overclaim',
  'editor_take',
  'source_gap_risk',
  'finalSelectionEligibility',
  'candidate_pool_preflight',
  'relevance_bucket',
  'impact_claim_level',
  'do_not_claim',
  'do_not_overstate',
  'hal_signal_capsule',
  'HAL Signal Capsule',
  'article_sections',
  'specificity_checks',
  'overclaim_guardrails',
  'main_article_readiness',
  'reader_owners',
  'check_within_2_weeks',
  'why_now',
  'impact_axes',
  'review_only',
  'cpp_ai_tooling_fallback',
  'generic_tech_watchlist',
  'source_dedup',
  'processed_source_event_ids',
  'processed_evidence_ids',
  'previous_values',
  'current_values',
  'state/source-snapshots/',
  'content/source-events/',
  '자동 정상 발행 기준',
  '자동 발행 기준',
  '편집자 확인 후 merge',
  'merge 발행',
  'Review-only 발행본',
  '편집자 검토 후 공개 가능한',
  '편집자 검토 후 발행 가능한'
]);

const LEGACY_PUBLIC_FORBIDDEN_TERMS = Object.freeze([
  'Review-only',
  'Fallback',
  'editor review',
  'normal publishable coverage',
  'section repair',
  'hard failure',
  'candidate shortage',
  'survivor',
  'donor',
  '중복 issue',
  '구조화 필드',
  'publish gate'
]);

const CONTEXTUAL_PUBLIC_TERMS = Object.freeze([
  'deterministic',
  'guardrail',
  'validator',
  'validation gate',
  'quality gate',
  'quality threshold',
  'publish-ready',
  'claim binding',
  'claim-binding',
  'overclaim'
]);

const CONTEXTUAL_INTERNAL_MARKERS = Object.freeze([
  'internal',
  'debug',
  'report',
  'failure',
  'failed',
  'output',
  'diagnostic',
  'diagnostics',
  'gate',
  'policy',
  'schema',
  'contract',
  'pipeline',
  'public_article',
  'editor draft',
  'validation'
]);

const CONTEXTUAL_ALLOW_PHRASES = Object.freeze([
  'API validator',
  'input validator',
  'form validator',
  'schema validator library',
  'static analysis validator',
  'Android Studio validator'
]);

const CONTEXTUAL_FAIL_PHRASES = Object.freeze([
  'internal validator report',
  'validator report',
  'quality gate output',
  'internal validator',
  'debug validator result',
  'claim binding failure',
  'claim-binding diagnostics',
  'overclaim guardrail',
  'overclaim check result',
  'internal guardrail output'
]);

const PUBLIC_PROSE_PLACEHOLDER_PATTERNS = Object.freeze([
  { pattern: /\bAPI\/component\/date\b/i, reason: 'api_component_date_placeholder' },
  { pattern: /\bsource title\/domain\/version\/date\b/i, reason: 'source_identity_placeholder' },
  { pattern: /\btest\/log\/metric\/API\b/i, reason: 'test_log_metric_api_placeholder' },
  { pattern: /\bbuild\/test\/debug metric\b/i, reason: 'build_test_debug_metric_placeholder' },
  { pattern: /\bcompatibility test scenario\b/i, reason: 'compatibility_test_scenario_placeholder' },
  { pattern: /관련\s+API\/component/i, reason: 'related_api_component_placeholder' },
  { pattern: /관련\s+API\/component\/date/i, reason: 'related_api_component_date_placeholder' },
  { pattern: /현재\s+device matrix와\s+맞는지/i, reason: 'device_matrix_fit_placeholder' },
  { pattern: /compatibility test scenario\s+또는\s+stream\/metadata/i, reason: 'test_scenario_stream_metadata_placeholder' },
  { pattern: /stream\/metadata\s+확인\s+항목/i, reason: 'stream_metadata_check_item_placeholder' },
  { pattern: /확인\s+항목만\s+추적합니다/i, reason: 'check_item_tracking_placeholder' },
  { pattern: /source\s+범위에서[^.!?。！？\r\n]*확인\s+항목을\s+점검합니다/i, reason: 'source_scope_check_item_placeholder' },
  { pattern: /release note 범위에서[^.!?。！？\r\n]*API\/component\/date/i, reason: 'release_note_placeholder_template' },
  { pattern: /원문\s+세부\s+내용으로는[^.!?。！？\r\n]*확인됩니다/i, reason: 'source_detail_review_placeholder' },
  { pattern: /후속\s+검토에서\s+출처\s+범위를\s+확인할\s+때\s+기준점/i, reason: 'internal_followup_source_scope' }
]);

function normalizedLeakText(value) {
  return compactText(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ');
}

function lowerLeakText(value) {
  return normalizedLeakText(value).toLowerCase();
}

function sentenceFragments(value) {
  return normalizedLeakText(value)
    .split(/(?<=[.!?。！？])\s+|(?<=[다요함음임됨됨니다]\.)\s+|[\r\n]+/u)
    .map(item => item.trim())
    .filter(Boolean);
}

function includesPhrase(textValue, phrase) {
  return textValue.includes(String(phrase || '').toLowerCase());
}

function sentenceAtIndex(value, index) {
  const normalized = normalizedLeakText(value);
  const matches = [...normalized.matchAll(/[^.!?。！？\r\n]+(?:[.!?。！？]+|$)/gu)];
  const match = matches.find(item => index >= item.index && index < item.index + item[0].length);
  return match ? match[0].trim() : '';
}

function hasAllowPhraseInContext(textValue, term) {
  return CONTEXTUAL_ALLOW_PHRASES
    .map(phrase => phrase.toLowerCase())
    .some(phrase => phrase.includes(term) && String(textValue || '').includes(phrase));
}

function contextualLeakReasons(value) {
  const normalized = normalizedLeakText(value);
  const lower = normalized.toLowerCase();
  const reasons = [];

  for (const phrase of CONTEXTUAL_FAIL_PHRASES) {
    if (includesPhrase(lower, phrase)) reasons.push(phrase);
  }

  for (const term of CONTEXTUAL_PUBLIC_TERMS) {
    const lowerTerm = term.toLowerCase();
    if (!lower.includes(lowerTerm)) continue;
    const termIndexes = [];
    let fromIndex = 0;
    while (fromIndex < lower.length) {
      const index = lower.indexOf(lowerTerm, fromIndex);
      if (index === -1) break;
      termIndexes.push(index);
      fromIndex = index + lowerTerm.length;
    }
    for (const index of termIndexes) {
      const windowText = lower.slice(Math.max(0, index - 40), index + lowerTerm.length + 40);
      const sameSentence = sentenceAtIndex(normalized, index).toLowerCase();
      if (
        hasAllowPhraseInContext(windowText, lowerTerm) ||
        hasAllowPhraseInContext(sameSentence, lowerTerm)
      ) {
        continue;
      }
      if (CONTEXTUAL_INTERNAL_MARKERS.some(marker => windowText.includes(marker))) {
        reasons.push(`${term}+internal_marker`);
        continue;
      }
      if (sameSentence) {
        if (CONTEXTUAL_INTERNAL_MARKERS.some(marker => sameSentence.includes(marker))) {
          reasons.push(`${term}+same_sentence_marker`);
        }
      }
    }
  }
  return [...new Set(reasons)];
}

function publicProseLeakageIssues(value, label = 'public text') {
  const lower = lowerLeakText(value);
  const normalized = normalizedLeakText(value);
  const issues = [];
  for (const term of HARD_PUBLIC_IDENTIFIERS) {
    if (lower.includes(String(term).toLowerCase())) {
      issues.push(`${label} contains hard internal identifier: ${term}`);
    }
  }
  for (const term of LEGACY_PUBLIC_FORBIDDEN_TERMS) {
    if (lower.includes(String(term).toLowerCase())) {
      issues.push(`${label} contains internal public-forbidden term: ${term}`);
    }
  }
  for (const reason of contextualLeakReasons(value)) {
    issues.push(`${label} contains contextual internal term: ${reason}`);
  }
  for (const { pattern, reason } of PUBLIC_PROSE_PLACEHOLDER_PATTERNS) {
    if (pattern.test(normalized)) {
      issues.push(`${label} contains validator-token prose instead of reader-facing prose: ${reason}`);
    }
  }
  return issues;
}

function publicUrlError(value) {
  const raw = compactText(value);
  if (!raw) return 'missing_url';
  let parsed;
  try {
    parsed = new URL(raw);
  } catch (_) {
    return 'invalid_url';
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return 'non_public_scheme';
  const urlText = raw.toLowerCase();
  if (
    urlText.includes('/.tmp/') ||
    urlText.includes('/content/newsroom/') ||
    urlText.includes('/content/collected-news/') ||
    urlText.includes('/content/source-events/') ||
    urlText.includes('/state/source-snapshots/')
  ) {
    return 'internal_artifact_url';
  }
  if (parsed.hostname === 'github.com' && /\/actions\/(?:runs|workflows)\//i.test(parsed.pathname)) {
    return 'github_actions_artifact_url';
  }
  return '';
}

module.exports = {
  HARD_PUBLIC_IDENTIFIERS,
  LEGACY_PUBLIC_FORBIDDEN_TERMS,
  CONTEXTUAL_PUBLIC_TERMS,
  CONTEXTUAL_INTERNAL_MARKERS,
  CONTEXTUAL_ALLOW_PHRASES,
  CONTEXTUAL_FAIL_PHRASES,
  PUBLIC_PROSE_PLACEHOLDER_PATTERNS,
  normalizedLeakText,
  lowerLeakText,
  sentenceFragments,
  includesPhrase,
  sentenceAtIndex,
  hasAllowPhraseInContext,
  contextualLeakReasons,
  publicProseLeakageIssues,
  publicUrlError
};
