// PR body의 발행 준비(readiness) 관련 section을 담당한다.
// review handoff 해석, diagnostics-only 상태, public newsletter 준비도/안내,
// homepage headline 결정/디자인 리뷰, article 구조 계약, RAW input provenance처럼
// merge 후 공개 여부와 관련된 정보를 Markdown으로 정리하는 함수만 모은 단일 책임 모듈이다.

const {
  requiredPublicFiles,
  resolveReviewableArtifacts
} = require('./resolve-reviewable-artifacts');
const {
  loadNewsroomReport
} = require('./pr-body-artifacts');
const {
  valueOrUnknown,
  booleanText
} = require('./pr-body-format');

function resolveReviewHandoff(options = {}) {
  if (!options.date) return null;
  try {
    const resolverOptions = {
      root: options.root,
      date: options.date
    };
    if (Object.prototype.hasOwnProperty.call(options, 'changedArtifacts')) {
      resolverOptions.changedArtifacts = options.changedArtifacts;
    }
    return resolveReviewableArtifacts(resolverOptions);
  } catch (_) {
    return null;
  }
}

function renderReviewOnlyStatus(status, handoff, root, date) {
  if (!handoff?.diagnosticsOnly) return '';
  const generationStatus = date
    ? loadNewsroomReport(root, date, 'generation-status.json') || {}
    : {};
  const failureStage = valueOrUnknown(generationStatus.failure_stage ?? status.failure_stage);
  const failureReason = valueOrUnknown(generationStatus.failure_reason ?? status.failure_reason);
  return [
    '## Diagnostics-only Status',
    '',
    '이 PR은 diagnostics-only입니다. public newsletter files가 준비되지 않았으므로 merge해도 Newsletter 홈페이지에 표시되지 않습니다. This PR is not publish-ready.',
    '',
    `- diagnostics_only: ${booleanText(handoff.diagnosticsOnly)}`,
    `- public_newsletter_ready: ${booleanText(handoff.publicNewsletterReady)}`,
    `- homepage_visible_after_merge: ${booleanText(handoff.homepageVisibleAfterMerge)}`,
    '- final_publish_ready: false',
    '- publish_gate_passed: false (public validation skipped)',
    `- quality_status: ${valueOrUnknown(status.quality_status ?? generationStatus.quality_status)}`,
    `- quality_score: ${valueOrUnknown(status.quality_score ?? generationStatus.quality_score)}`,
    `- quality_threshold: ${valueOrUnknown(status.quality_threshold ?? generationStatus.quality_threshold)}`,
    `- failure_stage: ${failureStage}`,
    `- failure_reason: ${failureReason}`,
    ''
  ].join('\n');
}

function renderPublicNewsletterReadiness(root, date, handoff) {
  if (!handoff || (!handoff.diagnosticsOnly && !handoff.publicNewsletterReady)) return '';
  const required = date ? requiredPublicFiles(date) : [];
  return [
    '## Public Newsletter Readiness',
    '',
    `- public_newsletter_ready: ${booleanText(handoff.publicNewsletterReady)}`,
    `- review_publication_ready: ${booleanText(handoff.reviewPublicationReady)}`,
    `- diagnostics_only: ${booleanText(handoff.diagnosticsOnly)}`,
    `- homepage_visible_after_merge: ${booleanText(handoff.homepageVisibleAfterMerge)}`,
    `- publication_mode: ${valueOrUnknown(handoff.publicationMode)}`,
    `- homepage_visibility: ${valueOrUnknown(handoff.homepageVisibility)}`,
    `- normal_public_ready: ${booleanText(handoff.normalPublicReady)}`,
    `- automatic_publish_ready: ${booleanText(handoff.automaticPublishReady)}`,
    `- public_artifact_ready: ${booleanText(handoff.publicArtifactReady)}`,
    `- fallback_public_ready: ${booleanText(handoff.fallbackPublicReady)}`,
    `- fallback_only: ${booleanText(handoff.fallbackOnly)}`,
    `- camera_anchor_count: ${valueOrUnknown(handoff.cameraAnchorCount)}`,
    `- homepage_badge: ${valueOrUnknown(handoff.homepageBadge || 'none')}`,
    `- public_newsletter_reason: ${valueOrUnknown(handoff.publicNewsletterReason)}`,
    `- review_pr_ready: ${booleanText(handoff.reviewPrReady)}`,
    `- publish_candidate_ready: ${booleanText(handoff.publishCandidateReady)}`,
    '- required public files:',
    ...(required.length > 0 ? required.map(filePath => `  - ${filePath}`) : ['  - unknown']),
    ''
  ].join('\n');
}

function renderHomepageHeadlineDesignReview(status = {}, date = '') {
  const review = status.homepage_headline_design_review && typeof status.homepage_headline_design_review === 'object'
    ? status.homepage_headline_design_review
    : {};
  const figmaUrl = review.figma_url || review.url || process.env.HOMEPAGE_HEADLINE_FIGMA_URL;
  const artifactPath = review.artifact_path || review.screenshot_artifact_path;
  const desktopCoverage = review.desktop_coverage || process.env.HOMEPAGE_HEADLINE_DESKTOP_COVERAGE;
  const mobileCoverage = review.mobile_coverage || process.env.HOMEPAGE_HEADLINE_MOBILE_COVERAGE;
  const implementationDeviation = review.implementation_deviation || process.env.HOMEPAGE_HEADLINE_IMPLEMENTATION_DEVIATION;
  if (!figmaUrl && !artifactPath && !desktopCoverage && !mobileCoverage && !implementationDeviation) {
    return '';
  }
  return [
    '## Homepage Headline Design Review',
    '',
    `- Figma URL: ${valueOrUnknown(figmaUrl)}`,
    `- Artifact path: ${valueOrUnknown(artifactPath)}`,
    `- Desktop coverage: ${valueOrUnknown(desktopCoverage)}`,
    `- Mobile coverage: ${valueOrUnknown(mobileCoverage)}`,
    `- Implementation deviation: ${valueOrUnknown(implementationDeviation)}`,
    ''
  ].join('\n');
}

function renderPublicNewsletterNotice(status = {}, handoff = null) {
  if (status.final_publish_ready === true) return '';
  if (handoff?.diagnosticsOnly) {
    return [
      '## Public Newsletter 안내',
      '',
      'AI 자동 발행 기준은 통과하지 못했고 public newsletter files가 준비되지 않았습니다. 이 PR은 diagnostics-only이며 merge해도 Newsletter 홈페이지에 표시되지 않습니다. publish-ready label은 붙이지 않습니다.'
    ].join('\n');
  }
  if (handoff?.reviewPublicationReady) {
    if (handoff.publicationMode === 'fallback_public') {
      return [
        '## Public Newsletter 안내',
        '',
        '이 PR은 Issue #247을 hard block policy에서 downgrade policy로 의도적으로 바꿉니다.',
        'fallback-only composition은 metadata, PR body, quality report, public UI 전체에서 Tooling Watch Edition으로 명확히 표시된 경우에만 homepage-visible public issue를 만들 수 있습니다.',
        '',
        '수정된 acceptance criteria:',
        '- tooling fallback만으로는 normal homepage-visible Camera HAL newsletter를 만들 수 없습니다.',
        '- fallback-only composition은 fallback disclosure metadata와 UI notice가 모두 있을 때만 homepage-visible Tooling Watch Edition을 만들 수 있습니다.'
      ].join('\n');
    }
    return [
      '## Public Newsletter 안내',
      '',
      'AI 자동 발행 기준은 통과하지 못했지만, public newsletter files는 생성되었습니다. 편집장이 이 PR을 승인하여 merge하면 Newsletter 사이트에 게시됩니다. publish-ready label은 붙이지 않습니다.'
    ].join('\n');
  }
  return [
    '## Public Newsletter 안내',
    '',
    'AI 자동 발행 기준은 통과하지 못했지만, public newsletter files는 생성되었습니다. 편집장이 이 PR을 승인하여 merge하면 Newsletter 사이트에 게시됩니다.'
  ].join('\n');
}

function renderRawInputProvenance(status = {}, date = '') {
  const input = status.candidate_input;
  if (!input || typeof input !== 'object') return '';

  return [
    '## RAW Input Provenance',
    '',
    `- input_mode: ${valueOrUnknown(input.mode)}`,
    `- RAW branch: ${date ? `newsroom-raw/${date}` : 'unknown'}`,
    `- candidate_artifact: ${valueOrUnknown(input.candidate_artifact)}`,
    `- candidate_artifact_hash: ${valueOrUnknown(input.candidate_artifact_hash)}`,
    `- manifest: ${valueOrUnknown(input.manifest)}`,
    `- manifest_status: ${valueOrUnknown(input.manifest_status)}`,
    `- manifest_type: ${valueOrUnknown(input.manifest_type)}`,
    `- llm_used: ${booleanText(input.llm_used)}`,
    `- merge_mode: ${valueOrUnknown(input.merge_mode || 'none')}`,
    `- candidate_count: ${valueOrUnknown(input.candidate_count)}`,
    ''
  ].join('\n');
}

function publicOutputExpectedFromStatus(status = {}) {
  if (status.public_output_expected === true || status.public_output_expected === 'true') return true;
  if (status.public_output_expected === false || status.public_output_expected === 'false') return false;
  return status.public_artifact_ready === true ||
    status.public_newsletter_ready === true ||
    status.review_publication_ready === true ||
    status.final_publish_ready === true ||
    status.automatic_publish_ready === true ||
    status.normal_public_ready === true ||
    status.public_state === 'REVIEW_ONLY_PUBLIC_CREATED' ||
    status.public_state === 'PUBLIC_READY';
}

module.exports = {
  resolveReviewHandoff,
  renderReviewOnlyStatus,
  renderPublicNewsletterReadiness,
  renderHomepageHeadlineDesignReview,
  renderPublicNewsletterNotice,
  renderRawInputProvenance,
  publicOutputExpectedFromStatus
};
