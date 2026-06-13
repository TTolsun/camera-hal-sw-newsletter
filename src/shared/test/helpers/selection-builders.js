'use strict';

const {
  buildShortlistReport: buildShortlistReportBase
} = require('../../../generator/select/newsroom-selection');
const {
  articlePolicy
} = require('../../common/newsletter-policy');
const {
  emptyHeadlineState
} = require('../../../generator/reporter/homepage-headline');
const { candidate } = require('./newsroom-builders');

const FALLBACK_WINDOW_TEST_MIN_ARTICLES = 3;

function buildShortlistReport(date, collectedCandidates, options = {}) {
  const hasHeadlineState = Object.prototype.hasOwnProperty.call(options, 'homepageHeadlineState');
  return buildShortlistReportBase(date, collectedCandidates, {
    homepageHeadlineState: hasHeadlineState
      ? options.homepageHeadlineState
      : emptyHeadlineState({ date }),
    ...options
  });
}

function policyPrimaryCandidate(index = 0, overrides = {}) {
  return candidate({
    title: `CameraX policy primary release ${index}`,
    url: `https://example.com/policy-primary-${index}`,
    relevance_bucket: articlePolicy.primaryCameraStack.buckets[0],
    editorial_priority: 1,
    aosp_camera_directness: 5,
    driver_stack_relevance: 0,
    multimedia_camera_output_relevance: 0,
    soc_platform_relevance: 0,
    native_tooling_relevance: 0,
    counts_as_primary_camera_topic: true,
    ...overrides
  });
}

function policyDriverCandidate(index = 0, overrides = {}) {
  return candidate({
    title: `V4L2 image sensor driver article ${index}`,
    url: `https://example.com/policy-driver-${index}`,
    summary: 'V4L2 camera driver update changes image sensor format negotiation and frame routing.',
    api_or_component: 'V4L2 image sensor driver',
    behavior_change: 'The camera driver update changes image sensor frame routing.',
    relevance_bucket: 'camera_driver_image_pipeline',
    editorial_priority: 2,
    aosp_camera_directness: 0,
    driver_stack_relevance: 5,
    multimedia_camera_output_relevance: 0,
    soc_platform_relevance: 0,
    native_tooling_relevance: 0,
    counts_as_primary_camera_topic: false,
    counts_as_driver_topic: true,
    counts_as_soc_topic: false,
    counts_as_fallback_topic: false,
    ...overrides
  });
}

function policySupportingCandidate(index = 0, overrides = {}) {
  const topics = [
    'LLVM sanitizer diagnostics',
    'Clang static analyzer',
    'LLDB native debugger',
    'CMake camera build pipeline',
    'libc++ concurrency update'
  ];
  const topic = topics[index % topics.length];
  return candidate({
    title: `${topic} policy supporting workflow`,
    url: `https://example.com/policy-supporting-${index}`,
    summary: `${topic} improves native C++ build and test productivity for camera workflow debugging.`,
    api_or_component: topic,
    behavior_change: 'Native debugging workflow behavior changed.',
    relevance_bucket: 'cpp_ai_tooling_fallback',
    editorial_priority: 6,
    aosp_camera_directness: 0,
    driver_stack_relevance: 0,
    multimedia_camera_output_relevance: 0,
    soc_platform_relevance: 0,
    native_tooling_relevance: 5,
    counts_as_fallback_topic: true,
    camera_hal_relevance_score: 0,
    ...overrides
  });
}

module.exports = {
  FALLBACK_WINDOW_TEST_MIN_ARTICLES,
  buildShortlistReport,
  policyPrimaryCandidate,
  policyDriverCandidate,
  policySupportingCandidate
};
