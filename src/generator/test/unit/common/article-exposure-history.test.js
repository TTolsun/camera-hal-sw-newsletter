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
const {
  articleIdentityKey,
  normalizeArticleUrl
} = require('../../../../shared/common/article-identity');
const { normalizeUrl } = require('../../../../shared/common/selection-normalizers');

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

// production 후보 모양. decorateCandidate가 url·normalized_url·article_identity_key를 모두 붙이고
// canonical_url은 붙이지 않는다. normalized_url은 selection normalizer 산물이라 URL 전체가
// 소문자이고 쿼리가 없다 — article-identity의 정규화(호스트만 소문자, 추적 파라미터만 제거)와
// 다르므로, 이 두 값을 섞어 비교하면 매칭이 조용히 빗나간다.
function selectedCandidate(title, url) {
  return {
    url,
    normalized_url: normalizeUrl(url),
    article_identity_key: articleIdentityKey({ url }),
    title
  };
}

test('recordNewsletterArticles takes identity and title from the matching selected candidate', () => {
  let history = { schemaVersion: 1, coverage: { mode: 'forward_only', coverage_starts_at: '2026-06-03', backfill_included: false }, articles: [] };
  // 로케일 쿼리가 붙은 실제 developer.android.com URL. selection normalizer가 쿼리를 지우므로
  // normalized_url과 raw URL의 identity 정규화 결과가 서로 다르다.
  const url = 'https://developer.android.com/jetpack/androidx/releases/camera?hl=ko#1.7.0-alpha03';
  const selectedArticles = [selectedCandidate('CameraX 1.7.0-alpha03 release notes', url)];
  assert.notEqual(selectedArticles[0].normalized_url, normalizeArticleUrl(url), '두 정규화가 갈리는 입력이어야 한다');

  history = recordNewsletterArticles(history, [editorSection('CameraX 1.7.0-alpha03', url)], {
    date: '2026-06-03',
    cooldownDays: 21,
    selectedArticles
  });

  assert.equal(history.articles.length, 1);
  assert.equal(history.articles[0].article_identity_key, selectedArticles[0].article_identity_key);
  assert.equal(history.articles[0].title, 'CameraX 1.7.0-alpha03 release notes');
  // 기록의 source_url은 sourceUrl(article)이 고르므로 후보의 normalized_url이 된다(참고용 필드,
  // 대조에 쓰이는 것은 article_identity_key다). 후보에서 왔다는 것이 여기서 잠그는 내용이다.
  assert.equal(history.articles[0].source_url, selectedArticles[0].normalized_url);
});

test('a url-less section is matched by identity key, so it does not adopt an unrelated candidate', () => {
  // 이 테스트가 실제로 잠그는 것은 후보 대조 축이다. articleIdentityKey가 아니라 URL을 직접
  // 비교하는 구현으로 되돌리면 URL 없는 section과 URL 없는 후보가 빈 문자열끼리 맞아떨어져,
  // 발행되지 않은 URL에 쿨다운이 찍힌다.
  //
  // newsletterArticleExposure의 `if (!key) return fallback` 가드는 같은 사고를 한 단계 앞에서도
  // 막는 두 번째 줄이다. 이 테스트만으로는 그 가드가 잠기지 않는다(가드를 지워도 여기서는
  // 대조 축이 먼저 막는다). 그렇다고 가드를 지울 근거는 아니다 — 대조 축이 바뀌는 순간 그것이
  // 마지막 방어선이다.
  let history = { schemaVersion: 1, coverage: { mode: 'forward_only', coverage_starts_at: '2026-06-03', backfill_included: false }, articles: [] };
  const section = editorSection('출처가 비어 있는 섹션', '');
  delete section.source_candidate_url;
  const strandedCandidate = {
    article_identity_key: 'url:https://example.com/published-elsewhere',
    title: '다른 기사'
  };

  history = recordNewsletterArticles(history, [section], {
    date: '2026-06-03',
    cooldownDays: 21,
    selectedArticles: [strandedCandidate]
  });

  assert.equal(history.articles.length, 1);
  assert.notEqual(history.articles[0].article_identity_key, strandedCandidate.article_identity_key);
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
  assert.strictEqual(everCoveredAsNewsletterArticle({ article_identity_key: 'url:https://example.com/camerax-1.6.0' }, history), true);
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
  assert.strictEqual(everCoveredAsNewsletterArticle({ article_identity_key: 'url:https://example.com/headline-only' }, history), false);
});

test('everCoveredAsNewsletterArticle is false for an unknown key', () => {
  assert.strictEqual(everCoveredAsNewsletterArticle({ article_identity_key: 'url:https://example.com/never' }, { articles: [] }), false);
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

// ── 패치 시리즈 인지형 재게재 게이트(#1036) ────────────────────────────────────
// 수집 단계는 한 패치 시리즈를 대표 1건으로 줄이는데, 그 대표 URL이 주마다 바뀐다
// (#799 (source, seriesId) collapse · #822 커버레터 우선). 그래서 지난주 발행한 시리즈가
// 이번 주에 다른 조각 URL로 들어오면 URL identity만 보는 게이트는 그냥 통과한다.
// 아래 URL 2건은 실제 데이터다 — 2026-08-31호가 v3 08/12 조각을 발행했고, 같은 주 수집물에
// 그 시리즈의 커버레터도 후보로 들어와 있었다(articles/content/collected-news/2026-08-31).
const YOGA_BOOK_V3_PUBLISHED_PIECE_URL =
  'https://lore.kernel.org/linux-media/34736c93669fcb3e34023137b7785d469a843254.1787872237.git.mauriziocasciano7@gmail.com';
const YOGA_BOOK_V3_COVER_LETTER_URL =
  'https://lore.kernel.org/linux-media/cover.1787872237.git.mauriziocasciano7@gmail.com/';

function historyWithPublishedSeriesPiece() {
  const empty = {
    schemaVersion: 1,
    coverage: { mode: 'forward_only', coverage_starts_at: '2026-08-31', backfill_included: false },
    articles: []
  };
  return recordArticleExposure(empty, {
    title: '[PATCH v3 08/12] media: atomisp: support the Yoga Book OV2740 link',
    url: YOGA_BOOK_V3_PUBLISHED_PIECE_URL
  }, { date: '2026-08-31', type: 'newsletter_article' });
}

test('recordArticleExposure stores the patch series key alongside the URL identity', () => {
  const history = historyWithPublishedSeriesPiece();

  assert.strictEqual(
    history.articles[0].series_identity_key,
    'lore-series:git-1787872237-mauriziocasciano7@gmail.com'
  );
});

test('쿨다운 레인: 같은 시리즈의 다른 조각 URL이 다음 주에 오면 쿨다운이 걸린다', () => {
  const history = historyWithPublishedSeriesPiece();
  const nextWeekRepresentative = {
    title: '[PATCH v3 00/12] media: Add Lenovo Yoga Book YB1-X91 camera support',
    url: YOGA_BOOK_V3_COVER_LETTER_URL
  };

  const annotated = annotateArticleExposure(nextWeekRepresentative, history, { date: '2026-09-07' });

  assert.strictEqual(annotated.published_within_cooldown, true);
  assert.strictEqual(annotated.last_newsletter_date, '2026-08-31');
});

test('catch-up 레인: 같은 시리즈의 다른 조각 URL은 이미 게재된 것으로 본다', () => {
  const history = historyWithPublishedSeriesPiece();
  const nextWeekRepresentative = {
    title: '[PATCH v3 00/12] media: Add Lenovo Yoga Book YB1-X91 camera support',
    url: YOGA_BOOK_V3_COVER_LETTER_URL
  };

  assert.strictEqual(
    everCoveredAsNewsletterArticle(nextWeekRepresentative, history, { date: '2026-09-07' }),
    true
  );
});

test('series_identity_key가 없는 기존 레코드도 source_url에서 유도해 시리즈로 막는다', () => {
  // state/article-exposure-history.json에 실제로 남아 있는 모양이다(31건 전부 이 필드가 없다).
  // state 파일을 마이그레이션하지 않으므로 읽기 시점 폴백이 없으면 기존 이력은 전부 URL 비교로
  // 되돌아간다 — 이 테스트가 폴백의 존재 이유다.
  const legacyHistory = {
    schemaVersion: 1,
    coverage: { mode: 'forward_only', coverage_starts_at: '2026-08-31', backfill_included: false },
    articles: [{
      article_identity_key: `url:${YOGA_BOOK_V3_PUBLISHED_PIECE_URL}`,
      title: '[PATCH v3 08/12] media: atomisp: support the Yoga Book OV2740 link',
      source_url: YOGA_BOOK_V3_PUBLISHED_PIECE_URL,
      newsletter_date: '2026-08-31',
      exposure_type: 'newsletter_article',
      exposed_at: '2026-08-31',
      newsletter_article_date: '2026-08-31',
      cooldown_until: '2026-09-21',
      exposure_types: ['newsletter_article']
    }]
  };
  assert.ok(
    !Object.prototype.hasOwnProperty.call(legacyHistory.articles[0], 'series_identity_key'),
    'legacy fixture must not carry the new field'
  );
  const nextWeekRepresentative = { url: YOGA_BOOK_V3_COVER_LETTER_URL };

  assert.strictEqual(
    annotateArticleExposure(nextWeekRepresentative, legacyHistory, { date: '2026-09-07' }).published_within_cooldown,
    true
  );
  assert.strictEqual(
    everCoveredAsNewsletterArticle(nextWeekRepresentative, legacyHistory, { date: '2026-09-07' }),
    true
  );
});

test('시리즈가 아닌 후보끼리는 서로 차단하지 않는다(빈 시리즈 키 매치 금지)', () => {
  // 이 PR의 최대 위험: 시리즈 키가 없는 후보는 빈 문자열이라, 빈 키끼리 맞아떨어지면 발행된
  // 기사 1건이 그 주 비시리즈 후보 전부를 막아 편성이 통째로 비게 된다.
  const empty = {
    schemaVersion: 1,
    coverage: { mode: 'forward_only', coverage_starts_at: '2026-08-31', backfill_included: false },
    articles: []
  };
  const history = recordArticleExposure(empty, {
    title: 'CameraX 1.6.0 release notes',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0'
  }, { date: '2026-08-31', type: 'newsletter_article' });

  // 시리즈가 아니면 필드 자체를 남기지 않는다 — 빈 값을 쓰면 state 파일에 의미 없는 필드만 는다.
  assert.ok(!Object.prototype.hasOwnProperty.call(history.articles[0], 'series_identity_key'));

  const unrelated = {
    title: 'libcamera v0.7.2 released',
    url: 'https://github.com/raspberrypi/libcamera/releases/tag/v0.7.2'
  };

  assert.strictEqual(
    annotateArticleExposure(unrelated, history, { date: '2026-09-07' }).published_within_cooldown,
    false
  );
  assert.strictEqual(annotateArticleExposure(unrelated, history, { date: '2026-09-07' }).already_exposed, false);
  assert.strictEqual(everCoveredAsNewsletterArticle(unrelated, history, { date: '2026-09-07' }), false);
});

// ── 재제출 축(#1036의 대표 증거) ──────────────────────────────────────────────
// 시리즈 키는 한 번의 git-send-email 호출을 가른다. v4 재제출은 새 epoch를 받아 시리즈 키가
// 달라지므로 시리즈 축만으로는 안 잡힌다. 수집 단계의 재제출 병합(#824)이 보는 축 — 브래킷
// 접두부를 뗀 제목 — 을 게이트도 함께 봐야 닫힌다.
//
// 아래 레코드는 실제 state/article-exposure-history.json에 남아 있는 2026-08-31호 발행분이고,
// 후보 URL·제목은 같은 주 수집물(articles/content/collected-news/2026-08-31)의 실제 값이다.
const YOGA_BOOK_V2_PUBLISHED_URL =
  'https://lore.kernel.org/linux-media/20260827181756.2430054-1-mauriziocasciano7@gmail.com';
const YOGA_BOOK_V4_COVER_LETTER_URL =
  'https://lore.kernel.org/linux-media/cover.1787933456.git.mauriziocasciano7@gmail.com/';
const YOGA_BOOK_SUBJECT = 'media: Add Lenovo Yoga Book YB1-X91 camera support';

function historyWithPublishedV2CoverLetter() {
  return {
    schemaVersion: 1,
    coverage: { mode: 'forward_only', coverage_starts_at: '2026-08-31', backfill_included: false },
    articles: [{
      article_identity_key: `url:${YOGA_BOOK_V2_PUBLISHED_URL}`,
      title: `[PATCH v2 00/11] ${YOGA_BOOK_SUBJECT}`,
      source_url: YOGA_BOOK_V2_PUBLISHED_URL,
      newsletter_date: '2026-08-31',
      exposure_type: 'newsletter_article',
      exposed_at: '2026-08-31',
      newsletter_article_date: '2026-08-31',
      cooldown_until: '2026-09-21',
      exposure_types: ['newsletter_article']
    }]
  };
}

test('재제출 축: v2를 발행한 뒤 v4 대표가 오면 차단된다 (#1036 대표 증거)', () => {
  const history = historyWithPublishedV2CoverLetter();
  const v4CoverLetter = {
    title: `[PATCH v4 00/15] ${YOGA_BOOK_SUBJECT}`,
    url: YOGA_BOOK_V4_COVER_LETTER_URL
  };

  assert.strictEqual(
    annotateArticleExposure(v4CoverLetter, history, { date: '2026-09-07' }).published_within_cooldown,
    true
  );
  assert.strictEqual(
    everCoveredAsNewsletterArticle(v4CoverLetter, history, { date: '2026-09-07' }),
    true
  );
});

test('재제출 축은 소스 스코프를 넘지 않는다', () => {
  // collapseSeriesRerolls가 `${source_id}::${subject}`로 한 소스 안에서만 병합한다. 게이트가
  // 스코프를 빼면 서로 다른 소스의 같은 제목이 맞아떨어져 오차단이 난다.
  const history = historyWithPublishedV2CoverLetter();
  const sameSubjectOtherSource = {
    title: `[v2,1/6] ${YOGA_BOOK_SUBJECT}`,
    url: 'https://patchwork.libcamera.org/patch/99999/',
    seriesId: '9999'
  };

  assert.strictEqual(
    annotateArticleExposure(sameSubjectOtherSource, history, { date: '2026-09-07' }).published_within_cooldown,
    false
  );
});

test('재제출 축은 제목이 다르면 묶지 않는다', () => {
  // 제목을 고쳐 재제출한 시리즈는 수집 단계도 의도적으로 병합하지 않는다(퍼지 매칭 금지).
  // 게이트도 같은 제약을 따라야 오차단 표면이 collapse보다 넓어지지 않는다.
  const history = historyWithPublishedV2CoverLetter();
  const differentSubject = {
    title: '[PATCH v4 00/15] media: Add Lenovo Yoga Book YB1-X91 audio support',
    url: YOGA_BOOK_V4_COVER_LETTER_URL
  };

  assert.strictEqual(
    annotateArticleExposure(differentSubject, history, { date: '2026-09-07' }).published_within_cooldown,
    false
  );
});

test('재제출 축은 시리즈가 아닌 기사에는 만들어지지 않는다', () => {
  // 재제출 키를 시리즈일 때만 만들지 않으면, 같은 호스트에 같은 제목을 가진 서로 다른 기사가
  // 제목만으로 맞아떨어진다. 릴리스 노트처럼 한 페이지의 앵커만 다른 후보가 실제 이력에 있어
  // (developer.android.com 계열) 그 전부가 첫 발행 1건에 막히게 된다.
  const empty = {
    schemaVersion: 1,
    coverage: { mode: 'forward_only', coverage_starts_at: '2026-08-31', backfill_included: false },
    articles: []
  };
  const history = recordArticleExposure(empty, {
    title: 'CameraX release notes',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0'
  }, { date: '2026-08-31', type: 'newsletter_article' });

  const sameTitleDifferentAnchor = {
    title: 'CameraX release notes',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.7.0'
  };

  assert.strictEqual(
    annotateArticleExposure(sameTitleDifferentAnchor, history, { date: '2026-09-07' }).published_within_cooldown,
    false
  );
  assert.strictEqual(
    everCoveredAsNewsletterArticle(sameTitleDifferentAnchor, history, { date: '2026-09-07' }),
    false
  );
});

// ── 일치 레코드가 여럿일 때 (독립 리뷰 major 1) ────────────────────────────────
// 같은 시리즈가 여러 주에 걸쳐 발행되면 조각마다 레코드가 1건씩 남는다. 그중 1건을 먼저 고른 뒤
// 그 레코드만 검사하면, 만료된 레코드가 앞에 있을 때 아직 살아 있는 쿨다운을 가린다.
// 아래 두 레코드는 실제 state/article-exposure-history.json의 AR0234 idx 8 / idx 15 모양이다.
const AR0234_V1_URL = 'https://lore.kernel.org/linux-media/20260731073505.2278769-1-eagle.alexander923@gmail.com/';
const AR0234_V2_URL = 'https://lore.kernel.org/linux-media/20260807102847.1813059-1-eagle.alexander923@gmail.com/';
const AR0234_SUBJECT = 'media: i2c: Add onsemi AR0234 camera sensor driver';

function ar0234Record(url, version, newsletterDate, cooldownUntil) {
  return {
    article_identity_key: `url:${url}`,
    title: `[PATCH ${version} 0/2] ${AR0234_SUBJECT}`,
    source_url: url,
    newsletter_date: newsletterDate,
    exposure_type: 'newsletter_article',
    exposed_at: newsletterDate,
    newsletter_article_date: newsletterDate,
    cooldown_until: cooldownUntil,
    exposure_types: ['newsletter_article']
  };
}

test('만료된 레코드가 앞에 있어도 아직 살아 있는 쿨다운이 이긴다', () => {
  const history = {
    schemaVersion: 1,
    coverage: { mode: 'forward_only', coverage_starts_at: '2026-08-01', backfill_included: false },
    articles: [
      ar0234Record(AR0234_V1_URL, 'v1', '2026-08-03', '2026-08-24'),
      ar0234Record(AR0234_V2_URL, 'v2', '2026-08-10', '2026-08-31')
    ]
  };
  const v3Candidate = {
    title: `[PATCH v3 0/2] ${AR0234_SUBJECT}`,
    url: 'https://lore.kernel.org/linux-media/20260820075524.2056029-1-eagle.alexander923@gmail.com/'
  };

  for (const date of ['2026-08-25', '2026-08-28', '2026-08-31']) {
    const annotated = annotateArticleExposure(v3Candidate, history, { date });
    assert.strictEqual(annotated.published_within_cooldown, true, `date=${date}`);
    // 인용하는 날짜도 실제로 막고 있는 레코드의 것이어야 한다.
    assert.strictEqual(annotated.last_newsletter_date, '2026-08-10', `date=${date}`);
  }

  // 둘 다 만료된 뒤에는 통과해야 한다 — 술어가 쿨다운을 영구 차단으로 바꾸면 안 된다.
  assert.strictEqual(
    annotateArticleExposure(v3Candidate, history, { date: '2026-09-01' }).published_within_cooldown,
    false
  );
});

// ── record.title은 표시용이다 (독립 리뷰 major 2) ─────────────────────────────
// 발행 단계의 홈페이지 헤드라인 갱신(ensure-public-newsletter-artifacts의
// persistHomepageHeadlineArtifacts)이 같은 레코드의 title을 렌더된 한국어 헤드라인으로 덮는다.
// 그래서 subject 키를 title에서 유도하면 매 호의 헤드라인 기사 1건만 재제출 축이 조용히 죽는다.
const IMX908_V3_URL = 'https://lore.kernel.org/linux-media/20260828064843.65047-2-lachlan.michael@sony.com/';
const IMX908_SUBJECT = 'media: dt-bindings: imx908: Add Sony IMX908 sensor';
const IMX908_RENDERED_HEADLINE = 'Sony IMX908 이미지 센서, Linux Device Tree 바인딩 추가로 공식 지원 기반 마련';

test('발행 기록은 재제출 subject 키를 함께 남긴다', () => {
  const empty = {
    schemaVersion: 1,
    coverage: { mode: 'forward_only', coverage_starts_at: '2026-08-31', backfill_included: false },
    articles: []
  };
  const history = recordArticleExposure(empty, {
    title: `[PATCH v3 1/2] ${IMX908_SUBJECT}`,
    url: IMX908_V3_URL
  }, { date: '2026-08-31', type: 'newsletter_article' });

  assert.strictEqual(
    history.articles[0].series_subject_key,
    'media dt bindings imx908 add sony imx908 sensor'
  );
});

test('헤드라인 갱신이 한국어 제목으로 subject 키를 덮지 않는다', () => {
  const empty = {
    schemaVersion: 1,
    coverage: { mode: 'forward_only', coverage_starts_at: '2026-08-31', backfill_included: false },
    articles: []
  };
  // 1) 발행 기록(수집 후보 제목)
  let history = recordArticleExposure(empty, {
    title: `[PATCH v3 1/2] ${IMX908_SUBJECT}`,
    url: IMX908_V3_URL
  }, { date: '2026-08-31', type: 'newsletter_article' });
  const storedSubject = history.articles[0].series_subject_key;

  // 2) 홈페이지 헤드라인 갱신이 같은 URL에 렌더된 한국어 제목을 실어 온다.
  //    persistHomepageHeadlineArtifacts가 하는 호출과 같은 모양이다.
  history = recordArticleExposure(history, {
    title: IMX908_RENDERED_HEADLINE,
    url: IMX908_V3_URL
  }, { date: '2026-08-31', type: 'homepage_headline' });

  assert.strictEqual(history.articles.length, 1);
  assert.strictEqual(history.articles[0].title, IMX908_RENDERED_HEADLINE, '표시용 title은 갱신된다');
  assert.strictEqual(history.articles[0].series_subject_key, storedSubject, 'subject 키는 보존된다');
  assert.strictEqual(
    history.articles[0].series_identity_key,
    'lore-series:20260828064843.65047-lachlan.michael@sony.com'
  );

  // 3) 그래서 다음 버전 재제출이 여전히 차단된다.
  const v4Candidate = {
    title: `[PATCH v4 1/2] ${IMX908_SUBJECT}`,
    url: 'https://lore.kernel.org/linux-media/20260904111111.22222-2-lachlan.michael@sony.com/'
  };
  assert.strictEqual(
    annotateArticleExposure(v4Candidate, history, { date: '2026-09-07' }).published_within_cooldown,
    true
  );
});

test('재제출 축은 제목이 빈 시리즈 후보끼리 맞아떨어지지 않는다', () => {
  // scope는 있고 subject만 빈 경우다. 가드가 없으면 `host::` 하나로 서로 다른 시리즈가 전부 묶인다.
  const history = {
    schemaVersion: 1,
    coverage: { mode: 'forward_only', coverage_starts_at: '2026-08-31', backfill_included: false },
    articles: [{
      article_identity_key: `url:${IMX908_V3_URL}`,
      title: '',
      source_url: IMX908_V3_URL,
      newsletter_date: '2026-08-31',
      exposure_type: 'newsletter_article',
      newsletter_article_date: '2026-08-31',
      cooldown_until: '2026-09-21',
      exposure_types: ['newsletter_article']
    }]
  };
  const untitledOtherSeries = {
    title: '',
    url: 'https://lore.kernel.org/linux-media/20260901090909.33333-1-someone.else@example.com/'
  };

  assert.strictEqual(
    annotateArticleExposure(untitledOtherSeries, history, { date: '2026-09-07' }).published_within_cooldown,
    false
  );
  assert.strictEqual(
    everCoveredAsNewsletterArticle(untitledOtherSeries, history, { date: '2026-09-07' }),
    false
  );
});

test('비시리즈 기록을 다시 갱신해도 시리즈 필드가 빈 값으로 생기지 않는다', () => {
  // 보존 규칙이 빈 값까지 실어 나르면 "시리즈가 아니면 필드를 안 남긴다"는 결정이 무너져
  // state 파일의 모든 기록에 빈 필드가 붙는다.
  const empty = {
    schemaVersion: 1,
    coverage: { mode: 'forward_only', coverage_starts_at: '2026-08-31', backfill_included: false },
    articles: []
  };
  const article = {
    title: 'CameraX 1.6.0 release notes',
    url: 'https://developer.android.com/jetpack/androidx/releases/camera#1.6.0'
  };
  let history = recordArticleExposure(empty, article, { date: '2026-08-31', type: 'newsletter_article' });
  history = recordArticleExposure(history, article, { date: '2026-09-07', type: 'homepage_headline' });

  const record = history.articles[0];
  assert.ok(!Object.prototype.hasOwnProperty.call(record, 'series_identity_key'));
  assert.ok(!Object.prototype.hasOwnProperty.call(record, 'series_subject_key'));
});

test('쿨다운은 main 기사 발행 기록만 건다 — 헤드라인 기록의 cooldown_until은 무시한다', () => {
  // cooldown_until은 newsletter_article 분기에서만 계산된다. 그 불변식이 깨져 헤드라인 기록이
  // 쿨다운을 걸기 시작하면, main으로 낸 적 없는 URL이 재게재 차단으로 잡힌다.
  const history = {
    schemaVersion: 1,
    coverage: { mode: 'forward_only', coverage_starts_at: '2026-08-31', backfill_included: false },
    articles: [{
      article_identity_key: 'url:https://example.com/headline-only',
      title: 'Headline only',
      source_url: 'https://example.com/headline-only',
      newsletter_date: '2026-08-31',
      exposure_type: 'homepage_headline',
      exposure_types: ['homepage_headline'],
      cooldown_until: '2026-09-21'
    }]
  };

  assert.strictEqual(
    annotateArticleExposure({ url: 'https://example.com/headline-only' }, history, { date: '2026-09-07' })
      .published_within_cooldown,
    false
  );
});
