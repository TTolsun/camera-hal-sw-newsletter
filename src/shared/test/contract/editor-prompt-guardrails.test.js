'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const test = require('node:test');

const {
  linkedEvidencePromptGuardrails,
  sourceExtractionPromptGuardrails
} = require('../../../generator/publish/newsletter-prompts');

test('LLM prompt guardrails prohibit linked evidence overclaim without exposing payloads', () => {
  const guardrails = linkedEvidencePromptGuardrails();
  assert.match(guardrails, /prompt payload에 포함되어 있지 않습니다/);
  assert.match(guardrails, /article capsule 또는 source field/);
  assert.match(guardrails, /Editor draft text는 linked evidence가 아닙니다/);
  assert.match(guardrails, /검증해야 할 claim/);
  assert.doesNotMatch(guardrails, /editor draft fields/);
  assert.match(guardrails, /blocked, failed, skipped, unsupported/);
  assert.match(guardrails, /build_dependency_fix, test_only_change, documentation_only/);
  assert.match(guardrails, /stream, buffer, metadata, request, result, ImageCapture, VideoCapture, Surface, CameraPipe/);

  const cliPath = require.resolve('../../../generator/publish/gemini-newsroom-newsletter');
  const source = fs.readFileSync(cliPath, 'utf8');
  const promptUsageCount = (source.match(/linkedEvidencePromptGuardrails\(\),/g) || []).length;
  assert.ok(promptUsageCount >= 7);
});

test('LLM prompt guardrails treat source quality blockers as hard generation inputs', () => {
  const guardrails = sourceExtractionPromptGuardrails();
  assert.match(guardrails, /canonical source_quality/);
  assert.match(guardrails, /main_article_source_allowed=false/);
  assert.match(guardrails, /hard blocker/);
  assert.match(guardrails, /main_article_source_blockers/);
  assert.match(guardrails, /blocked 또는 failed linked evidence/);
});
