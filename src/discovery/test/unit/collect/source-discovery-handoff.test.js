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
    seed_publishable_candidate_count: 0,
    derived_publishable_candidate_count: 0,
    ...overrides
  };
}

// #1186: 제안 단계를 제거한 뒤 이 단계가 새로 더하는 후보는 seed 근거 확장과 linked evidence 파생뿐이다.
// 새 후보가 없는 주가 정상 상태라서 경고(strengthen_candidates)가 아니라 03 진행으로 본다.
test('no new stage 2 candidates: manual candidates alone proceed to 03 without a warning', () => {
  const result = sourceDiscoveryHandoff({
    status: 'PASS',
    stats: makeStats(),
    mergedCandidateRelPath: MERGED_ARTIFACT
  });
  assert.strictEqual(result.nextStep, 'run_03');
  assert.strictEqual(result.label, '03 진행 가능');
  assert.ok(!('gemini_discovery_no_new_unique_url' in result));
});

test('seed publishable candidates proceed to 03', () => {
  const result = sourceDiscoveryHandoff({
    status: 'PASS',
    stats: makeStats({ seed_publishable_candidate_count: 2 }),
    mergedCandidateRelPath: MERGED_ARTIFACT
  });
  assert.strictEqual(result.nextStep, 'run_03');
});

test('linked derived publishable candidates are counted as new stage 2 candidates', () => {
  const result = sourceDiscoveryHandoff({
    status: 'PASS',
    stats: makeStats({ derived_publishable_candidate_count: 1 }),
    mergedCandidateRelPath: MERGED_ARTIFACT,
    sourceDiscoveryFeedbackReport: { status: 'WARNING' }
  });
  assert.strictEqual(result.nextStep, 'run_03');
  assert.match(result.reason, /linked evidence/);
});

test('parser gap warning without new candidates recommends strengthening candidates', () => {
  const result = sourceDiscoveryHandoff({
    status: 'PASS',
    stats: makeStats(),
    mergedCandidateRelPath: MERGED_ARTIFACT,
    sourceDiscoveryFeedbackReport: { status: 'WARNING' }
  });
  assert.strictEqual(result.nextStep, 'strengthen_candidates');
});

test('blocked status is not affected by new candidate counts', () => {
  const result = sourceDiscoveryHandoff({
    status: FAILED_LLM_CREDENTIALS,
    stats: makeStats({ seed_publishable_candidate_count: 3 }),
    mergedCandidateRelPath: MERGED_ARTIFACT
  });
  assert.strictEqual(result.nextStep, 'blocked');
});

test('missing mergedCandidateRelPath: blocked', () => {
  const result = sourceDiscoveryHandoff({
    status: 'PASS',
    stats: makeStats(),
    mergedCandidateRelPath: ''
  });
  assert.strictEqual(result.nextStep, 'blocked');
});
