'use strict';

// Week 01 setup gate. Verifies that the lab can reach everything it needs
// before any slot that costs real time. Never calls an LLM.
//
// The API key is reported but NOT enforced here: the Build and labeling slots
// (~125 minutes) run without it, so a missing key must not block them.
// judge.js is where a missing key becomes a hard failure.

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const COLLECTED_NEWS_DIR = path.join(REPO_ROOT, 'articles', 'content', 'collected-news');
const MIN_EXPECTED_DATES = 30;

const REQUIRED_LLM_EXPORTS = [
  'callLlmJson',
  'resetLlmDiagnostics',
  'getLlmDiagnostics',
  'getLlmCostCalls',
  'buildCostReport'
];

function checkLlmClient() {
  const llm = require(path.join(REPO_ROOT, 'src', 'shared', 'llm', 'llm-client'));
  for (const name of REQUIRED_LLM_EXPORTS) {
    assert.strictEqual(typeof llm[name], 'function', `llm-client is missing ${name}`);
  }
  return `llm-client exports ${REQUIRED_LLM_EXPORTS.length}/${REQUIRED_LLM_EXPORTS.length}`;
}

function checkGroupKey() {
  const { candidateGroupKey } = require(path.join(REPO_ROOT, 'src', 'shared', 'common', 'article-groups'));
  assert.strictEqual(typeof candidateGroupKey, 'function', 'candidateGroupKey is not exported');
  const key = candidateGroupKey({ url: 'https://example.com/a', title: 'probe' });
  assert.strictEqual(key, 'article:https://example.com/a', `unexpected fallback key: ${key}`);
  return 'candidateGroupKey URL fallback';
}

function checkJudgeRouting() {
  const { modelGroupInfoForStage } = require(path.join(REPO_ROOT, 'src', 'shared', 'llm', 'model-policy'));
  const info = modelGroupInfoForStage('week01 judge agreement');
  assert.strictEqual(info.group, 'judge', `stage routed to ${info.group}, not judge`);
  assert.strictEqual(info.known, true, 'stage group not recognised');
  assert.strictEqual(info.warning || '', '', `routing warning: ${info.warning}`);
  return 'stage "week01 judge agreement" routes to judge group';
}

function checkDataset() {
  assert.ok(fs.existsSync(COLLECTED_NEWS_DIR), `missing ${COLLECTED_NEWS_DIR}`);
  const dates = fs.readdirSync(COLLECTED_NEWS_DIR)
    .filter(name => fs.existsSync(path.join(COLLECTED_NEWS_DIR, name, 'candidates.json')));
  assert.ok(
    dates.length >= MIN_EXPECTED_DATES,
    `only ${dates.length} dates carry candidates.json, expected >= ${MIN_EXPECTED_DATES}`
  );
  return `candidates.json dates=${dates.length}`;
}

function main() {
  const checks = [checkLlmClient, checkGroupKey, checkJudgeRouting, checkDataset];
  for (const check of checks) {
    console.log(`OK ${check()}`);
  }

  const hasKey = Boolean(process.env.GEMINI_API_KEY);
  console.log(
    hasKey
      ? 'OK GEMINI_API_KEY set'
      : 'WARN GEMINI_API_KEY not set - Build and labeling still run; judge.js will fail until it is exported'
  );
}

main();
