// Deterministic post-processing of editor drafts and fact-check reports.
//
// Single responsibility: clean up LLM output before the quality gate sees it —
//   - validateFactCheck: normalize status, drop schema-field false positives
//   - sanitizeClaimEvidenceIds: strip hallucinated claim evidence_ids
//   - stampCoverageType: deterministically mark fresh vs catch_up sections
//   - pruneCatchUpFramingFactCheckItems: drop fact-check false positives that object to the
//     intentional catch-up retrospective framing
// All pure transforms (read editor/factCheck/reporter/shortlistReport, return new objects);
// extracted from the generation orchestrator (gemini-newsroom-newsletter.js).

const { normalizeUrl } = require('../generate/newsroom-selection');

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberOrDefault(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Editor-draft schema / internal selection-metadata fields the fact-checker sometimes flags as
// "should not be in the public article" — they are deterministically owned by the pipeline, not
// the LLM, so a fact-check finding against them is always a false positive.
const FACT_CHECK_SCHEMA_FIELD_BLOCKLIST = [
  /public_article\.(decision_metadata|story_contract_version|editorial_story)/,
  /\.(relevance_bucket|editorial_priority|aosp_camera_directness|driver_stack_relevance|soc_platform_relevance|native_tooling_relevance|counts_as_|finalSelectionEligibility|source_gap_risk|main_article_readiness|do_not_claim|evidence_origin|source_hint|resolvedImage|imageCandidates|imageSource|imageAttribution|imageAlt|imageLicenseStatus|imageUsageDecisionReason|selectedImage|source_candidate_url|source_candidate_hash|article_group_key|tooling_workflow_type|camera_hal_checks|action_hints|is_ai_related|article_type)/
];

function isSchemaFieldFactCheckViolation(item) {
  const location = String(item?.location || '');
  return FACT_CHECK_SCHEMA_FIELD_BLOCKLIST.some(pattern => pattern.test(location));
}

function validateFactCheck(value) {
  if (!['PASS', 'NEEDS_FIX'].includes(value.status)) {
    value.status = ensureArray(value.must_fix).length > 0 ? 'NEEDS_FIX' : 'PASS';
  }
  value.must_fix = ensureArray(value.must_fix).filter(item => !isSchemaFieldFactCheckViolation(item));
  value.recommended_fixes = ensureArray(value.recommended_fixes).filter(item => !isSchemaFieldFactCheckViolation(item));
  value.source_gaps = ensureArray(value.source_gaps);
  value.source_gap_count = numberOrDefault(value.source_gap_count, value.source_gaps.length);
  value.article_quality = ensureArray(value.article_quality).map(item => ({
    section_index: numberOrDefault(item?.section_index, -1),
    headline: String(item?.headline || ''),
    publishable: item?.publishable !== false,
    reason: String(item?.reason || '')
  }));
  value.final_comment = value.final_comment || '';
  if (!['PASS', 'NEEDS_FIX'].includes(value.status)) {
    value.status = value.must_fix.length > 0 ? 'NEEDS_FIX' : 'PASS';
  } else if (value.status === 'NEEDS_FIX' && value.must_fix.length === 0) {
    value.status = 'PASS';
  }
  return value;
}

function collectValidEvidenceIds(reporter) {
  const validIds = new Set();
  for (const candidate of ensureArray(reporter?.candidates)) {
    for (const block of ensureArray(candidate?.source_extraction?.evidence_blocks)) {
      const id = String(block.evidence_id || block.id || '');
      if (id) validIds.add(id);
    }
    for (const id of ensureArray(candidate?.primary_evidence_ids)) {
      if (id) validIds.add(String(id));
    }
  }
  return validIds;
}

function sanitizeClaimEvidenceIds(editor, reporter) {
  const validIds = collectValidEvidenceIds(reporter);
  const sections = ensureArray(editor?.sections);
  if (sections.length === 0) return editor;
  const sanitized = sections.map(section => {
    const claims = ensureArray(section.claims);
    if (claims.length === 0) return section;
    const cleanedClaims = claims.map(claim => {
      const ids = ensureArray(claim.evidence_ids);
      if (ids.length === 0) return claim;
      const kept = ids.filter(id => validIds.has(id));
      if (kept.length === ids.length) return claim;
      return { ...claim, evidence_ids: kept };
    });
    return { ...section, claims: cleanedClaims };
  });
  return { ...editor, sections: sanitized };
}

function stampCoverageType(editor, shortlistReport) {
  const sections = ensureArray(editor?.sections);
  if (sections.length === 0) return editor;
  const catchUpByUrl = new Map();
  for (const item of ensureArray(shortlistReport?.catch_up_articles)) {
    const url = normalizeUrl(item.url);
    if (url) catchUpByUrl.set(url, item);
  }
  const stamped = sections.map(section => {
    const sourceUrl = ensureArray(section.sources)
      .map(source => normalizeUrl(source?.url))
      .find(url => url && catchUpByUrl.has(url));
    if (sourceUrl) {
      const match = catchUpByUrl.get(sourceUrl);
      return { ...section, coverage_type: 'catch_up', catch_up_age_days: Number(match.catch_up_age_days) };
    }
    return { ...section, coverage_type: section.coverage_type === 'catch_up' ? 'catch_up' : 'fresh' };
  });
  return { ...editor, sections: stamped };
}

function isCatchUpFramingFalsePositive(item, catchUpIndexes) {
  const location = String(item?.location || '');
  const sectionMatch = location.match(/sections\[(\d+)\]/);
  if (!sectionMatch) return false;
  if (!catchUpIndexes.has(Number(sectionMatch[1]))) return false;
  if (!/\.public_article\.(headline|lead)/.test(location)) return false;
  const problem = String(item?.problem || '');
  return /지난 소식|past news|retrospective|editorial framing|편집|회고|N주 전|주 전 릴리스/i.test(problem);
}

function pruneCatchUpFramingFactCheckItems(factCheck, editor) {
  const sections = ensureArray(editor?.sections);
  const catchUpIndexes = new Set(
    sections.map((section, index) => (section.coverage_type === 'catch_up' ? index : -1)).filter(index => index >= 0)
  );
  if (catchUpIndexes.size === 0) return factCheck;
  const before = ensureArray(factCheck?.must_fix).length;
  const value = { ...factCheck };
  value.must_fix = ensureArray(factCheck?.must_fix).filter(item => !isCatchUpFramingFalsePositive(item, catchUpIndexes));
  value.recommended_fixes = ensureArray(factCheck?.recommended_fixes).filter(item => !isCatchUpFramingFalsePositive(item, catchUpIndexes));
  const removed = before - value.must_fix.length;
  if (removed > 0) {
    console.warn(`Pruned ${removed} catch-up retrospective-framing fact-check false positive(s).`);
    if (['PASS', 'NEEDS_FIX'].includes(value.status)) {
      value.status = value.must_fix.length > 0 ? 'NEEDS_FIX' : 'PASS';
    }
  }
  return value;
}

module.exports = {
  FACT_CHECK_SCHEMA_FIELD_BLOCKLIST,
  collectValidEvidenceIds,
  isCatchUpFramingFalsePositive,
  isSchemaFieldFactCheckViolation,
  pruneCatchUpFramingFactCheckItems,
  sanitizeClaimEvidenceIds,
  stampCoverageType,
  validateFactCheck
};
