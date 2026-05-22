const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  annotateArticleExposure,
  dedupeByArticleIdentity,
  readExposureHistory,
  recordArticleExposure,
  writeExposureHistory
} = require('../../../scripts/newsroom/common/article-exposure-history');

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'article-exposure-history-'));
}

test('missing exposure history starts as forward-only coverage', () => {
  const root = tempRoot();
  const history = readExposureHistory(root, '2026-05-23');

  assert.equal(history.coverage.mode, 'forward_only');
  assert.equal(history.coverage.coverage_starts_at, '2026-05-23');
  assert.equal(history.coverage.backfill_included, false);
  assert.deepEqual(history.articles, []);
});

test('exposure history lightly seeds from latest newsletters metadata only', () => {
  const root = tempRoot();
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data', 'newsletters.json'), JSON.stringify([
    { date: '2026-05-20', title: 'Old', html: 'newsletters/2026-05-20/index.html' },
    { date: '2026-05-23', title: 'Latest', html: 'newsletters/2026-05-23/index.html' }
  ]), 'utf8');

  const history = readExposureHistory(root, '2026-05-23');

  assert.equal(history.coverage.mode, 'forward_only');
  assert.equal(history.articles[0].newsletter_date, '2026-05-23');
  assert.equal(history.articles[0].exposure_type, 'newsletter_index_seed');
});

test('recording exposure accumulates count and date/type history without duplicating', () => {
  let history = readExposureHistory(tempRoot(), '2026-05-23');
  history = recordArticleExposure(history, {
    title: 'Camera HAL update',
    source_url: 'https://example.com/a'
  }, {
    date: '2026-05-23',
    type: 'homepage_headline',
    score: 88
  });
  history = recordArticleExposure(history, {
    title: 'Camera HAL update copy',
    source_url: 'https://example.com/a?utm_source=x'
  }, {
    date: '2026-05-24',
    type: 'latest_issue_main',
    score: 84
  });

  assert.equal(history.articles.length, 1);
  assert.equal(history.articles[0].newsletter_date, '2026-05-24');
  assert.equal(history.articles[0].headline_score, 84);
  assert.equal(history.articles[0].first_exposed_at, '2026-05-23');
  assert.equal(history.articles[0].last_exposed_at, '2026-05-24');
  assert.equal(history.articles[0].exposure_count, 2);
  assert.deepEqual(history.articles[0].exposure_types, ['homepage_headline', 'latest_issue_main']);
});

test('recording the same exposure event is idempotent', () => {
  let history = readExposureHistory(tempRoot(), '2026-05-23');
  const article = {
    title: 'Camera HAL update',
    source_url: 'https://example.com/a'
  };
  history = recordArticleExposure(history, article, {
    date: '2026-05-23',
    type: 'homepage_headline',
    score: 88
  });
  history = recordArticleExposure(history, article, {
    date: '2026-05-23',
    type: 'homepage_headline',
    score: 88
  });

  assert.equal(history.articles.length, 1);
  assert.equal(history.articles[0].exposure_count, 1);
  assert.equal(history.articles[0].first_exposed_at, '2026-05-23');
  assert.equal(history.articles[0].last_exposed_at, '2026-05-23');
  assert.deepEqual(history.articles[0].exposure_types, ['homepage_headline']);
});

test('exposure diagnostics annotate and dedupe by article identity', () => {
  const history = recordArticleExposure(readExposureHistory(tempRoot(), '2026-05-23'), {
    title: 'Camera HAL update',
    source_url: 'https://example.com/a'
  }, { date: '2026-05-23' });
  const annotated = annotateArticleExposure({
    title: 'Camera HAL update',
    source_url: 'https://example.com/a'
  }, history);
  const deduped = dedupeByArticleIdentity([
    { title: 'A', source_url: 'https://example.com/a' },
    { title: 'A copy', source_url: 'https://example.com/a?utm_medium=x' }
  ]);

  assert.equal(annotated.already_exposed, true);
  assert.equal(deduped.length, 1);
});

test('exposure history writes stable JSON', () => {
  const root = tempRoot();
  const history = recordArticleExposure(readExposureHistory(root, '2026-05-23'), {
    title: 'Camera HAL update',
    source_url: 'https://example.com/a'
  }, { date: '2026-05-23' });
  const filePath = writeExposureHistory(root, history);

  const written = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.equal(written.schemaVersion, 1);
  assert.equal(written.articles[0].exposure_count, 1);
  assert.equal(written.articles[0].first_exposed_at, '2026-05-23');
  assert.equal(written.articles[0].last_exposed_at, '2026-05-23');
  assert.deepEqual(written.articles[0].exposure_types, ['homepage_headline']);
});
