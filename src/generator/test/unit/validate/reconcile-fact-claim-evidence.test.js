'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  reconcileFactClaimEvidence
} = require('../../../editor/editor-output-contract');
const { editor, section, reporterForClaimTests } = require('../../../../core/test/helpers/editor-builders');

// #502: LLM editor가 source 기반 fact claim에 후보 evidence index에 없는 evidence_id를
// 인용하면 `claim-evidence: unresolved evidence_id` 차감이 발생한다. reconcile은 실제 뒷받침
// evidence가 후보의 allowed_claim_evidence에 있을 때만 결정론적으로 재바인딩하고,
// 뒷받침이 없으면 unbound로 fail-closed 유지한다(게이트 약화 없음).

test('reconcile rebinds a non-empty but unresolved evidence_id to the candidate allowed evidence', () => {
  const draft = editor({
    sections: [section(1, {
      claims: [{
        claim_id: 'claim-1',
        text: 'Fact 1',
        claim_type: 'fact',
        evidence_ids: ['evidence-unresolved-bogus'],
        source_urls: ['https://example.com/source-1'],
        impact_level: 'app_api_or_framework_adjacent',
        overclaim_risk: 'low'
      }]
    })]
  });

  const result = reconcileFactClaimEvidence(draft, { reporter: reporterForClaimTests() });

  assert.deepEqual(result.sections[0].claims[0].evidence_ids, ['evidence-1']);
});

test('reconcile leaves a claim with unsupported specific tokens unbound (fail closed, never invents evidence)', () => {
  // claim 텍스트의 protected token(CameraX 9.9.9)이 후보 evidence('Fact 1')에 없으므로
  // strict 오라클이 fact_claim_not_supported_by_evidence_text로 거부 -> 재바인딩 안 함.
  const draft = editor({
    sections: [section(1, {
      claims: [{
        claim_id: 'claim-1',
        text: 'CameraX 9.9.9 ships a brand new HAL API surface',
        claim_type: 'fact',
        evidence_ids: ['evidence-unresolved-bogus'],
        source_urls: ['https://example.com/source-1'],
        impact_level: 'app_api_or_framework_adjacent',
        overclaim_risk: 'low'
      }]
    })]
  });

  const result = reconcileFactClaimEvidence(draft, { reporter: reporterForClaimTests() });

  assert.deepEqual(result.sections[0].claims[0].evidence_ids, ['evidence-unresolved-bogus']);
});

test('reconcile still binds an empty evidence_ids fact claim (superset of the missing-evidence case)', () => {
  const draft = editor({
    sections: [section(1, {
      claims: [{
        claim_id: 'claim-1',
        text: 'Fact 1',
        claim_type: 'fact',
        evidence_ids: [],
        source_urls: ['https://example.com/source-1'],
        impact_level: 'app_api_or_framework_adjacent',
        overclaim_risk: 'low'
      }]
    })]
  });

  const result = reconcileFactClaimEvidence(draft, { reporter: reporterForClaimTests() });

  assert.deepEqual(result.sections[0].claims[0].evidence_ids, ['evidence-1']);
});
