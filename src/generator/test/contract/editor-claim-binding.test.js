'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  EditorSemanticValidationError,
  validateEditorOutputContract
} = require('../../editor/editor-output-contract');
const {
  articleClaimContractPrompt
} = require('../../publish/gemini-newsroom-newsletter');
const {
  section,
  editor,
  reporterForClaimTests,
  normalizeSection
} = require('../../../core/test/helpers/editor-builders');

test('strict editor claim binding requires a fact claim for factual article fields', () => {
  const draft = editor({
    sections: [
      section(1, {
        claims: [{
          claim_id: 'claim-1',
          text: 'Fact 1',
          claim_type: 'recommendation',
          evidence_ids: ['evidence-1'],
          source_urls: ['https://example.com/source-1'],
          impact_level: 'direct_hal_contract',
          overclaim_risk: 'low'
        }]
      }),
      section(2),
      section(3)
    ]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, '2026-05-08', {
      normalizeSection,
      reporter: reporterForClaimTests(),
      strictClaims: true
    }),
    error => {
      assert.ok(error instanceof EditorSemanticValidationError);
      assert.equal(error.details.field, 'sections.claims');
      assert.ok(error.details.issues.some(issue =>
        issue.issues.some(item => item.reason_code === 'missing_fact_claim')
      ));
      return true;
    }
  );
});

test('strict editor claim binding accepts allowed claim evidence ids', () => {
  const draft = editor({
    sections: [
      section(1, {
        claims: [{
          claim_id: 'claim-1',
          text: 'Fact 1',
          claim_type: 'fact',
          evidence_ids: ['evidence-1'],
          source_urls: ['https://example.com/source-1'],
          impact_level: 'app_api_or_framework_adjacent',
          overclaim_risk: 'low'
        }]
      })
    ]
  });

  assert.doesNotThrow(() => validateEditorOutputContract(draft, '2026-05-08', {
    normalizeSection,
    reporter: reporterForClaimTests(),
    strictClaims: true
  }));
});

test('strict editor claim binding uses seed evidence pack input when validating editor output', () => {
  const url = 'https://example.com/source-1';
  const draft = editor({
    sections: [
      section(1, {
        claims: [{
          claim_id: 'claim-1',
          text: 'Fact 1',
          claim_type: 'fact',
          evidence_ids: ['seed-primary-1'],
          source_urls: [url],
          impact_level: 'app_api_or_framework_adjacent',
          overclaim_risk: 'low'
        }]
      })
    ]
  });
  const reporter = {
    candidates: [{
      title: 'Source 1',
      url,
      source_candidate_hash: 'hash-1',
      relevance_bucket: 'direct_aosp_camera',
      counts_as_primary_camera_topic: true,
      evidence_pack_ids: ['seed-pack-1'],
      finalSelectionEligibility: 'main',
      hasDatedEvidence: true,
      source_gap_risk: false,
      main_eligible: true
    }]
  };
  const seedEvidencePack = {
    packs: [{
      evidence_pack_id: 'seed-pack-1',
      seed_url: url,
      final_url: url,
      title: 'Source 1',
      primary_evidence: [{
        evidence_id: 'seed-primary-1',
        url,
        title: 'Source 1',
        source_backed_items: ['Fact 1']
      }],
      linked_evidence: []
    }]
  };

  assert.doesNotThrow(() => validateEditorOutputContract(draft, '2026-05-08', {
    normalizeSection,
    reporter,
    strictClaims: true,
    seedEvidencePack
  }));
});

test('strict editor claim binding rejects field paths as evidence ids', () => {
  const draft = editor({
    sections: [
      section(1, {
        claims: [{
          claim_id: 'claim-1',
          text: 'Fact 1',
          claim_type: 'fact',
          evidence_ids: ['article_sections.verified_facts[0]'],
          source_urls: ['https://example.com/source-1'],
          impact_level: 'app_api_or_framework_adjacent',
          overclaim_risk: 'low'
        }]
      })
    ]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, '2026-05-08', {
      normalizeSection,
      reporter: reporterForClaimTests(),
      strictClaims: true
    }),
    error => {
      const reasonCodes = error.details.issues.flatMap(issue =>
        issue.issues.map(item => item.reason_code)
      );
      assert.ok(reasonCodes.includes('unknown_evidence_id'));
      return true;
    }
  );
});

test('claim prompt restricts editor and repair evidence ids to allowed evidence', () => {
  const prompt = articleClaimContractPrompt();

  assert.match(prompt, /allowed_claim_evidence\[\]\.evidence_id/);
  assert.match(prompt, /allowed_claim_evidence\[\]\.source_urls/);
  assert.match(prompt, /confirmed_facts\[0\]/);
  assert.match(prompt, /article_sections\.verified_facts\[0\]/);
  assert.doesNotMatch(prompt, /Repair/);
});

test('strict editor claim binding rejects duplicate claim ids and invalid enums', () => {
  const draft = editor({
    sections: [
      section(1, {
        claims: [
          {
            claim_id: 'claim-1',
            text: 'Fact 1',
            claim_type: 'fact',
            evidence_ids: ['evidence-1'],
            source_urls: ['https://example.com/source-1'],
            impact_level: 'not_an_impact',
            overclaim_risk: 'low'
          },
          {
            claim_id: 'claim-1',
            text: 'Fact 1',
            claim_type: 'not_a_claim_type',
            evidence_ids: ['evidence-1'],
            source_urls: ['https://example.com/source-1'],
            impact_level: 'direct_hal_contract',
            overclaim_risk: 'impossible'
          }
        ]
      }),
      section(2),
      section(3)
    ]
  });

  assert.throws(
    () => validateEditorOutputContract(draft, '2026-05-08', {
      normalizeSection,
      reporter: reporterForClaimTests(),
      strictClaims: true
    }),
    error => {
      const reasonCodes = error.details.issues.flatMap(issue =>
        issue.issues.map(item => item.reason_code)
      );
      assert.ok(reasonCodes.includes('duplicate_claim_id'));
      assert.ok(reasonCodes.includes('invalid_claim_type'));
      assert.ok(reasonCodes.includes('invalid_impact_level'));
      assert.ok(reasonCodes.includes('invalid_overclaim_risk'));
      return true;
    }
  );
});

test('strict editor claim binding maps source and HAL signal impact aliases with source URL evidence', () => {
  const url = 'https://example.com/source-1';
  const draft = editor({
    sections: [
      section(1, {
        claims: [{
          claim_id: 'claim-1',
          text: 'Fact 1',
          claim_type: 'fact',
          evidence_ids: [],
          source_urls: [url],
          impact_level: 'camerax_app_compatibility',
          overclaim_risk: 'low'
        }]
      })
    ]
  });
  const reporter = {
    candidates: [{
      title: 'Source 1',
      url,
      source_candidate_hash: 'hash-1',
      source_extraction: {
        evidence_blocks: [{
          text: 'Fact 1',
          links: [{ url }]
        }]
      },
      finalSelectionEligibility: 'main',
      hasDatedEvidence: true,
      source_gap_risk: false,
      main_eligible: true
    }]
  };

  assert.doesNotThrow(() => validateEditorOutputContract(draft, '2026-05-08', {
    normalizeSection,
    reporter,
    strictClaims: true
  }));
});
