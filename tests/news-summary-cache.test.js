const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const {
  contentFingerprint,
  readCacheRecord,
  writeCacheRecord
} = require('../scripts/lib/news-summary-cache');

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
  assert.equal(hit.record.model_metadata.model, 'unit-model');
  assert.equal(hit.record.content_fingerprint, contentFingerprint(item));

  fs.rmSync(dir, { recursive: true, force: true });
});

test('cache misses when behavior evidence changes', () => {
  const dir = tempDir();
  const item = candidate();

  writeCacheRecord(item, dir);
  const miss = readCacheRecord(candidate({ behavior_change: 'Different API behavior.' }), dir);

  assert.equal(miss.hit, false);
  assert.equal(miss.reason, 'content-fingerprint-mismatch');

  fs.rmSync(dir, { recursive: true, force: true });
});
