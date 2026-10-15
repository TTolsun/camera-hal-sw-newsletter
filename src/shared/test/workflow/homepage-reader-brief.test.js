const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const archive = require('../../../../articles/assets/js/newsletter-archive');

// Synthetic UI-only inputs. These are not published articles or quality PASS fixtures.
function sample(locale = 'ko') {
  const entry = {
    weeklyKey: '2026-W42', date: '2026-10-12', title: '2026 W42',
    html: 'newsletters/2026-W42/index.html', summary: 'Legacy A\nLegacy B',
    tags: ['Camera HAL', 'AI'], article_count: 2,
    article_images: ['https://example.com/b.jpg'],
    coverage_mode: 'iso_week', coverage_week_key: '2026-W41',
    coverage_start_date: '2026-10-05', coverage_end_date: '2026-10-11'
  };
  const base = `${locale === 'en' ? 'en/' : ''}${entry.html}`;
  const brief = {
    schema_version: 1, locale, intro: 'A proposal and a tool announcement.',
    items: [
      { id: 'a', href: `${base}#article-a`, headline: 'Proposal A <review>', lead: 'Proposed; not yet merged.', takeaway: 'Review the applicable conditions.', tags: ['Camera HAL'], image: { src: 'assets/images/fallback/newsletter-default.svg', alt: '', is_fallback: true } },
      { id: 'b', href: `${base}#article-b`, headline: 'Tool B', lead: 'A tool was announced.', takeaway: 'Relevant to coding tasks.', tags: ['AI'], image: { src: 'https://example.com/b.jpg', alt: 'Tool B image', is_fallback: false } }
    ]
  };
  if (locale === 'en') entry.en = { html: base, title: '2026 W42', summary: 'English legacy A', reader_brief: brief };
  else entry.reader_brief = brief;
  return { entry, brief };
}

test('homepage and cards keep A copy and classification without borrowing B media', () => {
  const { entry, brief } = sample();
  const before = JSON.stringify(entry);
  for (const firstImage of [brief.items[0].image, null]) {
    brief.items[0].image = firstImage;
    const home = archive.renderLatestIssue(entry);
    const card = archive.renderArchiveCard(entry);
    for (const html of [home, card]) {
      assert.match(html, /Proposal A &lt;review&gt;/);
      assert.doesNotMatch(html, /b\.jpg|<[^>]*>AI<\//);
      assert.match(html, /Camera HAL/);
    }
    assert.doesNotMatch(home, /<img/);
    assert.match(card, /is-fallback/);
    assert.match(card, /src="assets\/images\/fallback\/newsletter-default.svg" alt=""/);
    assert.match(home, /Proposed; not yet merged\./);
    assert.match(home, /Review the applicable conditions\./);
    assert.match(home, /href="newsletters\/2026-W42\/index\.html#article-a"/);
    assert.match(home, /href="newsletters\/2026-W42\/index\.html#article-b"/);
  }
  brief.items[0].image = { src: 'assets/images/fallback/newsletter-default.svg', alt: '', is_fallback: true };
  assert.equal(JSON.stringify(entry), before, 'rendering must not mutate the wire input');
});

test('single item real image preserves alt and loading failures become text without borrowed media', () => {
  const { entry, brief } = sample();
  brief.items = [brief.items[1]];
  const html = archive.renderLatestIssue(entry);
  assert.match(html, /src="https:\/\/example.com\/b.jpg" alt="Tool B image" loading="eager"/);
  assert.match(html, /Tool B<\/h1>/);
  assert.doesNotMatch(html, /reader-stories|article-a/);
  const handler = html.match(/onerror="([^"]+)"/)[1];
  const img = { onerror() {}, alt: 'Tool B image', parentElement: { hidden: false } };
  Function(handler).call(img);
  assert.equal(img.onerror, null);
  assert.equal(img.alt, '');
  assert.equal(img.parentElement.hidden, true);
});

test('both locales lead with the change and work implications while keeping the introduction optional', () => {
  for (const locale of ['ko', 'en']) {
    const { entry, brief } = sample(locale);
    const html = archive.renderLatestIssue(entry, { locale });
    assert.ok(html.indexOf('reader-decision') < html.indexOf('reader-stories'));
    const context = html.match(/<details class="reader-context">([\s\S]*?)<\/details>/)[1];
    assert.ok(context.indexOf('reader-intro') < context.indexOf('reader-stories'));
    assert.match(context, /article-b/);
    assert.match(html, /<details class="reader-context">/);
    assert.doesNotMatch(html, /<details[^>]*\bopen/);
    assert.equal(html.split(brief.items[0].takeaway).length - 1, 1);
    assert.doesNotMatch(archive.renderArchiveCard(entry, { locale, compact: true }), /card-takeaway/);
    assert.match(archive.renderArchiveCard(entry, { locale }), /card-takeaway/);
    brief.intro = '';
    const withoutIntro = archive.renderLatestIssue(entry, { locale });
    assert.match(withoutIntro, /<details class="reader-context">[\s\S]*reader-stories[\s\S]*article-b[\s\S]*<\/details>/);
    assert.doesNotMatch(withoutIntro, /reader-intro/);
  }
});

test('public item order and distinct duplicate-title anchors are preserved', () => {
  const { entry, brief } = sample();
  brief.items[1].headline = brief.items[0].headline;
  brief.items.reverse();
  const html = archive.renderLatestIssue(entry);
  assert.ok(html.indexOf('#article-b') < html.indexOf('#article-a'));
  assert.match(html, /Tool B image/);
  brief.items[0].image = { src: 'assets/images/brand/HALley.png', alt: 'Repaired B image', is_fallback: false };
  assert.match(archive.renderArchiveCard(entry), /src="assets\/images\/brand\/HALley.png" alt="Repaired B image"/);
});

test('unknown version, malformed shape and unsafe destinations diagnose and use legacy display', () => {
  const warnings = [];
  const sandbox = { console: { warn: (...args) => warnings.push(args) }, URL };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../../../articles/assets/js/newsletter-archive.js'), 'utf8'), sandbox);
  const mutations = [
    brief => { brief.schema_version = 2; },
    brief => { brief.locale = 'en'; },
    brief => { brief.intro = {}; },
    brief => { brief.items = {}; },
    brief => { delete brief.items[0].takeaway; },
    brief => { brief.items[0].href = 'javascript:alert(1)'; },
    brief => { brief.items[0].href = 'newsletters/2026-W41/index.html#article-a'; },
    brief => { brief.items[0].href = 'newsletters/2026-W42/index.html#article-a" onclick="x'; },
    brief => { brief.items[0].image.src = '../assets/x.png'; },
    brief => { brief.items[0].image.src = 'assets/../data/x'; },
    brief => { brief.items[0].image.src = 'http://example.com/x'; },
    brief => { brief.items[0].image.src = 'https://user:password@example.com/x'; },
    brief => { brief.items[0].image.is_fallback = false; },
    brief => { brief.items[0].image.alt = 'Misleading alt'; },
    brief => { brief.items[1].id = brief.items[0].id; },
    brief => { brief.items[1].href = brief.items[0].href; }
  ];
  for (const mutate of mutations) {
    const { entry, brief } = sample();
    mutate(brief);
    const html = sandbox.NewsletterArchive.renderLatestIssue(entry);
    assert.match(html, /Legacy A/);
    assert.doesNotMatch(html, /article-a|b\.jpg|<img/);
  }
  assert.equal(warnings.length, mutations.length);
});

test('empty and absent projections keep the weekly URL without manufacturing claims or anchors', () => {
  const { entry, brief } = sample();
  brief.items = [];
  assert.equal(archive.readerBrief(entry), brief);
  assert.doesNotMatch(archive.renderLatestIssue(entry), /#article-|Legacy A|Legacy B/);
  assert.doesNotMatch(archive.renderArchiveCard(entry), /#article-|Legacy A|Legacy B/);
  delete entry.reader_brief;
  const html = archive.renderLatestIssue(entry);
  assert.match(html, /href="newsletters\/2026-W42\/index.html"/);
  assert.match(html, /대상 W41.*발행 W42/s);
  assert.doesNotMatch(html, /<img|reader-intro|reader-takeaway|#article-/);
});

test('English uses its own translated anchors and clears projections when the edition is absent', () => {
  const { entry, brief } = sample('en');
  brief.items[0].href = 'en/newsletters/2026-W42/index.html#article-english-a';
  entry.reader_brief = sample().brief;
  const options = { locale: 'en', rootPath: '../' };
  const html = archive.renderLatestIssue(entry, options);
  assert.match(html, /href="\.\.\/en\/newsletters\/2026-W42\/index.html#article-english-a"/);
  assert.match(html, /Coverage W41.*Published W42/s);
  assert.doesNotMatch(html, /href="newsletters|Korean only/);
  delete entry.en.reader_brief;
  assert.doesNotMatch(archive.renderLatestIssue(entry, options), /Proposal A|article-a/);
  delete entry.en;
  const koreanOnly = archive.renderLatestIssue(entry, options);
  assert.match(koreanOnly, /Korean only/);
  assert.doesNotMatch(koreanOnly, /Proposal A|Legacy A/);
  assert.match(koreanOnly, /href="\.\.\/newsletters\/2026-W42\/index.html"/);
});

test('public prose is escaped without inserting HTML or internal QA values', () => {
  const { entry, brief } = sample();
  brief.intro = '<script>alert("x")</script>';
  brief.items[0].lead = '<a href="javascript:x">Lead & details</a>';
  entry.reader_checkpoints = ['INTERNAL_CHECKPOINT'];
  const html = archive.renderLatestIssue(entry);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Lead &amp; details/);
  assert.doesNotMatch(html, /<script|INTERNAL_CHECKPOINT/);
});

test('card link names include the visible headline in both locales and legacy states', () => {
  for (const locale of ['ko', 'en']) {
    const { entry, brief } = sample(locale);
    const options = { locale, ariaSuffix: 'Open this issue' };
    function assertNamedHeadline(expected) {
      const html = archive.renderArchiveCard(entry, options);
      const label = html.match(/aria-label="([^"]+)"/)[1];
      assert.ok(label.includes(expected), `visible headline missing from link name: ${label}`);
      assert.ok(label.includes(entry.date));
      assert.ok(label.includes('Open this issue'));
      assert.match(html, new RegExp(`<h3[^>]*>${expected}</h3>`));
    }
    assertNamedHeadline('Proposal A &lt;review&gt;');
    brief.items = [];
    assertNamedHeadline(entry.title);
    if (locale === 'en') delete entry.en.reader_brief;
    else delete entry.reader_brief;
    assertNamedHeadline(locale === 'en' ? 'English legacy A' : 'Legacy A');
    if (locale === 'en') {
      delete entry.en;
      assertNamedHeadline(entry.title);
      assert.match(archive.renderArchiveCard(entry, options), /aria-label="[^"]*Korean only/);
    }
  }
});

test('legacy lead_article_image is safe to reuse but never overrides a present projection', () => {
  const { entry, brief } = sample();
  entry.lead_article_image = 'https://example.com/legacy-a.png';
  brief.items[0].image = null;
  for (const render of [archive.renderLatestIssue, archive.renderArchiveCard]) {
    assert.doesNotMatch(render(entry), /legacy-a.png/);
    delete entry.reader_brief;
    assert.match(render(entry, { rootPath: '../' }), /src="https:\/\/example.com\/legacy-a.png" alt=""/);
    for (const invalid of ['', 'javascript:alert(1)', '../assets/a.png', 'http://example.com/a.png', 'assets/images/fallback/android.svg']) {
      const output = render({ ...entry, lead_article_image: invalid });
      assert.doesNotMatch(output, /src="(?:javascript:|http:|\.\.\/assets)/);
      if (render === archive.renderLatestIssue) assert.doesNotMatch(output, /<img/);
      else assert.match(output, /is-fallback/);
    }
    entry.reader_brief = brief;
  }
});

test('card image failures retain their frame and use a decorative local fallback in both locales', () => {
  for (const locale of ['ko', 'en']) {
    const { entry, brief } = sample(locale);
    brief.items = [brief.items[1]];
    const rootPath = locale === 'en' ? '../' : '';
    const html = archive.renderArchiveCard(entry, { locale, rootPath });
    const classes = [];
    const img = { onerror() {}, alt: 'Tool B image', src: 'https://example.com/b.jpg',
      dataset: { fallbackSrc: rootPath + 'assets/images/fallback/newsletter-default.svg' },
      parentElement: { hidden: false, classList: { add: value => classes.push(value) } } };
    Function(html.match(/onerror="([^"]+)"/)[1]).call(img);
    assert.equal(img.src, img.dataset.fallbackSrc);
    assert.equal(img.alt, '');
    assert.equal(img.onerror, null);
    assert.equal(img.parentElement.hidden, false);
    assert.deepEqual(classes, ['is-fallback']);
    delete entry.reader_brief;
    if (entry.en) delete entry.en.reader_brief;
    entry.lead_article_image = 'assets/images/fallback/android.svg';
    assert.ok(archive.renderArchiveCard(entry, { locale, rootPath }).includes(`src="${rootPath}assets/images/fallback/android.svg" alt=""`));
  }
});

test('topic cards select the matching article title, image and anchor together instead of the issue lead', () => {
  for (const locale of ['ko', 'en']) {
    const { entry, brief } = sample(locale);
    const before = JSON.stringify(entry);
    const cards = archive.cardEntries([entry], { topic: 'ai' }, locale);
    assert.equal(cards.length, 1);
    const html = archive.renderArchiveCard(cards[0], { locale, rootPath: locale === 'en' ? '../' : '' });
    assert.match(html, /Tool B<\/h3>/);
    assert.match(html, /b\.jpg" alt="Tool B image"/);
    assert.ok(html.includes(brief.items[1].href));
    assert.doesNotMatch(html, /Proposal A|#article-a|총 2건|2 articles/);
    assert.equal(JSON.stringify(entry), before);
    assert.equal(archive.cardEntries([entry], { topic: 'all' }, locale)[0], entry);
  }
});

test('a topic emits every matching article with distinct identities even when headlines repeat', () => {
  const { entry, brief } = sample();
  brief.items[0].tags = ['AI'];
  brief.items[0].headline = brief.items[1].headline;
  const cards = archive.cardEntries([entry], { topic: 'ai' });
  assert.equal(cards.length, 2);
  assert.notEqual(cards[0].display_article_id, cards[1].display_article_id);
  assert.match(archive.renderArchiveCard(cards[0]), /#article-a/);
  assert.match(archive.renderArchiveCard(cards[1]), /#article-b/);
});

test('missing or malformed weekly article data cannot substitute an unrelated lead card for a topic', () => {
  const { entry } = sample();
  delete entry.reader_brief;
  assert.deepEqual(archive.cardEntries([entry], { topic: 'ai' }), []);
  assert.equal(archive.renderArchiveCard({ ...entry, display_article_id: 'javascript:wrong' }), '');
});

test('untranslated article topic results retain their Korean identity and explicit language label', () => {
  const { entry } = sample();
  const cards = archive.cardEntries([entry], { topic: 'ai' }, 'en');
  const html = archive.renderArchiveCard(cards[0], { locale: 'en', rootPath: '../' });
  assert.match(html, /Korean only/);
  assert.match(html, /href="\.\.\/newsletters\/2026-W42\/index.html#article-b"/);
  assert.match(html, /<h3[^>]*lang="ko"[^>]*>Tool B/);
});
