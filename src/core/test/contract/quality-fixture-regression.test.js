'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  reportFor,
  scopedCandidate,
  section,
  validSections,
  reporterCandidatesFor
} = require('../helpers/quality-builders');
const { readJsonFixture } = require('../helpers/fixture-loader');

test('bad regression fixtures cannot pass the main article quality gate', () => {
  const genericAi = readJsonFixture('quality/bad/generic-ai-main-article.json');
  const freebsd = readJsonFixture('quality/bad/freebsd-source-label-regression.json');
  const sections = [
    section({
      ...genericAi.section,
      url: genericAi.section.sources[0].url
    }),
    section({
      ...freebsd.section,
      url: freebsd.section.sources[0].url
    }),
    section({ headline: 'CameraX release A', url: 'https://example.com/a' }),
    section({ headline: 'AOSP Camera change B', url: 'https://example.com/b' })
  ];
  const report = reportFor(sections, [
    scopedCandidate(genericAi.section.sources[0].url, 'generic_tech_watchlist', genericAi.policyFlags),
    scopedCandidate(freebsd.section.sources[0].url, 'generic_tech_watchlist', {
      ...freebsd.candidate,
      editorial_priority: 6,
      camera_hal_relevance_score: 0,
      android_camera_relevance_score: 0,
      practical_actionability_score: 0
    }),
    scopedCandidate('https://example.com/a', 'direct_aosp_camera'),
    scopedCandidate('https://example.com/b', 'direct_aosp_camera')
  ]);

  // generic-AI / freebsd are forbidden (generic_tech_watchlist) main buckets. Per-article
  // editorial usefulness is now the fact-checker's call, so the deterministic gate no longer
  // DEMOTEs them on topic; the newsletter-level composition policy still blocks the lineup.
  assert.equal(report.status, 'NEEDS_FIX');
  assert.ok(report.metrics.blocking_deduction_count > 0);
});

test('curated good quality fixtures remain passable synthetic contract samples', () => {
  const fixturePaths = [
    'quality/good/camerax-curated.json',
    'quality/good/libcamera-driver-pipeline-curated.json'
  ];
  const fixtureSections = fixturePaths.map(fixturePath => {
    const fixture = readJsonFixture(fixturePath);
    const url = fixture.section.sources[0].url;
    return section({ ...fixture.section, url });
  });
  const sections = [
    ...fixtureSections,
    ...validSections().slice(fixtureSections.length)
  ];
  const report = reportFor(sections, [
    ...fixturePaths.map(fixturePath => {
      const fixture = readJsonFixture(fixturePath);
      return scopedCandidate(
        fixture.section.sources[0].url,
        fixture.candidate?.relevance_bucket || 'direct_aosp_camera',
        fixture.policyFlags
      );
    }),
    ...reporterCandidatesFor(validSections()).slice(fixtureSections.length)
  ]);

  for (const fixtureSection of fixtureSections) {
    const result = report.article_results.find(item => item.headline === fixtureSection.headline);
    assert.ok(result, `${fixtureSection.headline} should be present in quality results`);
    assert.equal(result.status, 'PASS');
  }
});

test('bad quality fixture coverage remains non-PASS under the quality gate', () => {
  // weak-hal-actionability was a quality/depth-only bad fixture; that judgment moved to the
  // fact-checker LLM, so the deterministic gate no longer fails it. The remaining fixtures are
  // safety-bad (missing source, source-gap risk, reference-only promotion, undated evidence).
  const fixturePaths = [
    'quality/bad/missing-source-url-main-article.json',
    'quality/bad/source-gap-risk-main-article.json',
    'quality/bad/reference-only-promoted-main-article.json',
    'quality/bad/undated-evidence-main-article.json'
  ];
  const fixtures = fixturePaths.map(readJsonFixture);
  const sections = fixtures.map(fixture => {
    const url = fixture.section.sources?.[0]?.url;
    return section(url ? { ...fixture.section, url } : fixture.section);
  });
  const report = reportFor(sections, fixtures
    .filter(fixture => fixture.section.sources?.[0]?.url)
    .map(fixture => scopedCandidate(
      fixture.section.sources[0].url,
      fixture.candidate?.relevance_bucket || 'direct_aosp_camera',
      {
        ...fixture.policyFlags,
        ...fixture.candidate
      }
    )));

  assert.equal(report.status, 'NEEDS_FIX');
  for (const fixture of fixtures) {
    const result = report.article_results.find(item => item.headline === fixture.section.headline);
    assert.ok(result, `${fixture.section.headline} should be present in quality results`);
    assert.notEqual(result.status, 'PASS');
  }
});

test('bad duplicate and stale-claim quality fixtures remain blocking', () => {
  const duplicate = readJsonFixture('quality/bad/duplicate-source-url-main-articles.json');
  const duplicateSections = duplicate.sections.map(item => section({
    ...item,
    url: item.sources[0].url
  }));
  const duplicateReport = reportFor([
    ...duplicateSections,
    ...validSections().slice(duplicateSections.length)
  ], reporterCandidatesFor([
    ...duplicateSections,
    ...validSections().slice(duplicateSections.length)
  ]));

  assert.equal(duplicateReport.status, 'NEEDS_FIX');
  assert.ok(duplicateReport.deductions.some(item =>
    item.reason.toLowerCase().includes('duplicate source url')
  ));

  const stale = readJsonFixture('quality/bad/stale-claim-hard-failure.json');
  const staleReport = reportFor(validSections(), reporterCandidatesFor(validSections()), {
    staleClaimReport: stale.staleClaimReport
  });

  assert.equal(staleReport.status, 'NEEDS_FIX');
  assert.equal(staleReport.metrics.stale_claim_status, 'NEEDS_FIX');
  assert.equal(staleReport.metrics.stale_claim_hard_failure_count, 1);
});
