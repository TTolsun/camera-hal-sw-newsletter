'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  qualityGatePolicy
} = require('../../scripts/newsroom/common/newsletter-policy');
const {
  hardFailRegressionCases
} = require('../helpers/quality-fixtures');
const {
  reportFor,
  scopedCandidate,
  section,
  validSections,
  reporterCandidatesFor
} = require('../helpers/quality-builders');
const {
  determineQualityStatus
} = require('../../scripts/newsroom/validate/newsletter-quality');

test('qualityGatePolicy.hardFailConditions have config-driven regression test coverage', () => {
  const configuredConditions = new Set(qualityGatePolicy.hardFailConditions);

  for (const condition of qualityGatePolicy.hardFailConditions) {
    const regression = hardFailRegressionCases.get(condition);
    assert.ok(regression, `Missing hard fail regression case for configured condition: ${condition}`);
    assert.ok(
      regression.name.includes(condition),
      `Regression test name must include configured hard fail condition: ${condition}`
    );
  }

  for (const condition of hardFailRegressionCases.keys()) {
    assert.ok(configuredConditions.has(condition), `Regression case is not configured in qualityGatePolicy.hardFailConditions: ${condition}`);
  }
});

for (const regression of hardFailRegressionCases.values()) {
  test(regression.name, () => {
    const report = regression.buildReport();
    regression.assertReport(report);
    assert.ok(report.metrics.blocking_deduction_count > 0);
    assert.ok(report.metrics.hard_fail_count > 0);
  });
}

test('quality gate passes only when every safety check clears and every article is publishable', () => {
  assert.equal(determineQualityStatus({
    sourceGapCount: 0,
    hasFactCheckMustFix: false,
    blockingDeductions: [],
    unpublishableArticles: []
  }), 'PASS');
});

test('quality gate fails an article the fact-checker marked not useful to a HAL SW engineer', () => {
  assert.equal(determineQualityStatus({
    sourceGapCount: 0,
    hasFactCheckMustFix: false,
    blockingDeductions: [],
    unpublishableArticles: [{ section_index: 0, reason: 'generic, no concrete value for a HAL SW engineer' }]
  }), 'NEEDS_FIX');
});

test('quality gate does not override hard blockers regardless of article verdicts', () => {
  assert.equal(determineQualityStatus({
    sourceGapCount: 0,
    hasFactCheckMustFix: false,
    blockingDeductions: [{ category: 'composition', points: 4 }],
    unpublishableArticles: []
  }), 'NEEDS_FIX');
  assert.equal(determineQualityStatus({
    sourceGapCount: 1,
    hasFactCheckMustFix: false,
    blockingDeductions: [],
    unpublishableArticles: []
  }), 'NEEDS_FIX');
  assert.equal(determineQualityStatus({
    sourceGapCount: 0,
    hasFactCheckMustFix: true,
    blockingDeductions: [],
    unpublishableArticles: []
  }), 'NEEDS_FIX');
});

test('quality gate hard-fails raw background table artifacts', () => {
  const url = 'https://example.com/raw-camerax-table';
  const sections = [
    section({
      headline: 'CameraX raw table leak',
      url,
      background: 'camera-view 1.6.1 - - 1.7.0-alpha01 camera-video 1.6.1 - - 1.7.0-alpha01 View the Camera Library Close Maven Group versions'
    }),
    ...validSections().slice(1)
  ];
  const report = reportFor(sections, [
    scopedCandidate(url, 'android_platform_camera_adjacent'),
    ...reporterCandidatesFor(validSections()).slice(1)
  ]);

  assert.equal(report.status, 'NEEDS_FIX');
  assert.ok(report.deductions.some(item => item.category === 'field-hygiene' && item.blocking === true));
  assert.equal(report.article_results[0].status, 'FAIL');
});

test('quality gate hard-fails exact duplicate and semantic background overlap', () => {
  const exactUrl = 'https://example.com/exact-overlap';
  const semanticUrl = 'https://example.com/semantic-overlap';
  const exactReport = reportFor([
    section({
      headline: 'CameraX exact duplicate',
      url: exactUrl,
      what_changed: 'CameraX changed.',
      background: 'CameraX changed.'
    }),
    ...validSections().slice(1)
  ], [
    scopedCandidate(exactUrl, 'android_platform_camera_adjacent'),
    ...reporterCandidatesFor(validSections()).slice(1)
  ]);
  const semanticReport = reportFor([
    section({
      headline: 'CameraX semantic overlap',
      url: semanticUrl,
      what_changed: 'CameraX release updates Android camera compatibility validation behavior today.',
      background: 'CameraX release updates Android camera compatibility validation behavior now.'
    }),
    ...validSections().slice(1)
  ], [
    scopedCandidate(semanticUrl, 'android_platform_camera_adjacent'),
    ...reporterCandidatesFor(validSections()).slice(1)
  ]);

  assert.ok(exactReport.deductions.some(item =>
    item.category === 'field-hygiene' &&
    item.blocking === true &&
    item.reason.includes('exactly duplicates')
  ));
  assert.equal(exactReport.article_results[0].status, 'FAIL');
  assert.ok(semanticReport.deductions.some(item =>
    item.category === 'field-hygiene' &&
    item.blocking === true &&
    item.reason.includes('overlaps what_changed too much')
  ));
  assert.equal(semanticReport.article_results[0].status, 'FAIL');
});
