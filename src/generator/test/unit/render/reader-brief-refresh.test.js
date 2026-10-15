'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { buildHtml } = require('../../../render/newsletter-renderer');
const { applyTranslation, translationSourceHash } = require('../../../render/apply-translation');
const { refreshReaderBriefs } = require('../../../publish/refresh-reader-briefs');

function syntheticRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-brief-refresh-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text, 'utf8'); };
  const issue = { weekly_key: '2026-W19', date: '2026-05-04', title: 'Synthetic source', summary: 'A proposal, not a release.',
    sections: [{ id: 'article-a', headline: 'Driver proposal', relevance_bucket: 'camera_driver_image_pipeline',
      selectedImage: '../../assets/images/fallback/newsletter-default.svg', imageAlt: 'Original alt',
      public_article: { headline: 'Driver proposal', lead: 'Only board A is covered.', body_paragraphs: ['The proposal is unmerged.', 'No measurement is available.'],
        camera_hal_takeaway: 'Observe the review.', source_links: [{ title: 'Official proposal', url: 'https://example.com/review' }] } }] };
  const text = JSON.stringify(issue, null, 2) + '\n';
  const overlay = { schemaVersion: 1, weekly_key: issue.weekly_key, source_hash: translationSourceHash(text), title: 'Translated source',
    summary: 'A proposal, not a release.', watch_points: [], reference_articles: [], sections: [{ id: 'article-a', headline: 'Translated driver proposal',
      lead: 'Only board A is covered.', body_markdown: 'The proposal is unmerged.\n\nNo measurement is available.', why_it_matters: 'Observe the review.' }] };
  const index = [{ weeklyKey: issue.weekly_key, date: issue.date, title: '2026 W19', summary: 'Original index summary', tags: ['Driver'],
    lead_article_image: 'assets/images/fallback/newsletter-default.svg', html: 'newsletters/2026-W19/index.html',
    en: { title: '2026 W19', summary: 'Original English summary', html: 'en/newsletters/2026-W19/index.html' } }];
  put('articles/data/newsletters-weekly.json', JSON.stringify(index, null, 2) + '\n');
  put('articles/newsletters/2026-W19/issue.json', text);
  put('articles/newsletters/2026-W19/translation.en.json', JSON.stringify(overlay));
  put('articles/newsletters/2026-W19/index.html', buildHtml(issue));
  put('articles/en/newsletters/2026-W19/index.html', buildHtml(applyTranslation(issue, overlay, { sourceText: text }), { locale: 'en' }));
  return { root, put, index };
}

test('projection refresh is read-only by default and writes only bilingual reader briefs idempotently', t => {
  const box = syntheticRoot(t);
  const file = path.join(box.root, 'articles/data/newsletters-weekly.json');
  const before = fs.readFileSync(file, 'utf8');
  const dry = refreshReaderBriefs({ root: box.root });
  assert.equal(dry.changed, true);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  refreshReaderBriefs({ root: box.root, write: true });
  const [entry] = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { reader_brief: korean, en, ...rest } = entry;
  const { reader_brief: english, ...englishRest } = en;
  assert.deepEqual(rest, Object.fromEntries(Object.entries(box.index[0]).filter(([key]) => key !== 'en')));
  assert.deepEqual(englishRest, box.index[0].en);
  assert.equal(korean.items[0].headline, 'Driver proposal');
  assert.equal(english.items[0].headline, 'Translated driver proposal');
  assert.equal(korean.items[0].image.is_fallback, true);
  assert.equal(refreshReaderBriefs({ root: box.root }).changed, false);
});

test('stale English translation blocks all index writes', t => {
  const box = syntheticRoot(t);
  const file = path.join(box.root, 'articles/data/newsletters-weekly.json');
  const before = fs.readFileSync(file, 'utf8');
  const overlayPath = path.join(box.root, 'articles/newsletters/2026-W19/translation.en.json');
  const overlay = JSON.parse(fs.readFileSync(overlayPath, 'utf8')); overlay.source_hash = translationSourceHash('stale');
  fs.writeFileSync(overlayPath, JSON.stringify(overlay), 'utf8');
  assert.throws(() => refreshReaderBriefs({ root: box.root, write: true }), /Stale translation/);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('missing published article anchor cannot create a broken topic-card destination', t => {
  const box = syntheticRoot(t);
  const file = path.join(box.root, 'articles/data/newsletters-weekly.json');
  const before = fs.readFileSync(file, 'utf8');
  box.put('articles/newsletters/2026-W19/index.html', '<html><body>No article</body></html>');
  assert.throws(() => refreshReaderBriefs({ root: box.root, write: true }), /projection mismatch/);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});
