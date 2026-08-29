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
  fs.mkdirSync(path.join(root, 'articles', 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'articles', 'data', 'newsletters.json'), JSON.stringify([
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
      newsletter_article_date: '2026-06-03',
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

// 입력 모양이 곧 계약이다. 실제 호출부(orchestrator-terminal-contracts)가 넘기는 것은 후보가
// 아니라 editor.sections이므로 fixture도 그 모양이어야 한다. 후보 모양({title, source_url})
// fixture는 identity 붕괴 버그를 그대로 통과시켰다.
function editorSection(headline, url) {
  return {
    headline,
    sources: [{ title: headline, url }],
    source_candidate_url: url,
    article_sections: { background: '기사 본문' }
  };
}

test('recordNewsletterArticles records editor sections in the candidate url identity space', () => {
  let history = { schemaVersion: 1, coverage: { mode: 'forward_only', coverage_starts_at: '2026-06-03', backfill_included: false }, articles: [] };
  const sections = [
    editorSection('CameraX 1.7.0-alpha03', 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha03'),
    editorSection('libcamera control serializer fix', 'https://patchwork.libcamera.org/patch/27507/')
  ];

  history = recordNewsletterArticles(history, sections, { date: '2026-06-03', cooldownDays: 21 });

  assert.equal(history.articles.length, 2);
  assert.ok(history.articles.every(a => a.exposure_type === 'newsletter_article'));
  assert.ok(history.articles.every(a => a.cooldown_until === '2026-06-24'));
  assert.deepEqual(history.articles.map(a => a.article_identity_key).sort(), [
    'url:https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha03',
    'url:https://patchwork.libcamera.org/patch/27507'
  ]);
  assert.ok(history.articles.every(a => a.title));
  assert.ok(history.articles.every(a => a.source_url));
});

test('recordNewsletterArticles falls back to the first section source when source_candidate_url is absent', () => {
  let history = { schemaVersion: 1, coverage: { mode: 'forward_only', coverage_starts_at: '2026-06-03', backfill_included: false }, articles: [] };
  const section = editorSection('libcamera EGLDisplay caching', 'https://patchwork.libcamera.org/patch/27496/');
  delete section.source_candidate_url;

  history = recordNewsletterArticles(history, [section], { date: '2026-06-03', cooldownDays: 21 });

  assert.equal(history.articles.length, 1);
  assert.equal(history.articles[0].article_identity_key, 'url:https://patchwork.libcamera.org/patch/27496');
});

test('recordNewsletterArticles takes identity from the matching selected candidate', () => {
  let history = { schemaVersion: 1, coverage: { mode: 'forward_only', coverage_starts_at: '2026-06-03', backfill_included: false }, articles: [] };
  const url = 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha03';
  const selectedArticles = [{
    article_identity_key: 'url:https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha03',
    title: 'CameraX 1.7.0-alpha03 release notes',
    canonical_url: url
  }];

  history = recordNewsletterArticles(history, [editorSection('CameraX 1.7.0-alpha03', url)], {
    date: '2026-06-03',
    cooldownDays: 21,
    selectedArticles
  });

  assert.equal(history.articles.length, 1);
  assert.equal(history.articles[0].article_identity_key, selectedArticles[0].article_identity_key);
  assert.equal(history.articles[0].title, 'CameraX 1.7.0-alpha03 release notes');
  assert.equal(history.articles[0].source_url, url);
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

test('annotateArticleExposure keeps published_within_cooldown after a later homepage_headline exposure', () => {
  // 회귀 잠금: exposure_type(단수)은 마지막 노출 유형이라 다음 주 헤드라인 유지가
  // newsletter_article을 homepage_headline으로 덮는다. 그때 쿨다운 검사가 조용히 죽으면 안 된다.
  let history = {
    schemaVersion: 1,
    coverage: { mode: 'forward_only', coverage_starts_at: '2026-08-17', backfill_included: false },
    articles: []
  };
  const article = { source_url: 'https://example.com/camerax-1.7.0-alpha03' };
  history = recordArticleExposure(history, article, {
    date: '2026-08-17',
    type: 'newsletter_article',
    cooldownDays: 21
  });
  history = recordArticleExposure(history, article, {
    date: '2026-08-24',
    type: 'homepage_headline'
  });

  assert.equal(history.articles.length, 1);
  assert.equal(history.articles[0].exposure_type, 'homepage_headline');
  assert.deepEqual(history.articles[0].exposure_types, ['newsletter_article', 'homepage_headline']);
  // newsletter_date는 마지막 노출 주로 덮이지만 발행 주는 newsletter_article_date에 남는다.
  assert.equal(history.articles[0].newsletter_date, '2026-08-24');
  assert.equal(history.articles[0].newsletter_article_date, '2026-08-17');

  const annotated = annotateArticleExposure(article, history, { date: '2026-08-31' });
  assert.strictEqual(annotated.published_within_cooldown, true);
  // 경고 문구가 인용하는 값이다. 최근 노출일(08-24)이 아니라 main 기사로 발행된 주여야 한다.
  assert.strictEqual(annotated.last_newsletter_date, '2026-08-17');
});

test('annotateArticleExposure does not block the issue that published the article on that same date', () => {
  // 워크플로 03의 재실행(ref: main 체크아웃)은 그 주 자신의 레코드가 이미 들어 있는 state를 본다.
  let history = {
    schemaVersion: 1,
    coverage: { mode: 'forward_only', coverage_starts_at: '2026-08-17', backfill_included: false },
    articles: []
  };
  const article = { source_url: 'https://example.com/camerax-1.7.0-alpha03' };
  history = recordArticleExposure(history, article, {
    date: '2026-08-17',
    type: 'newsletter_article',
    cooldownDays: 21
  });

  assert.strictEqual(annotateArticleExposure(article, history, { date: '2026-08-17' }).published_within_cooldown, false);
  assert.strictEqual(annotateArticleExposure(article, history, { date: '2026-08-24' }).published_within_cooldown, true);
  assert.strictEqual(annotateArticleExposure(article, history, { date: '2026-09-08' }).published_within_cooldown, false);
});

test('annotateArticleExposure compares the cooldown against the issue date, not the wall clock', () => {
  const history = {
    schemaVersion: 1,
    coverage: { mode: 'forward_only', coverage_starts_at: '2026-01-01', backfill_included: false },
    articles: [{
      article_identity_key: 'url:https://example.com/replayed',
      exposure_type: 'newsletter_article',
      newsletter_date: '2026-01-01',
      cooldown_until: '2026-01-22'
    }]
  };
  const candidate = { source_url: 'https://example.com/replayed' };

  assert.strictEqual(annotateArticleExposure(candidate, history, { date: '2026-01-10' }).published_within_cooldown, true);
  assert.strictEqual(annotateArticleExposure(candidate, history, { date: '2026-02-10' }).published_within_cooldown, false);
});
