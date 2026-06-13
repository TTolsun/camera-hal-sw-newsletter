const { ensureArray } = require('./value-coercion');
const {
  BUCKETS
} = require('./aosp-camera-scope');

const PUBLICATION_MODES = Object.freeze({
  NORMAL_PUBLIC: 'normal_public',
  FALLBACK_PUBLIC: 'fallback_public',
  REVIEW_ONLY: 'review_only',
  DIAGNOSTICS_ONLY: 'diagnostics_only'
});

const HOMEPAGE_VISIBILITY = Object.freeze({
  NORMAL: 'normal',
  VISIBLE_WITH_FALLBACK_BADGE: 'visible_with_fallback_badge',
  HIDDEN: 'hidden'
});

const FALLBACK_HOMEPAGE_BADGE = 'Tooling Watch Edition';
const FALLBACK_TAGS = ['Tooling Watch Edition', 'Tooling Watch'];

const CAMERA_ANCHOR_BUCKETS = new Set([
  BUCKETS.DIRECT_AOSP_CAMERA,
  BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE,
  BUCKETS.ANDROID_PLATFORM_CAMERA_ADJACENT,
  BUCKETS.ANDROID_MULTIMEDIA_CAMERA_OUTPUT
]);

function text(value) {
  return String(value ?? '').trim();
}

function candidateBucket(candidate = {}) {
  return text(
    candidate.final_relevance_bucket ||
    candidate.relevance_bucket ||
    candidate.aosp_camera_stack_bucket ||
    candidate.aospCameraStackBucket ||
    candidate.categoryBucket
  );
}

function sectionBucket(section = {}) {
  return text(
    section.final_relevance_bucket ||
    candidateBucket(section.bound_candidate) ||
    candidateBucket(section.public_article?.bound_candidate) ||
    candidateBucket(section.final_candidate) ||
    section.relevance_bucket ||
    section.aosp_camera_stack_bucket ||
    section.aospCameraStackBucket ||
    section.categoryBucket ||
    candidateBucket(section.source_candidate)
  );
}

function finalPublicComposition(sections) {
  const publicSections = ensureArray(sections).filter(section => section && section.public_article !== false);
  const buckets = publicSections.map(sectionBucket).filter(Boolean);
  const cameraAnchorCount = buckets.filter(bucket => CAMERA_ANCHOR_BUCKETS.has(bucket)).length;
  const fallbackSectionCount = buckets.filter(bucket => bucket === BUCKETS.CPP_AI_TOOLING_FALLBACK).length;
  const fallbackOnly = publicSections.length > 0 && cameraAnchorCount === 0;
  return {
    selected_article_count: publicSections.length,
    camera_anchor_count: cameraAnchorCount,
    fallback_section_count: fallbackSectionCount,
    fallback_only: fallbackOnly
  };
}

function publicationDecisionForSections(sections, options = {}) {
  const composition = finalPublicComposition(sections);
  const publicNewsletterReady = options.publicNewsletterReady === true;
  const finalPublishReady = options.finalPublishReady === true;
  const diagnosticsOnly = options.diagnosticsOnly === true || !publicNewsletterReady;
  if (diagnosticsOnly) {
    return {
      ...composition,
      publication_mode: PUBLICATION_MODES.DIAGNOSTICS_ONLY,
      homepage_visibility: HOMEPAGE_VISIBILITY.HIDDEN,
      normal_public_ready: false,
      automatic_publish_ready: false,
      public_artifact_ready: false,
      fallback_public_ready: false,
      homepage_badge: ''
    };
  }
  if (composition.fallback_only) {
    return {
      ...composition,
      publication_mode: PUBLICATION_MODES.FALLBACK_PUBLIC,
      homepage_visibility: HOMEPAGE_VISIBILITY.VISIBLE_WITH_FALLBACK_BADGE,
      normal_public_ready: false,
      automatic_publish_ready: false,
      public_artifact_ready: true,
      fallback_public_ready: true,
      homepage_badge: FALLBACK_HOMEPAGE_BADGE
    };
  }
  const normalReady = publicNewsletterReady && finalPublishReady;
  return {
    ...composition,
    publication_mode: normalReady ? PUBLICATION_MODES.NORMAL_PUBLIC : PUBLICATION_MODES.REVIEW_ONLY,
    homepage_visibility: HOMEPAGE_VISIBILITY.NORMAL,
    normal_public_ready: normalReady,
    automatic_publish_ready: normalReady,
    public_artifact_ready: true,
    fallback_public_ready: false,
    fallback_only: false,
    homepage_badge: ''
  };
}

function fallbackEditionNoticeLines() {
  return [
    'Tooling Watch Edition',
    '이번 호는 Camera HAL / Driver / Android multimedia 직접 후보가 부족하여 Android native tooling / build/test/debug workflow 중심의 참고 issue로 발행되었습니다.',
    'Camera pipeline, Android native 성능, build/test/debug workflow 관점에서 참고 가능한 항목만 선별했으며 정상 Camera HAL issue로 간주하지 않습니다.'
  ];
}

function fallbackIssueTags(tags = []) {
  const cleaned = ensureArray(tags)
    .map(String)
    .filter(Boolean)
    .filter(tag => tag !== 'Camera HAL');
  return [...new Set([...FALLBACK_TAGS, ...cleaned])];
}

function applyPublicationDecision(target, decision) {
  if (!target || !decision) return target;
  target.publication_mode = decision.publication_mode;
  target.homepage_visibility = decision.homepage_visibility;
  target.normal_public_ready = decision.normal_public_ready;
  target.automatic_publish_ready = decision.automatic_publish_ready;
  target.public_artifact_ready = decision.public_artifact_ready;
  target.fallback_public_ready = decision.fallback_public_ready;
  target.fallback_only = decision.fallback_only;
  target.camera_anchor_count = decision.camera_anchor_count;
  target.fallback_section_count = decision.fallback_section_count;
  target.homepage_badge = decision.homepage_badge;
  return target;
}

module.exports = {
  CAMERA_ANCHOR_BUCKETS,
  FALLBACK_HOMEPAGE_BADGE,
  FALLBACK_TAGS,
  HOMEPAGE_VISIBILITY,
  PUBLICATION_MODES,
  applyPublicationDecision,
  fallbackEditionNoticeLines,
  fallbackIssueTags,
  finalPublicComposition,
  publicationDecisionForSections
};
