'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { candidate } = require('../helpers/newsroom-builders');
const { readJsonFixture } = require('../helpers/fixture-loader');
const {
  buildShortlistReport
} = require('../helpers/selection-builders');

test('bad selection fixtures do not become final main articles', () => {
  const badFixtures = [
    'selection/bad/watchlist-reference-main-article.json',
    'selection/bad/source-gap-main-article.json',
    'selection/bad/missing-url-main-candidate.json',
    'selection/bad/candidate-only-without-crosscheck.json',
    'selection/bad/weak-hal-generic-ai-main-candidate.json',
    'selection/bad/undated-reference-promotion-candidate.json'
  ].map(fixturePath => ({
    fixturePath,
    fixture: readJsonFixture(fixturePath)
  }));
  const duplicate = readJsonFixture('selection/bad/duplicate-url-main-candidates.json');
  const badCandidates = [
    ...badFixtures.map(({ fixture }) => candidate(fixture.candidate)),
    ...duplicate.candidates.map(item => candidate(item))
  ];
  const report = buildShortlistReport('2026-05-03', [
    candidate({ title: 'CameraX release A improves Android Camera validation', url: 'https://example.com/a' }),
    candidate({ title: 'AOSP Camera change B updates stream compatibility', url: 'https://example.com/b' }),
    candidate({ title: 'Android Camera API change C fixes metadata behavior', url: 'https://example.com/c' }),
    candidate({ title: 'Camera HAL stream update D changes buffer handling', url: 'https://example.com/d' }),
    ...badCandidates
  ]);
  const selectedUrls = new Set(report.selected_articles.map(item => item.url));

  for (const { fixture } of badFixtures) {
    assert.equal(selectedUrls.has(fixture.candidate.url), false);
    if (fixture.expected.status === 'EXCLUDE') {
      assert.ok(
        report.excluded_candidates.some(item =>
          item.url === fixture.candidate.url || item.title === fixture.candidate.title
        ),
        `${fixture.candidate.title} should be excluded`
      );
    }
  }
  assert.ok(report.excluded_candidates.some(item =>
    item.url === duplicate.candidates[1].url &&
    item.exclusion_reasons.includes('duplicate URL or near-duplicate title')
  ));
});

test('good selection fixtures remain eligible final main article inputs', () => {
  const goodFixtures = [
    'selection/good/camerax-main-candidate.json',
    'selection/good/dated-aosp-camera-main-candidate.json',
    'selection/good/libcamera-driver-pipeline-main-candidate.json'
  ].map(readJsonFixture);
  const report = buildShortlistReport('2026-05-03', goodFixtures.map(fixture => candidate(fixture.candidate)));
  const excludedUrls = new Set(report.excluded_candidates.map(item => item.url));
  const selectedUrls = new Set(report.selected_articles.map(item => item.url));

  for (const fixture of goodFixtures) {
    assert.equal(excludedUrls.has(fixture.candidate.url), false);
    assert.equal(selectedUrls.has(fixture.candidate.url), true);
  }
});
