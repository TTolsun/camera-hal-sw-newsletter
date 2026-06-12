'use strict';

const {
  BUCKETS
} = require('../../../src/core/common/aosp-camera-scope');
const {
  articlePolicy,
  getPublishReadyCompositionPolicy
} = require('../../../src/core/common/newsletter-policy');

const SHORTLIST_CAP = 12;
const RESERVE_MIN_CANDIDATES = 4;
const RESERVE_MAX_CANDIDATES = 7;

const MIN_FINAL_ARTICLES = articlePolicy.mainArticleCount.min;
const MAX_FINAL_ARTICLES = articlePolicy.mainArticleCount.max;
const ABSOLUTE_MIN_REVIEWABLE_ARTICLES = articlePolicy.primaryCameraStack.minRequired;

const publishReadyCompositionPolicy = getPublishReadyCompositionPolicy();
const MIN_NON_FALLBACK_PUBLISH_READY_ARTICLES = publishReadyCompositionPolicy.primaryCameraStackMinRequired;

const DIRECT_AOSP_CAMERA_OR_DRIVER_BUCKETS = Object.freeze([
  BUCKETS.DIRECT_AOSP_CAMERA,
  BUCKETS.CAMERA_DRIVER_IMAGE_PIPELINE
]);

const MAIN_ARTICLE_SCORE_THRESHOLD = 42;
const MIN_CAMERA_HAL_DIRECTNESS = 2;
const MIN_SCOPE_RELEVANCE = 2;
const LINKED_EVIDENCE_RUNTIME_BONUS = 2;
const LINKED_EVIDENCE_WATCH_PENALTY = 8;

const COMPOSITION_MODES = Object.freeze({
  NORMAL: 'NORMAL',
  FALLBACK_COMPOSITION: 'FALLBACK_COMPOSITION',
  THIN_WEEK_REVIEW: 'THIN_WEEK_REVIEW',
  NEEDS_FIX: 'NEEDS_FIX'
});

module.exports = {
  SHORTLIST_CAP,
  RESERVE_MIN_CANDIDATES,
  RESERVE_MAX_CANDIDATES,
  MIN_FINAL_ARTICLES,
  MAX_FINAL_ARTICLES,
  ABSOLUTE_MIN_REVIEWABLE_ARTICLES,
  MIN_NON_FALLBACK_PUBLISH_READY_ARTICLES,
  DIRECT_AOSP_CAMERA_OR_DRIVER_BUCKETS,
  MAIN_ARTICLE_SCORE_THRESHOLD,
  MIN_CAMERA_HAL_DIRECTNESS,
  MIN_SCOPE_RELEVANCE,
  LINKED_EVIDENCE_RUNTIME_BONUS,
  LINKED_EVIDENCE_WATCH_PENALTY,
  COMPOSITION_MODES
};
