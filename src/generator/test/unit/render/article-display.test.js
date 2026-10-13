const assert = require('node:assert/strict');
const test = require('node:test');
const { articleDisplayRows } = require('../../../render/article-display');
const { buildHtml, weeklyTopicTags } = require('../../../render/newsletter-renderer');
const { sectionKey } = require('../../../render/apply-translation');

function section(id, bucket, image = {}) {
  return {
    id,
    headline: 'Internal title',
    relevance_bucket: bucket,
    sources: [{ title: 'Source', url: `https://example.com/${id}` }],
    public_article: {
      headline: 'Same Camera title',
      lead: 'A source-backed proposal.',
      camera_hal_takeaway: 'Relevant to users of this library; adoption is unconfirmed.',
      body_paragraphs: ['Details remain in the article.'],
      reader_checkpoints: ['INTERNAL QA'],
      source_links: [{ title: 'Source', url: `https://example.com/${id}`, source_role: 'primary' }]
    },
    ...image
  };
}

function issue(sections) {
  return { weekly_key: '2026-W42', date: '2026-10-12', title: 'Weekly issue', summary: 'Intro', briefing: [], references: [], sections };
}

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

test('display projection preserves renderer order, duplicate anchors, public prose and topic tags', () => {
  const draft = freeze(issue([
    section('a', 'cpp_ai_tooling_fallback', { is_ai_related: false }),
    section('b', 'direct_aosp_camera'),
    section('c', 'camera_driver_image_pipeline', { headline: 'Qualcomm CAMSS SoC support' })
  ]));
  const before = JSON.stringify(draft);
  const rows = articleDisplayRows(draft, { issueHref: 'newsletters/2026-W42/index.html' });
  assert.deepEqual(rows.map(row => row.id), ['a', 'b', 'c']);
  assert.deepEqual(rows.map(row => row.href.split('#')[1]), ['article-same-camera-title', 'article-same-camera-title-2', 'article-same-camera-title-3']);
  assert.deepEqual(rows.map(row => row.tags), [['C++'], ['Camera HAL'], ['Driver', 'Image Processing', 'SoC Platform']]);
  assert.deepEqual([...new Set(rows.flatMap(row => row.tags))], weeklyTopicTags(draft.sections));
  const html = buildHtml(draft);
  for (const row of rows) {
    assert.ok(html.includes(`id="${row.href.split('#')[1]}"`));
    assert.ok(html.includes(row.headline));
    assert.ok(html.includes(row.lead));
    assert.ok(html.includes(row.takeaway));
    assert.deepEqual(Object.keys(row), ['id', 'href', 'headline', 'lead', 'takeaway', 'tags', 'image']);
  }
  assert.equal(JSON.stringify(draft), before);
  assert.doesNotMatch(JSON.stringify(rows), /INTERNAL QA|Internal title/);
  rows[1].tags.push('unexpected');
  assert.deepEqual(articleDisplayRows(draft, { issueHref: 'newsletters/2026-W42/index.html' })[1].tags, ['Camera HAL']);
});

test('display images use final resolver paths, path-based fallback detection and no borrowed image', () => {
  const draft = issue([
    section('none', 'android'),
    section('fallback', 'android', { selectedImage: '../../assets/images/fallback/ai.svg', imageAlt: 'Decoration' }),
    section('photo', 'android', {
      selectedImage: 'https://example.com/rejected.jpg',
      resolvedImage: { src: 'https://example.com/final.jpg', usedFallback: true },
      imageAlt: 'Camera diagram'
    }),
    section('invalid', 'android', { selectedImage: 'javascript:alert(1)' })
  ]);
  for (const locale of ['ko', 'en']) {
    const issueHref = `${locale === 'en' ? 'en/' : ''}newsletters/2026-W42/index.html`;
    const rows = articleDisplayRows(draft, { locale, issueHref });
    assert.equal(rows[0].image, null);
    assert.deepEqual(rows[1].image, { src: 'assets/images/fallback/ai.svg', alt: '', is_fallback: true });
    assert.deepEqual(rows[2].image, { src: 'https://example.com/final.jpg', alt: 'Camera diagram', is_fallback: false });
    assert.equal(rows[3].image, null);
    const html = buildHtml(draft, { locale });
    assert.ok(html.includes(`${locale === 'en' ? '../../../' : '../../'}${rows[1].image.src}`));
    assert.ok(html.includes(rows[2].image.src));
    assert.doesNotMatch(html, /rejected\.jpg/);
  }
});

test('translated titles produce their own renderer anchors while identity follows sectionKey', () => {
  const source = section(undefined, 'android');
  const draft = issue([source]);
  const ko = articleDisplayRows(draft, { issueHref: 'newsletters/2026-W42/index.html' });
  const translated = structuredClone(draft);
  translated.sections[0].public_article.headline = 'English translated headline';
  const en = articleDisplayRows(translated, { locale: 'en', issueHref: 'en/newsletters/2026-W42/index.html' });
  assert.equal(en[0].id, sectionKey(source));
  assert.equal(en[0].id, ko[0].id);
  assert.notEqual(en[0].href.split('#')[1], ko[0].href.split('#')[1]);
  assert.ok(buildHtml(translated, { locale: 'en' }).includes(`id="${en[0].href.split('#')[1]}"`));
});

test('legacy missing fields and references do not become invented public summaries', () => {
  const draft = issue([{ headline: 'Legacy internal title', sources: [{ url: 'https://example.com/legacy' }] }]);
  draft.reference_articles = [{ title: 'Reference', url: 'https://example.com/reference' }];
  const rows = articleDisplayRows(draft, { issueHref: 'newsletters/2026-W42/index.html' });
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].headline, rows[0].lead, rows[0].takeaway, rows[0].image], ['', '', '', null]);
  assert.ok(buildHtml(draft).includes(`id="${rows[0].href.split('#')[1]}"`));
  assert.deepEqual(articleDisplayRows(issue([]), { issueHref: 'newsletters/2026-W42/index.html' }), []);
});

test('display projection rejects unknown locale and invalid site-relative issue routes', () => {
  for (const issueHref of [undefined, '', '/newsletters/2026-W42/index.html', '../index.html', 'https://example.com/index.html', 'newsletters/2026-W42/index.html#x', 'en/newsletters/2026-W42/index.html']) {
    assert.throws(() => articleDisplayRows(issue([]), { issueHref }), /issueHref/);
  }
  assert.throws(() => articleDisplayRows(issue([]), { locale: 'fr', issueHref: 'newsletters/2026-W42/index.html' }), /Unsupported locale/);
});
