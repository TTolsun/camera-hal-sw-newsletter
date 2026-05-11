const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

const {
  articleSectionContractPrompt
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
  assert.match(prompt, /exactly these five keys/);
  assert.match(prompt, /optional only for legacy artifact compatibility/);
  assert.match(prompt, /do not rely on legacy fields/);
  assert.match(prompt, /source-backed facts/);
  assert.match(prompt, /HAL interpretation/);
  assert.match(prompt, /direct runtime\/API behavior/);
  assert.match(prompt, /concrete actions/);
});

test('LLM editor, repair, completion, and fact-check prompts include article section contract', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'scripts', 'newsroom', 'cli', 'gemini-newsroom-newsletter.js'),
    'utf8'
  );
  const usageCount = (source.match(/articleSectionContractPrompt\(\),/g) || []).length;

  assert.ok(usageCount >= 5);
});
