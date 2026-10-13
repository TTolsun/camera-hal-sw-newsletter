'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildReaderBrief } = require('../../../render/reader-brief');
const { buildHtml } = require('../../../render/newsletter-renderer');
const { applyTranslation, translationSourceHash } = require('../../../render/apply-translation');

// Synthetic UI contract inputs, not publication PASS fixtures.
function sample() {
  return {
    weekly_key: '2026-W42', date: '2026-10-12', title: 'Sample', summary: '최종 렌더용 요약입니다.',
    sections: [1, 2].map(id => ({
      id: `article-${id}`, headline: 'libcamera 제안', relevance_bucket: 'camera_driver_image_pipeline',
      public_article: { headline: 'libcamera 제안', lead: '동작 변경을 제안했습니다.',
        camera_hal_takeaway: '사용자는 적용 조건을 참고할 수 있습니다.', body_paragraphs: ['공개 본문입니다.'],
        reader_checkpoints: ['내부 QA'], source_links: [] },
      ...(id === 2 ? { resolvedImage: { src: 'https://example.com/article.png' }, imageAlt: '둘째 기사 이미지' } : {})
    })),
    reference_articles: [{ title: '참고 기사', url: 'https://example.com/reference' }]
  };
}

test('ReaderBriefV1 copies final public fields and keeps headline/image/tags on the same identity', () => {
  const issue = sample();
  const before = structuredClone(issue);
  const brief = buildReaderBrief(issue, { issueHref: 'newsletters/2026-W42/index.html' });
  assert.deepEqual(Object.keys(brief), ['schema_version', 'locale', 'intro', 'items']);
  assert.equal(brief.schema_version, 1);
  assert.equal(brief.locale, 'ko');
  assert.equal(brief.intro, issue.summary);
  assert.equal(brief.items.length, 2);
  assert.equal(brief.items[0].image, null);
  assert.equal(brief.items[1].image.src, 'https://example.com/article.png');
  assert.deepEqual(brief.items[0].tags, ['Driver', 'Image Processing']);
  assert.deepEqual(brief.items.map(item => item.id), ['article-1', 'article-2']);
  const html = buildHtml(issue);
  for (const item of brief.items) {
    assert.match(html, new RegExp(`id="${item.href.split('#')[1]}"`));
    assert.deepEqual(Object.keys(item), ['id', 'href', 'headline', 'lead', 'takeaway', 'tags', 'image']);
    assert.equal(item.lead, issue.sections[0].public_article.lead);
    assert.equal(item.takeaway, issue.sections[0].public_article.camera_hal_takeaway);
  }
  assert.notEqual(brief.items[0].href, brief.items[1].href);
  assert.deepEqual(issue, before);
});

test('builder rejects unknown locales and unsafe or wrong-language weekly routes', () => {
  for (const issueHref of ['https://example.com/a', '../newsletters/2026-W42/index.html',
    'newsletters/2026-W42/index.html#fragment', 'newsletters/2026-W99/index.html',
    'en/newsletters/2026-W42/index.html', 'newsletters/2026-W42/index.html?x=1']) {
    assert.throws(() => buildReaderBrief(sample(), { issueHref }), /issueHref/);
  }
  assert.throws(() => buildReaderBrief(sample(), { locale: 'fr' }), /locale/);
});

test('fallback image stays decorative; no summary or missing legacy fields are invented', () => {
  const issue = sample();
  issue.summary = '';
  issue.sections = [{ id: 'legacy', public_article: {}, selectedImage: '../../assets/images/fallback/android.svg', imageAlt: 'ignored' }];
  const brief = buildReaderBrief(issue, { issueHref: 'newsletters/2026-W42/index.html' });
  assert.equal(brief.intro, '');
  assert.equal(brief.items[0].lead, '');
  assert.equal(brief.items[0].takeaway, '');
  assert.deepEqual(brief.items[0].image, { src: 'assets/images/fallback/android.svg', alt: '', is_fallback: true });
  assert.deepEqual(buildReaderBrief({ sections: [] }, { issueHref: 'newsletters/2026-W42/index.html' }).items, []);
});

test('valid English overlay produces its own anchors and prose; stale overlays cannot produce a brief', () => {
  const issue = sample();
  issue.reference_articles = [];
  const translation = { schemaVersion: 1, weekly_key: issue.weekly_key, source_hash: translationSourceHash(issue),
    title: 'Sample', summary: 'A proposal and its scope.', watch_points: [], reference_articles: [],
    sections: issue.sections.map(section => ({ id: section.id, headline: 'libcamera proposal',
      lead: 'A change was proposed.', why_it_matters: 'Users can review the conditions.', body_markdown: 'Public body.' })) };
  const english = applyTranslation(issue, translation);
  const brief = buildReaderBrief(english, { locale: 'en', issueHref: 'en/newsletters/2026-W42/index.html' });
  assert.equal(brief.intro, translation.summary);
  const html = buildHtml(english, { locale: 'en' });
  for (const item of brief.items) {
    assert.equal(item.headline, 'libcamera proposal');
    assert.match(item.href, /^en\/newsletters\//);
    assert.match(html, new RegExp(`id="${item.href.split('#')[1]}"`));
  }
  const korean = buildReaderBrief(issue, { issueHref: 'newsletters/2026-W42/index.html' });
  assert.notEqual(brief.items[0].href.split('#')[1], korean.items[0].href.split('#')[1]);
  assert.throws(() => applyTranslation({ ...issue, summary: '수정된 원문' }, translation), /Stale/);
});
