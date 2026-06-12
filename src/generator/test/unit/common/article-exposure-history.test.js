const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  annotateArticleExposure,
  dedupeByArticleIdentity,
  everCoveredAsNewsletterArticle,
  readExposureHistory,
  recordArticleExposure,
  recordNewsletterArticles,
  writeExposureHistory
} = require('../../../reporter/article-exposure-history');

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

test('recordArticleExposure sets cooldown_until for newsletter_article type', () => {
  let history = { schemaVersion: 1, coverage: { mode: 'forward_only', coverage_starts_at: '2026-06-03', backfill_included: false }, articles: [] };
  history = recordArticleExposure(history, {
    title: 'CameraX 1.6.1 fix',
    source_url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.1'
  }, {
    date: '2026-06-03',
    type: 'newsletter_article',
    cooldownDays: 21
  });
  assert.equal(history.articles[0].exposure_type, 'newsletter_article');
  assert.equal(history.articles[0].newsletter_date, '2026-06-03');
  assert.equal(history.articles[0].cooldown_until, '2026-06-24');
});

test('recordArticleExposure does not set cooldown_until for homepage_headline type', () => {
  let history = { schemaVersion: 1, coverage: { mode: 'forward_only', coverage_starts_at: '2026-06-03', backfill_included: false }, articles: [] };
  history = recordArticleExposure(history, {
    title: 'CameraX headline',
    source_url: 'https://example.com'
  }, {
    date: '2026-06-03',
    type: 'homepage_headline'
  });
  assert.ok(!history.articles[0].cooldown_until);
});

test('annotateArticleExposure marks published_within_cooldown when cooldown_until is in the future', () => {
  const history = {
    schemaVersion: 1,
    coverage: { mode: 'forward_only', coverage_starts_at: '2026-06-03', backfill_included: false },
    articles: [{
      article_identity_key: 'url:https://example.com/camerax-fix',
      exposure_type: 'newsletter_article',
      newsletter_date: '2026-06-03',
      cooldown_until: '2099-01-01'
    }]
  };
  const candidate = { source_url: 'https://example.com/camerax-fix' };
  const annotated = annotateArticleExposure(candidate, history);
  assert.strictEqual(annotated.published_within_cooldown, true);
  assert.strictEqual(annotated.last_newsletter_date, '2026-06-03');
  assert.strictEqual(annotated.already_exposed, true);
});

test('annotateArticleExposure does not set published_within_cooldown when cooldown_until has passed', () => {
  const history = {
    schemaVersion: 1,
    coverage: { mode: 'forward_only', coverage_starts_at: '2026-06-03', backfill_included: false },
    articles: [{
      article_identity_key: 'url:https://example.com/old-article',
      exposure_type: 'newsletter_article',
      newsletter_date: '2026-01-01',
      cooldown_until: '2026-01-22'
    }]
  };
  const candidate = { source_url: 'https://example.com/old-article' };
  const annotated = annotateArticleExposure(candidate, history);
  assert.strictEqual(annotated.published_within_cooldown, false);
  assert.strictEqual(annotated.last_newsletter_date, null);
});

test('recordNewsletterArticles records all sections with newsletter_article type', () => {
  let history = { schemaVersion: 1, coverage: { mode: 'forward_only', coverage_starts_at: '2026-06-03', backfill_included: false }, articles: [] };
  const sections = [
    { title: 'Article A', source_url: 'https://example.com/a' },
    { title: 'Article B', source_url: 'https://example.com/b' }
  ];
  history = recordNewsletterArticles(history, sections, { date: '2026-06-03', cooldownDays: 21 });
  assert.equal(history.articles.length, 2);
  assert.ok(history.articles.every(a => a.exposure_type === 'newsletter_article'));
  assert.ok(history.articles.every(a => a.cooldown_until === '2026-06-24'));
});

test('everCoveredAsNewsletterArticle is true for any newsletter_article record ignoring cooldown', () => {
  const history = {
    schemaVersion: 1,
    coverage: { mode: 'forward_only', coverage_starts_at: '2026-06-03', backfill_included: false },
    articles: [{
      article_identity_key: 'url:https://example.com/camerax-1.6.0',
      exposure_type: 'newsletter_article',
      newsletter_date: '2026-01-01',
      cooldown_until: '2026-01-22'
    }]
  };
  assert.strictEqual(everCoveredAsNewsletterArticle('url:https://example.com/camerax-1.6.0', history), true);
});

test('everCoveredAsNewsletterArticle is false when only homepage_headline exposure exists', () => {
  const history = {
    schemaVersion: 1,
    coverage: { mode: 'forward_only', coverage_starts_at: '2026-06-03', backfill_included: false },
    articles: [{
      article_identity_key: 'url:https://example.com/headline-only',
      exposure_type: 'homepage_headline',
      newsletter_date: '2026-05-27'
    }]
  };
  assert.strictEqual(everCoveredAsNewsletterArticle('url:https://example.com/headline-only', history), false);
});

test('everCoveredAsNewsletterArticle is false for an unknown key', () => {
  assert.strictEqual(everCoveredAsNewsletterArticle('url:https://example.com/never', { articles: [] }), false);
});
