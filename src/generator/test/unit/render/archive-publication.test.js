'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { hash, snapshot, preservation, preserveAnchors, recoverDaily, legacyWeeklyView, publishedSourceLists, validatePublishedProjection } = require('../../../render/archive-publication');
const { buildHtml, buildMarkdown } = require('../../../render/newsletter-renderer');
const { translationSourceHash } = require('../../../render/apply-translation');
const { migrate, planPage, applyPlans } = require('../../../publish/migrate-public-newsletters');
const { mainArticleBlocks, validateRenderedIssueStructure } = require('../../../quality/rendered-issue-structure');

// Synthetic preservation inputs, never publication PASS/golden fixtures.
function issue() {
  return { date: '2026-05-04', weekly_key: '2026-W19', title: 'Synthetic Camera issue', summary: 'An unmerged proposal with limited scope.',
    sections: [1, 2].map(id => ({ id: `source-${id}`, relevance_bucket: 'direct_aosp_camera',
      selectedImage: '../../assets/images/fallback/android.svg', imageAlt: `Original image ${id}`,
      public_article: { headline: `Camera proposal ${id}`, lead: `The proposal ${id} has not merged.`,
        body_paragraphs: ['Only board A is supported.', 'No performance measurement is available.'],
        camera_hal_takeaway: 'Observe the review before considering adoption.',
        source_links: [{ title: 'Official review', url: `https://example.com/review/${id}` }] } })),
    references: [{ title: 'Background', url: 'https://example.com/background' }] };
}

function sandbox(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'newsletter-archive-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text, 'utf8'); };
  const source = issue();
  const sourceText = `${JSON.stringify(source, null, 2)}\n`;
  const dir = 'articles/newsletters/2026-W19';
  put(`${dir}/issue.json`, sourceText);
  put(`${dir}/index.html`, buildHtml(source).replace('id="issue-briefing"', 'id="old-contents"'));
  put(`${dir}/newsletter.md`, buildMarkdown(source));
  const overlay = { schemaVersion: 1, weekly_key: source.weekly_key, source_hash: translationSourceHash(sourceText), title: 'English synthetic',
    summary: 'An unmerged proposal with limited scope.', watch_points: [], reference_articles: [],
    sections: source.sections.map(section => ({ id: section.id, headline: section.public_article.headline, lead: section.public_article.lead,
      body_markdown: section.public_article.body_paragraphs.join('\n\n'), why_it_matters: section.public_article.camera_hal_takeaway })) };
  put(`${dir}/translation.en.json`, JSON.stringify(overlay));
  put('articles/en/newsletters/2026-W19/index.html', buildHtml(source, { locale: 'en' }));
  put('articles/en/newsletters/2026-W19/newsletter.md', buildMarkdown(source, { locale: 'en' }));
  put('articles/data/newsletters-weekly.json', JSON.stringify([{ weeklyKey: source.weekly_key, date: source.date }]));
  put('articles/data/newsletters.json', '[]\n');
  const state = () => Object.fromEntries(fs.readdirSync(root, { recursive: true }).filter(file => fs.statSync(path.join(root, file)).isFile())
    .map(file => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
  const plan = locale => planPage(root, { key: '2026-W19', locale,
    file: `articles/${locale === 'en' ? 'en/' : ''}newsletters/2026-W19/index.html` });
  return { root, put, state, plan, dir, sourceText };
}

test('preservation blocks removed article prose, source binding, image alt, captions, IDs, and local links', () => {
  const html = buildHtml(issue());
  for (const changed of [html.replace('Only board A is supported.', 'All boards are supported.'),
    html.replace('https://example.com/review/1', 'https://example.com/review/2'),
    html.replace('Original image 1', 'Other article image'),
    html.replace('id="issue-briefing"', 'id="gone"'), html.replace('href="#issue-briefing"', 'href="#missing"')]) {
    assert.equal(preservation(html, changed).ok, false);
  }
  assert.equal(preservation(html, html).ok, true);
});

test('obsolete navigation and article aliases remain stable at their corresponding landing target', () => {
  const current = buildHtml(issue());
  const old = current.replaceAll('article-camera-proposal-1', 'shared-old-anchor').replace('id="issue-briefing"', 'id="old-contents"');
  const migrated = preserveAnchors(old, current);
  assert.equal(preservation(old, migrated).ok, true);
  assert.match(migrated, /id="shared-old-anchor" data-legacy-target="article-camera-proposal-1"/);
  assert.equal(preserveAnchors(migrated, current), migrated);
  assert.equal(new Set(snapshot(migrated).ids).size, snapshot(migrated).ids.length);
});

test('daily recovery preserves date, public blocks, headings, media, source links, and original hashes without stamping story v2', () => {
  const daily = issue(); delete daily.weekly_key;
  let html = buildHtml(daily);
  html = html.replace('<p>Only board A is supported.</p>', '<h3 class="article-subheading">Board limits</h3><p>Only board A is supported.</p>');
  const md = buildMarkdown(daily);
  const archive = recoverDaily(html, md, { htmlPath: 'public/index.html', markdownPath: 'public/newsletter.md', date: daily.date });
  assert.equal(archive.issue.weekly_key, undefined);
  assert.equal(archive.issue.public_contract_version, undefined);
  assert.equal(archive.provenance[0].hash, hash(html));
  const rendered = buildHtml(archive.issue, { archive });
  assert.match(rendered, /이 호의 핵심/);
  assert.match(rendered, /<h3 class="article-subheading">Board limits<\/h3>/);
  assert.doesNotMatch(rendered, /hreflang="en"|data-alternate-href=/);
  assert.equal(preservation(html, preserveAnchors(html, rendered)).ok, true);
});

test('unsupported daily rich text cannot silently become plain paragraphs', () => {
  const daily = issue(); delete daily.weekly_key;
  const html = buildHtml(daily).replace('<p>Only board A is supported.</p>', '<pre><code>keep_this_code()</code></pre>');
  assert.throws(() => recoverDaily(html, buildMarkdown(daily), { date: daily.date }), /rich article markup/);
});

test('legacy weekly headings and lists render semantically without rewriting stored public prose', () => {
  const original = issue();
  original.sections[0].public_article.body_paragraphs = ['### Board support', 'Only board A is supported.', '**Review limits**', '- Keep proposal status.'];
  original.sections[0].public_article.lead = original.sections[0].public_article.headline;
  original.sections[0].public_article.camera_hal_takeaway = original.sections[0].public_article.headline;
  const before = JSON.stringify(original);
  const archive = legacyWeeklyView(original);
  const html = buildHtml(original, { archive });
  assert.match(html, /<h3 class="article-subheading">Board support<\/h3>/);
  assert.match(html, /<ul><li>Keep proposal status\.<\/li><\/ul>/);
  assert.match(html, /<p>Only board A is supported\.<\/p>/);
  assert.match(html, /이번 주 핵심/);
  assert.equal(JSON.stringify(original), before);
  assert.equal(preservation(buildHtml(original), preserveAnchors(buildHtml(original), html)).ok, true);
});

test('daily highlights remain navigation and missing entries or broken targets still fail structure validation', () => {
  const daily = issue(); delete daily.weekly_key;
  const archive = recoverDaily(buildHtml(daily), buildMarkdown(daily), { date: daily.date });
  const md = buildMarkdown(archive.issue, { archive });
  const html = buildHtml(archive.issue, { archive });
  assert.equal(mainArticleBlocks(md).length, daily.sections.length);
  const check = markdown => validateRenderedIssueStructure({ date: daily.date, markdown, html, validateDataIndex: false });
  assert.equal(check(md).ok, true);
  assert.ok(check(md.replace(/^- \[Camera proposal 1\].*$/m, '')).errors.some(error => error.includes('briefing bullets')));
  assert.ok(check(md.replace('](#article-camera-proposal-1)', '](#missing)')).errors.some(error => error.includes('preserved article anchors')));
});

test('dry-run performs no source writes; explicit paired write is idempotent and preserves issue/overlay/index bytes', t => {
  const box = sandbox(t);
  const before = box.state();
  const overlayPath = path.join(box.root, box.dir, 'translation.en.json');
  const overlayBefore = fs.readFileSync(overlayPath, 'utf8');
  const plans = ['ko', 'en'].map(box.plan);
  assert.ok(plans.every(plan => plan.status === 'ready'));
  assert.ok(plans.some(plan => plan.outputs.some(file => file.before !== file.after)));
  assert.deepEqual(box.state(), before);
  assert.equal(applyPlans(box.root, plans), true);
  const second = ['ko', 'en'].map(box.plan);
  assert.ok(second.every(plan => plan.outputs.every(file => file.before === file.after)));
  assert.equal(fs.readFileSync(path.join(box.root, box.dir, 'issue.json'), 'utf8'), box.sourceText);
  assert.equal(fs.readFileSync(overlayPath, 'utf8'), overlayBefore);
  assert.ok(Object.entries(box.state()).filter(([file, content]) => before[file] !== content).every(([file]) => /[\\/](index.html|newsletter.md)$/.test(file)));
});

test('stale English overlay blocks the whole batch before Korean files change', t => {
  const box = sandbox(t);
  const overlayFile = `${box.dir}/translation.en.json`;
  const overlay = JSON.parse(fs.readFileSync(path.join(box.root, overlayFile), 'utf8'));
  overlay.source_hash = translationSourceHash('stale');
  box.put(overlayFile, JSON.stringify(overlay));
  const before = box.state();
  assert.throws(() => box.plan('en'), /Stale translation source_hash/);
  assert.equal(applyPlans(box.root, [box.plan('ko'), { status: 'blocked' }]), false);
  assert.deepEqual(box.state(), before);
});

test('Markdown-only code or checklist is a blocking loss even if HTML renders identically', t => {
  const box = sandbox(t);
  const file = `${box.dir}/newsletter.md`;
  box.put(file, fs.readFileSync(path.join(box.root, file), 'utf8') + '\n```cpp\nkeep_this_example();\n```\n');
  const result = planPage(box.root, { key: '2026-W19', locale: 'ko', file: `${box.dir}/index.html` });
  assert.equal(result.status, 'blocked');
  assert.ok(result.markdownDelta.removed.some(text => text.includes('keep_this_example')));
});

test('a later filesystem failure restores earlier page writes and removes newly created projection files', t => {
  const box = sandbox(t);
  const plans = ['ko', 'en'].map(box.plan);
  const created = `${box.dir}/publication-source.json`;
  plans[0].outputs.unshift({ path: created, before: null, after: '{}\n' });
  plans[1].outputs.push({ path: box.dir, before: '', after: 'cannot overwrite directory' });
  const before = box.state();
  assert.throws(() => applyPlans(box.root, plans));
  assert.deepEqual(box.state(), before);
});

test('write requires explicit selection; traversal and unsupported locale are rejected', () => {
  assert.throws(() => migrate({ write: true }), /explicit/);
  assert.throws(() => migrate({ keys: ['../../outside'] }), /Invalid issue/);
  assert.throws(() => migrate({ keys: ['2026-W19'], locales: ['fr'] }), /Invalid locale/);
});

test('archival source lists preserve link groupings and do not invent missing patch-series URLs', () => {
  const source = issue();
  source.sections[0].public_article.source_links = [{ title: 'Original patch title', url: 'https://lore.kernel.org/linux-media/20260501-camera-v1-1-abcdef123456@example.org/' }];
  source.references = source.sections[0].public_article.source_links;
  const html = buildHtml(source).replace(/ — <a href="[^"]+\/T\/#t">전체 패치 시리즈<\/a>/g, '');
  const archive = { sourceLists: publishedSourceLists(html) };
  const next = buildHtml(source, { archive });
  assert.equal(preservation(html, next).ok, true);
  assert.doesNotMatch(next, /\/T\/#t/);
  assert.doesNotMatch(buildMarkdown(source, { archive }), /\/T\/#t/);
  assert.match(buildMarkdown(source), /\/T\/#t/);
});

test('daily reference groups and publication boundaries retain original date strings, text and all URLs', () => {
  const daily = issue(); delete daily.weekly_key;
  const notice = '<div class="publication-notice" role="note"><p>Tooling Watch Edition</p>\n<p>Reference only; no adoption claim.</p></div>';
  const reading = '<section class="section issue-reference-articles"><h2 id="issue-reference-articles-title">참고 / 더 읽을거리</h2>\n<ul><li><a href="https://example.com/reference">Reference</a> — Source (July 01, 2026) · Limited scope</li><li>Camera changes: <a href="https://example.com/a">Review A</a> (2026-07) · <a href="https://example.com/b">Review B</a> (2026-07)</li></ul></section>';
  const readingMd = '## 참고 / 더 읽을거리\n\n- [Reference](<https://example.com/reference>) — Source (July 01, 2026) · Limited scope\n- Camera changes: [Review A](<https://example.com/a>) (2026-07) · [Review B](<https://example.com/b>) (2026-07)\n\n';
  const html = buildHtml(daily).replace('<article class="wrap issue-wrap">', `<article class="wrap issue-wrap">${notice}`)
    .replace('<section class="section issue-references"', `${reading}\n<section class="section issue-references"`);
  const markdown = buildMarkdown(daily).replace('## 참고자료', `${readingMd}## 참고자료`);
  const archive = recoverDaily(html, markdown, { date: daily.date });
  const next = preserveAnchors(html, buildHtml(archive.issue, { archive }));
  assert.equal(preservation(html, next).ok, true);
  assert.ok(buildMarkdown(archive.issue, { archive }).includes(readingMd));
  assert.match(next, /July 01, 2026/);
  assert.match(next, /\(2026-07\)/);
  assert.equal(archive.issue.publication_mode, undefined);
  assert.equal(archive.issue.review_publication_ready, undefined);
  assert.deepEqual(archive.noticeLines, ['Tooling Watch Edition', 'Reference only; no adoption claim.']);
  assert.equal(archive.reading[0].items[1].filter(token => token.type === 'link').length, 2);
});

test('same-article Markdown-only checklists and paragraphs become visible without replacing HTML prose', () => {
  const daily = issue(); delete daily.weekly_key;
  const html = buildHtml(daily);
  const addition = 'This extra public paragraph remains tentative.\n\n### 확인할 점\n\n- Keep proposal status.\n- Inspect `dumpsys media.camera` only on board A.\n\n';
  const markdown = buildMarkdown(daily).replace('**출처**', `${addition}**출처**`);
  const archive = recoverDaily(html, markdown, { date: daily.date });
  const nextHtml = buildHtml(archive.issue, { archive }), nextMd = buildMarkdown(archive.issue, { archive });
  assert.equal(preservation(html, preserveAnchors(html, nextHtml)).ok, true);
  assert.match(nextHtml, /<code>dumpsys media.camera<\/code>/);
  assert.match(nextHtml, /This extra public paragraph remains tentative/);
  assert.match(nextMd, /- Keep proposal status\.\n- Inspect `dumpsys media.camera` only on board A\./);
  assert.ok(archive.articles[0].blocks.some(block => block.origin === 'published-markdown'));
  assert.ok(!archive.articles[1].blocks.some(block => block.origin === 'published-markdown'));
  assert.equal(validatePublishedProjection(archive, daily.date), archive);
});

test('published Markdown identity mismatches and unsupported rich supplements still block recovery', () => {
  const daily = issue(); delete daily.weekly_key;
  const html = buildHtml(daily), markdown = buildMarkdown(daily);
  assert.throws(() => recoverDaily(html, markdown.replace('## 2. Camera proposal 1', '## 2. Other article'), { date: daily.date }), /identity mismatch/);
  assert.throws(() => recoverDaily(html, markdown.replace('## 3. Camera proposal 2', '### Camera proposal 2'), { date: daily.date }), /article count mismatch/);
  assert.throws(() => recoverDaily(html, markdown.replace('**출처**', '```cpp\nkeep_example();\n```\n\n**출처**'), { date: daily.date }), /Unsupported Markdown-only block/);
  assert.throws(() => recoverDaily(html.replace('https://example.com/review/1', 'javascript:wrong()'), markdown, { date: daily.date }), /link protocol|Incomplete published article/);
});

test('catch-up Markdown labels survive without inventing an exact age or weekly identity', () => {
  const daily = issue(); delete daily.weekly_key;
  const markdown = buildMarkdown(daily).replace('## 3. Camera proposal 2', '## 지난 소식 (Catch-up)\n\n## 3. Camera proposal 2 (5주 전 릴리스)');
  const archive = recoverDaily(buildHtml(daily), markdown, { date: daily.date });
  const output = buildMarkdown(archive.issue, { archive });
  assert.match(output, /## 지난 소식 \(Catch-up\)/);
  assert.match(output, /## 3\. Camera proposal 2 \(5주 전 릴리스\)/);
  assert.equal(archive.issue.sections[1].catch_up_age_days, undefined);
  assert.equal(archive.issue.weekly_key, undefined);
});

test('cached projection validation rejects unsafe inline links and cross-article source lists', () => {
  const daily = issue(); delete daily.weekly_key;
  const original = recoverDaily(buildHtml(daily), buildMarkdown(daily), { date: daily.date });
  const unsafe = structuredClone(original);
  unsafe.sourceLists.articles[0][0][0].url = 'javascript:wrong()';
  assert.throws(() => validatePublishedProjection(unsafe, daily.date), /Invalid published projection/);
  const missing = structuredClone(original); missing.sourceLists.articles.pop();
  assert.throws(() => validatePublishedProjection(missing, daily.date), /Invalid published projection/);
  const wrong = structuredClone(original); wrong.articles[0].markdownHeading = '## 2. Other article';
  assert.throws(() => validatePublishedProjection(wrong, daily.date), /Invalid published projection/);
});
