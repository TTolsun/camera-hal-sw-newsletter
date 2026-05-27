const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  CollectionIntentError,
  approveCollectionIntentFromUrls,
  buildCollectionIntentFromUrls,
  parseManualSourceUrls
} = require('../../../scripts/newsroom/collect/collection-intent');
const {
  collectionIntentPath,
  collectionIntentRelPath
} = require('../../../scripts/newsroom/common/artifact-paths');

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'collection-intent-'));
}

test('parseManualSourceUrls splits, trims, ignores empty segments, and dedupes first-seen', () => {
  const urls = parseManualSourceUrls(
    ' https://a.example/x ;; https://b.example/y ; https://a.example/x '
  );
  assert.deepEqual(urls, ['https://a.example/x', 'https://b.example/y']);
});

test('parseManualSourceUrls returns empty array for empty or whitespace input', () => {
  assert.deepEqual(parseManualSourceUrls(''), []);
  assert.deepEqual(parseManualSourceUrls('   ;  ; '), []);
  assert.deepEqual(parseManualSourceUrls(undefined), []);
});

test('parseManualSourceUrls rejects non-http(s) protocols', () => {
  assert.throws(
    () => parseManualSourceUrls('ftp://a.example/x'),
    /must use http or https/
  );
  assert.throws(
    () => parseManualSourceUrls('file:///etc/passwd'),
    CollectionIntentError
  );
});

test('parseManualSourceUrls rejects invalid URLs and newline input', () => {
  assert.throws(() => parseManualSourceUrls('not a url'), /Invalid manual source URL/);
  assert.throws(
    () => parseManualSourceUrls('https://a.example/x\nhttps://b.example/y'),
    /single-line/
  );
  assert.throws(() => parseManualSourceUrls('https://a.example/x\r'), /single-line/);
});

test('buildCollectionIntentFromUrls produces stable seed ids and validated payload', () => {
  const date = '2026-05-16';
  const payload = buildCollectionIntentFromUrls({
    urls: ['https://a.example/x', 'https://b.example/y'],
    date,
    generatedAt: '2026-05-16T00:00:00.000Z'
  });

  assert.equal(payload.schema_version, 1);
  assert.equal(payload.newsletter_date, date);
  assert.deepEqual(payload.keyword_hints, []);
  assert.equal(payload.seed_urls.length, 2);
  assert.equal(payload.seed_urls[0].url, 'https://a.example/x');
  assert.match(payload.seed_urls[0].seed_id, /^seed-01-[0-9a-f]{10}$/);
  assert.match(payload.seed_urls[1].seed_id, /^seed-02-[0-9a-f]{10}$/);
  assert.equal(payload.seed_urls[0].priority, 'medium');

  // seed_id is derived from the URL, so the same URL yields the same id.
  const again = buildCollectionIntentFromUrls({
    urls: ['https://a.example/x'],
    date,
    generatedAt: '2026-05-16T00:00:00.000Z'
  });
  assert.equal(again.seed_urls[0].seed_id, payload.seed_urls[0].seed_id);
});

test('approveCollectionIntentFromUrls writes the canonical intent and returns approved metadata', () => {
  const root = tempRoot();
  const date = '2026-05-16';

  const result = approveCollectionIntentFromUrls({
    root,
    date,
    urls: ['https://a.example/x', 'https://b.example/y'],
    generatedAt: '2026-05-16T00:00:00.000Z'
  });

  assert.equal(result.status, 'approved');
  assert.equal(result.relPath, collectionIntentRelPath(date));
  assert.equal(result.seedUrlCount, 2);
  assert.equal(result.keywordHintCount, 0);
  assert.match(result.hash, /^[0-9a-f]{64}$/);

  const written = JSON.parse(fs.readFileSync(collectionIntentPath(root, date), 'utf8'));
  assert.equal(written.newsletter_date, date);
  assert.equal(written.seed_urls.length, 2);
  assert.deepEqual(written.seed_urls.map(seed => seed.url), [
    'https://a.example/x',
    'https://b.example/y'
  ]);
});
