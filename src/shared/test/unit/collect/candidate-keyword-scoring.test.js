'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { normalizeCandidate } = require('../../../cli/collect-news-candidates');

const SOURCE = {
  id: 'keyword-regression',
  name: 'Neutral feed',
  url: 'https://example.com/feed',
  sourceUrl: 'https://example.com/feed',
  category: 'misc',
  section: 'Other',
  priority: 'low',
  reliability: 'official',
  keywords: []
};

function candidate(title, source = SOURCE, overrides = {}) {
  return normalizeCandidate({
    source,
    sourceKind: 'rss_item',
    title,
    summary: '',
    url: 'https://example.com/item',
    ...overrides
  });
}

const baseScore = candidate('Neutral announcement').relevanceScore;

test('#1258 ordinary word substrings do not add camera or tooling scores', () => {
  for (const title of [
    'challenging', 'shall', 'release', 'increase', 'CRISPR', 'maintain',
    'retail', 'pharma', 'products', 'latest', 'its', 'Its business', 'input', 'BITS', 'AITS', 'SITS'
  ]) {
    assert.equal(candidate(title).relevanceScore, baseScore, title);
  }
});

test('#1258 technical acronyms match whole tokens and ITS retains its case or Camera context', () => {
  for (const title of ['HAL', 'CTS', 'ISP', 'EAS', 'ARM', 'ITS', 'camera its']) {
    const expected = title === 'camera its' ? 24 : 12;
    assert.equal(candidate(title).relevanceScore - baseScore, expected, title);
  }
  assert.equal(candidate('ai').relevanceScore - baseScore, 6);
  assert.equal(candidate('camera checks its buffers').relevanceScore,
    candidate('camera checks buffers').relevanceScore);
});

test('#1258 known camera driver compounds and plural engineering words retain their signals', () => {
  for (const title of ['softisp', 'rkisp1', 'rkisp2', 'atomisp', 'HdrNet', 'hdrnet', 'HDR10', 'HDR10+']) {
    assert.equal(candidate(title).relevanceScore - baseScore, 12, title);
  }
  for (const [plural, singular] of [
    ['cameras', 'camera'], ['agents', 'agent'], ['models', 'model'],
    ['developers', 'developer'], ['tools', 'tool'], ['buffers', 'buffer'],
    ['AI agents', 'AI agent'], ['coding agents', 'coding agent'], ['subagent', 'agent'], ['subagents', 'agent'],
    ['AndroidX', 'android'], ['arm64', 'arm'], ['ARMv8', 'arm'], ['_LIBCPP_', 'cpp'],
    ['streaming', 'stream'], ['camera_sensor', 'image sensor'], ['camera sensor', 'image sensor'], ['CPUs', 'cpu'], ['GPUs', 'gpu'], ['NPUs', 'npu']
  ]) {
    assert.equal(candidate(plural).relevanceScore, candidate(singular).relevanceScore, plural);
  }
  for (const title of ['CameraX', 'Camera2', 'libcamera', 'RAW10', 'RAW12', 'RAW14']) {
    assert.equal(candidate(title).relevanceScore - baseScore, 24, title);
  }
});

test('#1258 code separators, CamelCase APIs, C++ and multiword keywords remain searchable', () => {
  for (const [identifier, words] of [
    ['ICameraProvider', 'Camera Provider'],
    ['CameraCaptureSession', 'Camera Capture Session'],
    ['CameraHALProvider', 'Camera HAL Provider'],
    ['MediaCodec', 'mediacodec'],
    ['SurfaceView', 'surfaceview'],
    ['OpenAI', 'AI'],
    ['ia_css_stream_create', 'stream']
  ]) {
    assert.equal(candidate(identifier).relevanceScore, candidate(words).relevanceScore, identifier);
  }
  assert.equal(candidate('C++').relevanceScore - baseScore, 6);
  assert.equal(candidate('C++26').relevanceScore - baseScore, 6);
  assert.equal(candidate('libc++').relevanceScore - baseScore, 6);
  assert.equal(candidate('ultra hdr').relevanceScore - baseScore, 24);
  assert.equal(candidate('A/V sync').relevanceScore - baseScore, 12);
  assert.equal(candidate('photo picker').relevanceScore - baseScore, 12);
});

test('#1258 source prior uses metadata-only matching with the existing three-point cap', () => {
  const withKeywords = { ...SOURCE, keywords: ['hal', 'its', 'test'] };
  assert.equal(candidate('Neutral announcement', { ...withKeywords, name: 'challenging its latest' }).relevanceScore,
    baseScore);
  assert.equal(candidate('HAL ITS test', withKeywords).relevanceScore,
    candidate('HAL ITS test').relevanceScore, 'article text is not source metadata');
  assert.equal(candidate('Neutral announcement', {
    ...SOURCE, name: 'Camera HAL ITS developer tools', keywords: ['Camera', 'HAL', 'ITS', 'developer', 'tools']
  }).relevanceScore, baseScore + 3);
  assert.equal(candidate('Neutral announcement', {
    ...SOURCE, name: 'C++26 reference', keywords: ['C++26']
  }).relevanceScore, baseScore + 1);
  assert.equal(candidate('Neutral announcement', {
    ...SOURCE, name: 'constructor toString __proto__', keywords: ['constructor', 'toString', '__proto__']
  }).relevanceScore, baseScore + 3);
});

test('#1258 matching cannot supply missing publication date or source evidence', () => {
  const result = candidate('Camera HAL ISP CTS tests');
  assert.ok(result.relevanceScore >= 50);
  assert.equal(result.hasDatedEvidence, false);
  assert.equal(result.source_gap_risk, true);
  assert.equal(result.main_eligible, false);
});

test('#1258 Media3 loses the false release EAS points without weakening short eligibility', () => {
  const result = candidate('Media3 1.9.0 release', {
    ...SOURCE,
    name: 'Media3 test release',
    category: 'android-media',
    section: 'Android Media / Camera Output',
    priority: 'high',
    keywords: ['Media3', 'test', 'release']
  }, {
    sourceKind: 'release_note_item',
    publishedAt: '2026-10-15',
    summary: 'Fix tests.',
    version_or_release: 'Media3 1.9.0',
    api_or_component: 'Media3',
    behavior_change: 'Fix tests.'
  });
  assert.equal(result.relevanceScore, 47);
  assert.equal(result.evidence_score, 8);
  assert.equal(result.hasDatedEvidence, true);
  assert.notEqual(result.finalSelectionEligibility, 'short');
  assert.equal(result.main_eligible, false);
});

test('#1258 repeated terms count once and source priority and reliability weights remain fixed', () => {
  assert.equal(candidate('Camera camera CAMERA').relevanceScore, candidate('camera').relevanceScore);
  assert.equal(candidate('Neutral announcement', { ...SOURCE, priority: 'high' }).relevanceScore,
    baseScore + 8);
  assert.equal(candidate('Neutral announcement', { ...SOURCE, reliability: 'project-official' }).relevanceScore,
    baseScore - 3);
});

function workflowCandidate(overrides = {}) {
  const behavior = 'It pairs well with another model as a subagent on coding work.';
  return candidate('A small model', {
    ...SOURCE, id: 'official-tooling', name: 'Official tooling', category: 'ai',
    priority: 'medium', keywords: ['developer', 'tool']
  }, {
    sourceKind: 'blog_post_item',
    publishedAt: '2026-10-15',
    summary: 'A model for coding.',
    api_or_component: 'A coding model',
    behavior_change: behavior,
    source_extraction: { workflow: { sections: [{ items: [{ text: behavior }] }] } },
    ...overrides
  });
}

test('#1258 bound official coding workflow remains qualified at the existing evidence and 30-point floor', () => {
  const raw = {
    summary: 'A model for developers using tools.',
    api_or_component: 'A coding model'
  };
  const qualified = workflowCandidate(raw);
  assert.ok(qualified.relevanceScore >= 30 && qualified.relevanceScore < 50);
  assert.equal(qualified.main_eligible, true);
  assert.equal(qualified.main_article_source_allowed, true);
  assert.equal(qualified.finalSelectionEligibility, 'short');
  for (const overrides of [
    { ...raw, source_extraction: undefined },
    { ...raw, source_extraction: { workflow: { sections: [{ items: [{ text: 'Unrelated sentence.' }] }] } } },
    { ...raw, publishedAt: '' },
    { ...raw, behavior_change: 'A new model.', source_extraction: undefined }
  ]) {
    assert.equal(workflowCandidate(overrides).main_eligible, false);
  }
  assert.equal(workflowCandidate({ source: { ...SOURCE, category: 'ai' } }).main_eligible, false,
    'evidence does not waive the 30-point floor');
});

test('#1258 bound workflow qualification still respects official source and publication policy', () => {
  const measured = { summary: 'A model for developers using tools.', api_or_component: 'A coding model' };
  const blocked = workflowCandidate({
    ...measured,
    source: { ...SOURCE, category: 'ai', priority: 'medium', mainArticlePolicy: 'blocked' }
  });
  assert.equal(blocked.main_article_source_allowed, false);
  assert.equal(blocked.decision.selection, 'watch');
  const nonOfficial = workflowCandidate({
    ...measured,
    source: { ...SOURCE, category: 'ai', priority: 'medium', reliability: 'project-official' }
  });
  assert.equal(nonOfficial.main_eligible, false);
});

test('#1258 only concrete official dated camera-output releases retain low-score qualification', () => {
  const source = {
    ...SOURCE, name: 'Media3 Release Notes', category: 'android-media', priority: 'medium',
    keywords: ['Media3'], sourceRole: 'official_release_source', mainArticlePolicy: 'allowed'
  };
  const raw = {
    sourceKind: 'release_note_item', publishedAt: '2026-10-15',
    summary: 'Fixed Media3 audio/video sync regression when playing back camera-recorded videos in video call validation flows.',
    version_or_release: 'Media3 1.9.0', api_or_component: 'Media3'
  };
  const release = overrides => candidate('Media3 1.9.0 release', source, { ...raw, ...overrides });
  const result = release();
  assert.equal(result.relevanceScore, 47);
  assert.equal(result.main_eligible, true);
  assert.equal(result.main_article_source_allowed, true);
  assert.equal(result.finalSelectionEligibility, 'short');
  for (const overrides of [
    { publishedAt: '' },
    { summary: 'Fix tests.' },
    { sourceKind: 'documentation_page' },
    { summary: 'Media3 1.9.0 is available.', behavior_change: '' }
  ]) {
    assert.equal(release(overrides).main_eligible, false);
  }
  const blocked = release({ source: { ...source, mainArticlePolicy: 'blocked' } });
  assert.equal(blocked.main_article_source_allowed, false);
  assert.equal(blocked.decision.selection, 'watch');
});

test('#1258 preserved evidence cannot override candidate-only, reference, or non-official sources', () => {
  const measured = { summary: 'A model for developers using tools.', api_or_component: 'A coding model' };
  for (const flags of [
    { candidateOnly: true },
    { sourceRole: 'official_documentation_reference' }
  ]) {
    const result = workflowCandidate({
      ...measured, source: { ...SOURCE, category: 'ai', priority: 'medium', ...flags }
    });
    assert.equal(result.main_eligible, false);
    assert.equal(result.main_article_source_allowed, false);
  }
  assert.equal(candidate('camera_sensorless').relevanceScore, candidate('camera').relevanceScore);
});
