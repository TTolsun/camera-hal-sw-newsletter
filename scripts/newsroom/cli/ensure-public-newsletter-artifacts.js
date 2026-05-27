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
  decodeHtml
} = require('../common/common');
const {
  articleIdentityKey,
  normalizeArticleUrl
} = require('../common/article-identity');
const {
  uniqueArticleAnchorId
} = require('../common/article-anchor');
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
  const usedAnchors = new Set();
  let articleIndex = 0;
  return [...html.matchAll(/<section\b([^>]*)>[\s\S]*?<\/section>/gi)]
    .map(match => {
      if (!/\barticle-card\b/i.test(match[0])) return null;
      const currentIndex = articleIndex;
      articleIndex += 1;
      const attrs = match[1] || '';
      const block = match[0];
      const sourceUrl = decodeHtml(
        matchFirst(block, /<div class="source-list"[\s\S]*?<a[^>]*href="([^"]+)"/i) ||
        matchFirst(block, /<figcaption[\s\S]*?<a[^>]*href="([^"]+)"/i)
      );
      const title = stripHtml(
        matchFirst(block, /<h[23][^>]*class="[^"]*\barticle-title\b[^"]*"[^>]*>([\s\S]*?)<\/h[23]>/i) ||
        matchFirst(block, /<h3[^>]*>([\s\S]*?)<\/h3>/i)
      );
      const summary = stripHtml(
        matchFirst(block, /<p[^>]*class="[^"]*\barticle-lead\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i) ||
        matchFirst(block, /<p[^>]*>([\s\S]*?)<\/p>/i)
      );
      const sourceName = stripHtml(
        matchFirst(block, /<figcaption[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) ||
        matchFirst(block, /<div class="source-list"[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)
      );
      const imageTag = matchFirst(block, /(<img\b(?=[^>]*class="[^"]*\barticle-image\b)[^>]*>)/i);
      const imageUrl = decodeHtml(matchFirst(imageTag, /\bsrc="([^"]+)"/i));
      const imageAlt = decodeHtml(matchFirst(imageTag, /\balt="([^"]*)"/i));
      if (!title || !summary || !sourceUrl) return null;
      const existingAnchor = decodeHtml(matchFirst(attrs, /\bid="([^"]+)"/i));
      const articleAnchor = existingAnchor || uniqueArticleAnchorId(title, currentIndex, usedAnchors);
      if (existingAnchor) usedAnchors.add(existingAnchor);
      return {
        article_identity_key: articleIdentityKey({ source_url: sourceUrl }),
        title,
        summary,
        source_url: sourceUrl,
        source_name: sourceName || '출처',
        article_anchor: articleAnchor,
        newsletter_article_url: `newsletters/${date}/index.html#${articleAnchor}`,
        image_url: imageUrl,
        image_alt: imageAlt || title
      };
    })
    .filter(Boolean);
}

function renderedHeadlineState({ root, date, state, shortlist }) {
  const rendered = readRenderedNewsletterArticles(root, date);
  if (rendered.length === 0 || !state?.current_headline) {
    return { state, reconciliation: null };
  }
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
      state: {
        ...state,
        current_headline: {
          ...current,
          title: renderedCurrent.title,
          summary: renderedCurrent.summary,
          source_url: renderedCurrent.source_url,
          newsletter_url: newsletterUrl,
          newsletter_article_url: renderedCurrent.newsletter_article_url || newsletterUrl,
          image_url: renderedCurrent.image_url || current.image_url || '',
          image_alt: renderedCurrent.image_alt || current.image_alt || renderedCurrent.title,
          snapshot: {
            ...(current.snapshot || {}),
            source_name: renderedCurrent.source_name || current.snapshot?.source_name || ''
          }
        }
      },
      reconciliation: null
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
        newsletter_article_url: article.newsletter_article_url || newsletterUrl,
        image_url: article.image_url || selected.image_url || selected.selectedImage || '',
        image_alt: article.image_alt || selected.image_alt || selected.imageAlt || article.title,
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

  if (!fallback) return { state, reconciliation: null };
  const fallbackState = {
    ...state,
    current_headline: headlineSnapshotFromCandidate(fallback.candidate, {
      date,
      newsletterUrl,
      scoredAt: date
    })
  };
  return {
    state: fallbackState,
    reconciliation: {
      applied: true,
      previous_headline_key: current.article_identity_key || '',
      rendered_headline_key: fallbackState.current_headline.article_identity_key,
      reason: 'selected_headline_not_rendered_in_public_issue'
    }
  };
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
