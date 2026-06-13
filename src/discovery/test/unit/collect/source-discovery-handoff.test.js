'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  FAILED_LLM_CREDENTIALS,
  sourceDiscoveryHandoff
} = require('../../../gemini-source-discovery-boundary');

const MERGED_ARTIFACT = 'articles/content/collected-news/2026-06-03/merged-candidates.json';

function makeStats(overrides = {}) {
  return {
    merged_candidate_count: 10,
    gemini_candidate_count: 5,
    gemini_unique_url_count: 5,
    gemini_new_unique_url_count: 0,
    gemini_manual_duplicate_url_count: 5,
    gemini_publishable_candidate_count: 3,
    seed_new_unique_url_count: 0,
    seed_publishable_candidate_count: 0,
    ...overrides
  };
}

test('zero-new-URL with llmUsed=true: gemini_discovery_no_new_unique_url is true', () => {
  const result = sourceDiscoveryHandoff({
    status: 'OK',
    stats: makeStats({ gemini_new_unique_url_count: 0 }),
    mergedCandidateRelPath: MERGED_ARTIFACT,
    llmUsed: true
  });
  assert.strictEqual(result.gemini_discovery_no_new_unique_url, true);
});

test('zero-new-URL with llmUsed=true and publishable candidates: nextStep is run_03', () => {
  const result = sourceDiscoveryHandoff({
    status: 'OK',
    stats: makeStats({ gemini_new_unique_url_count: 0, gemini_publishable_candidate_count: 3 }),
    mergedCandidateRelPath: MERGED_ARTIFACT,
    llmUsed: true
  });
  assert.strictEqual(result.nextStep, 'run_03');
  assert.strictEqual(result.gemini_discovery_no_new_unique_url, true);
  assert.ok(result.label.includes('Gemini 신규 URL 없음'));
});

test('zero-new-URL with llmUsed=true and no publishable: nextStep is strengthen_candidates', () => {
  const result = sourceDiscoveryHandoff({
    status: 'OK',
    stats: makeStats({ gemini_new_unique_url_count: 0, gemini_publishable_candidate_count: 0 }),
    mergedCandidateRelPath: MERGED_ARTIFACT,
    llmUsed: true
  });
  assert.strictEqual(result.nextStep, 'strengthen_candidates');
  assert.strictEqual(result.gemini_discovery_no_new_unique_url, true);
  assert.ok(result.label.includes('Gemini 신규 URL 없음'));
});

test('zero-new-URL with llmUsed=false: gemini_discovery_no_new_unique_url is false', () => {
  const result = sourceDiscoveryHandoff({
    status: 'OK',
    stats: makeStats({
      gemini_new_unique_url_count: 0,
      gemini_publishable_candidate_count: 0,
      seed_new_unique_url_count: 5,
      seed_publishable_candidate_count: 3
    }),
    mergedCandidateRelPath: MERGED_ARTIFACT,
    llmUsed: false
  });
  assert.ok(!result.gemini_discovery_no_new_unique_url);
});

test('positive gemini_new_unique_url_count: gemini_discovery_no_new_unique_url is false', () => {
  const result = sourceDiscoveryHandoff({
    status: 'OK',
    stats: makeStats({ gemini_new_unique_url_count: 3, gemini_publishable_candidate_count: 2 }),
    mergedCandidateRelPath: MERGED_ARTIFACT,
    llmUsed: true
  });
  assert.strictEqual(result.gemini_discovery_no_new_unique_url, false);
  assert.ok(!result.label.includes('Gemini 신규 URL 없음'));
});

test('blocked status is not affected by zero-new-URL', () => {
  const result = sourceDiscoveryHandoff({
    status: FAILED_LLM_CREDENTIALS,
    stats: makeStats({ gemini_new_unique_url_count: 0 }),
    mergedCandidateRelPath: MERGED_ARTIFACT,
    llmUsed: true
  });
  assert.strictEqual(result.nextStep, 'blocked');
  assert.ok(!result.gemini_discovery_no_new_unique_url);
});

test('missing mergedCandidateRelPath: blocked regardless of llmUsed', () => {
  const result = sourceDiscoveryHandoff({
    status: 'OK',
    stats: makeStats({ gemini_new_unique_url_count: 0 }),
    mergedCandidateRelPath: '',
    llmUsed: true
  });
  assert.strictEqual(result.nextStep, 'blocked');
});
