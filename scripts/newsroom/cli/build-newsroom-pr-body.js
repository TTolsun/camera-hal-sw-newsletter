const fs = require('fs');
const path = require('path');

const {
  renderCandidateSelectionDiagnostics
} = require('../generate/selection-diagnostics');
const {
  formatReasonSummary,
  readStatus
} = require('./write-generation-status-output');

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8').trim() : '';
}

function valueOrUnknown(value) {
  if (value === null || value === undefined || value === '') return 'unknown';
  return String(value);
}

function resolveDate(options = {}) {
  if (options.date) return options.date;
  const datePath = path.join(process.cwd(), '.tmp', 'newsletter-date.txt');
  if (fs.existsSync(datePath)) return fs.readFileSync(datePath, 'utf8').trim();
  return process.env.NEWSLETTER_DATE || '';
}

function buildNewsroomPrBody(options = {}) {
  const root = options.root || process.cwd();
  const date = resolveDate(options);
  const status = options.status || readStatus(path.join(root, '.tmp', 'newsletter-generation-status.json'));
  const validateOutcome = options.validateOutcome || process.env.VALIDATE_OUTCOME || 'unknown';
  const newsroomDir = path.join(root, 'content', 'newsroom', date);
  const editorBrief = date ? readTextIfExists(path.join(newsroomDir, 'editor-in-chief-brief.md')) : '';
  const finalSelectedCount = Number(status.final_selected_article_count ?? status.selected_article_count);
  const minFinalArticles = Number(status.selection_policy?.min_final_articles || 4);
  const lines = [];

  if (editorBrief) {
    lines.push(editorBrief, '');
  }

  lines.push(
    '## Generation Status',
    '',
    `Status: ${valueOrUnknown(status.status)}`,
    `Fact-check status: ${valueOrUnknown(status.fact_check_status)}`,
    `Fact-check must-fix count: ${valueOrUnknown(status.must_fix_count ?? 0)}`,
    `Quality score: ${valueOrUnknown(status.quality_score)}`,
    `Quality threshold: ${valueOrUnknown(status.quality_threshold)}`,
    'Max score: 100',
    `Result: ${valueOrUnknown(status.quality_status)}`,
    `Quality attempts: ${valueOrUnknown(status.quality_attempt_count)}`,
    `Locked articles: ${valueOrUnknown(status.locked_article_count)}`,
    `Repaired sections: ${valueOrUnknown(status.repaired_section_count ?? 0)}`,
    `Skipped repair sections: ${valueOrUnknown(status.skipped_repair_section_count ?? 0)}`,
    `Validation outcome: ${validateOutcome}`,
    `Publish ready: ${status.publish_ready === true ? 'true' : 'false'}`,
    `Selection publish ready: ${status.selection_publish_ready === true ? 'true' : 'false'}`,
    `Final publish ready: ${status.final_publish_ready === true ? 'true' : 'false'}`,
    `Editor review required: ${status.editor_review_required === true ? 'true' : 'false'}`,
    `Underfilled thin-week path: ${status.underfilled === true ? 'true' : 'false'}`,
    ''
  );

  if (status.underfilled === true) {
    lines.push(
      `Only ${Number.isFinite(finalSelectedCount) ? finalSelectedCount : valueOrUnknown(status.final_selected_article_count ?? status.selected_article_count)} publishable articles were selected; expected at least ${minFinalArticles}.`,
      ''
    );
  }

  lines.push(
    '## Composition Summary',
    '',
    `- composition_mode: ${valueOrUnknown(status.composition_mode)}`,
    `- selection_composition_mode: ${valueOrUnknown(status.selection_composition_mode ?? status.composition_mode)}`,
    `- final_publish_ready: ${status.final_publish_ready === true ? 'true' : 'false'}`,
    `- editor_review_required: ${status.editor_review_required === true ? 'true' : 'false'}`,
    `- direct_aosp_camera count: ${valueOrUnknown(status.direct_aosp_camera_count ?? status.composition_summary?.direct_aosp_camera_count)}`,
    `- camera_driver_image_pipeline count: ${valueOrUnknown(status.camera_driver_image_pipeline_count ?? status.composition_summary?.camera_driver_image_pipeline_count)}`,
    `- android_platform_camera_adjacent count: ${valueOrUnknown(status.android_platform_camera_adjacent_count ?? status.composition_summary?.android_platform_camera_adjacent_count)}`,
    `- soc_platform_signal count: ${valueOrUnknown(status.soc_platform_signal_count ?? status.composition_summary?.soc_platform_signal_count)}`,
    `- cpp_ai_tooling_fallback count: ${valueOrUnknown(status.cpp_ai_tooling_fallback_count ?? status.composition_summary?.cpp_ai_tooling_fallback_count)}`,
    `- generic_tech_watchlist count: ${valueOrUnknown(status.generic_tech_watchlist_count ?? status.composition_summary?.generic_tech_watchlist_count)}`,
    `- composition reason: ${valueOrUnknown(status.composition_reason)}`,
    ''
  );

  if (status.composition_mode === 'FALLBACK_COMPOSITION') {
    lines.push(
      'Fallback composition: direct AOSP Camera/driver candidates were limited, so SoC/platform or C++/AI tooling articles are included as lower-priority reviewable main articles. Do not add artificial Camera HAL wording; keep the practical SoC/platform/native development connection explicit.',
      ''
    );
  }

  if (status.composition_mode === 'THIN_WEEK_REVIEW') {
    lines.push(
      'Thin-week review path: this PR is reviewable but not publish-ready. Automatic publish/deploy must stay blocked.',
      ''
    );
  }

  lines.push(
    '## Deterministic Final Selection Status',
    '',
    `- Input candidates: ${valueOrUnknown(status.input_candidate_count)}`,
    `- Eligible candidates: ${valueOrUnknown(status.eligible_candidate_count)}`,
    `- Selected articles: ${valueOrUnknown(status.selected_article_count)}`,
    `- Reporter candidates: ${valueOrUnknown(status.reporter_candidate_count)}`,
    `- Reporter-selected candidates: ${valueOrUnknown(status.reporter_selected_count)}`,
    `- Final input candidates: ${valueOrUnknown(status.final_input_candidate_count ?? status.input_candidate_count)}`,
    `- Final eligible candidates: ${valueOrUnknown(status.final_eligible_candidate_count ?? status.eligible_candidate_count)}`,
    `- Final selected articles: ${valueOrUnknown(status.final_selected_article_count ?? status.selected_article_count)}`,
    `- Reporter-selected but final-excluded: ${valueOrUnknown(status.reporter_selected_but_final_excluded_count)}`,
    `- Selection warnings: ${ensureArray(status.selection_warnings).join('; ') || 'none'}`,
    `- Selection errors: ${ensureArray(status.selection_errors).join('; ') || 'none'}`,
    `- Top exclusion reasons: ${formatReasonSummary(status.exclusion_reason_summary)}`,
    `- Top final exclusion reasons: ${formatReasonSummary(ensureArray(status.final_exclusion_reason_summary).length > 0 ? status.final_exclusion_reason_summary : status.exclusion_reason_summary)}`,
    '',
    renderCandidateSelectionDiagnostics(status),
    '',
    '## Editor Action Guidance',
    '',
    '- This PR is generated for editor review and is not auto-merged.',
    '- Resolve fact-check must-fix items separately from editorial quality deductions.',
    '- If facts cannot be verified, demote the item to briefing/watchlist or exclude it instead of promoting a source-gap article.',
    '- Keep valid locked articles unchanged and avoid duplicate URLs, titles, and source-date-title combinations.',
    ''
  );

  if (status.status !== 'PASS' || validateOutcome === 'failure' || status.final_publish_ready !== true) {
    lines.push(
      `- Review content/newsroom/${date}/fact-check-report.md, content/newsroom/${date}/quality-report.md, and validation output before publishing.`,
      ''
    );
  }

  lines.push(
    '## Generated Artifacts',
    '',
    `- content/collected-news/${date}/candidates.json`,
    `- content/newsroom/${date}/shortlisted-candidates.json`,
    `- content/newsroom/${date}/article-capsules.json`,
    `- content/newsroom/${date}/reporter-candidates.json`,
    `- content/newsroom/${date}/editor-draft.json`,
    `- content/newsroom/${date}/fact-check-report.json`,
    `- content/newsroom/${date}/quality-report.json`,
    `- content/newsroom/${date}/quality-report.md`,
    `- content/newsroom/${date}/retry-history.json`,
    `- content/newsroom/${date}/retry-history.md`,
    `- content/newsroom/${date}/recovery-prompt.md (only when recovery is needed)`,
    `- newsletters/${date}/newsletter.md`,
    `- newsletters/${date}/index.html`,
    '- data/newsletters.json'
  );

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

function main() {
  process.stdout.write(buildNewsroomPrBody());
}

if (require.main === module) {
  main();
}

module.exports = {
  buildNewsroomPrBody,
  resolveDate
};
