const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const { articleDisplayRows } = require('../../../render/article-display');
const { buildHtml, buildMarkdown } = require('../../../render/newsletter-renderer');
const { mainArticleBlocks } = require('../../../quality/rendered-issue-structure');

function issue(count = 2) {
  return {
    weekly_key: '2026-W42', date: '2026-10-12', title: 'Weekly issue',
    summary: 'Source-backed introduction.', briefing: ['Existing title list'], references: [],
    sections: Array.from({ length: count }, (_, index) => ({
      id: `sample-${index}`, headline: 'Internal title', relevance_bucket: 'android',
      selectedImage: index ? 'https://example.com/source.jpg' : '../../assets/images/fallback/ai.svg',
      imageAlt: 'Source diagram', imageSource: 'https://example.com/source',
      public_article: {
        headline: 'Camera <sample> & proposal', lead: 'Public change remains a proposal.',
        camera_hal_takeaway: 'The public application conditions remain unconfirmed.',
        body_paragraphs: ['Detailed evidence paragraph one.', 'Detailed limitations paragraph two.'],
        reader_checkpoints: ['INTERNAL QA'],
        source_links: [{ title: 'Original source', url: 'https://example.com/source', source_role: 'primary' }]
      }
    }))
  };
}

// Contract-input UI tests are deliberately independent of #1276's implementation.
function withSyntheticBuilder(fn, transform = value => value) {
  const load = Module._load;
  const mocked = test.mock.method(Module, '_load', function(request, parent, ...rest) {
    if (request === './reader-brief' && parent.filename.endsWith('newsletter-renderer.js')) {
      return { buildReaderBrief: (draft, options) => transform({
        schema_version: 1, locale: options.locale, intro: draft.summary,
        items: articleDisplayRows(draft, options)
      }) };
    }
    return load.call(this, request, parent, ...rest);
  });
  try { fn(); } finally { mocked.mock.restore(); }
}

test('weekly highlights copy only public prose and put the introduction in one place', () => {
  withSyntheticBuilder(() => {
    const draft = issue();
    const html = buildHtml(draft);
    const md = buildMarkdown(draft);
    assert.match(html, /id="issue-briefing-title">이번 주 핵심/);
    assert.match(md, /## 1\. 이번 주 핵심/);
    assert.equal((html.match(/>Source-backed introduction\.</g) || []).length, 1);
    assert.equal((md.match(/Source-backed introduction\./g) || []).length, 1);
    assert.match(html, /Camera &lt;sample&gt; &amp; proposal/);
    assert.doesNotMatch(html, /<sample>|INTERNAL QA|Internal title/);
    assert.doesNotMatch(md, /INTERNAL QA|Internal title/);
    assert.equal(mainArticleBlocks(md).length, 2);
    assert.deepEqual(draft.briefing, ['Existing title list']);
  });
});

test('lead and practical meaning precede images and detail in HTML and Markdown', () => {
  const draft = issue(1);
  delete draft.weekly_key;
  const html = buildHtml(draft).split('tabindex="-1" aria-labelledby="article-')[1];
  const md = mainArticleBlocks(buildMarkdown(draft))[0].text;
  for (const output of [html, md]) {
    assert.ok(output.indexOf('Public change remains') < output.indexOf('public application conditions'));
    assert.ok(output.indexOf('public application conditions') < output.indexOf('assets/images/fallback/ai.svg'));
    assert.ok(output.indexOf('assets/images/fallback/ai.svg') < output.indexOf('Detailed evidence'));
    assert.ok(output.indexOf('Detailed limitations') < output.indexOf('Original source'));
  }
  assert.match(html, /class="article-media article-media-decoration" aria-hidden="true"/);
  assert.match(html, /alt="Source diagram"/);
  assert.doesNotMatch(html, /article-image-caption/);
});

test('highlights replace contents and all navigation reaches focusable anchors in both locales', () => {
  withSyntheticBuilder(() => {
    for (const locale of ['ko', 'en']) {
      const html = buildHtml(issue(3), { locale });
      const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
      assert.equal(new Set(ids).size, ids.length);
      for (const match of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(match[1]), match[1]);
      assert.equal((html.match(/class="article-navigation"/g) || []).length, 3);
      assert.equal((html.match(/aria-label="(?:이전 기사|Previous article):/g) || []).length, 2);
      assert.equal((html.match(/aria-label="(?:다음 기사|Next article):/g) || []).length, 2);
      assert.match(html, /id="issue-briefing" tabindex="-1"/);
      assert.doesNotMatch(html, /class="issue-contents"/);
      assert.match(html, /<details class="reader-brief-context"><summary>/);
      assert.doesNotMatch(html, /<details[^>]*\bopen/);
      assert.ok(html.indexOf('reader-brief-items') < html.indexOf('reader-brief-context'));
      assert.match(html, /class="skip-link" href="#main-content"/);
      assert.match(html, /<main id="main-content" tabindex="-1"/);
      const md = buildMarkdown(issue(3), { locale });
      assert.match(md, /<a id="issue-briefing"><\/a>/);
      assert.doesNotMatch(md, /#issue-contents|## (?:목차|Contents)|Existing title list/);
      const label = locale === 'ko' ? '이번 주 핵심으로' : 'Back to this week’s highlights';
      assert.equal(html.split(`href="#issue-briefing">${label}`).length - 1, 3);
      assert.equal(md.split(`[${label}](#issue-briefing)`).length - 1, 3);
      assert.match(html, /id="article-camera-sample-proposal-2" tabindex="-1"/);
      assert.match(html, /Source diagram/);
      assert.match(html, /article-image-caption/);
      if (locale === 'en') assert.doesNotMatch(html, /목차|다음 기사|이번 주 핵심/);
    }
  });
});

test('single article and missing fields produce no empty box or fabricated media', () => {
  withSyntheticBuilder(() => {
    const draft = issue(1);
    delete draft.sections[0].selectedImage;
    delete draft.sections[0].public_article.lead;
    delete draft.sections[0].public_article.camera_hal_takeaway;
    const html = buildHtml(draft);
    assert.doesNotMatch(html, /class="article-lead"|class="article-block camera-hal-takeaway"|article-placeholder-visual|class="article-media|aria-label="이전 기사:|aria-label="다음 기사:/);
    assert.match(html, /Detailed evidence paragraph one/);
    assert.match(html, /Original source/);
  });
});

// 기사가 1건이면 "이번 주 핵심" 상자가 본문 첫머리를 그대로 반복하므로 넣지 않는다(#1278 소유자 결정).
// 이번 호 소개는 제목 아래에 한 번 두고, 돌아갈 곳이 없으니 기사 끝 이동 링크도 두지 않는다.
test('single article issues skip the highlights box and keep the introduction once', () => {
  withSyntheticBuilder(() => {
    for (const locale of ['ko', 'en']) {
      const draft = issue(1);
      const html = buildHtml(draft, { locale });
      const md = buildMarkdown(draft, { locale });
      assert.doesNotMatch(html, /class="section issue-briefing"|id="issue-briefing"|reader-brief-items|class="article-navigation"/);
      // Markdown은 기사 번호와 구조 검사를 위해 ## 1. 섹션을 남기되 제목 링크만 둔다.
      assert.doesNotMatch(md, /issue-briefing/);
      assert.match(md, /## 1\. [^\n]+\n\n- \[Camera <sample> & proposal\]\(#[^)]+\)\n/);
      assert.match(html, /<p class="subtitle">Source-backed introduction\.<\/p>/);
      // <head>의 description 메타는 화면에 보이지 않으므로 본문만 센다.
      const body = html.slice(html.indexOf('<body'));
      assert.equal((body.match(/Source-backed introduction\./g) || []).length, 1);
      assert.equal((md.match(/Source-backed introduction\./g) || []).length, 1);
      for (const sentence of ['Public change remains a proposal.', 'The public application conditions remain unconfirmed.']) {
        assert.equal(body.split(sentence).length - 1, 1, `${locale} html repeats: ${sentence}`);
        assert.equal(md.split(sentence).length - 1, 1, `${locale} markdown repeats: ${sentence}`);
      }
    }
    // 상자를 빼는 것은 정확히 1건일 때뿐이다. 0건인 호는 예전처럼 상자를 둔다.
    const empty = buildHtml(issue(0));
    assert.match(empty, /class="section issue-briefing"/);
    assert.doesNotMatch(empty, /<p class="subtitle">/);
  });
});

test('legacy repeated headline summaries are displayed once without rewriting public fields', () => {
  withSyntheticBuilder(() => {
    const draft = issue(1);
    const article = draft.sections[0].public_article;
    article.headline = article.lead = article.camera_hal_takeaway = 'Legacy headline';
    const before = JSON.stringify(draft);
    const html = buildHtml(draft);
    assert.doesNotMatch(html, /class="article-lead"|class="article-block camera-hal-takeaway"|class="reader-brief-takeaway"/);
    assert.match(html, /Detailed evidence paragraph one/);
    assert.doesNotMatch(html, /<details>|issue-contents-title/);
    assert.equal(JSON.stringify(draft), before);
  });
});

test('unknown or malformed projection is diagnosed and returns to the legacy summary', () => {
  const warning = test.mock.method(console, 'warn', () => {});
  try {
    for (const transform of [brief => ({ ...brief, schema_version: 99 }), brief => ({ ...brief, items: null }), brief => ({ ...brief, items: [{ ...brief.items[0], href: 'javascript:alert(1)' }] })]) {
      withSyntheticBuilder(() => {
        const html = buildHtml(issue(1));
        assert.match(html, /Existing title list/);
        assert.match(html, /class="subtitle">Source-backed introduction/);
        assert.doesNotMatch(html, /javascript:/);
        assert.match(html, /id="issue-contents" tabindex="-1"/);
        assert.match(html, /href="#issue-contents">목차로 돌아가기/);
      }, transform);
    }
    assert.equal(warning.mock.callCount(), 3);
  } finally { warning.mock.restore(); }
});

test('actual projection builder and renderer share final article identity, prose and anchors', () => {
  const { buildReaderBrief } = require('../../../render/reader-brief');
  for (const locale of ['ko', 'en']) {
    const draft = issue();
    const brief = buildReaderBrief(draft, { locale, issueHref: `${locale === 'en' ? 'en/' : ''}newsletters/2026-W42/index.html` });
    const html = buildHtml(draft, { locale });
    for (const item of brief.items) {
      assert.ok(html.includes(`id="${item.href.split('#')[1]}"`));
      assert.ok(html.includes(item.lead));
      assert.ok(html.includes(item.takeaway));
    }
    assert.equal(mainArticleBlocks(buildMarkdown(draft, { locale })).length, brief.items.length);
  }
});


test('future weekly issues reuse the shared reading surface in both locales', () => {
  // 상자는 기사가 2건 이상인 호에만 있다(단일 기사 호는 위 테스트가 다룬다).
  const draft = issue(2);
  draft.weekly_key = '2027-W02';
  draft.date = '2027-01-11';
  for (const locale of ['ko', 'en']) {
    const html = buildHtml(draft, { locale });
    assert.match(html, /css\/styles\.css/);
    assert.match(html, /class="wrap issue-wrap"/);
    assert.match(html, /class="skip-link"/);
    assert.match(html, /class="reader-brief-items"/);
    assert.match(html, /<details class="reader-brief-context">/);
    assert.doesNotMatch(html, /class="issue-contents"|2026-W42/);
    assert.ok(html.indexOf('reader-brief-items') < html.indexOf('reader-brief-context'));
  }
});
