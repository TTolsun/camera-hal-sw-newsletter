'use strict';

const { ensureArray } = require('../../shared/common/value-coercion');
const {
  articlePolicy,
  articleCountRangeText,
  publishGateCriteriaText
} = require('../../shared/common/newsletter-policy');
const {
  articleSectionContractRows,
  articleSectionContractRowValues
} = require('../reporter/article-structure-summary');
const { text } = require('./quality-text');
const {
  blockingDeductions,
  softDeductions
} = require('./quality-deduction-rules');

// Markdown rendering of the quality report. Moved verbatim out of newsletter-quality.js
// as part of the SRP split (issue #52 phase 6); the report text is byte-for-byte identical.

function markdownTableCell(value) {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\|/g, '\\|') || 'none';
}

function truncateText(value, limit = 100) {
  const normalized = String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.length > limit ? `${normalized.slice(0, Math.max(0, limit - 3))}...` : normalized;
}

function articleSectionContractMarkdownRows(report) {
  const rows = articleSectionContractRows(ensureArray(report.sections), {
    articleResults: ensureArray(report.article_results)
  });
  return rows.map(row =>
    `| ${articleSectionContractRowValues(row).map(markdownTableCell).join(' | ')} |`
  ).join('\n') || '| none | none | none | none | none | none | none |';
}

function buildQualityReportMarkdown(report) {
  const deductions = ensureArray(report.deductions);
  const hardItems = blockingDeductions(deductions);
  const softItems = softDeductions(deductions);
  const metrics = report.metrics || {};
  const articleCount = Number(metrics.article_count);
  const compositionFailure = Number.isFinite(articleCount) && (articleCount < articlePolicy.mainArticleCount.min || articleCount > articlePolicy.mainArticleCount.max)
    ? `- Article composition failure: ${articleCount} main articles were generated; Newsletter Policy range is ${articleCountRangeText()}.`
    : '- Underfilled/composition failure: none';
  const topDeductionCategories = ensureArray(metrics.top_deduction_categories)
    .map(item => `- ${item.category} (${item.count})`)
    .join('\n') || '- none';
  const candidateExclusionSummary = ensureArray(metrics.candidate_exclusion_summary)
    .map(item => `- ${item.reason} (${item.count})`)
    .join('\n') || '- none';
  const halSignalSummary = report.hal_signal_quality_summary || metrics.hal_signal_quality_summary || {};
  const claimSummary = report.claim_validation_summary || metrics.claim_validation_summary || {};
  const claimRows = ensureArray(report.claim_results)
    .slice(0, 40)
    .map(item => [
      item.article_headline || `article ${item.article_index || ''}`,
      `${item.claim_id || 'claim'}: ${truncateText(item.text || '', 100)}`,
      item.claim_type || 'unknown',
      item.status || 'not_available',
      item.impact_level || 'unknown',
      item.overclaim_risk || 'unknown',
      ensureArray(item.issues).map(issue => issue.reason_code || issue.message).filter(Boolean).join(', ') || 'none',
      ensureArray(item.evidence_ids).join(', ') || 'none',
      ensureArray(item.source_urls).join(', ') || 'none'
    ])
    .map(row => `| ${row.map(markdownTableCell).join(' | ')} |`)
    .join('\n') || '| none | none | none | none | none | none | none | none | none |';
  const uncoveredFactLines = ensureArray(report.uncovered_facts)
    .slice(0, 12)
    .map(item => `- article=${item.article_index}; headline=${markdownTableCell(item.article_headline || '')}; field=${item.field}; reason=${item.reason_code}; text=${markdownTableCell(item.text || '')}`)
    .join('\n') || '- none';
  const halSignalRows = ensureArray(report.main_article_signal_checks || metrics.main_article_signal_checks)
    .map(item => [
      item.index || '',
      item.title || '',
      item.signal_quality_status || 'unknown',
      item.actionability_level || 'unknown',
      item.effective_actionability_level || item.actionability_level || 'unknown',
      ensureArray(item.hal_impact_axes).join(', ') || 'none',
      item.hal_signal_capsule_complete === true ? 'complete' : `missing ${ensureArray(item.hal_signal_capsule_missing_keys).join(', ') || 'capsule'}`,
      ensureArray(item.hard_blocker_reason_codes || item.hard_blockers).join(', ') || 'none'
    ]);
  const halSignalTable = halSignalRows.length > 0
    ? halSignalRows.map(row => `| ${row.map(markdownTableCell).join(' | ')} |`).join('\n')
    : '| none | none | none | none | none | none | none | none |';
  const articleGateRows = ensureArray(report.article_results).map(item => [
    `| ${item.index || ''} `,
    ` ${item.status || 'UNKNOWN'} `,
    ` ${item.repair_action || ''} `,
    ` ${item.headline || ''} `,
    ` ${item.scope_count?.relevance_bucket || ''} `,
    ` ${item.scope_count?.editorial_priority ?? ''} `,
    ` ${item.scope_count?.counts_as_primary_camera_topic === true} `,
    ` ${item.scope_count?.counts_as_driver_topic === true} `,
    ` ${item.scope_count?.counts_as_soc_topic === true} `,
    ` ${item.scope_count?.counts_as_fallback_topic === true} `,
    ` ${item.scope_count?.publishable_scope === true} `,
    ` ${item.scope_count?.binding_status || ''} `,
    ` ${item.scope_count?.binding_source || ''} `,
    ` ${item.scope_count?.metadata_source || ''} `,
    ` ${ensureArray(item.scope_count?.missing_score_fields).join(', ') || 'none'} `,
    ` ${item.scope_count?.count_reason || ''} `,
    ` ${item.scope_count?.exclusion_reason_if_not_counted || 'none'} `,
    ` ${ensureArray(item.hard_fail_reasons).join('; ') || 'none'} `,
    ` ${ensureArray(item.soft_deductions).map(deduction => `${deduction.category}: ${deduction.reason}`).join('; ') || 'none'} |`
  ].join('|')).join('\n') || '| none | none | none | none | none | none | none | none | none | none | none | none | none | none | none | none |';
  const articleStructureRows = articleSectionContractMarkdownRows(report);
  const deductionLine = item => {
    const reasonCode = item.reason_code ? ` (${item.reason_code})` : '';
    return `- ${item.points} pt [${item.category}] ${item.location ? `${item.location}: ` : ''}${item.reason}${reasonCode}`;
  };
  const hardDeductionLines = hardItems.map(deductionLine).join('\n') || '- none';
  const softDeductionLines = softItems.map(deductionLine).join('\n') || '- none';
  // #654: surface each article the fact-checker marked not publishable, with the verdict's
  // confidence, so the human reviewer can see when a block is low-confidence (borderline,
  // run-to-run flip-prone) and decide whether to override it. confidence is already
  // canonicalized to high/medium/low/unspecified by the gate (normalizeVerdictConfidence).
  const unpublishableArticleLines = ensureArray(report.unpublishable_articles)
    .map(item => `- #${item.section_index} [confidence: ${markdownTableCell(item.confidence)}] ${markdownTableCell(item.headline)}: ${markdownTableCell(item.reason)}`)
    .join('\n') || '- none';

  return `# 뉴스레터 품질 리포트 - ${report.date}

## Gate Result

- Quality score: ${report.score}
- Quality threshold: ${report.threshold}
- Max score: ${report.max_score || 100}
- Result: ${report.status}
- Summary: ${report.summary}

## Publication Mode

- publication_mode: ${report.publication_mode || 'n/a'}
- homepage_visibility: ${report.homepage_visibility || 'n/a'}
- content_quality_score: ${report.content_quality_score ?? report.score ?? 'n/a'}
- camera_relevance_score: ${report.camera_relevance_score ?? 'n/a'}
- publication_mode_decision: ${report.publication_mode_decision || 'n/a'}
- fallback_only: ${String(report.fallback_only === true)}
- camera_anchor_count: ${report.camera_anchor_count ?? 'n/a'}
- fallback_public_ready: ${String(report.fallback_public_ready === true)}

## Composition

- Main article count: ${metrics.article_count}
- Briefing count: ${metrics.briefing_count}
- Structured camera article count: ${metrics.camera_article_count}
- Legacy regex camera article count: ${metrics.legacy_regex_camera_article_count ?? 'n/a'}
- Expanded-scope article count: ${metrics.expanded_scope_article_count}
- direct_aosp_camera count: ${metrics.direct_aosp_camera_count ?? 0}
- camera_driver_image_pipeline count: ${metrics.camera_driver_image_pipeline_count ?? 0}
- android count: ${metrics.android_count ?? 0}
- android_multimedia_camera_output count: ${metrics.android_multimedia_camera_output_count ?? 0}
- soc_platform_signal count: ${metrics.soc_platform_signal_count ?? 0}
- cpp_ai_tooling_fallback count: ${metrics.cpp_ai_tooling_fallback_count ?? 0}
- generic_tech_watchlist count: ${metrics.generic_tech_watchlist_count ?? 0}
- primary_camera_stack_count: ${metrics.primary_camera_stack_count ?? 0}
- supporting_main_article_count: ${metrics.supporting_main_article_count ?? 0}
- forbidden_main_article_count: ${metrics.forbidden_main_article_count ?? 0}
- fallback_relevance_count: ${metrics.fallback_relevance_count ?? 0}
- publishable_scope_count: ${metrics.publishable_scope_count ?? 0}
- composition_mode: ${metrics.composition_mode || 'UNKNOWN'}
- Newsletter Policy gate: ${publishGateCriteriaText()}
- Relevance bucket counts: ${JSON.stringify(metrics.relevance_bucket_counts || {})}
- Topic tier distribution (${metrics.topic_tier_distribution_source || 'relevance_bucket'}): ${JSON.stringify(metrics.topic_tier_distribution || {})}
- AI article count: ${metrics.ai_article_count}
${compositionFailure}

## HAL Signal Quality

- strong_signal_count: ${halSignalSummary.strong_signal_count ?? 0}
- usable_signal_count: ${halSignalSummary.usable_signal_count ?? 0}
- weak_signal_count: ${halSignalSummary.weak_signal_count ?? 0}
- watchlist_only_count: ${halSignalSummary.watchlist_only_count ?? 0}
- blocked_source_gap_count: ${halSignalSummary.blocked_source_gap_count ?? 0}
- article_count_with_hal_signal_capsule: ${halSignalSummary.article_count_with_hal_signal_capsule ?? 0}
- article_count_without_hal_signal_capsule: ${halSignalSummary.article_count_without_hal_signal_capsule ?? 0}
- generic_signal_hard_blocker_count: ${halSignalSummary.generic_signal_hard_blocker_count ?? 0}
- hal_signal_hard_blocker_count: ${halSignalSummary.hal_signal_hard_blocker_count ?? 0}
- hard_blocker_reason_code_counts: ${JSON.stringify(halSignalSummary.hard_blocker_reason_code_counts || {})}
- hal_impact_axis_counts: ${JSON.stringify(halSignalSummary.hal_impact_axis_counts || {})}
- actionability_level_counts: ${JSON.stringify(halSignalSummary.actionability_level_counts || {})}
- effective_actionability_level_counts: ${JSON.stringify(halSignalSummary.effective_actionability_level_counts || {})}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
${halSignalTable}

## Fact Check And Source Integrity

- Fact-check status: ${metrics.fact_check_status}
- Must-fix count: ${metrics.must_fix_count}
- Source-gap count: ${metrics.source_gap_count}
- Stale claim status: ${metrics.stale_claim_status || 'UNKNOWN'}
- Stale claim removals: ${metrics.stale_claim_removed_count ?? 0}
- Stale claim hard failures: ${metrics.stale_claim_hard_failure_count ?? 0}
- Source integrity violation count: ${metrics.source_integrity_violation_count || 0}
- Blocking deduction count: ${metrics.blocking_deduction_count || 0}
- Blocking deduction categories: ${ensureArray(metrics.blocking_deduction_categories).join(', ') || 'none'}
- Hard fail count: ${metrics.hard_fail_count || 0}
- Soft deduction count: ${metrics.soft_deduction_count || 0}

## Claim Binding

- Claim validation status: ${claimSummary.status || 'not_available'}
- Claim coverage: bound_claims=${claimSummary.bound_claims ?? 'unknown'}; total_claims=${claimSummary.total_claims ?? 'unknown'}
- Derived evidence mapping count: ${claimSummary.derived_evidence_mapping_count ?? metrics.derived_evidence_mapping_count ?? 0}
- Overclaim risk: ${claimSummary.overclaim_risk || 'unknown'}
- Uncovered fact count: ${metrics.uncovered_fact_count ?? ensureArray(report.uncovered_facts).length}

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${claimRows}

### Uncovered Facts

${uncoveredFactLines}

## Article Structure Contract

- Complete article sections: ${metrics.article_section_contract?.complete_count ?? 0}
- Incomplete article sections: ${metrics.article_section_contract?.incomplete_count ?? 0}

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
${articleStructureRows}

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${articleGateRows}

## Hard Fails

${hardDeductionLines}

## Soft Deductions

${softDeductionLines}

## Unpublishable Articles

${unpublishableArticleLines}

## Top Deduction Categories

${topDeductionCategories}

## Candidate Exclusion Summary

${candidateExclusionSummary}

## Deductions

${deductions.length === 0 ? '- none' : deductions.map(item => `- ${item.points} pt [${item.category}] ${item.location ? `${item.location}: ` : ''}${item.reason}`).join('\n')}
`;
}

module.exports = {
  markdownTableCell,
  truncateText,
  articleSectionContractMarkdownRows,
  buildQualityReportMarkdown
};
