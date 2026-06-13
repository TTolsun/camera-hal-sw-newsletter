// Orchestrator section repair-plan helpers.
//
// Single responsibility: derive the deterministic section repair plan from
// editor / quality-report / fact-check inputs — repair-policy classification,
// section<->result matching, plan construction, and plan membership queries.
// Pure transforms on their arguments only — no generationRunState, no fs, no
// module globals — extracted verbatim from gemini-newsroom-newsletter.js.

const {
  normalizeTitle,
  sectionUrls
} = require('../../shared/common/section-identity');
const { ensureArray } = require('../render/newsletter-renderer');
const {
  deductionMatchesSection,
  sectionHasSourceGap
} = require('../quality/newsletter-quality');
const { articlePolicy } = require('../../shared/common/newsletter-policy');
const {
  stringOrEmpty,
  sectionLabel
} = require('./orchestrator-shared-helpers');

function finalArticleSlotDistribution(sections) {
  const distribution = {
    android_camera_platform_api: 0,
    camerax_aosp_camera_compatibility: 0,
    linux_camera_libcamera_v4l2: 0,
    ai_camera_path_hal_workflow: 0,
    cpp_toolchain_fallback: 0,
    other: 0
  };
  for (const section of ensureArray(sections)) {
    const body = [
      section.category,
      section.headline,
      section.evidence_summary,
      section.article_sections?.hal_driver_impact,
      section.article_type,
      ensureArray(section.sources).map(source => `${source.title} ${source.url}`).join(' ')
    ].join(' ');
    if (/AI|agent|LLM|NPU|GPU|on-device|inference|model/i.test(body) &&
      /camera|HAL|stream|buffer|ImageAnalysis|workflow|latency|thermal|power/i.test(body)) {
      distribution.ai_camera_path_hal_workflow += 1;
    } else if (/libcamera|V4L2|Linux camera|media controller/i.test(body)) {
      distribution.linux_camera_libcamera_v4l2 += 1;
    } else if (/CameraX|AOSP Camera|CDD|CTS|VTS|Camera ITS|compatibility/i.test(body)) {
      distribution.camerax_aosp_camera_compatibility += 1;
    } else if (/Android Camera|Camera2|platform API|Camera HAL|request|result|metadata|stream|buffer/i.test(body)) {
      distribution.android_camera_platform_api += 1;
    } else if (/C\+\+|LLVM|Clang|NDK|toolchain/i.test(body)) {
      distribution.cpp_toolchain_fallback += 1;
    } else {
      distribution.other += 1;
    }
  }
  return distribution;
}

function deductionRepairPolicy(deduction = {}) {
  const category = stringOrEmpty(deduction.category);
  const reason = stringOrEmpty(deduction.reason);
  const reasonCode = stringOrEmpty(deduction.reason_code || deduction.reasonCode);
  const haystack = `${category} ${reason}`;
  const neverRepairableClaimReasons = new Set([
    'missing_claims',
    'missing_fact_claim',
    'missing_fact_evidence_ids',
    'missing_source_urls',
    'unknown_evidence_id',
    'keyword_hint_is_not_evidence',
    'gemini_proposal_is_not_evidence',
    'provenance_id_without_item_evidence',
    'blocked_or_failed_evidence_id',
    'source_url_mismatch',
    'evidence_source_url_mismatch',
    'source_url_fragment_mismatch',
    'missing_matching_fact_claim',
    'fact_claim_not_supported_by_evidence_text',
    'runtime_claim_without_runtime_evidence',
    'stream_buffer_metadata_without_stream_buffer_metadata_evidence'
  ]);
  const repairableClaimReasons = new Set([
    'direct_hal_claim_without_direct_evidence',
    'do_not_overstate_violation',
    'invalid_impact_level',
    'do_not_claim_violation'
  ]);
  if (neverRepairableClaimReasons.has(reasonCode)) {
    return {
      failure_type: reasonCode,
      action: 'replace-or-demote',
      allow_rewrite: false,
      reason: 'claim evidence, source binding, or coverage failure must be demoted or replaced'
    };
  }
  if (repairableClaimReasons.has(reasonCode)) {
    return {
      failure_type: reasonCode,
      action: 'repair-section',
      allow_rewrite: true,
      reason: reasonCode === 'do_not_claim_violation'
        ? 'same-source repair may only remove the unsupported assertion or rewrite it as risk_note/limitation without changing evidence ids or source URLs'
        : 'same-source claim wording or impact classification repair is allowed once'
    };
  }
  if (/source gap|source_gap|watchlist|watch page|ineligible|main_eligible=false|missing dated evidence|no dated release/i.test(haystack)) {
    return {
      failure_type: 'source-gap',
      action: 'replace-or-demote',
      allow_rewrite: false,
      reason: 'source gap or ineligible source must be demoted or replaced'
    };
  }
  if (/duplicate|source URL is used across main sections/i.test(haystack)) {
    return {
      failure_type: 'duplicate',
      action: 'replace-section',
      allow_rewrite: false,
      reason: 'duplicate source or article must be replaced'
    };
  }
  if (/scope-relevance|generic_tech_watchlist|expanded AOSP Camera \/ driver \/ SoC \/ native relevance|lacks article-level AOSP Camera/i.test(haystack)) {
    return {
      failure_type: 'scope-demotion',
      action: 'replace-or-demote',
      allow_rewrite: false,
      reason: 'structured scope demotion must open replacement or reserve path'
    };
  }
  if (/hal-depth|hal-relevance|weak HAL|Camera HAL perspective|engineering depth/i.test(haystack)) {
    return {
      failure_type: 'weak-hal-relevance',
      action: 'replace-section',
      allow_rewrite: false,
      reason: 'weak HAL relevance should use a stronger candidate'
    };
  }
  if (/actionability|action item/i.test(haystack)) {
    return {
      failure_type: 'missing-actionability',
      action: 'repair-section',
      allow_rewrite: true,
      reason: 'same-source actionability repair is allowed once'
    };
  }
  if (/required-fields|evidence-specificity/i.test(haystack)) {
    return {
      failure_type: category || 'evidence',
      action: 'repair-section',
      allow_rewrite: true,
      reason: 'same-source evidence or required-field repair is allowed once'
    };
  }
  return {
    failure_type: category || 'unknown',
    action: 'repair-section',
    allow_rewrite: true,
    reason: 'section-scoped repair is allowed'
  };
}

function mergeRepairPolicies(policies) {
  const priority = ['replace-or-demote', 'replace-section', 'repair-section'];
  const items = ensureArray(policies);
  return items.sort((a, b) => priority.indexOf(a.action) - priority.indexOf(b.action))[0] || null;
}

function recommendedFixMentionsSection(item, section) {
  const haystack = normalizeTitle(item);
  const labels = [
    section.headline,
    section.category,
    ...ensureArray(section.sources).flatMap(source => [source.title, source.url])
  ].map(normalizeTitle).filter(Boolean);
  return labels.some(label => haystack.includes(label) || label.includes(haystack));
}

function articleResultMatchesSection(result, section) {
  const resultUrls = new Set(ensureArray(result?.sources).map(source => stringOrEmpty(source?.url)).filter(Boolean));
  if (ensureArray(section.sources).some(source => resultUrls.has(stringOrEmpty(source.url)))) return true;
  const resultLabels = [
    result?.headline,
    result?.category
  ].map(normalizeTitle).filter(Boolean);
  if (resultLabels.length === 0) return false;
  const sectionLabels = [
    section.headline,
    section.category,
    ...ensureArray(section.sources).flatMap(source => [source.title, source.url])
  ].map(normalizeTitle).filter(Boolean);
  return sectionLabels.some(sectionLabel =>
    resultLabels.some(resultLabel =>
      resultLabel === sectionLabel ||
      resultLabel.includes(sectionLabel) ||
      sectionLabel.includes(resultLabel)
    )
  );
}

function articleResultForSection(section, qualityReport) {
  return ensureArray(qualityReport?.article_results)
    .find(result => articleResultMatchesSection(result, section)) || null;
}

function buildSectionRepairPlan(editor, qualityReport, factCheck, eligibilityFindings = [], options = {}) {
  const maxSectionRepairs = Number.isInteger(options.maxSectionRepairs) ? options.maxSectionRepairs : Infinity;
  const sectionPlans = ensureArray(editor.sections).map(section => {
    const deductions = ensureArray(qualityReport?.deductions)
      .filter(deduction => deductionMatchesSection(deduction, section));
    const recommendedFixes = ensureArray(factCheck?.recommended_fixes)
      .filter(item => recommendedFixMentionsSection(item, section));
    const sectionEligibilityFindings = eligibilityFindings.filter(finding => finding.section === section);
    const hasSourceGap = sectionHasSourceGap(section, factCheck);
    const hasReporterEligibilityBlock = sectionEligibilityFindings.length > 0;
    const articleResult = articleResultForSection(section, qualityReport);
    const policies = [
      ...deductions.map(deductionRepairPolicy),
      ...recommendedFixes.map(item => deductionRepairPolicy({ category: 'recommended-fix', reason: item }))
    ];
    if (articleResult?.status === 'DEMOTE') {
      policies.push({
        failure_type: 'scope-demotion',
        action: 'replace-or-demote',
        allow_rewrite: false,
        reason: `article gate status DEMOTE requires replacement path (${articleResult.repair_action || 'demote-or-replace'})`
      });
    } else if (articleResult?.status === 'FAIL') {
      policies.push({
        failure_type: 'article-gate-fail',
        action: 'replace-or-demote',
        allow_rewrite: false,
        reason: `article gate status FAIL requires replacement path (${articleResult.repair_action || 'replace-or-demote'})`
      });
    }
    if (hasSourceGap || hasReporterEligibilityBlock) {
      policies.push({
        failure_type: 'source-gap',
        action: 'replace-or-demote',
        allow_rewrite: false,
        reason: 'source gap or reporter eligibility violation must be demoted or replaced'
      });
    }
    const policy = mergeRepairPolicies(policies);
    const action = policy ? policy.action : 'preserve';
    return {
      headline: sectionLabel(section),
      sources: sectionUrls(section),
      action,
      failure_type: policy?.failure_type || '',
      allow_rewrite: policy?.allow_rewrite !== false,
      policy_reason: policy?.reason || '',
      source_gap: hasSourceGap,
      reporter_eligibility_violations: sectionEligibilityFindings.map(finding => ({
        source_title: finding.source_title,
        source_url: finding.source_url,
        candidate_title: finding.candidate_title,
        reason: finding.reason
      })),
      deductions: deductions.map(deduction => ({
        category: deduction.category,
        points: deduction.points,
        reason: deduction.reason,
        location: deduction.location || ''
      })),
      recommended_fixes: recommendedFixes
    };
  }).filter(item => item.action !== 'preserve');
  const priority = { 'replace-or-demote': 0, 'replace-section': 1, 'repair-section': 2 };
  return sectionPlans
    .sort((a, b) => (priority[a.action] ?? 9) - (priority[b.action] ?? 9))
    .slice(0, maxSectionRepairs);
}

function buildFullSectionRepairPlan(editor, qualityReport, factCheck, eligibilityFindings = []) {
  return buildSectionRepairPlan(editor, qualityReport, factCheck, eligibilityFindings, {
    maxSectionRepairs: Infinity
  });
}

function sectionMatchesRepairItem(section, item) {
  if (!section || !item) return false;
  if (sectionLabel(section) === item.headline) return true;
  const urls = new Set(sectionUrls(section));
  return ensureArray(item.sources).some(url => urls.has(url));
}

function sectionsMatchingRepairPlan(sections, repairPlan) {
  return ensureArray(sections).filter(section =>
    ensureArray(repairPlan).some(item => sectionMatchesRepairItem(section, item))
  );
}

function sectionsOutsideRepairPlan(sections, repairPlan) {
  return ensureArray(sections).filter(section =>
    !ensureArray(repairPlan).some(item => sectionMatchesRepairItem(section, item))
  );
}

function hasTooFewMainArticlesDeduction(qualityReport) {
  return ensureArray(qualityReport?.deductions).some(deduction =>
    deduction?.category === 'composition' &&
    /main articles/i.test(String(deduction.reason || '')) &&
    Number(qualityReport?.metrics?.article_count || 0) < articlePolicy.mainArticleCount.min
  );
}

module.exports = {
  finalArticleSlotDistribution,
  deductionRepairPolicy,
  mergeRepairPolicies,
  recommendedFixMentionsSection,
  articleResultMatchesSection,
  articleResultForSection,
  buildSectionRepairPlan,
  buildFullSectionRepairPlan,
  sectionMatchesRepairItem,
  sectionsMatchingRepairPlan,
  sectionsOutsideRepairPlan,
  hasTooFewMainArticlesDeduction
};
