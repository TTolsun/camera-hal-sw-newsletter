const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const {
  buildSummaryCacheReport,
  cachePathForContentHash,
  cachePathForUrl,
  contentHash,
  contentFingerprint,
  annotateCandidatesWithCache,
  readCacheRecord,
  writeCacheRecord
} = require('../../../reporter/news-summary-cache');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'news-summary-cache-'));
}

function candidate(overrides = {}) {
  return {
    title: 'Hybrid inference for Android',
    url: 'https://example.com/android-ai',
    published_date: '2026-05-01',
    source: 'Android Developers Blog',
    summary: 'Hybrid inference API for Android AI features.',
    version_or_release: '',
    api_or_component: 'Firebase AI Logic',
    behavior_change: 'Hybrid inference uses on-device and cloud inference.',
    ...overrides
  };
}

test('cache hit requires matching URL hash and content fingerprint', () => {
  const dir = tempDir();
  const item = candidate();

  writeCacheRecord(item, dir, { model: 'unit-model' });
  const hit = readCacheRecord(item, dir);

  assert.equal(hit.hit, true);
  assert.equal(hit.reason, 'url-hit');
  assert.equal(hit.lookup.source, 'by-url');
  assert.equal(hit.record.model_metadata.model, 'unit-model');
  assert.equal(hit.record.content_fingerprint, contentFingerprint(item));
  assert.equal(hit.record.content_hash, contentHash(item));
  assert.equal(fs.existsSync(cachePathForUrl(item.url, dir)), true);
  assert.equal(fs.existsSync(cachePathForContentHash(contentHash(item), dir)), true);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('cache misses when behavior evidence changes', () => {
  const dir = tempDir();
  const item = candidate();

  writeCacheRecord(item, dir);
  const miss = readCacheRecord(candidate({ behavior_change: 'Different API behavior.' }), dir);

  assert.equal(miss.hit, false);
  assert.match(miss.reason, /content-hash-mismatch/);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('cache reuses same URL when only date or source metadata changes', () => {
  const dir = tempDir();
  const item = candidate();

  writeCacheRecord(item, dir);
  const hit = readCacheRecord(candidate({
    published_date: '2026-05-02',
    source: 'Android Developers Blog Mirror'
  }), dir);

  assert.equal(hit.hit, true);
  assert.equal(hit.reason, 'url-hit-content-match-metadata-changed');
  assert.equal(hit.record.summary, item.summary);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('cache reuses matching content hash across different URLs', () => {
  const dir = tempDir();
  const item = candidate();

  writeCacheRecord(item, dir);
  const hit = readCacheRecord(candidate({
    url: 'https://mirror.example.com/android-ai?utm_source=newsletter',
    source: 'Mirror Source',
    published_date: '2026-05-03'
  }), dir);

  assert.equal(hit.hit, true);
  assert.equal(hit.reason, 'content-hash-hit');
  assert.equal(hit.lookup.source, 'by-content');
  assert.equal(hit.record.normalized_url, 'https://example.com/android-ai');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('cache key ignores reporter-only evidence notes', () => {
  const dir = tempDir();
  const item = candidate({
    evidence_notes: [
      'Reporter-only note added after Gemini reporter stage.'
    ]
  });

  writeCacheRecord(item, dir);
  const hit = readCacheRecord(candidate(), dir);

  assert.equal(hit.hit, true);
  assert.equal(hit.reason, 'url-hit');
  assert.equal(hit.record.summary, item.summary);

  fs.rmSync(dir, { recursive: true, force: true });
});

test('annotated candidates expose cache diagnostics for debug artifacts', () => {
  const dir = tempDir();
  const item = candidate();

  writeCacheRecord(item, dir, { stage: 'reporter', model: 'unit-model' });
  const annotated = annotateCandidatesWithCache([
    item,
    candidate({ url: 'https://example.com/new-item', title: 'New Camera HAL item' })
  ], dir);
  const report = buildSummaryCacheReport('2026-05-04', annotated.cache_diagnostics);

  assert.equal(annotated[0].summary_cache.hit, true);
  assert.equal(annotated[0].summary_cache.lookup_source, 'by-url');
  assert.equal(annotated[0].summary_cache.summary, item.summary);
  assert.equal(annotated[1].summary_cache.hit, false);
  assert.equal(report.totals.candidate_count, 2);
  assert.equal(report.totals.hit_count, 1);
  assert.equal(report.totals.miss_count, 1);
  assert.ok(report.reasons.some(item => item.reason.includes('missing-cache-record')));

  fs.rmSync(dir, { recursive: true, force: true });
});
