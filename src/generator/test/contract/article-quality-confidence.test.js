'use strict';

// #654: the fact-checker's per-article publishable verdict is binary, so a borderline
// article can flip publishable across runs (LLM stochasticity at temp 0.20). This adds a
// `confidence` self-assessment to the verdict so a low-confidence block is visible to the
// human reviewer who merges the PR. The confidence is the LLM's own signal, surfaced for
// review — it does NOT become a deterministic gate, and publishable=false still blocks
// regardless of confidence (no publish-behavior change).

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildNewsletterQualityReport,
  buildQualityReportMarkdown
} = require('../../quality/newsletter-quality');
const { factCheckSchema } = require('../../render/newsletter-schema');
const { articleQualityVerdictPrompt } = require('../../reporter/newsletter-prompts');
const { scopedCandidate, section } = require('../../../shared/test/helpers/quality-builders');

const DATE = '2026-06-03';

function inputs(articleQuality) {
  const a = section({ headline: 'CameraX clean article', url: 'https://example.com/a' });
  const b = section({ headline: 'Borderline article', url: 'https://example.com/b' });
  const editor = { briefing: ['one', 'two', 'three'], sections: [a, b] };
  const reporter = {
    candidates: [
      scopedCandidate('https://example.com/a', 'direct_aosp_camera'),
      scopedCandidate('https://example.com/b', 'direct_aosp_camera')
    ]
  };
  const factCheck = {
    status: 'PASS',
    must_fix: [],
    source_gaps: [],
    source_gap_count: 0,
    recommended_fixes: [],
    article_quality: articleQuality
  };
  return { editor, reporter, factCheck };
}

test('articleQualityVerdict schema exposes confidence as an optional field', () => {
  const verdict = factCheckSchema.properties.article_quality.items;
  assert.ok(verdict.properties.confidence, 'confidence property is present on the verdict schema');
  assert.equal(verdict.properties.confidence.type, 'STRING');
  assert.ok(
    !verdict.required.includes('confidence'),
    'confidence stays optional so the model is not forced and old artifacts stay valid'
  );
});

test('articleQualityVerdict prompt asks for a high/medium/low confidence on borderline calls', () => {
  const prompt = articleQualityVerdictPrompt();
  assert.match(prompt, /confidence/i);
  assert.match(prompt, /high/);
  assert.match(prompt, /medium/);
  assert.match(prompt, /low/);
  // borderline / uncertain guidance is the whole point — low confidence must be requested when unsure.
  assert.match(prompt, /borderline|경계|불확실|애매/);
});

test('gate carries the verdict confidence onto each unpublishable article', () => {
  const { editor, reporter, factCheck } = inputs([
    { section_index: 0, publishable: true, reason: 'Useful to a Camera HAL SW engineer.', confidence: 'high' },
    { section_index: 1, publishable: false, reason: 'Borderline; thin concrete value.', confidence: 'low' }
  ]);
  const report = buildNewsletterQualityReport(DATE, editor, reporter, factCheck, {});
  const entry = report.unpublishable_articles.find(item => item.section_index === 1);
  assert.ok(entry, 'the publishable=false article is surfaced');
  assert.equal(entry.confidence, 'low');
});

test('a low-confidence unpublishable verdict still blocks the gate (confidence is not a gate)', () => {
  const { editor, reporter, factCheck } = inputs([
    { section_index: 0, publishable: true, reason: 'Useful.', confidence: 'high' },
    { section_index: 1, publishable: false, reason: 'Borderline.', confidence: 'low' }
  ]);
  const report = buildNewsletterQualityReport(DATE, editor, reporter, factCheck, {});
  assert.equal(report.status, 'NEEDS_FIX');
});

test('a missing confidence defaults to unspecified rather than being fabricated', () => {
  const { editor, reporter, factCheck } = inputs([
    { section_index: 0, publishable: true, reason: 'Useful.' },
    { section_index: 1, publishable: false, reason: 'Not useful.' }
  ]);
  const report = buildNewsletterQualityReport(DATE, editor, reporter, factCheck, {});
  const entry = report.unpublishable_articles.find(item => item.section_index === 1);
  assert.equal(entry.confidence, 'unspecified');
});

test('quality markdown surfaces the unpublishable article with its confidence for the reviewer', () => {
  const { editor, reporter, factCheck } = inputs([
    { section_index: 0, publishable: true, reason: 'Useful.', confidence: 'high' },
    { section_index: 1, publishable: false, reason: 'Borderline; thin concrete value.', confidence: 'low' }
  ]);
  const report = buildNewsletterQualityReport(DATE, editor, reporter, factCheck, {});
  const markdown = buildQualityReportMarkdown(report);
  assert.match(markdown, /Unpublishable Articles/);
  assert.match(markdown, /Borderline; thin concrete value\./);
  assert.match(markdown, /low/);
});
