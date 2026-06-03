const fs = require('fs');
const path = require('path');

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
  readExposureHistory,
  recordArticleExposure,
  writeExposureHistory
} = require('../common/article-exposure-history');
const {
  writeHomepageHeadlineState
} = require('../common/homepage-headline');
const {
  renderedHeadlineState
} = require('../common/headline-render-reconciliation');
const {
  reconcilePublicState
} = require('../common/public-state-reconciliation');

// Contract:
// - This command ensures the workflow has either publishable public newsletter artifacts
//   or reviewable failure artifacts.
// - It must not mark review-only artifacts as publish-ready.
// - It may exit successfully with public_newsletter_ready=false when review_pr_ready=true.
function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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
    } else if (arg === '--no-llm-fallback-titles') {
      options.noLlmFallbackTitles = true;
    } else if (arg) {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
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

function applyHeadlineRenderReconciliation(report, reconciliation) {
  if (!report || typeof report !== 'object' || !reconciliation?.applied) return;
  report.headline_public_render_reconciliation = reconciliation;
  report.headline_decision = {
    ...(report.headline_decision || {}),
    public_rendered_headline_key: reconciliation.rendered_headline_key,
    public_render_reconciled: true,
    public_render_reconciliation_reason: reconciliation.reason
  };
}

function persistHeadlineDiagnosticsReconciliation({ root, date, reconciliation }) {
  if (!reconciliation?.applied) return '';
  const relPath = `content/newsroom/${date}/selection-diagnostics.md`;
  const filePath = path.join(root, ...relPath.split('/'));
  if (!fs.existsSync(filePath)) return '';
  const existing = fs.readFileSync(filePath, 'utf8');
  const withoutStaleLines = existing.replace(
    /\n- public_render_reconciled: .*\n- public_rendered_headline_key: .*\n- public_render_reconciliation_reason: .*/g,
    ''
  );
  const updated = withoutStaleLines.replace(
    /(- replacement_headline_key: [^\n]*\n)/,
    `$1- public_render_reconciled: true\n` +
      `- public_rendered_headline_key: ${reconciliation.rendered_headline_key}\n` +
      `- public_render_reconciliation_reason: ${reconciliation.reason}\n`
  );
  if (updated === existing) return '';
  fs.writeFileSync(filePath, updated, 'utf8');
  return relPath;
}

function persistHomepageHeadlineArtifacts({ root, date, resolved }) {
  if (resolved.publicNewsletterReady !== true) return [];
  const shortlistPath = path.join(root, 'content', 'newsroom', date, 'shortlisted-candidates.json');
  const selectionReportPath = path.join(root, 'content', 'newsroom', date, 'selection-report.json');
  const shortlist = readJsonSafely(shortlistPath);
  const rendered = renderedHeadlineState({
    root,
    date,
    state: shortlist.homepage_headline_state,
    shortlist
  });
  const state = rendered.state;
  const reconciliation = rendered.reconciliation;
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

  shortlist.homepage_headline_state = state;
  shortlist.article_exposure_coverage = history.coverage;
  applyHeadlineRenderReconciliation(shortlist, reconciliation);
  writeJson(shortlistPath, shortlist);
  files.push(relativeArtifactPath(root, shortlistPath));

  const selectionReport = readJsonSafely(selectionReportPath);
  if (Object.keys(selectionReport).length > 0) {
    selectionReport.article_exposure_coverage = history.coverage;
    applyHeadlineRenderReconciliation(selectionReport, reconciliation);
    writeJson(selectionReportPath, selectionReport);
    files.push(relativeArtifactPath(root, selectionReportPath));
  }
  const diagnosticsPath = persistHeadlineDiagnosticsReconciliation({ root, date, reconciliation });
  if (diagnosticsPath) files.push(diagnosticsPath);
  return files;
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

function buildEnsureOutputs(resolved, reconciliation) {
  return {
    ...buildReviewableArtifactOutputs(resolved),
    ...reconciliation.outputs
  };
}

function reconcileResolvedArtifacts({ root, date, resolved }) {
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
    outputs: buildEnsureOutputs(reconciledResolved, reconciliation)
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
  if (!resolved.publicNewsletterReady) {
    const reason = resolved.publicNewsletterReason || 'public newsletter artifacts are not structurally ready';
    if (resolved.reviewPrReady) {
      const reconciled = reconcileResolvedArtifacts({ root, date, resolved });
      return {
        date,
        resolved: reconciled.reconciledResolved,
        reconciliation: reconciled.reconciliation,
        outputs: reconciled.outputs
      };
    }
    throw new Error(reason);
  }

  const reconciled = reconcileResolvedArtifacts({ root, date, resolved });
  return {
    date,
    resolved: reconciled.reconciledResolved,
    reconciliation: reconciled.reconciliation,
    outputs: reconciled.outputs
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  try {
    const result = await ensurePublicNewsletterArtifacts(options);
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
  ensurePublicNewsletterArtifacts,
  parseArgs
};
