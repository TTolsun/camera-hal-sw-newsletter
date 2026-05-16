const assert = require('node:assert/strict');
const test = require('node:test');

const {
  selectEvidenceFetchTargets
} = require('../../../scripts/newsroom/cli/gemini-source-discovery-boundary');
const {
  validateCandidateEvidence
} = require('../../../scripts/newsroom/evidence/validate-candidate-evidence');

function candidate(index, overrides = {}) {
  return {
    id: `candidate-${index}`,
    title: `Camera candidate ${index}`,
    url: `https://example.com/camera-${index}`,
    finalSelectionEligibility: 'main',
    source_quality_bucket: 'strong_candidate',
    duplicate_of_selected_source: false,
    source_gap_risk: false,
    ...overrides
  };
}

test('evidence fetch target selection is capped and skips weak watchlist candidates', () => {
  const candidates = [
    ...Array.from({ length: 20 }, (_, index) => candidate(index)),
    candidate('weak', {
      id: 'weak-watchlist',
      finalSelectionEligibility: 'watchlist',
      source_quality_bucket: 'weak_candidate'
    })
  ];
  const targets = selectEvidenceFetchTargets(candidates, { clusters: [] }, { maxTargets: 12 });
  const targetIds = new Set(targets.map(item => item.id));

  assert.equal(targets.length, 12);
  assert.equal(targetIds.has('weak-watchlist'), false);

  const evidence = validateCandidateEvidence(candidates, {
    sources: targets.map(item => ({
      id: item.id,
      url: item.url,
      title: item.title,
      source_fetch_used: true,
      source_fetch_status: 'success',
      validation_mode: 'source_fetch',
      claims: [{ claim: item.title, evidence_text: `${item.title} source evidence.` }]
    }))
  }, { newsletterDate: '2026-05-16' });
  const skipped = evidence.report.candidates.find(item => item.candidate_id === 'weak-watchlist');

  assert.equal(skipped.validation_mode, 'skipped');
  assert.equal(skipped.source_fetch_status, 'skipped');
  assert.equal(skipped.evidence_validation_status, 'not_checked');
});

test('duplicate canonical candidate is fetched even when it is outside the strong final-eligible subset', () => {
  const canonical = candidate('canonical', {
    id: 'canonical',
    title: 'Canonical Camera source',
    url: 'https://example.com/canonical',
    finalSelectionEligibility: 'watchlist',
    source_quality_bucket: 'weak_candidate'
  });
  const duplicate = candidate('duplicate', {
    id: 'duplicate',
    title: 'Duplicate Camera source',
    url: 'https://example.com/duplicate',
    duplicate_of_selected_source: true
  });

  const targets = selectEvidenceFetchTargets([canonical, duplicate], {
    clusters: [{
      duplicate_count: 1,
      canonical_url: canonical.url,
      canonical_title: canonical.title
    }]
  }, { maxTargets: 12 });

  assert.deepEqual(targets.map(item => item.id), ['canonical']);
});

test('fetch failure requires editor review without turning metadata into deep evidence', () => {
  const source = candidate('fetch-failed');
  const evidence = validateCandidateEvidence([source], {
    sources: [{
      id: source.id,
      url: source.url,
      title: source.title,
      source_fetch_used: true,
      source_fetch_status: 'failed',
      source_fetch_error: 'timeout',
      validation_mode: 'source_fetch',
      claims: [{ claim: source.title, evidence_text: '' }]
    }]
  }, { newsletterDate: '2026-05-16' });
  const item = evidence.report.candidates[0];
  const annotated = evidence.annotatedCandidates[0];

  assert.equal(item.deep_checked, false);
  assert.equal(item.source_fetch_used, true);
  assert.equal(item.source_fetch_status, 'failed');
  assert.equal(item.validation_mode, 'source_fetch');
  assert.equal(item.evidence_validation_status, 'fetch_failed_review_required');
  assert.equal(item.final_selection_blocked, false);
  assert.equal(item.editor_review_required, true);
  assert.equal(annotated.evidence_validation_status, 'fetch_failed_review_required');
});

test('source gap risk stays blocked even when source fetch fails', () => {
  const source = candidate('source-gap', { source_gap_risk: true });
  const evidence = validateCandidateEvidence([source], {
    sources: [{
      id: source.id,
      url: source.url,
      title: source.title,
      source_fetch_used: true,
      source_fetch_status: 'failed',
      source_fetch_error: 'timeout',
      validation_mode: 'source_fetch',
      claims: [{ claim: source.title, evidence_text: '' }]
    }]
  }, { newsletterDate: '2026-05-16' });
  const item = evidence.report.candidates[0];

  assert.equal(item.final_selection_blocked, true);
  assert.equal(item.evidence_validation_status, 'blocked');
  assert.ok(item.reasons.includes('source_gap_risk=true'));
});
