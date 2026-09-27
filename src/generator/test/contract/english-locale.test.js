const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { applyTranslation, translationSourceHash } = require('../../render/apply-translation');
const { buildHtml, buildMarkdown } = require('../../render/newsletter-renderer');
const { validateRenderedIssueStructure } = require('../../quality/rendered-issue-structure');
const { validateEnglishEntry, hasLongKoreanProse } = require('../../validate/english-locale');
const { buildSitemap } = require('../../render/seo-metadata');
const { languagePaths } = require('../../../../articles/assets/js/site-header');
const { renderArchiveCard } = require('../../../../articles/assets/js/newsletter-archive');
const { writeEnglishEditions } = require('../../render/english-edition');
const { tempRoot, writeText, writeJson, readJson } = require('../../../shared/test/helpers/fs');

// Synthetic display/overlay inputs, not publication-quality golden artifacts.
function sample() {
  const source = { title: 'Android Developers', url: 'https://developer.android.com/media/camera' };
  const issue = {
    weekly_key: '2026-W39', date: '2026-09-21', title: '주간 소식', summary: '카메라 변경 사항을 정리합니다.',
    briefing: ['카메라 변경'], tags: ['Camera HAL'], references: [source], watch_points: ['호환성을 확인합니다.'],
    reference_articles: [{ id: 'ref', title: '추가 문서', note: '관련 문서입니다.', source: 'Android Developers', url: source.url, published_date: '2026-09-21' }],
    sections: [{
      id: 'camera', headline: '카메라 변경', category: 'Camera', tags: ['Camera HAL'],
      selectedImage: '../../assets/images/fallback/newsletter-default.svg',
      resolvedImage: { url: '../../assets/images/fallback/newsletter-default.svg', usedFallback: true },
      sources: [source],
      public_article: { headline: '카메라 변경', lead: '카메라 호환성을 살펴봅니다.', body_paragraphs: ['검증 범위를 확인합니다.'], camera_hal_takeaway: '버퍼 동작을 확인합니다.', source_links: [source] }
    }]
  };
  const translation = {
    schemaVersion: 1, weekly_key: issue.weekly_key, source_hash: translationSourceHash(issue),
    title: 'Weekly camera news', summary: 'Camera compatibility changes for engineers.',
    sections: [{ id: 'camera', headline: 'Camera changes', lead: 'Review camera compatibility.', body_markdown: 'Check the documented validation scope.', why_it_matters: 'Validate buffer behavior against the documented contract.' }],
    watch_points: ['Watch compatibility results.'], reference_articles: [{ id: 'ref', title: 'Further documentation', note: 'Related documentation.' }]
  };
  return { issue, translation };
}

test('English overlay preserves identity, evidence, images and the untouched source', () => {
  const { issue, translation } = sample();
  const before = structuredClone(issue);
  const result = applyTranslation(issue, translation);
  assert.deepEqual(issue, before);
  assert.equal(result.sections[0].id, issue.sections[0].id);
  for (const field of ['sources', 'selectedImage', 'resolvedImage', 'tags']) assert.deepEqual(result.sections[0][field], issue.sections[0][field]);
  assert.deepEqual(result.sections[0].public_article.source_links, issue.sections[0].public_article.source_links);
  assert.equal(result.reference_articles[0].url, issue.reference_articles[0].url);
  assert.deepEqual(result.briefing, ['Camera changes']);
});

test('overlay rejects stale hashes, missing prose, mismatched IDs/counts and immutable field injection', () => {
  const { issue, translation } = sample();
  for (const mutate of [
    t => { t.source_hash = 'sha256:stale'; },
    t => { t.sections = []; },
    t => { t.sections[0].id = 'unknown'; },
    t => { delete t.sections[0].lead; },
    t => { t.sections[0].selectedImage = 'https://example.com/other.jpg'; },
    t => { t.sections[0].sources = []; },
    t => { t.reference_articles[0].url = 'https://example.com/other'; },
    t => { delete t.reference_articles[0].note; },
    t => { t.watch_points = []; }
  ]) {
    const invalid = structuredClone(translation);
    mutate(invalid);
    assert.throws(() => applyTranslation(issue, invalid));
  }
});

test('overlay binds to the exact source file bytes when provided', () => {
  const { issue, translation } = sample();
  const sourceText = JSON.stringify(issue, null, 2) + '\n';
  translation.source_hash = translationSourceHash(sourceText);
  assert.doesNotThrow(() => applyTranslation(issue, translation, { sourceText }));
  assert.throws(() => applyTranslation(issue, translation), /source_hash/);
});

test('overlay rejects absent weekly identity, null IDs and non-string optional prose', () => {
  for (const change of [
    (issue, translation) => { delete issue.weekly_key; delete translation.weekly_key; },
    (issue, translation) => { issue.sections[0].id = null; translation.sections[0].id = null; },
    (issue, translation) => { translation.sections[0].source_subtitle = { invalid: true }; }
  ]) {
    const { issue, translation } = sample();
    change(issue, translation);
    translation.source_hash = translationSourceHash(issue);
    assert.throws(() => applyTranslation(issue, translation));
  }
});

test('English HTML and Markdown retain structure, source links and resolved images', () => {
  const { issue, translation } = sample();
  const english = applyTranslation(issue, translation);
  const html = buildHtml(english, { locale: 'en' });
  const markdown = buildMarkdown(english, { locale: 'en' });
  const result = validateRenderedIssueStructure({ date: issue.weekly_key, html, markdown, editor: english, validateDataIndex: false, briefingBulletCount: null });
  assert.deepEqual(result.errors, []);
  assert.match(html, /<html lang="en"/);
  assert.match(html, /content="en_US"/);
  assert.match(html, /href="\.\.\/\.\.\/\.\.\/en\/index.html"/);
  assert.match(html, /href="\.\.\/\.\.\/\.\.\/css\/styles.css"/);
  assert.doesNotMatch(html, /[가-힣]/);
  assert.doesNotMatch(markdown, /[가-힣]/);
  const externalLinks = value => [...value.matchAll(/<a\b[^>]*href="(https:[^"]+)"/g)].map(match => match[1]).sort();
  assert.deepEqual(externalLinks(html), externalLinks(buildHtml(issue)));
  const images = (value, url) => [...value.matchAll(/<img\b[^>]*src="([^"]+)"/g)].map(match => new URL(match[1], url).href);
  assert.deepEqual(images(html, 'https://example.com/en/newsletters/2026-W39/index.html'), images(buildHtml(issue), 'https://example.com/newsletters/2026-W39/index.html'));
  assert.equal((html.match(/class="article-title"/g) || []).length, issue.sections.length);
});

test('rendering locale is isolated and Korean remains the default', () => {
  const { issue, translation } = sample();
  const before = buildHtml(issue);
  buildHtml(applyTranslation(issue, translation), { locale: 'en' });
  assert.equal(buildHtml(issue), before);
  assert.equal(buildHtml(issue, { locale: 'ko' }), before);
  assert.throws(() => buildHtml(issue, { locale: 'unknown' }), /Unsupported locale/);
  for (const language of ['ko', 'en', 'x-default']) assert.ok(before.includes(`hreflang="${language}"`));
});

test('story v2 translation renders body headings and requires translated subtitle prose', () => {
  const { issue, translation } = sample();
  issue.story_contract_version = 2;
  const article = issue.sections[0].public_article;
  article.story_contract_version = 2;
  article.body_markdown = '한국어 본문입니다.';
  article.source_subtitle = '공개 문서에 기반한 설명입니다.';
  article.editorial_story = { not_to_overclaim: '과장하지 않습니다.', editor_take: '검증합니다.' };
  translation.source_hash = translationSourceHash(issue);
  assert.throws(() => applyTranslation(issue, translation), /source_subtitle/);
  translation.sections[0].source_subtitle = 'Based on public documentation.';
  translation.sections[0].body_markdown = 'Compatibility context.\n\n### Buffer behavior\n\nInspect the documented behavior.';
  const english = applyTranslation(issue, translation);
  const html = buildHtml(english, { locale: 'en' });
  assert.match(html, /<h3 class="article-subheading">Buffer behavior<\/h3>/);
  assert.doesNotMatch(html, /[가-힣]/);
});

test('overlay ignores translation array order and rejects duplicate section IDs', () => {
  const { issue, translation } = sample();
  issue.sections.push({ ...structuredClone(issue.sections[0]), id: 'second' });
  translation.sections.unshift({ ...translation.sections[0], id: 'second', headline: 'Second article' });
  translation.source_hash = translationSourceHash(issue);
  assert.deepEqual(applyTranslation(issue, translation).sections.map(section => section.id), ['camera', 'second']);
  translation.sections[0].id = 'camera';
  assert.throws(() => applyTranslation(issue, translation), /duplicate/);
});

test('public renderer has no Korean UI literals outside comments', () => {
  const code = fs.readFileSync(path.join(__dirname, '../../render/newsletter-renderer.js'), 'utf8').split('\n').filter(line => !line.trimStart().startsWith('//')).join('\n');
  assert.doesNotMatch(code, /[가-힣]/);
});

test('English archive links translated issues and marks untranslated issues with their Korean title', () => {
  const item = { weeklyKey: '2026-W39', title: '한국어 제목', summary: '한국어 요약', html: 'newsletters/2026-W39/index.html' };
  const fallback = renderArchiveCard(item, { locale: 'en', rootPath: '../' });
  assert.match(fallback, /Korean only/);
  assert.match(fallback, /한국어 제목/);
  assert.doesNotMatch(fallback, /한국어 요약/);
  assert.match(fallback, /href="\.\.\/newsletters\/2026-W39\/index.html"/);
  item.en = { title: 'English title', summary: 'English headline', html: `en/${item.html}` };
  const translated = renderArchiveCard(item, { locale: 'en', rootPath: '../' });
  assert.match(translated, /English headline/);
  assert.match(translated, /href="\.\.\/en\/newsletters\/2026-W39\/index.html"/);
  assert.doesNotMatch(translated, /Korean only|[가-힣]/);
  item.en.html = 'https://example.com/injected';
  assert.doesNotMatch(renderArchiveCard(item, { locale: 'en' }), /injected/);
});

test('language navigation respects project deployment paths and historical fallback', () => {
  const basePath = '/camera-hal-sw-newsletter/';
  assert.equal(languagePaths({ basePath, pathname: `${basePath}archive.html` }).en, `${basePath}en/archive.html`);
  assert.equal(languagePaths({ basePath, pathname: `${basePath}en/index.html` }).ko, `${basePath}index.html`);
  assert.equal(languagePaths({ basePath, pathname: `${basePath}newsletters/2026-W39/index.html` }).en, `${basePath}en/newsletters/2026-W39/index.html`);
  assert.equal(languagePaths({ basePath, pathname: `${basePath}newsletters/2026-05-05/index.html` }).en, `${basePath}en/archive.html`);
  assert.equal(languagePaths({ basePath, pathname: `${basePath}newsletters/2026-W39/index.html`, alternateHref: `${basePath}en/newsletters/2026-W39/index.html` }).en, `${basePath}en/newsletters/2026-W39/index.html`);
});

test('optional en data is validated only when present and sitemap includes translated issues', t => {
  const root = tempRoot();
  const item = { weeklyKey: '2026-W39', html: 'newsletters/2026-W39/index.html' };
  assert.deepEqual(validateEnglishEntry(item, root), []);
  item.en = { title: 'Weekly news', summary: 'Camera updates', html: `en/${item.html}`, md: 'en/newsletters/2026-W39/newsletter.md' };
  assert.ok(validateEnglishEntry(item, root).some(error => error.includes('Missing English artifact')));
  const { issue, translation } = sample();
  const english = applyTranslation(issue, translation);
  writeText(path.join(root, 'articles', item.en.html), buildHtml({ ...english, sections: english.sections.map(section => ({ ...section, selectedImage: null, resolvedImage: null })) }, { locale: 'en' }));
  writeText(path.join(root, 'articles', item.en.md), buildMarkdown(english, { locale: 'en' }));
  assert.ok(validateEnglishEntry(item, root).some(error => error.includes('Missing translation overlay')));
  const sourceText = `${JSON.stringify(issue, null, 2)}\n`;
  writeText(path.join(root, 'articles', 'newsletters', '2026-W39', 'issue.json'), sourceText);
  writeJson(path.join(root, 'articles', 'newsletters', '2026-W39', 'translation.en.json'), { ...translation, source_hash: translationSourceHash(sourceText) });
  assert.deepEqual(validateEnglishEntry(item, root), []);
  writeText(path.join(root, 'articles', 'newsletters', '2026-W39', 'issue.json'), sourceText.replace('카메라 변경', '다른 변경'));
  assert.ok(validateEnglishEntry(item, root).some(error => error.includes('does not apply to issue.json')));
  writeText(path.join(root, 'articles', 'newsletters', '2026-W39', 'issue.json'), sourceText);
  assert.ok(buildSitemap([item]).includes(item.en.html));
  writeJson(path.join(root, 'articles', 'data', 'newsletters-weekly.json'), [{ ...item, date: issue.date }]);
  const dated = { date: issue.date, html: `newsletters/${issue.date}/index.html`, en: item.en };
  assert.deepEqual(validateEnglishEntry(dated, root), []);
  assert.ok(validateEnglishEntry({ ...dated, date: '2026-09-14' }, root).some(error => error.includes('expected en/')));
  assert.equal(hasLongKoreanProse('한국어'), false);
  assert.equal(hasLongKoreanProse('번역되지 않은 긴 한국어 문장이 영문 페이지에 남아 있으면 검증에서 거부합니다.'), true);
  item.en.html = '../../outside.html';
  assert.ok(validateEnglishEntry(item, root).some(error => error.includes('expected en/')));
});

// 발행된 issue.json의 기사·참고 기사에는 id가 없다. 그 형태를 그대로 쓴다.
function publishedShapeSample() {
  const { issue, translation } = sample();
  delete issue.sections[0].id;
  delete issue.reference_articles[0].id;
  issue.sections[0].category = '주간 다이제스트';
  issue.sections[0].imageAlt = '카메라 변경 이미지';
  issue.sections[0].sources = [{ title: '한국어로 적힌 출처 제목', url: 'https://developer.android.com/media/camera' }];
  issue.sections[0].public_article.source_links = structuredClone(issue.sections[0].sources);
  translation.sections[0].id = 'url:https://developer.android.com/media/camera';
  translation.reference_articles[0].id = issue.reference_articles[0].url;
  translation.sections[0].image_alt = 'Camera change image';
  translation.sections[0].source_titles = { 'https://developer.android.com/media/camera': 'Source title in English' };
  translation.source_hash = translationSourceHash(issue);
  return { issue, translation };
}

test('overlay keys id-less published sections by article identity and references by URL', () => {
  const { issue, translation } = publishedShapeSample();
  const english = applyTranslation(issue, translation);
  assert.equal(english.sections[0].imageAlt, 'Camera change image');
  assert.equal(english.sections[0].sources[0].title, 'Source title in English');
  assert.equal(english.sections[0].public_article.source_links[0].title, 'Source title in English');
  assert.equal(english.sections[0].sources[0].url, issue.sections[0].sources[0].url);
  assert.equal(english.reference_articles[0].title, 'Further documentation');
  const html = buildHtml({ ...english, sections: english.sections.map(section => ({ ...section, selectedImage: null, resolvedImage: null })) }, { locale: 'en' });
  assert.doesNotMatch(html, /[가-힣]/);
  for (const mutate of [
    t => { t.sections[0].source_titles = { 'https://example.com/unknown': 'Unknown' }; },
    t => { t.sections[0].image_alt = ''; },
    t => { t.sections[0].id = 'camera'; }
  ]) {
    const invalid = structuredClone(translation);
    mutate(invalid);
    assert.throws(() => applyTranslation(issue, invalid));
  }
});

test('English edition writer renders from committed issue.json and records the en index entry', () => {
  const root = tempRoot();
  const { issue, translation } = publishedShapeSample();
  const sourceText = `${JSON.stringify(issue, null, 2)}
`;
  translation.source_hash = translationSourceHash(sourceText);
  writeText(path.join(root, 'articles', 'newsletters', '2026-W39', 'issue.json'), sourceText);
  writeJson(path.join(root, 'articles', 'newsletters', '2026-W39', 'translation.en.json'), translation);
  writeJson(path.join(root, 'articles', 'data', 'newsletters-weekly.json'), [{ weeklyKey: '2026-W39', date: issue.date, title: '2026 W39', html: 'newsletters/2026-W39/index.html' }]);
  writeEnglishEditions(root, ['2026-W39']);
  const [entry] = readJson(path.join(root, 'articles', 'data', 'newsletters-weekly.json'));
  assert.deepEqual(entry.en, { title: '2026 W39', summary: 'Camera changes', html: 'en/newsletters/2026-W39/index.html', md: 'en/newsletters/2026-W39/newsletter.md' });
  assert.equal(entry.title, '2026 W39');
  assert.match(fs.readFileSync(path.join(root, 'articles', 'en', 'newsletters', '2026-W39', 'index.html'), 'utf8'), /<html lang="en"/);
  assert.ok(fs.readFileSync(path.join(root, 'articles', 'sitemap.xml'), 'utf8').includes('en/newsletters/2026-W39/index.html'));
  fs.writeFileSync(path.join(root, 'articles', 'newsletters', '2026-W39', 'issue.json'), sourceText.replace('카메라 변경', '다른 변경'));
  assert.throws(() => writeEnglishEditions(root, ['2026-W39']), /source_hash/);
});

// 영문 홈은 한국어 홈(index.html)과 같은 구조다: 헤드라인 블록, 전체 목록, 정렬·주제 필터.
// 인라인 스크립트를 최소 DOM에서 실행해 실제 동작을 확인한다.
async function renderEnglishHome({ headline, newsletters, translation }) {
  const html = fs.readFileSync(path.join(__dirname, '../../../../articles/en/index.html'), 'utf8');
  const script = [...html.matchAll(/<script\b[^>]*>\s*([\s\S]*?)\s*<\/script>/gi)].map(match => match[1]).find(body => /async function loadHomepageHeadline\b/.test(body));
  assert.ok(script, 'en/index.html should include the homepage script');
  const element = () => ({ innerHTML: '', hidden: false, value: 'latest', classList: { add() {} }, addEventListener() {} });
  const elements = { 'featured-card': element(), 'latest-grid': element(), 'latest-topics': element(), 'latest-sort': element(), 'latest-empty': element() };
  const fetched = [];
  const context = {
    window: { NewsletterArchive: require('../../../../articles/assets/js/newsletter-archive') },
    document: { getElementById: id => elements[id] },
    console: { error() {} },
    fetch: async url => {
      fetched.push(url);
      const body = { '../data/homepage-headline.json': headline, '../data/newsletters-weekly.json': newsletters, '../newsletters/2026-W39/translation.en.json': translation }[url];
      return body ? { ok: true, json: async () => body } : { ok: false, status: 404 };
    }
  };
  require('node:vm').runInNewContext(script.replace(/loadHomepageHeadline\(\);\s*\n\s*loadNewsletters\(\);\s*$/, 'globalThis.__ready = Promise.all([loadHomepageHeadline(), loadNewsletters()]);'), context);
  await context.__ready;
  return { elements, fetched };
}

function englishHomeFixture() {
  const key = 'url:https://github.com/openai/codex/releases/tag/rust-v0.155.1';
  const headline = { current_headline: { article_identity_key: key, title: '한국어 헤드라인', summary: '한국어 요약입니다.', source_url: 'https://github.com/openai/codex/releases/tag/rust-v0.155.1', newsletter_date: '2026-09-21', image_url: 'https://example.com/codex.png', image_alt: 'Codex image', snapshot: { source_name: 'Codex Releases' } } };
  const newsletters = [
    { weeklyKey: '2026-W39', date: '2026-09-21', weekStartDate: '2026-09-21', weekEndDate: '2026-09-27', title: '2026 W39', summary: '한국어 기사 제목', html: 'newsletters/2026-W39/index.html', tags: ['AI'], article_count: 1, en: { title: '2026 W39', summary: 'Codex released', html: 'en/newsletters/2026-W39/index.html', md: 'en/newsletters/2026-W39/newsletter.md' } },
    { weeklyKey: '2026-W38', date: '2026-09-14', title: '2026 W38', summary: '번역 없는 호', html: 'newsletters/2026-W38/index.html', tags: ['Driver'], article_count: 4 }
  ];
  const translation = { sections: [{ id: key, headline: 'Codex released', lead: 'The Codex CLI release changes defaults.', body_markdown: 'Body.', why_it_matters: 'Check.' }] };
  return { headline, newsletters, translation };
}

test('English home mirrors the Korean home with the translated headline and every issue', async () => {
  const { elements, fetched } = await renderEnglishHome(englishHomeFixture());
  const hero = elements['featured-card'].innerHTML;
  assert.match(hero, /<h1 id="featured-title" class="featured-title">Codex released<\/h1>/);
  assert.match(hero, /The Codex CLI release changes defaults\./);
  assert.match(hero, /href="\.\.\/en\/newsletters\/2026-W39\/index\.html">Read article →/);
  assert.match(hero, /alt="Codex image"/);
  assert.doesNotMatch(hero, /[가-힣]/);
  assert.ok(fetched.includes('../newsletters/2026-W39/translation.en.json'));
  const grid = elements['latest-grid'].innerHTML;
  assert.match(grid, /href="\.\.\/en\/newsletters\/2026-W39\/index\.html"/);
  assert.match(grid, /1 article</);
  assert.match(grid, /Korean only/);
  assert.match(grid, /href="\.\.\/newsletters\/2026-W38\/index\.html"/);
  assert.match(elements['latest-topics'].innerHTML, />All</);
});

test('English home keeps the static hero when the headline issue has no English edition', async () => {
  const fixture = englishHomeFixture();
  delete fixture.newsletters[0].en;
  assert.equal((await renderEnglishHome(fixture)).elements['featured-card'].innerHTML, '');
  const missing = englishHomeFixture();
  missing.translation = null;
  assert.equal((await renderEnglishHome(missing)).elements['featured-card'].innerHTML, '');
  const other = englishHomeFixture();
  other.translation.sections[0].id = 'url:https://example.com/other';
  assert.equal((await renderEnglishHome(other)).elements['featured-card'].innerHTML, '');
});

test('English home hero alt never leaks the Korean title and stays empty for fallback art', async () => {
  const noAlt = englishHomeFixture();
  delete noAlt.headline.current_headline.image_alt;
  const hero = (await renderEnglishHome(noAlt)).elements['featured-card'].innerHTML;
  assert.match(hero, /alt="Codex released"/);
  assert.doesNotMatch(hero, /[가-힣]/);
  const koreanAlt = englishHomeFixture();
  koreanAlt.headline.current_headline.image_alt = '한국어 이미지 설명';
  assert.match((await renderEnglishHome(koreanAlt)).elements['featured-card'].innerHTML, /alt="Codex released"/);
  const fallback = englishHomeFixture();
  fallback.headline.current_headline.image_url = 'assets/images/fallback/newsletter-default.svg';
  const fallbackHero = (await renderEnglishHome(fallback)).elements['featured-card'].innerHTML;
  assert.match(fallbackHero, /src="\.\.\/assets\/images\/fallback\/newsletter-default\.svg" alt=""/);
});
