'use strict';

// Story Contract v2 issue code의 repair 정책 전수 등록(#849, Refs #1090).
//
// deductionRepairPolicy의 마지막 분기는 미등록 코드에 repair-section을 기본값으로 준다.
// v2 코드가 그 기본값에 우연히 얹혀 통과하면, 등록 누락이 영영 드러나지 않는다.
// 이 테이블이 텍스트 수리 가능 코드와 구조 실패 코드의 명시 등록을 잠근다.

const test = require('node:test');
const assert = require('node:assert/strict');

const { deductionRepairPolicy } = require('../../../publish/orchestrator-repair-plan');

const REPAIRABLE_V2_CODES = [
  'body_markdown_forbidden_construct',
  'body_markdown_forbidden_heading_level',
  'body_markdown_reserved_subheading',
  'body_markdown_duplicate_block',
  'body_markdown_dangling_subheading',
  'body_markdown_duplicates_public_field',
  'insufficient_public_body_paragraphs',
  'duplicate_headline'
];

const STRUCTURAL_V2_CODES = [
  'story_contract_version_mismatch',
  'story_contract_version_family_mismatch',
  'unsupported_public_contract_version',
  'unsupported_generation_contract_version',
  'unsupported_story_contract_version',
  'missing_public_article',
  'missing_story_public_article_field',
  'empty_editorial_story_field',
  'missing_body_markdown'
];

test('v2 body_markdown lint codes map to repair-section', () => {
  for (const reasonCode of REPAIRABLE_V2_CODES) {
    const policy = deductionRepairPolicy({ reason_code: reasonCode });
    assert.equal(policy.action, 'repair-section', reasonCode);
    assert.equal(policy.allow_rewrite, true, reasonCode);
    assert.equal(policy.failure_type, reasonCode);
  }
});

test('insufficient_public_body_paragraphs tells the repair prompt full-field replace is the only lever', () => {
  const policy = deductionRepairPolicy({ reason_code: 'insufficient_public_body_paragraphs' });
  assert.match(policy.reason, /whole \/public_article\/body_markdown field/);
  assert.match(policy.reason, /block patches cannot add paragraphs/);
});

test('v2 marker mismatch and missing body codes map to replace-or-demote', () => {
  for (const reasonCode of STRUCTURAL_V2_CODES) {
    const policy = deductionRepairPolicy({ reason_code: reasonCode });
    assert.equal(policy.action, 'replace-or-demote', reasonCode);
    assert.equal(policy.allow_rewrite, false, reasonCode);
    assert.equal(policy.failure_type, reasonCode);
  }
});

test('an unregistered code still falls back to the generic repair-section default', () => {
  // 기본값 자체는 v1 동작 그대로다. v2 코드 등록은 이 기본값에 기대지 않기 위한 것이지,
  // 기본값을 바꾸는 것이 아니다.
  const policy = deductionRepairPolicy({ category: 'some-category', reason: 'unmapped reason' });
  assert.equal(policy.action, 'repair-section');
  assert.equal(policy.failure_type, 'some-category');
});
