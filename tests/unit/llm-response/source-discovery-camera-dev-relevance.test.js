'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeProposalPayload
} = require('../../../scripts/newsroom/collect/gemini-source-discovery');

function makeProposal(overrides = {}) {
  return {
    proposal_id: 'proposal-test-1',
    topic_gap: 'Camera app prototyping tools',
    source_family: 'android_dev',
    candidate_urls: ['https://example.com/ai-studio'],
    ...overrides
  };
}

// ─── schema 신규 필드 파싱 ────────────────────────────────────────────────

test('normalizeProposalPayload: camera_dev_workflow_relevance=true를 정상 파싱', () => {
  const payload = {
    schema_version: 1,
    proposal_type: 'gemini_source_discovery',
    newsletter_date: '2026-05-31',
    proposals: [
      makeProposal({
        camera_dev_workflow_relevance: true,
        camera_dev_workflow_relevance_reason: 'Google AI Studio로 Camera 앱을 빠르게 프로토타이핑할 수 있음'
      })
    ]
  };

  const result = normalizeProposalPayload(payload, '2026-05-31');

  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0].camera_dev_workflow_relevance, true);
  assert.equal(
    result.proposals[0].camera_dev_workflow_relevance_reason,
    'Google AI Studio로 Camera 앱을 빠르게 프로토타이핑할 수 있음'
  );
});

test('normalizeProposalPayload: camera_dev_workflow_relevance=false를 정상 파싱', () => {
  const payload = {
    schema_version: 1,
    proposal_type: 'gemini_source_discovery',
    newsletter_date: '2026-05-31',
    proposals: [
      makeProposal({
        camera_dev_workflow_relevance: false,
        camera_dev_workflow_relevance_reason: ''
      })
    ]
  };

  const result = normalizeProposalPayload(payload, '2026-05-31');

  assert.equal(result.proposals[0].camera_dev_workflow_relevance, false);
  assert.equal(result.proposals[0].camera_dev_workflow_relevance_reason, '');
});

test('normalizeProposalPayload: 필드 누락 시 기본값 false', () => {
  const payload = {
    schema_version: 1,
    proposal_type: 'gemini_source_discovery',
    newsletter_date: '2026-05-31',
    proposals: [makeProposal()]
  };

  const result = normalizeProposalPayload(payload, '2026-05-31');

  assert.equal(result.proposals[0].camera_dev_workflow_relevance, false);
  assert.equal(result.proposals[0].camera_dev_workflow_relevance_reason, '');
});

test('normalizeProposalPayload: truthy 값이지만 boolean true가 아니면 false', () => {
  const payload = {
    schema_version: 1,
    proposal_type: 'gemini_source_discovery',
    newsletter_date: '2026-05-31',
    proposals: [
      makeProposal({
        camera_dev_workflow_relevance: 'true',
        camera_dev_workflow_relevance_reason: 'some reason'
      })
    ]
  };

  const result = normalizeProposalPayload(payload, '2026-05-31');

  // 문자열 'true'는 boolean true가 아니므로 false (보수적)
  assert.equal(result.proposals[0].camera_dev_workflow_relevance, false);
});

test('normalizeProposalPayload: reason 200자 초과 시 잘라냄', () => {
  const longReason = 'A'.repeat(300);
  const payload = {
    schema_version: 1,
    proposal_type: 'gemini_source_discovery',
    newsletter_date: '2026-05-31',
    proposals: [
      makeProposal({
        camera_dev_workflow_relevance: true,
        camera_dev_workflow_relevance_reason: longReason
      })
    ]
  };

  const result = normalizeProposalPayload(payload, '2026-05-31');

  assert.equal(result.proposals[0].camera_dev_workflow_relevance_reason.length, 200);
});

test('normalizeProposalPayload: 빈 proposals 배열은 정상 처리', () => {
  const payload = {
    schema_version: 1,
    proposal_type: 'gemini_source_discovery',
    newsletter_date: '2026-05-31',
    proposals: []
  };

  const result = normalizeProposalPayload(payload, '2026-05-31');

  assert.equal(result.proposals.length, 0);
});
