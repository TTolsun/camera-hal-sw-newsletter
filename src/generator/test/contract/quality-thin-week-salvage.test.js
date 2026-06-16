'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildNewsletterQualityReport,
  salvagePublishableSubset
} = require('../../quality/newsletter-quality');
const {
  scopedCandidate,
  section
} = require('../../../shared/test/helpers/quality-builders');

const DATE = '2026-06-03';

function publishable(index, reason = 'Useful to a Camera HAL SW engineer.') {
  return { section_index: index, publishable: true, reason };
}

function buildInputs(sections, candidates, factCheckOverrides = {}) {
  const editor = { briefing: ['one', 'two', 'three'], sections };
  const reporter = { candidates };
  const factCheck = {
    status: 'PASS',
    must_fix: [],
    source_gaps: [],
    source_gap_count: 0,
    recommended_fixes: [],
    article_quality: sections.map((_, index) => publishable(index)),
    ...factCheckOverrides
  };
  return { editor, reporter, factCheck };
}

test('salvage drops a failed article and publishes the clean subset', () => {
  const clean = section({ headline: 'CameraX 1.7.0-alpha01 SessionConfig API', url: 'https://example.com/clean' });
  const broken = section({ headline: 'Broken source article', url: 'invalid-source-url-without-scheme' });
  const { editor, reporter, factCheck } = buildInputs(
    [clean, broken],
    [scopedCandidate('https://example.com/clean', 'direct_aosp_camera'), scopedCandidate('invalid-source-url-without-scheme', 'direct_aosp_camera')]
  );

  const report = buildNewsletterQualityReport(DATE, editor, reporter, factCheck, {});
  assert.equal(report.status, 'NEEDS_FIX');

  const salvage = salvagePublishableSubset(DATE, editor, reporter, factCheck, report, {});
  assert.ok(salvage, 'a clean single-article subset should be salvageable');
  assert.equal(salvage.kept_section_count, 1);
  assert.equal(salvage.dropped_section_count, 1);
  assert.equal(salvage.qualityReport.status, 'PASS');
  assert.equal(salvage.editor.sections.length, 1);
  assert.equal(salvage.editor.sections[0].headline, clean.headline);
});

test('salvage drops an article the fact-checker marked not publishable', () => {
  const clean = section({ headline: 'CameraX clean article', url: 'https://example.com/clean' });
  const stale = section({ headline: 'Stale catch-up article', url: 'https://example.com/stale' });
  const { editor, reporter, factCheck } = buildInputs(
    [clean, stale],
    [scopedCandidate('https://example.com/clean', 'direct_aosp_camera'), scopedCandidate('https://example.com/stale', 'direct_aosp_camera')],
    { article_quality: [publishable(0), { section_index: 1, publishable: false, reason: 'Stale, no concrete value for a HAL SW engineer.' }] }
  );

  const report = buildNewsletterQualityReport(DATE, editor, reporter, factCheck, {});
  assert.equal(report.status, 'NEEDS_FIX');

  const salvage = salvagePublishableSubset(DATE, editor, reporter, factCheck, report, {});
  assert.ok(salvage);
  assert.equal(salvage.editor.sections.length, 1);
  assert.equal(salvage.editor.sections[0].headline, clean.headline);
  assert.equal(salvage.qualityReport.status, 'PASS');
});

test('salvage prunes must_fix that references only the dropped section', () => {
  const clean = section({ headline: 'CameraX clean article', url: 'https://example.com/clean' });
  const broken = section({ headline: 'Broken source article', url: 'invalid-source-url-without-scheme' });
  const { editor, reporter, factCheck } = buildInputs(
    [clean, broken],
    [scopedCandidate('https://example.com/clean', 'direct_aosp_camera'), scopedCandidate('invalid-source-url-without-scheme', 'direct_aosp_camera')],
    { status: 'NEEDS_FIX', must_fix: [{ location: 'sections[1].public_article.lead', problem: 'unsupported claim' }] }
  );

  const report = buildNewsletterQualityReport(DATE, editor, reporter, factCheck, {});
  assert.equal(report.status, 'NEEDS_FIX');

  const salvage = salvagePublishableSubset(DATE, editor, reporter, factCheck, report, {});
  assert.ok(salvage, 'dropping the section the must_fix points to should clear the blocker');
  assert.equal(salvage.factCheck.must_fix.length, 0);
  assert.equal(salvage.factCheck.status, 'PASS');
});

test('salvage prunes a source_gap that names a dropped section by a variant headline', () => {
  const clean = section({ headline: 'CameraX 1.7.0-alpha01 SessionConfig API', url: 'https://example.com/clean' });
  const broken = section({ headline: '[지난 소식] CameraX 1.6.0 정식 출시 (10주 전 릴리스)', url: 'invalid-source-url-without-scheme' });
  const { editor, reporter, factCheck } = buildInputs(
    [clean, broken],
    [scopedCandidate('https://example.com/clean', 'direct_aosp_camera'), scopedCandidate('invalid-source-url-without-scheme', 'direct_aosp_camera')],
    // The gap names the dropped section with a slightly different headline than editor.sections[1].
    { source_gaps: ['Reporter eligibility violation; section="CameraX 1.6.0 정식 출시"'], source_gap_count: 1 }
  );

  const report = buildNewsletterQualityReport(DATE, editor, reporter, factCheck, {});
  assert.equal(report.status, 'NEEDS_FIX');

  const salvage = salvagePublishableSubset(DATE, editor, reporter, factCheck, report, {});
  assert.ok(salvage, 'a gap on the dropped section must not block the clean subset');
  assert.equal(salvage.factCheck.source_gaps.length, 0);
  assert.equal(salvage.editor.sections[0].headline, clean.headline);
  assert.equal(salvage.qualityReport.status, 'PASS');
});

test('salvage returns null when no clean subset meets the minimum article count', () => {
  const brokenA = section({ headline: 'Broken A', url: 'invalid-url-a-no-scheme' });
  const brokenB = section({ headline: 'Broken B', url: 'invalid-url-b-no-scheme' });
  const { editor, reporter, factCheck } = buildInputs(
    [brokenA, brokenB],
    [scopedCandidate('invalid-url-a-no-scheme', 'direct_aosp_camera'), scopedCandidate('invalid-url-b-no-scheme', 'direct_aosp_camera')]
  );

  const report = buildNewsletterQualityReport(DATE, editor, reporter, factCheck, {});
  assert.equal(report.status, 'NEEDS_FIX');

  const salvage = salvagePublishableSubset(DATE, editor, reporter, factCheck, report, {});
  assert.equal(salvage, null);
});

// #628: editor repair가 약한 섹션 하나에서 실패(stable identity drift 등)해도, repair 이전의
// 유효 draft에서 그 섹션만 demote하고 강한 카메라 메인은 발행되어야 한다. 실제 사례 형태:
// CameraX 1.6.1(direct_aosp_camera) + atomisp 드라이버 패치(soc_platform_signal)는 통과,
// 주변부 productivity 글(android_platform_camera_adjacent)만 비발행. orchestrator의 repair
// catch가 이 salvagePublishableSubset을 호출하므로 그 메커니즘이 이 형태를 처리해야 한다.
test('#628: repair-failure 형태 — 강한 카메라 메인 2개는 발행, 약한 섹션만 demote', () => {
  const strongA = section({ headline: 'CameraX SessionConfig API', url: 'https://example.com/camerax' });
  const strongB = section({ headline: 'Camera driver memory-leak fix', url: 'https://example.com/driver' });
  const weak = section({ headline: 'Camera-adjacent productivity note', url: 'https://example.com/adjacent' });
  const { editor, reporter, factCheck } = buildInputs(
    [strongA, strongB, weak],
    [
      scopedCandidate('https://example.com/camerax', 'direct_aosp_camera'),
      scopedCandidate('https://example.com/driver', 'soc_platform_signal'),
      scopedCandidate('https://example.com/adjacent', 'android_platform_camera_adjacent')
    ],
    { article_quality: [publishable(0), publishable(1), { section_index: 2, publishable: false, reason: 'Camera-adjacent productivity note; no concrete HAL value.' }] }
  );

  const report = buildNewsletterQualityReport(DATE, editor, reporter, factCheck, {});
  assert.equal(report.status, 'NEEDS_FIX');

  const salvage = salvagePublishableSubset(DATE, editor, reporter, factCheck, report, {});
  assert.ok(salvage, '약한 섹션 하나가 실패해도 강한 카메라 메인 2개는 살아남아야 한다');
  assert.equal(salvage.kept_section_count, 2);
  assert.equal(salvage.dropped_section_count, 1);
  assert.equal(salvage.qualityReport.status, 'PASS');
  assert.deepEqual(salvage.editor.sections.map(item => item.headline), [strongA.headline, strongB.headline]);
});

test('salvage returns null when the full lineup already passes (nothing to drop)', () => {
  const cleanA = section({ headline: 'CameraX clean A', url: 'https://example.com/a' });
  const cleanB = section({ headline: 'CameraX clean B', url: 'https://example.com/b' });
  const { editor, reporter, factCheck } = buildInputs(
    [cleanA, cleanB],
    [scopedCandidate('https://example.com/a', 'direct_aosp_camera'), scopedCandidate('https://example.com/b', 'direct_aosp_camera')]
  );

  const report = buildNewsletterQualityReport(DATE, editor, reporter, factCheck, {});
  assert.equal(report.status, 'PASS');

  const salvage = salvagePublishableSubset(DATE, editor, reporter, factCheck, report, {});
  assert.equal(salvage, null);
});
