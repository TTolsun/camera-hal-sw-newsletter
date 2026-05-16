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

test('evidence fetch target selection uses deterministic priority instead of input order', () => {
  const canonical = candidate('canonical', {
    id: 'canonical',
    title: 'Canonical Camera source',
    url: 'https://example.com/canonical',
    finalSelectionEligibility: 'watchlist',
    source_quality_bucket: 'weak_candidate',
    source_quality_score: 0.1,
    reliability: 'community',
    published_date: '2026-05-01'
  });
  const shuffled = [
    candidate('low-first', {
      id: 'low-first',
      source_quality_score: 0.05,
      reliability: 'community',
      published_date: '2026-05-16'
    }),
    candidate('review-high', {
      id: 'review-high',
      source_quality_bucket: 'review_candidate',
      source_quality_score: 0.99,
      reliability: 'official',
      published_date: '2026-05-16'
    }),
    candidate('strong-community-new', {
      id: 'strong-community-new',
      source_quality_score: 0.7,
      reliability: 'community',
      published_date: '2026-05-20'
    }),
    candidate('strong-official-old', {
      id: 'strong-official-old',
      source_quality_score: 0.7,
      reliability: 'official',
      published_date: '2026-05-01'
    }),
    candidate('strong-official-new', {
      id: 'strong-official-new',
      source_quality_score: 0.7,
      reliability: 'official',
      published_date: '2026-05-20'
    }),
    candidate('strong-high', {
      id: 'strong-high',
      source_quality_score: 0.95,
      reliability: 'community',
      published_date: '2026-05-10'
    }),
    ...Array.from({ length: 14 }, (_, index) => candidate(`filler-${index}`, {
      id: `filler-${index}`,
      source_quality_bucket: index % 2 === 0 ? 'review_candidate' : 'strong_candidate',
      source_quality_score: 0.2,
      reliability: 'community',
      published_date: '2026-04-01'
    })),
    canonical
  ];

  const targets = selectEvidenceFetchTargets(shuffled, {
    clusters: [{
      duplicate_count: 1,
      canonical_url: canonical.url,
      canonical_title: canonical.title
    }]
  }, { maxTargets: 12 });

  assert.deepEqual(targets.slice(0, 7).map(item => item.id), [
    'canonical',
    'strong-high',
    'strong-official-new',
    'strong-official-old',
    'strong-community-new',
    'filler-1',
    'filler-11'
  ]);
  assert.equal(targets.length, 12);
  assert.equal(targets.some(item => item.id === 'low-first'), false);
  assert.equal(targets.some(item => item.id === 'review-high'), false);
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
