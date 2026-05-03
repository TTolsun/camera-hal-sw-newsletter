const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildShortlistReport,
  exclusionReasons,
  normalizeUrl,
  selectFinalArticles
} = require('../scripts/lib/newsroom-selection');

function candidate(overrides = {}) {
  const title = overrides.title || 'CameraX 1.5 release improves Android Camera compatibility';
  const urlTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return {
    title,
    source: overrides.source || 'Android Developers',
    url: overrides.url || `https://example.com/${urlTitle}`,
    published_date: overrides.published_date || '2026-05-01T00:00:00Z',
    summary: overrides.summary || 'CameraX release changes Android Camera behavior and compatibility validation.',
    reliability: overrides.reliability || 'official',
    finalSelectionEligibility: overrides.finalSelectionEligibility || 'main',
    isWatchPage: overrides.isWatchPage || false,
    hasDatedEvidence: overrides.hasDatedEvidence !== undefined ? overrides.hasDatedEvidence : true,
    source_gap_risk: overrides.source_gap_risk || false,
    main_eligible: overrides.main_eligible !== undefined ? overrides.main_eligible : true,
    briefing_only: overrides.briefing_only || false,
    reference_only: overrides.reference_only || false,
    evidence_score: overrides.evidence_score !== undefined ? overrides.evidence_score : 6,
    camera_hal_relevance_score: overrides.camera_hal_relevance_score !== undefined ? overrides.camera_hal_relevance_score : 100,
    api_or_component: overrides.api_or_component || 'CameraX',
    behavior_change: overrides.behavior_change || 'Release updates CameraX compatibility behavior.',
    ...overrides
  };
}

test('prefilter excludes source gaps, undated watch pages, missing evidence, and duplicate URLs', () => {
  const report = buildShortlistReport('2026-05-03', [
    candidate({ title: 'Android Camera HAL release note', url: 'https://example.com/a' }),
    candidate({ title: 'Duplicate URL', url: 'https://example.com/a?utm=1' }),
    candidate({ title: 'Source gap', url: 'https://example.com/b', source_gap_risk: true }),
    candidate({ title: 'Watch page', url: 'https://example.com/c', isWatchPage: true, hasDatedEvidence: false, finalSelectionEligibility: 'watchlist' }),
    candidate({ title: 'Missing date', url: 'https://example.com/d', published_date: '', hasDatedEvidence: false })
  ], { minArticles: 1 });

  assert.equal(report.shortlisted_candidates.length, 1);
  assert.equal(report.shortlisted_candidates[0].title, 'Android Camera HAL release note');
  assert.deepEqual(
    report.excluded_candidates.map(item => item.exclusion_reasons[0]),
    ['duplicate URL or near-duplicate title', 'source_gap_risk=true', 'missing dated evidence', 'missing dated evidence']
  );
});

test('deterministic score ordering is stable and shortlist is capped', () => {
  const items = Array.from({ length: 15 }, (_, index) => candidate({
    title: `CameraX release ${index} component ${String.fromCharCode(65 + index)}`,
    url: `https://example.com/release-${index}`,
    reliability: index % 2 === 0 ? 'official' : 'community',
    camera_hal_relevance_score: 100 - index
  }));
  const report = buildShortlistReport('2026-05-03', items);

  assert.equal(report.shortlisted_candidates.length, 12);
  assert.equal(report.shortlisted_candidates[0].title, 'CameraX release 0 component A');
  assert.ok(report.shortlisted_candidates[0].deterministic_score >= report.shortlisted_candidates[1].deterministic_score);
});

test('final selection enforces AI slot and uses C++ fallback only when needed', () => {
  const shortlist = [
    candidate({ title: 'CameraX release A', url: 'https://example.com/a' }),
    candidate({ title: 'AOSP Camera change B', url: 'https://example.com/b' }),
    candidate({ title: 'Android Camera API change C', url: 'https://example.com/c' }),
    candidate({ title: 'Hybrid inference for Android camera apps', url: 'https://example.com/ai', summary: 'AI inference over image frames for Android camera workflows.' }),
    candidate({ title: 'C++ toolchain tip for HAL tests', url: 'https://example.com/cpp', summary: 'C++ compiler workflow for native Camera HAL test builds.', camera_hal_relevance_score: 45 })
  ];

  const selected = selectFinalArticles(shortlist);

  assert.ok(selected.length >= 4 && selected.length <= 5);
  assert.ok(selected.some(item => item.ai_slot_candidate));
  assert.ok(selected.some(item => item.title.includes('C++')) || selected.filter(item => item.camera_platform_candidate).length >= 4);
});

test('near-duplicate titles are prevented', () => {
  const report = buildShortlistReport('2026-05-03', [
    candidate({ title: 'CameraX 1.5 release improves compatibility', url: 'https://example.com/a' }),
    candidate({ title: 'CameraX 1.5 release improves Android compatibility', url: 'https://example.com/b' })
  ], { minArticles: 1 });

  assert.equal(report.shortlisted_candidates.length, 1);
  assert.equal(report.excluded_candidates[0].exclusion_reasons[0], 'duplicate URL or near-duplicate title');
});

test('URL normalization removes tracking query and hash', () => {
  assert.equal(
    normalizeUrl('https://Example.com/path/?utm_source=x#section'),
    'https://example.com/path'
  );
});

test('exclusion reason reports reference-only candidates', () => {
  assert.ok(exclusionReasons(candidate({ reference_only: true })).includes('reference_only=true'));
});
