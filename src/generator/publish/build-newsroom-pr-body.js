const {
  resolvePublishStatus
} = require('./publish-status');
const {
  getChangedRepoVisibleArtifacts
} = require('./resolve-reviewable-artifacts');
const {
  buildReviewArtifactInventory,
  renderGeneratedArtifactsSummary
} = require('./review-artifact-inventory');
const {
  renderCandidateTraceability
} = require('./pr-body-candidate-trace');
const {
  renderFinalNewsletterEditorSummary,
  renderPublicationDecisionSummary
} = require('./pr-body-final-summary');
const {
  recommendedEditorAction,
  renderStatusSection
} = require('./pr-body-status-section');
const {
  renderEditorialDecisionSummary
} = require('./pr-body-editorial-decision');
const {
  renderCatchUpSummary,
  renderCandidatePoolPreflight,
  renderFailureDiagnostics
} = require('./pr-body-diagnostic-sections');
const {
  resolveReviewHandoff,
  renderReviewOnlyStatus,
  renderPublicNewsletterReadiness,
  renderHomepageHeadlineDesignReview,
  renderPublicNewsletterNotice,
  renderRawInputProvenance,
  publicOutputExpectedFromStatus
} = require('./pr-body-readiness-sections');
const {
  extractEditorBriefSections,
  renderEditorApprovedPublicationPolicy,
  renderHeavyRetentionNote
} = require('./pr-body-static-text');

function renderGeneratedArtifacts(date, status = {}, root = process.cwd(), changedArtifacts = null) {
  const changed = Array.isArray(changedArtifacts)
    ? changedArtifacts
    : getChangedRepoVisibleArtifacts({ root, date });
  const inventory = buildReviewArtifactInventory({
    root,
    date,
    changedArtifacts: changed,
    runContext: {
      status: status.status || 'unknown',
      seedUsed: status.seed_used ?? status.candidate_input?.seed_used,
      publicOutputExpected: publicOutputExpectedFromStatus(status)
    }
  });
  return renderGeneratedArtifactsSummary(inventory) + '\n\n' + renderHeavyRetentionNote(date);
}

function buildNewsroomPrBody(options = {}) {
  const resolved = options.publishStatus || resolvePublishStatus(options);
  const root = resolved.root || options.root || process.cwd();
  const date = resolved.date || options.date || '';
  const status = resolved.status;
  const handoffOptions = { root, date, status };
  if (Object.prototype.hasOwnProperty.call(options, 'changedArtifacts')) {
    handoffOptions.changedArtifacts = options.changedArtifacts;
  }
  const handoff = resolveReviewHandoff(handoffOptions);
  const lines = [];
  const pushSection = section => {
    if (section) lines.push(section, '');
  };

  const reviewOnlyStatus = renderReviewOnlyStatus(status, handoff, root, date);
  const publicationDecisionSummary = renderPublicationDecisionSummary(status, handoff);
  const editorialDecisionSummary = renderEditorialDecisionSummary(root, date, status, handoff);

  pushSection(renderFinalNewsletterEditorSummary(status, handoff, date));

  if (handoff?.diagnosticsOnly) {
    pushSection(reviewOnlyStatus);
    pushSection(editorialDecisionSummary);
  } else if (status.final_publish_ready === true) {
    pushSection(editorialDecisionSummary);
    pushSection(publicationDecisionSummary);
  } else {
    pushSection(publicationDecisionSummary);
    pushSection(editorialDecisionSummary);
  }
  pushSection(renderStatusSection(status, handoff));

  lines.push(
    renderPublicNewsletterReadiness(root, date, handoff),
    renderCatchUpSummary(root, date),
    renderCandidatePoolPreflight(root, date, status),
    renderFailureDiagnostics(root, date, status, handoff),
    renderPublicNewsletterNotice(status, handoff),
    renderHomepageHeadlineDesignReview(status, date),
    renderCandidateTraceability(root, date),
    renderGeneratedArtifacts(date, status, root, options.changedArtifacts)
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
  extractEditorBriefSections,
  renderCandidateTraceability,
  renderGeneratedArtifacts,
  renderRawInputProvenance,
  renderEditorApprovedPublicationPolicy,
  recommendedEditorAction
};
