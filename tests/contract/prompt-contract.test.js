const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const {
  articleSectionContractPrompt,
  publicArticleContractPrompt,
  sourceExtractionPromptGuardrails
} = require('../../scripts/gemini-newsroom-newsletter');

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
  assert.match(prompt, /verified_facts에 복사하면 안 됩니다/);
  assert.match(prompt, /do_not_claim은 source-backed fact나 public article content로 render하지 말고/);
});

test('public article contract prompt keeps public output separate from diagnostics', () => {
  const prompt = publicArticleContractPrompt();

  for (const marker of [
    'public_article',
    'article_sections',
    'hal_signal_capsule',
    'HAL Signal Capsule',
    'Fallback',
    'Review-only',
    'quality gate',
    'source_links'
  ]) {
    assert.match(prompt, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(prompt, /독자-facing/);
  assert.match(prompt, /verified_facts checklist/);
  assert.match(prompt, /CameraX-adjacent/);
  assert.match(prompt, /짧은 배경 문단/);
  assert.match(prompt, /즉시 조치할 항목은 없습니다/);
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
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'scripts', 'newsroom', 'cli', 'gemini-newsroom-newsletter.js'),
    'utf8'
  );
  const usageCount = (source.match(/articleSectionContractPrompt\(\),/g) || []).length;

  assert.ok(usageCount >= 5);
});

test('LLM editor, repair, completion, and fact-check prompts include public article contract', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'scripts', 'newsroom', 'cli', 'gemini-newsroom-newsletter.js'),
    'utf8'
  );
  const usageCount = (source.match(/publicArticleContractPrompt\(\),/g) || []).length;

  assert.ok(usageCount >= 6);
});

test('LLM reporter, editor, repair, completion, and fact-check prompts include source extraction guardrails', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'scripts', 'newsroom', 'cli', 'gemini-newsroom-newsletter.js'),
    'utf8'
  );
  const usageCount = (source.match(/sourceExtractionPromptGuardrails\(\),/g) || []).length;

  assert.ok(usageCount >= 7);
});
