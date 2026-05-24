const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const {
  articleSectionContractPrompt,
  publicArticleContractPrompt,
  sourceExtractionPromptGuardrails
} = require('../../scripts/gemini-newsroom-newsletter');

function promptHostSource() {
  return fs.readFileSync(
    path.join(__dirname, '..', '..', 'scripts', 'newsroom', 'cli', 'gemini-newsroom-newsletter.js'),
    'utf8'
  );
}

function assertStagePromptUsesFactCheckHelpers(source, stageAnchor) {
  const start = source.indexOf(stageAnchor);
  assert.notEqual(start, -1, `Missing stage anchor: ${stageAnchor}`);
  const end = source.indexOf('schema와 일치하는 JSON만 반환하세요.', start);
  assert.notEqual(end, -1, `Missing schema anchor after: ${stageAnchor}`);
  const stagePrompt = source.slice(start, end);

  assert.match(stagePrompt, /factCheckSeverityPrompt\(\),/);
  assert.match(stagePrompt, /cameraDeveloperToolingFactCheckPrompt\(\),/);
}

test('article section contract prompt fixes the five normalized keys and guardrails', () => {
  const prompt = articleSectionContractPrompt();

  for (const key of [
    'verified_facts',
    'background_context',
    'hal_driver_impact',
    'action_items',
    'team_share_points'
  ]) {
    assert.match(prompt, new RegExp(key));
  }
  assert.match(prompt, /article_sections를 포함해야 합니다/);
  assert.match(prompt, /required keys/);
  assert.match(prompt, /known_limitations/);
  assert.match(prompt, /watch_items/);
  assert.match(prompt, /do_not_claim/);
  assert.match(prompt, /optional arrays/);
  assert.match(prompt, /guardrail array/);
  assert.match(prompt, /legacy artifact compatibility 때문에만 optional/);
  assert.match(prompt, /legacy fields로 충족했다고 간주하지 마세요/);
  assert.match(prompt, /source-backed facts/);
  assert.match(prompt, /Jetpack Compose/);
  assert.match(prompt, /CameraX 앱 화면 guidance/);
  assert.match(prompt, /direct HAL\/API\/runtime change로 쓰지 마세요/);
  assert.match(prompt, /HAL 해석/);
  assert.match(prompt, /runtime\/API behavior/);
  assert.match(prompt, /구체적 action/);
  assert.match(prompt, /Action target scope:/);
  assert.match(prompt, /direct_camera_hal\/direct_aosp_camera\/camera_driver_image_pipeline: source가 직접 뒷받침할 때만 request\/result, metadata, stream, buffer, vendor tag, HAL contract/);
  assert.match(prompt, /android_camera_api\/android_platform_camera_adjacent: CameraX\/Camera2, preview\/capture, permission, app compatibility, Surface 연결/);
  assert.match(prompt, /android_multimedia_camera_output: media output path, codec, capture\/export, app-visible behavior/);
  assert.match(prompt, /cpp_ai_tooling_fallback: build\/test\/debug workflow, sample\/prototype app, Camera API usage/);
  assert.match(prompt, /HAL runtime, stream, buffer, metadata 변경을 기본 action target으로 만들지 마세요/);
  assert.match(prompt, /reference_only\/watchlist: 직접 조치 문장이 아니라 관찰\/제한 문장/);
  assert.match(prompt, /bucket scope에 맞는 구체 follow-up/);
  assert.match(prompt, /direct HAL\/driver evidence가 있는 경우에만 stream, buffer, metadata, request\/result, vendor tag/);
  assert.match(prompt, /app\/API\/tooling article에서는 permission, CameraX\/Camera2 usage, preview\/capture behavior, build\/test\/debug workflow/);
  assert.doesNotMatch(prompt, /owner\/test\/log\/metric\/API\/stream\/buffer\/metadata follow-up/);
  assert.match(prompt, /verified_facts에 복사하면 안 됩니다/);
  assert.match(prompt, /do_not_claim은 source-backed fact나 public article content로 render하지 말고/);
});

test('public article contract prompt keeps public output separate from diagnostics', () => {
  const prompt = publicArticleContractPrompt();

  for (const marker of [
    'public_article',
    'source_fact_bundle',
    'public_contract_version="story-v1"',
    'generation_contract_version=1',
    'story_contract_version=1',
    'headline',
    'source_subtitle',
    'lead',
    'body_paragraphs',
    'camera_hal_takeaway',
    'reader_checkpoints',
    'editorial_story',
    'reader_scenario',
    'what_happened',
    'field_scenario',
    'not_to_overclaim',
    'editor_take',
    'decision_metadata',
    'source_links',
    'source-bound engineering inference',
    'selected article capsule',
    'deterministic metadata',
    'deterministic judgment',
    'HAL impact level',
    'source eligibility',
    'source_gap_risk',
    'main/supporting 승격',
    'source link',
    'do_not_claim'
  ]) {
    assert.match(prompt, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(prompt, /독자-facing/);
  assert.match(prompt, /가정형 현업 장면/);
  assert.match(prompt, /source-confirmed fact/);
  assert.match(prompt, /모든 기사에 같은 작성 기준/);
  assert.match(prompt, /fallback_public, relevance_bucket, impact_claim_level 때문에 본문을 짧은 generic 문장/);
  assert.match(prompt, /3-5개 자연스러운 문단/);
  assert.match(prompt, /발표, 변경, 배경, 지원 범위, 적용 예시, 제약, 향후 계획/);
  assert.match(prompt, /Camera HAL 관련성 판단은 deterministic metadata와 validation layer가 담당/);
  assert.match(prompt, /Camera HAL\/Driver 관점에서의 의미/);
  assert.match(prompt, /Gemini는 decision_metadata를 생성하지 마세요/);
  assert.match(prompt, /validation report, checklist, enum, schema\/debug field name/);
  assert.match(prompt, /claim\/schema contract와 public prose contract를 섞지 마세요/);
  assert.match(prompt, /primary 또는 seed evidence URL/);
  assert.match(prompt, /최소 2개/);
  assert.match(prompt, /독자가 실제로 확인할 행동/);
  assert.match(prompt, /source 범위 제한/);
  assert.match(prompt, /API\/component\/date/);
  assert.match(prompt, /stream\/metadata/);
  assert.match(prompt, /compatibility test scenario/);
  assert.match(prompt, /vendor pipeline, stream, metadata, buffer/);
  assert.doesNotMatch(prompt, /즉시 조치할 항목은 없습니다\. 참고 동향으로만 공유합니다\./);
});


test('source extraction prompt guardrails keep source facts separate from editorial hints', () => {
  const prompt = sourceExtractionPromptGuardrails();

  assert.match(prompt, /source_extraction/);
  assert.match(prompt, /derived_editorial_hints/);
  assert.match(prompt, /source가 확인한 structured fact/);
  assert.match(prompt, /editorial guidance/);
  assert.match(prompt, /source_extraction\.release\.sections\[\]\.items\[\]\.text/);
  assert.match(prompt, /artifact table/);
  assert.match(prompt, /source URL 또는 전체 source page를 독립 분석하지 마세요/);
  assert.match(prompt, /release version/);
  assert.match(prompt, /validation checklist/);
});

test('LLM editor, repair, completion, and fact-check prompts include article section contract', () => {
  const source = promptHostSource();
  const usageCount = (source.match(/articleSectionContractPrompt\(\),/g) || []).length;

  assert.ok(usageCount >= 5);
});

test('LLM editor, repair, completion, and fact-check prompts include public article contract', () => {
  const source = promptHostSource();
  const usageCount = (source.match(/publicArticleContractPrompt\(\),/g) || []).length;

  assert.ok(usageCount >= 6);
});

test('LLM reporter, editor, repair, completion, and fact-check prompts include source extraction guardrails', () => {
  const source = promptHostSource();
  const usageCount = (source.match(/sourceExtractionPromptGuardrails\(\),/g) || []).length;

  assert.ok(usageCount >= 7);
});

test('LLM fact-check prompts map findings to schema fields and allow camera developer tooling coverage', () => {
  const source = promptHostSource();

  assert.doesNotMatch(source, /flag하세요/);
  assertStagePromptUsesFactCheckHelpers(source, '당신은 AOSP Camera / Driver / SoC Platform Newsletter의 AI fact checker입니다.');
  assertStagePromptUsesFactCheckHelpers(source, '당신은 repaired AOSP Camera / Driver / SoC Platform Newsletter draft의 AI fact checker입니다.');
  assertStagePromptUsesFactCheckHelpers(source, '당신은 completed AOSP Camera / Driver / SoC Platform Newsletter draft의 AI fact checker입니다.');
  assert.match(source, /must_fix\[\]/);
  assert.match(source, /source_gaps\[\]/);
  assert.match(source, /recommended_fixes\[\]/);
  assert.match(source, /selected capsule metadata/);
  assert.match(source, /source_extraction/);
  assert.match(source, /derived editorial hints는 framing 보조로만 사용/);
  assert.match(source, /단독 publishability 근거로 사용하지 마세요/);
  assert.match(source, /article text 또는 derived editorial hints에만 있고/);
  assert.match(source, /source\/capsule metadata\/source_extraction이 뒷받침하지 않으면/);
  assert.match(source, /Android Studio/);
  assert.match(source, /VS\(Visual Studio\) Code/);
  assert.match(source, /Claude/);
  assert.match(source, /Codex/);
  assert.match(source, /Roo Code/);
  assert.match(source, /OpenCode/);
  assert.doesNotMatch(source, /Rood Code/);
});

test('public article prompt does not force internal triage fallback prose', () => {
  const source = promptHostSource();

  assert.doesNotMatch(source, /즉시 조치할 항목은 없습니다\. 참고 동향으로만 공유합니다\./);
  assert.match(source, /validation report, checklist, enum, schema\/debug field name을 노출하지 마세요/);
  assert.match(source, /claim\/schema contract와 public prose contract를 섞지 마세요/);
  assert.match(source, /reader_checkpoints는 최소 2개/);
  assert.match(source, /body_paragraphs와 camera_hal_takeaway를 반복하는 bullet list로 public prose를 대체하지 마세요/);
  assert.match(source, /validator token을 조합한 문장을 쓰지 마세요/);
});
