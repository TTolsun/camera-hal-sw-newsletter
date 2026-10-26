'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { tempRoot, writeJson, writeText, readJson } = require('../../../shared/test/helpers/fs');
const { translationInput, translationSchema, normalizeTranslationResponse } = require('../../translate/translation-schema');
const { translationChecks } = require('../../translate/translation-checks');
const { parseArgs, readTarget, selectTarget, translateIssue, translateNewsletter } = require('../../translate/translate-newsletter');
const { invalidateTranslation, translationArtifactPaths } = require('../../render/translation-state');
const { validateTranslationParity } = require('../../validate/validate-translation-parity');
const { buildHtml, buildMarkdown } = require('../../render/newsletter-renderer');
const { translationSourceHash } = require('../../render/apply-translation');
const { readRuntimeConfig } = require('../../../shared/common/runtime-config');
const { configuredModelsForGroup } = require('../../../shared/llm/model-policy');
const { retentionCommitPlan } = require('../../publish/review-artifact-inventory');

function sample(t) {
  const root = tempRoot('translation-pipeline-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const key = '2026-W39';
  const source = { title: 'Camera patch', url: 'https://example.com/camera' };
  const issue = {
    weekly_key: key, date: '2026-09-21', title: '주간 소식', summary: '카메라 소식입니다.',
    tags: ['Camera HAL'], briefing: ['카메라 패치'], watch_points: ['머지 여부를 확인합니다.'],
    references: [source], reference_articles: [{ title: '참고 문서', url: source.url, note: '확인이 필요합니다.' }],
    sections: [{
      headline: 'IPU6 패치 제안', category: 'Camera', tags: ['Camera HAL'], imageAlt: '카메라 이미지',
      selectedImage: '../../assets/images/fallback/newsletter-default.svg',
      resolvedImage: { url: '../../assets/images/fallback/newsletter-default.svg', usedFallback: true },
      sources: [source], public_article: {
        headline: 'IPU6 패치 제안', lead: 'IPU6 패치를 제안합니다.',
        body_markdown: 'IPU6 rust-v0.155.1에서 `camera_open`을 변경하는 [패치](https://example.com/camera)를 제안합니다.',
        camera_hal_takeaway: 'IPU6 동작을 확인하세요.', source_links: [source]
      }
    }]
  };
  writeJson(path.join(root, 'articles/newsletters', key, 'issue.json'), issue);
  writeJson(path.join(root, 'articles/data/newsletters-weekly.json'), [{ weeklyKey: key, date: issue.date, html: `newsletters/${key}/index.html` }]);
  writeJson(path.join(root, 'articles/data/newsletters.json'), [{ date: issue.date }]);
  const target = readTarget(root, key);
  const overlay = translationInput(issue, target.sourceText);
  Object.assign(overlay, { title: 'Weekly camera news', summary: 'Camera changes.', watch_points: ['Watch for merge status.'] });
  Object.assign(overlay.sections[0], {
    headline: 'Proposed IPU6 patch', lead: 'A patch is proposed for IPU6.',
    body_markdown: 'A [patch](https://example.com/camera) proposes changing `camera_open` in IPU6 rust-v0.155.1.',
    why_it_matters: 'Check IPU6 behavior.', image_alt: 'Camera image'
  });
  Object.assign(overlay.reference_articles[0], { title: 'Further documentation', note: 'Review is needed.' });
  return { root, key, target, overlay };
}

test('translate has its own model group, environment override and flash-lite fallback', () => {
  assert.deepEqual(configuredModelsForGroup(readRuntimeConfig({}), 'translate'), ['gemini-2.5-flash', 'gemini-2.5-flash-lite']);
  assert.equal(readRuntimeConfig({ NEWSROOM_TRANSLATE_MODEL: 'manual-model' }).llmStageModels.translate, 'manual-model');
});

test('projection uses published URL identities and excludes evidence/media metadata', t => {
  const { target, overlay } = sample(t);
  const input = translationInput(target.issue, target.sourceText);
  assert.match(input.sections[0].id, /^url:/);
  assert.equal(input.reference_articles[0].id, 'https://example.com/camera');
  assert.equal(input.sections[0].selectedImage, undefined);
  assert.equal(input.sections[0].sources, undefined);
  assert.ok(translationSchema(input).properties.sections.items.properties.image_alt);
  assert.deepEqual(translationChecks(target.issue, overlay, target.sourceText).checks, { ids: true, urls: true, english: true, tokens: true });
});

test('checks reject short Korean, URL drift, token loss, metadata and byte hash drift', t => {
  const { target, overlay } = sample(t);
  for (const mutate of [
    value => { value.title = '짧음'; },
    value => { value.sections[0].image_alt = '카메라'; },
    value => { value.sections[0].body_markdown = value.sections[0].body_markdown.replace('example.com', 'wrong.com'); },
    value => { value.sections[0].body_markdown = value.sections[0].body_markdown.replace('rust-v0.155.1', 'rust-v0.155.2'); },
    value => { value.sections[0].body_markdown = value.sections[0].body_markdown.replace('IPU6', 'processor'); },
    value => { value.sections[0].body_markdown = value.sections[0].body_markdown.replace('IPU6', 'IPU60'); },
    value => { value.sections[0].body_markdown += '[link](https://example.com/camera)한글'; },
    value => { value.sections[0].body_markdown = value.sections[0].body_markdown.replace('camera_open', 'camera_close'); },
    value => { value.sections[0].selectedImage = 'https://example.com/replaced.png'; },
    value => { value.source_hash = translationSourceHash(target.sourceText.trim()); }
  ]) {
    const invalid = structuredClone(overlay);
    mutate(invalid);
    assert.throws(() => translationChecks(target.issue, invalid, target.sourceText));
  }
});

test('checks reject reordered section IDs even though overlay application restores order', t => {
  const { target, overlay } = sample(t);
  const issue = structuredClone(target.issue);
  issue.sections[0].id = 'first';
  issue.sections.push({ ...structuredClone(issue.sections[0]), id: 'second' });
  const sourceText = JSON.stringify(issue);
  const translation = structuredClone(overlay);
  translation.source_hash = translationSourceHash(sourceText);
  translation.sections = [{ ...overlay.sections[0], id: 'second' }, { ...overlay.sections[0], id: 'first' }];
  assert.throws(() => translationChecks(issue, translation, sourceText), /ID order/);
});

test('mixed optional prose is schema-required and only source-absent nulls can be omitted', t => {
  const { target, overlay } = sample(t);
  const input = translationInput(target.issue, target.sourceText);
  input.sections.push({ ...input.sections[0], id: 'second' });
  delete input.sections[1].image_alt;
  const schema = translationSchema(input);
  assert.ok(schema.properties.sections.items.required.includes('image_alt'));
  assert.equal(schema.properties.sections.items.properties.image_alt.nullable, true);
  assert.ok(schema.properties.sections.items.required.includes('source_titles'));
  assert.ok(schema.properties.reference_articles.items.required.includes('note'));
  const response = structuredClone(overlay);
  response.sections[0].image_alt = null;
  response.sections.push({ ...response.sections[0], id: 'second', image_alt: null });
  const normalized = normalizeTranslationResponse(response, input);
  assert.equal(normalized.sections[0].image_alt, null, 'a missing required translation is not silently repaired');
  assert.equal(Object.hasOwn(normalized.sections[1], 'image_alt'), false);
  assert.throws(() => translationChecks(target.issue, { ...normalized, sections: normalized.sections.slice(0, 1) }, target.sourceText), /Missing translation/);
});

test('one failed response is retried once with check feedback and stage telemetry identity', async t => {
  const { target, overlay } = sample(t);
  let calls = 0;
  const result = await translateIssue(target, { call: async (run, system, prompt) => {
    assert.equal(run.definition.modelGroup, 'translate');
    assert.match(system, /unmerged/);
    assert.match(system, /plain English in headline, lead, and camera_hal_takeaway/);
    assert.match(system, /support conditions, exceptions, uncertainty/);
    const { readableProsePrompt } = require('../../reporter/readable-prose-prompt');
    assert.ok(system.includes(readableProsePrompt()));
    assert.match(system, /full English body/);
    assert.match(system, /must not summarize away details/);
    calls++;
    assert.equal(run.qualityAttempt, calls);
    if (calls === 1) return { ...overlay, title: '오류' };
    assert.match(prompt, /Korean text remains/);
    return overlay;
  } });
  assert.equal(calls, 2);
  assert.deepEqual(result.overlay, overlay);
});

test('two invalid responses write no public artifacts or index changes', async t => {
  const { root, target, overlay } = sample(t);
  const before = fs.readFileSync(path.join(root, 'articles/data/newsletters-weekly.json'), 'utf8');
  let calls = 0;
  await assert.rejects(translateNewsletter(root, target, { call: async () => { calls++; return { ...overlay, title: '오류' }; } }), /two attempts/);
  assert.equal(calls, 2);
  assert.equal(fs.readFileSync(path.join(root, 'articles/data/newsletters-weekly.json'), 'utf8'), before);
  assert.equal(fs.existsSync(path.join(target.dir, 'translation.en.json')), false);
});

test('CLI writes both matching English entries and parity passes without touching Korean output', async t => {
  const { root, key, target, overlay } = sample(t);
  const korean = buildHtml(target.issue);
  writeText(path.join(target.dir, 'index.html'), korean);
  writeText(path.join(target.dir, 'newsletter.md'), buildMarkdown(target.issue));
  const result = await translateNewsletter(root, target, { call: async () => overlay });
  assert.match(result.body, /IPU6 패치 제안.*Proposed IPU6 patch/);
  const weekly = readJson(path.join(root, 'articles/data/newsletters-weekly.json'))[0];
  const dated = readJson(path.join(root, 'articles/data/newsletters.json'))[0];
  assert.deepEqual(dated.en, weekly.en);
  assert.equal(weekly.en.html, `en/newsletters/${key}/index.html`);
  assert.equal(weekly.en.reader_brief.locale, 'en');
  assert.equal(weekly.en.reader_brief.intro, overlay.summary);
  assert.equal(weekly.en.reader_brief.items[0].headline, overlay.sections[0].headline);
  assert.equal(fs.readFileSync(path.join(target.dir, 'index.html'), 'utf8'), korean);
  assert.equal(fs.readFileSync(target.sourcePath, 'utf8'), target.sourceText);
  assert.deepEqual(validateTranslationParity(root).errors, []);
  assert.equal(selectTarget(root), null);
  assert.equal(selectTarget(root, { force: true }).key, key);
  const htmlPath = path.join(root, 'articles', weekly.en.html);
  fs.appendFileSync(htmlPath, '<a href="https://example.com/injected">Extra source</a>');
  assert.match(validateTranslationParity(root).errors.join('\n'), /link mismatch/);
});

test('Korean corrections invalidate stale indexes, backing files and sitemap before retranslation', async t => {
  const { root, key, target, overlay } = sample(t);
  await translateNewsletter(root, target, { call: async () => overlay });
  assert.deepEqual(invalidateTranslation(root, key, target.sourceText), []);
  const corrected = target.sourceText + '\n';
  fs.writeFileSync(target.sourcePath, corrected);
  assert.match(validateTranslationParity(root).errors.join('\n'), /source_hash/);
  const removed = invalidateTranslation(root, key, corrected);
  for (const file of translationArtifactPaths(key)) {
    assert.ok(removed.includes(file));
    assert.equal(fs.existsSync(path.join(root, file)), false);
  }
  assert.equal(readJson(path.join(root, 'articles/data/newsletters.json'))[0].en, undefined);
  assert.equal(readJson(path.join(root, 'articles/data/newsletters-weekly.json'))[0].en, undefined);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'articles/sitemap.xml'), 'utf8'), /en\/newsletters\/2026-W39/);
  assert.deepEqual(validateTranslationParity(root), { errors: [], untranslated: [key] });
  assert.equal(selectTarget(root).key, key);
});

test('auto never backfills older untranslated issues and explicit missing input fails', t => {
  const { root, key, target, overlay } = sample(t);
  writeJson(path.join(target.dir, 'translation.en.json'), overlay);
  writeJson(path.join(root, 'articles/data/newsletters-weekly.json'), [
    { weeklyKey: '2026-W01' }, { weeklyKey: key, en: { html: `en/newsletters/${key}/index.html` } }
  ]);
  assert.equal(selectTarget(root), null);
  assert.throws(() => selectTarget(root, { weeklyKey: '2026-W01' }), /Missing translation source issue.json/);
  assert.throws(() => parseArgs(['--weekly-key', '../../secret']), /Invalid weekly key/);
  assert.throws(() => parseArgs(['--auto', '--weekly-key', key]), /Use --auto or/);
});

test('Korean publication allowlist carries tracked translation deletions but diagnostics-only excludes them', async t => {
  const { root, key, target, overlay } = sample(t);
  await translateNewsletter(root, target, { call: async () => overlay });
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  execFileSync('git', ['add', 'articles'], { cwd: root, stdio: 'pipe' });
  invalidateTranslation(root, key, target.sourceText + '\n');
  const options = { root, date: target.issue.date };
  const paths = retentionCommitPlan(options).paths;
  for (const file of translationArtifactPaths(key)) assert.ok(paths.includes(file), file);
  writeJson(path.join(root, 'articles/content/newsroom', target.issue.date, 'generation-status.json'), { public_output_expected: false });
  const diagnostic = retentionCommitPlan(options).paths;
  for (const file of translationArtifactPaths(key)) assert.ok(!diagnostic.includes(file), file);
});

function storySample(t) {
  const root = tempRoot('translation-story-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const key = '2026-W39';
  const urls = ['https://lore.kernel.org/linux-media/example/', 'https://lore.kernel.org/linux-media/example-2/'];
  const storySection = url => ({
    headline: 'HM1246 패치', category: 'Camera', tags: ['Camera HAL'], imageAlt: '카메라 이미지',
    selectedImage: '../../assets/images/fallback/newsletter-default.svg',
    resolvedImage: { url: '../../assets/images/fallback/newsletter-default.svg', usedFallback: true },
    sources: [{ title: 'linux-media', url }], public_article: {
      headline: 'HM1246 패치가 v10까지 온 이유', lead: '무엇이 걸렸는지 봅니다.',
      body_markdown: ['HM1246 드라이버 패치가 v10까지 왔습니다.', '### 리뷰 지점', 'v4l2_subdev_format 협상 경로가 걸렸습니다.'].join('\n\n'),
      camera_hal_takeaway: '포맷 협상 경로를 확인합니다.', reader_checkpoints: ['대표 기기에서 확인합니다.'],
      source_links: [{ title: 'linux-media', url }], story_contract_version: 2, source_subtitle: 'linux-media · 2026-08-10',
      editorial_story: { not_to_overclaim: '확대하지 않습니다.', editor_take: '범위 안에서만 봅니다.' },
      decision_metadata: { impact: 'Medium', scope: ['HAL'], action: ['Watch'], overclaim_risk: 'Low' }
    }
  });
  const issue = {
    weekly_key: key, date: '2026-09-21', title: '주간 소식', summary: '카메라 소식입니다.',
    public_contract_version: 'story-v2', generation_contract_version: 2,
    tags: ['Camera HAL'], briefing: ['카메라 패치'], watch_points: [],
    references: urls.map(url => ({ title: 'linux-media', url })), reference_articles: [],
    sections: urls.map(storySection)
  };
  writeJson(path.join(root, 'articles/newsletters', key, 'issue.json'), issue);
  const target = readTarget(root, key);
  const overlay = translationInput(issue, target.sourceText);
  Object.assign(overlay, { title: 'Weekly camera news', summary: 'Camera changes.' });
  overlay.sections.forEach((section, index) => Object.assign(section, {
    headline: 'Why the HM1246 patch reached v10', lead: 'What held it up.',
    body_markdown: ['The HM1246 driver patch has reached v10.', '### Review point', 'The v4l2_subdev_format negotiation path held it up.'].join('\n\n'),
    why_it_matters: 'Check the format negotiation path.', source_subtitle: 'linux-media · 2026-08-10',
    image_alt: 'Camera image', source_titles: { [urls[index]]: 'linux-media' }
  }));
  return { target, overlay };
}

function withBacktickedBody(overlay) {
  const sections = overlay.sections.map(section => ({
    ...section, body_markdown: section.body_markdown.replace('v4l2_subdev_format', '`v4l2_subdev_format`')
  }));
  return { ...overlay, sections };
}

test('checks reject public article contract violations that the translation added', t => {
  // 2026-10-26 W44: 프롬프트가 금지해도 LLM이 식별자에 백틱을 붙였고, 워크플로 최종 검증에서야 실패했다.
  const { target, overlay } = storySample(t);
  assert.deepEqual(translationChecks(target.issue, overlay, target.sourceText).checks, { ids: true, urls: true, english: true, tokens: true });
  assert.throws(() => translationChecks(target.issue, withBacktickedBody(overlay), target.sourceText),
    /Public article contract violation in translation: sections\[0\] body_markdown_forbidden_construct body_markdown inline_code block \d+; sections\[1\] body_markdown_forbidden_construct body_markdown inline_code block \d+/);
});

test('a contract violation is retried with its feedback before anything is written', async t => {
  const { target, overlay } = storySample(t);
  let calls = 0;
  const result = await translateIssue(target, { call: async (run, system, prompt) => {
    calls++;
    if (calls === 1) return withBacktickedBody(overlay);
    // 재시도는 한 번뿐이라 위반한 기사 전부가 피드백에 실려야 한다.
    assert.match(prompt, /sections\[0\][^;]*inline_code[^;]*; sections\[1\][^;]*inline_code/);
    return overlay;
  } });
  assert.equal(calls, 2);
  assert.deepEqual(result.overlay, overlay);
  // 검사가 원본 issue를 바꾸면 2차 시도가 원문 바이트와 어긋난다.
  assert.equal(JSON.stringify(target.issue), JSON.stringify(JSON.parse(target.sourceText)));
});
