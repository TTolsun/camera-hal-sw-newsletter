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
  assert.match(prompt, /must include article_sections/);
  assert.match(prompt, /five required keys/);
  assert.match(prompt, /known_limitations/);
  assert.match(prompt, /watch_items/);
  assert.match(prompt, /do_not_claim/);
  assert.match(prompt, /optional arrays/);
  assert.match(prompt, /guardrail array/);
  assert.match(prompt, /optional only for legacy artifact compatibility/);
  assert.match(prompt, /do not rely on legacy fields/);
  assert.match(prompt, /source-backed facts/);
  assert.match(prompt, /HAL interpretation/);
  assert.match(prompt, /direct runtime\/API behavior/);
  assert.match(prompt, /concrete actions/);
  assert.match(prompt, /must not be copied into verified_facts/);
  assert.match(prompt, /Do not render do_not_claim as source-backed fact/);
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
  assert.match(prompt, /reader-facing/);
  assert.match(prompt, /verified_facts checklist/);
  assert.match(prompt, /즉시 조치할 항목은 없습니다/);
});


test('source extraction prompt guardrails keep source facts separate from editorial hints', () => {
  const prompt = sourceExtractionPromptGuardrails();

  assert.match(prompt, /source_extraction/);
  assert.match(prompt, /derived_editorial_hints/);
  assert.match(prompt, /source-confirmed structured facts/);
  assert.match(prompt, /editorial guidance/);
  assert.match(prompt, /source_extraction\.release\.sections\[\]\.items\[\]\.text/);
  assert.match(prompt, /artifact tables/);
  assert.match(prompt, /Do not analyze the source URL/);
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
