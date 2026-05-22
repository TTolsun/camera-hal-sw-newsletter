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
const {
  decodeHtml
} = require('../common/common');
const {
  articleIdentityKey,
  normalizeArticleUrl
} = require('../common/article-identity');
const {
  readExposureHistory,
  recordArticleExposure,
  writeExposureHistory
} = require('../common/article-exposure-history');
const {
  computeHeadlineScore,
  headlineSnapshotFromCandidate,
  isHeadlineEligible,
  writeHomepageHeadlineState
} = require('../common/homepage-headline');
const {
  reconcilePublicState
} = require('../common/public-state-reconciliation');

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

function editorDraftSectionCount(root, date) {
  const editor = readJsonSafely(path.join(root, 'content', 'newsroom', date, 'editor-draft.json'));
  return ensureArray(editor.sections).length;
}

function shouldPreserveReviewableDraftWithoutFallback({ root, date, resolved, initialReasons }) {
  const status = resolved.status || {};
  const statusValues = new Set([status.status, status.generation_status].filter(Boolean));
  if (!statusValues.has('FAILED_REPAIR_REVIEWABLE')) return false;
  if (resolved.reviewPrReady !== true) return false;
  if (editorDraftSectionCount(root, date) < articlePolicy.mainArticleCount.min) return false;
  const reasonText = ensureArray(initialReasons).join('\n');
  return /repair_failure|section_count_drift|quality_status|must_fix_count|source_gap_count/.test(reasonText);
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

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function relativeArtifactPath(root, filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function stripHtml(value = '') {
  return decodeHtml(String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));
}

function matchFirst(value, pattern) {
  const match = String(value || '').match(pattern);
  return match ? match[1] : '';
}

function readRenderedNewsletterArticles(root, date) {
  const htmlPath = path.join(root, 'newsletters', date, 'index.html');
  if (!fs.existsSync(htmlPath)) return [];
  const html = fs.readFileSync(htmlPath, 'utf8');
  return [...html.matchAll(/<div class="[^"]*\barticle-card\b[^"]*"[\s\S]*?<\/div>\s*<\/section>/gi)]
    .map(match => {
      const block = match[0];
      const sourceUrl = decodeHtml(
        matchFirst(block, /<div class="source-list"[\s\S]*?<a[^>]*href="([^"]+)"/i) ||
        matchFirst(block, /<figcaption[\s\S]*?<a[^>]*href="([^"]+)"/i)
      );
      const title = stripHtml(matchFirst(block, /<h3[^>]*>([\s\S]*?)<\/h3>/i));
      const summary = stripHtml(
        matchFirst(block, /<p[^>]*class="[^"]*\barticle-lead\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i) ||
        matchFirst(block, /<p[^>]*>([\s\S]*?)<\/p>/i)
      );
      const sourceName = stripHtml(
        matchFirst(block, /<figcaption[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) ||
        matchFirst(block, /<div class="source-list"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)
      );
      if (!title || !summary || !sourceUrl) return null;
      return {
        article_identity_key: articleIdentityKey({ source_url: sourceUrl }),
        title,
        summary,
        source_url: sourceUrl,
        source_name: sourceName || 'source'
      };
    })
    .filter(Boolean);
}

function renderedHeadlineState({ root, date, state, shortlist }) {
  const rendered = readRenderedNewsletterArticles(root, date);
  if (rendered.length === 0 || !state?.current_headline) return state;
  const newsletterUrl = `newsletters/${date}/index.html`;
  const selectedByKey = new Map(ensureArray(shortlist.selected_articles).map(candidate => [
    articleIdentityKey(candidate),
    candidate
  ]));
  const current = state.current_headline;
  const currentSource = normalizeArticleUrl(current.source_url);
  const renderedCurrent = rendered.find(article =>
    article.article_identity_key === current.article_identity_key ||
    normalizeArticleUrl(article.source_url) === currentSource
  );

  if (renderedCurrent) {
    return {
      ...state,
      current_headline: {
        ...current,
        title: renderedCurrent.title,
        summary: renderedCurrent.summary,
        source_url: renderedCurrent.source_url,
        newsletter_url: newsletterUrl,
        snapshot: {
          ...(current.snapshot || {}),
          source_name: renderedCurrent.source_name || current.snapshot?.source_name || ''
        }
      }
    };
  }

  const fallback = rendered
    .map(article => {
      const selected = selectedByKey.get(article.article_identity_key) || {};
      const candidate = {
        ...selected,
        article_identity_key: article.article_identity_key,
        canonical_url: article.source_url,
        normalized_url: article.source_url,
        url: article.source_url,
        article_url: article.source_url,
        source_url: article.source_url,
        title: article.title,
        summary: article.summary,
        newsletter_date: date,
        newsletter_url: newsletterUrl,
        selected_at: date,
        snapshot: {
          ...(selected.snapshot || {}),
          source_name: article.source_name || selected.source_name || selected.source || ''
        }
      };
      if (!isHeadlineEligible(candidate)) return null;
      return {
        candidate,
        score: computeHeadlineScore(candidate).headline_score
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.candidate.title.localeCompare(right.candidate.title))[0];

  if (!fallback) return state;
  return {
    ...state,
    current_headline: headlineSnapshotFromCandidate(fallback.candidate, {
      date,
      newsletterUrl,
      scoredAt: date
    })
  };
}

function persistHomepageHeadlineArtifacts({ root, date, resolved }) {
  if (resolved.publicNewsletterReady !== true) return [];
  const shortlistPath = path.join(root, 'content', 'newsroom', date, 'shortlisted-candidates.json');
  const selectionReportPath = path.join(root, 'content', 'newsroom', date, 'selection-report.json');
  const shortlist = readJsonSafely(shortlistPath);
  const state = renderedHeadlineState({
    root,
    date,
    state: shortlist.homepage_headline_state,
    shortlist
  });
  if (!state || typeof state !== 'object' || !state.current_headline) return [];

  const files = [];
  const headlinePath = writeHomepageHeadlineState(root, state);
  files.push(relativeArtifactPath(root, headlinePath));

  let history = readExposureHistory(root, date);
  history = recordArticleExposure(history, state.current_headline, {
    date,
    type: 'homepage_headline',
    score: state.current_headline.current_score,
    reuseReason: shortlist.headline_decision?.reason || shortlist.headline_decision?.decision || '',
    newsletterUrl: state.current_headline.newsletter_url
  });
  const historyPath = writeExposureHistory(root, history);
  files.push(relativeArtifactPath(root, historyPath));

  shortlist.article_exposure_coverage = history.coverage;
  writeJson(shortlistPath, shortlist);
  files.push(relativeArtifactPath(root, shortlistPath));

  const selectionReport = readJsonSafely(selectionReportPath);
  if (Object.keys(selectionReport).length > 0) {
    selectionReport.article_exposure_coverage = history.coverage;
    writeJson(selectionReportPath, selectionReport);
    files.push(relativeArtifactPath(root, selectionReportPath));
  }
  return files;
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

function isTrue(value) {
  return value === true || value === 'true';
}

function buildEnsureOutputs(resolved, reconciliation, fallbackState) {
  return {
    ...buildReviewableArtifactOutputs(resolved),
    ...reconciliation.outputs,
    fallback_public_issue_executed: fallbackState.fallbackExecuted ? 'true' : 'false',
    fallback_public_issue_already_created: fallbackState.fallbackAlreadyCreated ? 'true' : 'false',
    fallback_public_issue_failed: fallbackState.fallbackError ? 'true' : 'false',
    fallback_public_issue_error: fallbackState.fallbackError ? String(fallbackState.fallbackError.message || fallbackState.fallbackError) : 'none',
    fallback_public_issue_diagnostics: fallbackState.fallbackDiagnosticsRelPath || 'none',
    fallback_public_issue_skipped: fallbackState.fallbackSkipped ? 'true' : 'false',
    fallback_public_issue_skip_reason: fallbackState.fallbackSkipReason || 'none',
    fallback_public_issue_trigger_reason: fallbackState.initialReasons.join('; ') || 'none'
  };
}

function reconcileResolvedArtifacts({ root, date, resolved, fallbackState }) {
  const headlineArtifacts = persistHomepageHeadlineArtifacts({ root, date, resolved });
  const resolvedWithHeadlineArtifacts = {
    ...resolved,
    changedArtifacts: [...new Set(ensureArray(resolved.changedArtifacts).concat(headlineArtifacts))]
  };
  const reconciliationStatus = {
    ...(resolvedWithHeadlineArtifacts.status || {}),
    public_newsletter_ready: resolvedWithHeadlineArtifacts.publicNewsletterReady === true,
    review_publication_ready: resolvedWithHeadlineArtifacts.reviewPublicationReady === true ||
      isTrue(resolvedWithHeadlineArtifacts.status?.review_publication_ready),
    diagnostics_only: resolvedWithHeadlineArtifacts.diagnosticsOnly === true,
    homepage_visible_after_merge: resolvedWithHeadlineArtifacts.homepageVisibleAfterMerge === true
  };
  const reconciliation = reconcilePublicState({
    root,
    date,
    status: reconciliationStatus,
    changedArtifacts: resolvedWithHeadlineArtifacts.changedArtifacts,
    write: true
  });
  const reconciledResolved = resolveReviewableArtifactsForEnsure({
    root,
    date,
    status: reconciliation.statusPatch
  }, reconciliation.changedArtifacts);
  return {
    reconciliation,
    reconciledResolved,
    outputs: buildEnsureOutputs(reconciledResolved, reconciliation, fallbackState)
  };
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
  let fallbackSkipped = false;
  let fallbackSkipReason = '';
  let fallbackError = null;
  let fallbackResult = null;
  let fallbackDiagnosticsRelPath = '';

  if (initialReasons.length > 0 && !fallbackAlreadyCreated && !options.noBuild) {
    if (shouldPreserveReviewableDraftWithoutFallback({ root, date, resolved, initialReasons })) {
      fallbackSkipped = true;
      fallbackSkipReason = 'preserve_reviewable_gemini_draft_after_failed_repair';
    } else if (!hasArtifactInputs(root, date)) {
      throw new Error(`Cannot build fallback public issue for ${date}: no newsroom or collected candidate artifacts are available.`);
    } else {
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
  }

  const fallbackState = {
    fallbackExecuted,
    fallbackAlreadyCreated,
    fallbackSkipped,
    fallbackSkipReason,
    fallbackError,
    fallbackDiagnosticsRelPath,
    initialReasons
  };

  if (!resolved.publicNewsletterReady) {
    const reason = resolved.publicNewsletterReason || 'public newsletter artifacts are not structurally ready';
    if (resolved.reviewPrReady) {
      const reconciled = reconcileResolvedArtifacts({ root, date, resolved, fallbackState });
      return {
        date,
        fallbackExecuted,
        fallbackAlreadyCreated,
        fallbackSkipped,
        fallbackTriggerReasons: initialReasons,
        resolved: reconciled.reconciledResolved,
        reconciliation: reconciled.reconciliation,
        outputs: reconciled.outputs
      };
    }
    if (fallbackError) {
      throw new Error(`${reason}\nFallback public issue builder failed: ${fallbackError.message}`);
    }
    throw new Error(reason);
  }

  const reconciled = reconcileResolvedArtifacts({ root, date, resolved, fallbackState });
  return {
    date,
    fallbackExecuted,
    fallbackAlreadyCreated,
    fallbackSkipped,
    fallbackTriggerReasons: initialReasons,
    resolved: reconciled.reconciledResolved,
    reconciliation: reconciled.reconciliation,
    outputs: reconciled.outputs
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
  shouldPreserveReviewableDraftWithoutFallback,
  ensurePublicNewsletterArtifacts,
  writeFallbackFailureDiagnostics,
  parseArgs
};
