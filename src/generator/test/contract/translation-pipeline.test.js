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
const { weeklyRenderInputIssues } = require('../../validate/validate-public-newsletter');
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
    assert.match(prompt, /Translate all Korean text in title into English/);
    assert.doesNotMatch(prompt, /Korean text remains|translation\./);
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

function storySample(t, tweak = () => {}) {
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
  tweak(issue);
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

// 백틱은 정규화가 걷어 내므로 재시도 경로는 정규화가 못 고치는 위반(인용 블록)으로 시험한다.
function withBlockquoteBody(overlay) {
  const sections = overlay.sections.map(section => ({ ...section, body_markdown: `> ${section.body_markdown}` }));
  return { ...overlay, sections };
}

test('checks reject public article contract violations that the translation added', t => {
  // 2026-10-26 W44: 프롬프트가 금지해도 LLM이 식별자에 백틱을 붙였고, 워크플로 최종 검증에서야 실패했다.
  const { target, overlay } = storySample(t);
  assert.deepEqual(translationChecks(target.issue, overlay, target.sourceText).checks, { ids: true, urls: true, english: true, tokens: true });
  assert.throws(() => translationChecks(target.issue, withBacktickedBody(overlay), target.sourceText),
    /Public article contract violation in translation: sections\[0\] body_markdown_forbidden_construct body_markdown inline_code block \d+; Public article contract violation in translation: sections\[1\] body_markdown_forbidden_construct body_markdown inline_code block \d+/);
});

test('a contract violation is retried with its feedback before anything is written', async t => {
  const { target, overlay } = storySample(t);
  let calls = 0;
  const result = await translateIssue(target, { call: async (run, system, prompt) => {
    calls++;
    if (calls === 1) return withBlockquoteBody(overlay);
    // 재시도는 한 번뿐이라 위반한 기사 전부가 코드명 없는 문장으로 피드백에 실려야 한다.
    const { previous_check_error: feedback } = JSON.parse(prompt);
    assert.equal(feedback.split('\n').length, 2);
    assert.match(feedback, /Remove the blockquote formatting from body_markdown/);
    assert.doesNotMatch(feedback, /body_markdown_forbidden_construct|public_article_leakage|Public article contract/);
    return overlay;
  } });
  assert.equal(calls, 2);
  assert.deepEqual(result.overlay, overlay);
  // 검사가 원본 issue를 바꾸면 2차 시도가 원문 바이트와 어긋난다.
  assert.equal(JSON.stringify(target.issue), JSON.stringify(JSON.parse(target.sourceText)));
});

test('backticks the model added to a source without backticks are stripped before checks, so no retry is spent', async t => {
  // 2026-W47: 모델이 식별자와 코드 펜스를 덧붙였다. 서식일 뿐이므로 안의 텍스트만 남긴다.
  const { target, overlay } = storySample(t);
  const response = withBacktickedBody(overlay);
  response.sections[0].body_markdown = `\`\`\`c\n${response.sections[0].body_markdown}\n\`\`\``;
  response.sections[1].headline = 'Why `HM1246` reached v10';
  const input = translationInput(target.issue, target.sourceText);
  const normalized = normalizeTranslationResponse(response, input);
  assert.deepEqual(normalized.sections.map(section => section.body_markdown), overlay.sections.map(section => section.body_markdown));
  assert.equal(normalized.sections[1].headline, 'Why HM1246 reached v10');
  assert.equal(response.sections[1].body_markdown.includes('`'), true, 'input response is not mutated');
  let calls = 0;
  const result = await translateIssue(target, { call: async () => { calls++; return response; } });
  assert.equal(calls, 1);
  assert.equal(result.overlay.sections[1].headline, 'Why HM1246 reached v10');
});

test('backticks are preserved in fields whose Korean source already had them', t => {
  const { target, overlay } = sample(t);
  const input = translationInput(target.issue, target.sourceText);
  assert.ok(input.sections[0].body_markdown.includes('`camera_open`'));
  const response = { ...overlay, title: 'Weekly `camera` news' };
  const normalized = normalizeTranslationResponse(response, input);
  assert.equal(normalized.sections[0].body_markdown, overlay.sections[0].body_markdown);
  assert.equal(normalized.title, 'Weekly camera news');
  assert.deepEqual(translationChecks(target.issue, normalized, target.sourceText).checks, { ids: true, urls: true, english: true, tokens: true });
});

test('stripping backticks never hides a missing protected token', async t => {
  const { target, overlay } = storySample(t);
  const response = withBacktickedBody(overlay);
  response.sections[0].body_markdown = response.sections[0].body_markdown.replace('v4l2_subdev_format', 'format');
  await assert.rejects(translateIssue(target, { call: async () => response }), /Missing protected token v4l2_subdev_format: translation\.sections\[0\]\.body_markdown/);
});

// 아래 시험은 한국어 원문을 일부 바꿔 쓴다. 번역문은 storySample의 영어 문장에 덧붙인다.
function withKoreanSource(tweak) {
  return issue => tweak(issue.sections.map(section => section.public_article));
}

test('translated technical terms are allowed when the Korean source uses their counterpart', t => {
  // 2026-W47: 폴백 -> fallback, 검사기 -> validators를 파이프라인 내부 용어 누출로 오판해 번역이 두 번 실패했다.
  const { target, overlay } = storySample(t, withKoreanSource(([first, second]) => {
    first.headline = 'SurfaceControl 및 TextureView 폴백';
    second.body_markdown += '\n\n프레임워크 내부에서는 검사기들을 거쳐 안전성을 확인합니다.';
  }));
  overlay.sections[0].headline = 'SurfaceControl and TextureView fallback';
  overlay.sections[1].body_markdown += '\n\nInternally, the framework ensures safety by passing through validators that pre-verify.';
  assert.deepEqual(translationChecks(target.issue, overlay, target.sourceText).checks, { ids: true, urls: true, english: true, tokens: true });
});

test('translated leak terms without a Korean counterpart in the source stay blocked', t => {
  const { target, overlay } = storySample(t);
  const fallback = structuredClone(overlay);
  fallback.sections[0].headline = 'SurfaceControl fallback';
  assert.throws(() => translationChecks(target.issue, fallback, target.sourceText), /sections\[0\][^;]*public_article_leakage headline[^;]*Fallback/);
  const validator = structuredClone(overlay);
  validator.sections[1].body_markdown += '\n\nInternally, validators pre-verify the request.';
  assert.throws(() => translationChecks(target.issue, validator, target.sourceText), /sections\[1\][^;]*public_article_leakage body_markdown[^;]*validator/);
});

test('pipeline-only terms stay blocked even when the Korean source has a technical counterpart', t => {
  const { target, overlay } = storySample(t, withKoreanSource(([first]) => { first.body_markdown += '\n\n폴백 경로와 검사기를 확인합니다.'; }));
  overlay.sections[0].body_markdown += '\n\nThe fallback path and validators are checked.';
  assert.doesNotThrow(() => translationChecks(target.issue, overlay, target.sourceText));
  for (const term of ['publish gate', 'Review-only']) {
    const invalid = structuredClone(overlay);
    invalid.sections[0].body_markdown += `\n\nThe ${term} decides it.`;
    assert.throws(() => translationChecks(target.issue, invalid, target.sourceText), new RegExp(`sections\\[0\\][^;]*public_article_leakage body_markdown[^;]*${term}`, 'i'));
  }
});

test('a failed article alone is retranslated and the passing article stays as translated', async t => {
  const { target, overlay } = storySample(t);
  const first = structuredClone(overlay);
  first.sections[1].body_markdown = first.sections[1].body_markdown.replace('v4l2_subdev_format', 'format');
  const prompts = [];
  const result = await translateIssue(target, { call: async (run, system, prompt) => {
    prompts.push(JSON.parse(prompt));
    if (prompts.length === 1) return first;
    // 모델이 통과한 기사까지 돌려줘도 1회차 번역이 고정되어야 한다.
    const changed = structuredClone(overlay);
    changed.sections[0].headline = 'Changed after acceptance';
    changed.sections[1].headline = 'Retry regressed an already valid field';
    return changed;
  } });
  assert.equal(prompts.length, 2);
  assert.deepEqual(prompts[0].display_text.sections.map(section => section.id), overlay.sections.map(section => section.id));
  const retry = prompts[1];
  assert.deepEqual(retry.display_text.sections.map(section => section.id), [overlay.sections[1].id]);
  assert.deepEqual(retry.immutable_metadata_and_glossary.map(item => item.id), [overlay.sections[1].id]);
  assert.equal(retry.previous_check_error, `Article ${overlay.sections[1].id}: In body_markdown, copy v4l2_subdev_format verbatim as a standalone token. Separate units from numbers and pluralize the surrounding noun, not an identifier.`);
  assert.deepEqual(result.overlay.sections[0], first.sections[0]);
  assert.deepEqual(result.overlay.sections[1], overlay.sections[1]);
  assert.deepEqual(result.overlay.title, overlay.title);
});

test('articles that fail for different reasons are all retried with each error in the feedback', async t => {
  const { target, overlay } = storySample(t);
  const first = structuredClone(overlay);
  first.sections[0].lead = '남은 한글입니다.';
  first.sections[1].body_markdown = first.sections[1].body_markdown.replace('v4l2_subdev_format', 'format');
  const prompts = [];
  const result = await translateIssue(target, { call: async (run, system, prompt) => {
    prompts.push(JSON.parse(prompt));
    return prompts.length === 1 ? first : overlay;
  } });
  assert.equal(prompts.length, 2);
  assert.equal(prompts[1].display_text.sections.length, 2);
  const lines = prompts[1].previous_check_error.split('\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /Translate all Korean text in lead into English/);
  assert.match(lines[1], /copy v4l2_subdev_format verbatim as a standalone token/);
  assert.doesNotMatch(prompts[1].previous_check_error, /translation\.|Missing protected token|Korean text remains/);
  assert.deepEqual(result.overlay, overlay);
});

test('structural errors retranslate the whole issue, and a still-failing article throws after the retry', async t => {
  const { target, overlay } = storySample(t);
  const reversed = { ...structuredClone(overlay), sections: [...overlay.sections].reverse() };
  const prompts = [];
  await translateIssue(target, { call: async (run, system, prompt) => {
    prompts.push(JSON.parse(prompt));
    return prompts.length === 1 ? reversed : overlay;
  } });
  assert.equal(prompts[1].display_text.sections.length, 2);
  assert.match(prompts[1].previous_check_error, /ID order mismatch/);

  const broken = structuredClone(overlay);
  broken.sections[1].body_markdown = broken.sections[1].body_markdown.replace('v4l2_subdev_format', 'format');
  const retried = [];
  await assert.rejects(translateIssue(target, { call: async (run, system, prompt) => {
    retried.push(JSON.parse(prompt));
    return broken;
  } }), /two attempts: Missing protected token v4l2_subdev_format: translation\.sections\[1\]\.body_markdown/);
  assert.equal(retried.length, 2);
  assert.equal(retried[1].display_text.sections.length, 1);
});

test('validate:public gives translation.en.json the same Korean-counterpart allowance as the translation checks', t => {
  // 번역 검사만 허용하고 validate:public이 같은 오버레이를 막으면 번역 PR이 최종 검증에서 실패한다.
  const { target, overlay } = storySample(t, withKoreanSource(([first]) => { first.headline = 'SurfaceControl 및 TextureView 폴백'; }));
  overlay.sections[0].headline = 'SurfaceControl and TextureView fallback';
  const root = path.resolve(target.dir, '../../..');
  writeJson(path.join(target.dir, 'translation.en.json'), overlay);
  assert.deepEqual(weeklyRenderInputIssues(root, target.key), []);
  overlay.sections[1].headline = 'SurfaceControl fallback';
  writeJson(path.join(target.dir, 'translation.en.json'), overlay);
  assert.match(weeklyRenderInputIssues(root, target.key).join('\n'), /sections\[1\]\.public_article failed: public_article_leakage headline[^\n]*Fallback/);
});

test('a Korean counterpart only counts in the paired source field, as a whole word, and with its context marker', t => {
  // 리뷰 재현: 번역 대상이 아닌 필드의 폴백, '검증기간', 파이프라인 marker가 붙은 validator는 면제하지 않는다.
  const editorOnly = storySample(t, withKoreanSource(([first]) => { first.editorial_story.not_to_overclaim += ' 폴백 경로입니다.'; }));
  editorOnly.overlay.sections[0].body_markdown += '\n\nThis story was promoted by the Fallback lane of the newsroom.';
  assert.throws(() => translationChecks(editorOnly.target.issue, editorOnly.overlay, editorOnly.target.sourceText), /sections\[0\][^;]*public_article_leakage body_markdown[^;]*Fallback/);

  const debug = storySample(t, withKoreanSource(([first]) => { first.body_markdown += '\n\n내부 검사기를 확인합니다.'; }));
  debug.overlay.sections[0].body_markdown += '\n\nDebug output from the validator shows the schema failed for this story.';
  assert.throws(() => translationChecks(debug.target.issue, debug.overlay, debug.target.sourceText), /sections\[0\][^;]*public_article_leakage body_markdown[^;]*validator/);

  const period = storySample(t, withKoreanSource(([first]) => { first.body_markdown += '\n\n내부 검증기간을 확인합니다.'; }));
  period.overlay.sections[0].body_markdown += '\n\nInternally, the validator checks the request.';
  assert.throws(() => translationChecks(period.target.issue, period.overlay, period.target.sourceText), /sections\[0\][^;]*public_article_leakage body_markdown[^;]*validator/);

  const faithful = storySample(t, withKoreanSource(([first]) => { first.body_markdown += '\n\n프레임워크 내부에서는 검사기들을 거쳐 안전성을 확인합니다.'; }));
  faithful.overlay.sections[0].body_markdown += '\n\nInternally, the framework ensures safety by passing through validators that pre-verify.';
  assert.doesNotThrow(() => translationChecks(faithful.target.issue, faithful.overlay, faithful.target.sourceText));
});

test('a Korean counterpart must be a whole word with only particles after it, and the English term may not outnumber it', t => {
  // '검증기준'은 검증기가 아니다. '검사기들을'은 검사기 + 복수 접미사 + 조사다.
  const compound = storySample(t, withKoreanSource(([first]) => { first.body_markdown += '\n\n내부 검증기준을 확인합니다.'; }));
  compound.overlay.sections[0].body_markdown += '\n\nInternally, the validator checks the request.';
  assert.throws(() => translationChecks(compound.target.issue, compound.overlay, compound.target.sourceText), /sections\[0\][^;]*public_article_leakage body_markdown[^;]*validator/);

  const particle = storySample(t, withKoreanSource(([first]) => { first.body_markdown += '\n\n내부 검사기들을 거칩니다.'; }));
  particle.overlay.sections[0].body_markdown += '\n\nInternally, validators are used.';
  assert.doesNotThrow(() => translationChecks(particle.target.issue, particle.overlay, particle.target.sourceText));

  // 한국어 대응어가 한 번뿐이면 영어 용어도 한 번까지만 옮긴 것으로 본다. 둘째는 원문에 없던 사용이다.
  const extra = storySample(t, withKoreanSource(([first]) => { first.body_markdown += '\n\n폴백 경로를 확인합니다.'; }));
  extra.overlay.sections[0].body_markdown += '\n\nThe fallback path is checked.\n\nThe release also has a fallback lane for the newsroom.';
  assert.throws(() => translationChecks(extra.target.issue, extra.overlay, extra.target.sourceText), /sections\[0\][^;]*public_article_leakage body_markdown[^;]*Fallback/);
});

test('backtick stripping leaves ids alone and removes long fences with their info string', t => {
  const { target, overlay } = storySample(t);
  const input = translationInput(target.issue, target.sourceText);
  const wrapped = structuredClone(overlay);
  wrapped.sections[0].id = `\`${wrapped.sections[0].id}\``;
  assert.throws(() => translationChecks(target.issue, normalizeTranslationResponse(wrapped, input), target.sourceText), /Unknown or duplicate translation ID/);

  const fenced = structuredClone(overlay);
  fenced.sections[0].body_markdown = `\`\`\`\`c\n${overlay.sections[0].body_markdown}\n\`\`\`\``;
  const normalized = normalizeTranslationResponse(fenced, input);
  assert.equal(normalized.sections[0].body_markdown, overlay.sections[0].body_markdown);
});
