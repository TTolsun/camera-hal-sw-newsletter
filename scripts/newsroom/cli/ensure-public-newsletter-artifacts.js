const fs = require('fs');
const path = require('path');

const {
  buildFallbackPublicIssue
} = require('../generate/fallback-public-issue');
const {
  buildReviewableArtifactOutputs,
  resolveDate,
  resolveReviewableArtifacts
} = require('./resolve-reviewable-artifacts');
const {
  readStatus,
  renderGithubOutputs
} = require('./write-generation-status-output');
const {
  articlePolicy
} = require('../common/newsletter-policy');

// Contract:
// - This command ensures the workflow has either publishable public newsletter artifacts
//   or reviewable failure artifacts.
// - It must not mark review-only artifacts as publish-ready.
// - It may exit successfully with public_newsletter_ready=false when review_pr_ready=true.
const FALLBACK_TRIGGER_STATUSES = new Set([
  'NEEDS_FIX',
  'QUALITY_NEEDS_FIX',
  'UNDERFILLED_NEEDS_FIX',
  'FAILED_REPAIR_REVIEWABLE'
]);

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--date') {
      options.date = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--root') {
      options.root = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--no-build') {
      options.noBuild = true;
    } else if (arg) {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function hasArtifactInputs(root, date) {
  return [
    path.join(root, 'content', 'newsroom', date, 'editor-draft.json'),
    path.join(root, 'content', 'newsroom', date, 'editor-draft-attempt-1.json'),
    path.join(root, 'content', 'newsroom', date, 'shortlisted-candidates.json'),
    path.join(root, 'content', 'newsroom', date, 'article-capsules.json'),
    path.join(root, 'content', 'newsroom', date, 'reporter-candidates.json'),
    path.join(root, 'content', 'collected-news', date, 'candidates.json')
  ].some(filePath => fs.existsSync(filePath));
}

function hardFailureArticleCount(qualityReport = {}) {
  return ensureArray(qualityReport.article_results).filter(result => {
    const hardReasons = ensureArray(result.hard_fail_reasons).join(' ');
    const blockingDeductions = ensureArray(result.deductions).some(item => item?.blocking === true);
    const status = String(result.status || '');
    const repairAction = String(result.repair_action || '');
    return status === 'FAIL' ||
      repairAction === 'replace-or-demote' ||
      blockingDeductions ||
      /source-integrity|scope-relevance|source gap|must_fix/i.test(hardReasons) ||
      result.scope_count?.publishable_scope === false;
  }).length;
}

function fallbackTriggerReasons({ root, date, resolved }) {
  const status = resolved.status || {};
  const newsroomDir = path.join(root, 'content', 'newsroom', date);
  const qualityReport = readJsonIfExists(path.join(newsroomDir, 'quality-report.json')) || {};
  const factCheck = readJsonIfExists(path.join(newsroomDir, 'fact-check-report.json')) || {};
  const repairFailure = readJsonIfExists(path.join(newsroomDir, 'repair-failure.json'));
  const repairFailureExists = Boolean(repairFailure);
  const reasons = [];

  if (resolved.publicNewsletterReady !== true) {
    reasons.push('public_newsletter_not_ready');
  }
  if (FALLBACK_TRIGGER_STATUSES.has(status.status) || FALLBACK_TRIGGER_STATUSES.has(status.generation_status)) {
    reasons.push(`status=${status.status || status.generation_status}`);
  }
  if (status.final_publish_ready === false || status.final_publish_ready === 'false') {
    reasons.push('final_publish_ready=false');
  }
  if (repairFailureExists) {
    reasons.push('repair_failure');
  }
  const qualityScore = numeric(qualityReport.score ?? status.quality_score);
  const qualityThreshold = numeric(qualityReport.threshold ?? status.quality_threshold);
  if (qualityReport.status && qualityReport.status !== 'PASS') {
    reasons.push(`quality_status=${qualityReport.status}`);
  }
  if (qualityScore !== null && qualityThreshold !== null && qualityScore < qualityThreshold) {
    reasons.push('quality_score_below_threshold');
  }
  const hardFailures = hardFailureArticleCount(qualityReport);
  if (hardFailures > 0) {
    reasons.push(`hard_failure_article_count=${hardFailures}`);
  }
  const sectionDrift = [
    status.repair_failure_kind,
    status.failure_reason,
    repairFailure?.code,
    repairFailure?.message,
    repairFailure?.reason,
    repairFailure?.details
  ].map(value => typeof value === 'string' ? value : JSON.stringify(value || '')).join('\n').includes('section_count_drift');
  if (sectionDrift) {
    reasons.push('section_count_drift');
  }
  const mainCount = numeric(status.rendered_main_article_count ?? status.final_selected_article_count ?? status.selected_article_count);
  const minCount = numeric(status.min_final_articles) ?? articlePolicy.mainArticleCount.min;
  if (mainCount !== null && minCount !== null && mainCount < minCount) {
    reasons.push('article_shortage');
  } else if (status.underfilled === true || status.underfilled === 'true') {
    reasons.push('article_shortage');
  }
  if (numeric(factCheck.source_gap_count ?? status.source_gap_count) > 0) {
    reasons.push('source_gap_count');
  }
  if (ensureArray(factCheck.must_fix).length > 0 || numeric(status.must_fix_count) > 0) {
    reasons.push('must_fix_count');
  }

  return [...new Set(reasons)];
}

function summarizeRejectedReasons(items) {
  const counts = new Map();
  for (const item of ensureArray(items)) {
    const reason = String(item?.reason || item?.selection_exclusion_reason || 'unknown').trim() || 'unknown';
    counts.set(reason, (counts.get(reason) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }));
}

function readJsonSafely(filePath) {
  try {
    return readJsonIfExists(filePath) || {};
  } catch (_) {
    return {};
  }
}

function writeFallbackFailureDiagnostics({ root, date, error, status = {} }) {
  const relPath = `content/newsroom/${date}/fallback-public-issue-diagnostics.json`;
  const filePath = path.join(root, ...relPath.split('/'));
  const existing = readJsonSafely(filePath);
  const rejectedCandidates = ensureArray(existing.rejected_candidates);
  const currentFailureReason = String(error?.message || error || 'Unknown fallback public issue failure.');
  const previousFailureReason = existing.failure_reason && existing.failure_reason !== currentFailureReason
    ? existing.failure_reason
    : undefined;
  const payload = {
    ...existing,
    date,
    generated_at: new Date().toISOString(),
    status: 'FAILED',
    fallback_public_issue_status: 'FAILED',
    source_status: status.generation_status || status.status || 'unknown',
    failure_stage: 'fallback_public_issue_builder',
    failure_reason: currentFailureReason,
    previous_failure_reason: previousFailureReason,
    fallback_public_issue_failed: true,
    original_fact_check_status: existing.original_fact_check_status || status.fact_check_status || 'UNKNOWN',
    original_must_fix_count: existing.original_must_fix_count ?? status.must_fix_count ?? 'unknown',
    original_source_gap_count: existing.original_source_gap_count ?? status.source_gap_count ?? 'unknown',
    fallback_public_issue_removed_blockers: existing.fallback_public_issue_removed_blockers ?? false,
    fallback_public_issue_removed_article_count: existing.fallback_public_issue_removed_article_count ?? ensureArray(existing.demoted_articles).length,
    preserve_article_count: existing.preserve_article_count ?? 'unknown',
    final_article_count: existing.final_article_count ?? 'unknown',
    minimum_required_count: existing.minimum_required_count ?? articlePolicy.mainArticleCount.min,
    demoted_articles: ensureArray(existing.demoted_articles),
    top_rejected_reasons: ensureArray(existing.top_rejected_reasons).length > 0
      ? existing.top_rejected_reasons
      : summarizeRejectedReasons(rejectedCandidates),
    written_by: 'ensure-public-newsletter-artifacts'
  };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return relPath;
}

function changedArtifactsForRecheck(options, fallbackResult, extraArtifacts = []) {
  if (Object.prototype.hasOwnProperty.call(options, 'changedArtifacts')) {
    return [...new Set(ensureArray(options.changedArtifacts).concat(extraArtifacts).filter(Boolean))];
  }
  if (fallbackResult?.publicFiles) {
    return [...new Set(ensureArray(fallbackResult.publicFiles).concat(extraArtifacts).filter(Boolean))];
  }
  return undefined;
}

function resolveReviewableArtifactsForEnsure(baseOptions, changedArtifacts) {
  const options = { ...baseOptions };
  if (changedArtifacts !== undefined) {
    options.changedArtifacts = changedArtifacts;
  }
  return resolveReviewableArtifacts(options);
}

function ensurePublicNewsletterArtifacts(options = {}) {
  const root = options.root || process.cwd();
  const statusPath = path.join(root, '.tmp', 'newsletter-generation-status.json');
  const status = options.status || readStatus(statusPath);
  const date = resolveDate({ root, status, explicitDate: options.date });
  if (!date) {
    throw new Error('Could not resolve newsletter date.');
  }

  let resolved = resolveReviewableArtifactsForEnsure({
    root,
    date,
    status
  }, Object.prototype.hasOwnProperty.call(options, 'changedArtifacts') ? options.changedArtifacts : undefined);
  const initialReasons = fallbackTriggerReasons({ root, date, resolved });
  const fallbackAlreadyCreated = resolved.status?.fallback_public_issue_status === 'CREATED';
  let fallbackExecuted = false;
  let fallbackError = null;
  let fallbackResult = null;
  let fallbackDiagnosticsRelPath = '';

  if (initialReasons.length > 0 && !fallbackAlreadyCreated && !options.noBuild) {
    if (!hasArtifactInputs(root, date)) {
      throw new Error(`Cannot build fallback public issue for ${date}: no newsroom or collected candidate artifacts are available.`);
    }
    fallbackExecuted = true;
    try {
      fallbackResult = buildFallbackPublicIssue({ root, date });
    } catch (error) {
      fallbackError = error;
      fallbackDiagnosticsRelPath = writeFallbackFailureDiagnostics({ root, date, error, status });
    }
    const recheckStatus = fallbackResult?.status || status;
    resolved = resolveReviewableArtifactsForEnsure({
      root,
      date,
      status: recheckStatus
    }, changedArtifactsForRecheck(options, fallbackResult, fallbackDiagnosticsRelPath ? [fallbackDiagnosticsRelPath] : []));
  }

  if (!resolved.publicNewsletterReady) {
    const reason = resolved.publicNewsletterReason || 'public newsletter artifacts are not structurally ready';
    if (resolved.reviewPrReady) {
      return {
        date,
        fallbackExecuted,
        fallbackAlreadyCreated,
        fallbackTriggerReasons: initialReasons,
        resolved,
        outputs: {
          ...buildReviewableArtifactOutputs(resolved),
          fallback_public_issue_executed: fallbackExecuted ? 'true' : 'false',
          fallback_public_issue_already_created: fallbackAlreadyCreated ? 'true' : 'false',
          fallback_public_issue_failed: fallbackError ? 'true' : 'false',
          fallback_public_issue_error: fallbackError ? String(fallbackError.message || fallbackError) : 'none',
          fallback_public_issue_diagnostics: fallbackDiagnosticsRelPath || 'none',
          fallback_public_issue_trigger_reason: initialReasons.join('; ') || 'none'
        }
      };
    }
    if (fallbackError) {
      throw new Error(`${reason}\nFallback public issue builder failed: ${fallbackError.message}`);
    }
    throw new Error(reason);
  }

  return {
    date,
    fallbackExecuted,
    fallbackAlreadyCreated,
    fallbackTriggerReasons: initialReasons,
    resolved,
    outputs: {
      ...buildReviewableArtifactOutputs(resolved),
      fallback_public_issue_executed: fallbackExecuted ? 'true' : 'false',
      fallback_public_issue_already_created: fallbackAlreadyCreated ? 'true' : 'false',
      fallback_public_issue_failed: fallbackError ? 'true' : 'false',
      fallback_public_issue_error: fallbackError ? String(fallbackError.message || fallbackError) : 'none',
      fallback_public_issue_diagnostics: fallbackDiagnosticsRelPath || 'none',
      fallback_public_issue_trigger_reason: initialReasons.join('; ') || 'none'
    }
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  try {
    const result = ensurePublicNewsletterArtifacts(options);
    process.stdout.write(`${renderGithubOutputs(result.outputs)}\n`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  fallbackTriggerReasons,
  hardFailureArticleCount,
  ensurePublicNewsletterArtifacts,
  writeFallbackFailureDiagnostics,
  parseArgs
};
