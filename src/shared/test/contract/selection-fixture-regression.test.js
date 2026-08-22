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
  // 앵커(2026-05-14, coverage 주 2026-05-04~05-10) 기준: 날짜 없는 기본 후보(2026-05-01)는
  // fallback 창(9일), 명시적으로 05-06을 쓰는 두 후보는 primary 창(4일)에 들어간다. primary만
  // 으로도 min(1)을 채우므로 fallback이 자동 참조되지 않는데, 이 테스트는 세 fixture 모두
  // 선정에 남아야 한다는 계약을 검증하는 목적이라 minArticles를 3으로 올려 fallback도
  // 명시적으로 채우게 한다.
  const report = buildShortlistReport('2026-05-14', goodFixtures.map(fixture => candidate(fixture.candidate)), {
    minArticles: 3
  });
  const excludedUrls = new Set(report.excluded_candidates.map(item => item.url));
  const selectedUrls = new Set(report.selected_articles.map(item => item.url));

  for (const fixture of goodFixtures) {
    assert.equal(excludedUrls.has(fixture.candidate.url), false);
    assert.equal(selectedUrls.has(fixture.candidate.url), true);
  }
});
