'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  validateNewsroomBudgetConfig
} = require('../../../tooling/validate/newsroom-budget-config-validator');
const { LLM_STAGES } = require('../../../llm/stage-catalog');

// 예산 config는 LLM stage id 어휘를 쓴다(#993).
//
// 예전에는 작업 이름(sourceDiscovery, articleExtraction ...)을 썼고, 그중 하나가 stage
// label과 철자가 같아 우연히 조인됐다. #982가 진단 키를 바꾸면서 그 조인이 조용히 끊겼고
// -- 예외도 실패도 없이 -- 3개월 뒤에야 발견됐다. 그래서 어휘가 어긋나는 순간을 발행 전
// config 검증에서 잡는다.

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');

function baseConfig(overrides = {}) {
  return {
    schemaVersion: 1,
    geminiUsageBudget: {
      enabled: true,
      targetCallsPerRun: 700,
      softLimitCallsPerRun: 750,
      hardLimitCallsPerRun: 850,
      allocation: { source_discovery: 120 },
      stages: { source_discovery: { optional: true } },
      ...overrides
    }
  };
}

test('배포 config가 검증을 통과한다', () => {
  const deployed = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'config', 'newsroom-budget.json'), 'utf8')
  );
  assert.deepEqual(validateNewsroomBudgetConfig(deployed), { ok: true, errors: [] });
});

test('배포 config의 모든 키가 catalog의 stage id다', () => {
  const deployed = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'config', 'newsroom-budget.json'), 'utf8')
  );
  const catalogIds = new Set(Object.values(LLM_STAGES).map(definition => definition.id));
  const keys = [
    ...Object.keys(deployed.geminiUsageBudget.stages),
    ...Object.keys(deployed.geminiUsageBudget.allocation)
  ];
  assert.ok(keys.length > 0, '검사할 키가 하나는 있어야 한다');
  keys.forEach(key => assert.ok(catalogIds.has(key), `${key}가 stage id가 아니다`));
});

test('예전 작업 이름 어휘로 되돌리면 stages에서 잡힌다', () => {
  const result = validateNewsroomBudgetConfig(
    baseConfig({ stages: { sourceDiscovery: { optional: true } } })
  );
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [
    'geminiUsageBudget.stages.sourceDiscovery is not a stage id in the LLM stage catalog.'
  ]);
});

test('allocation 키도 같은 규칙을 받는다', () => {
  const result = validateNewsroomBudgetConfig(
    baseConfig({ allocation: { articleExtraction: 140 } })
  );
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [
    'geminiUsageBudget.allocation.articleExtraction is not a stage id in the LLM stage catalog.'
  ]);
});

test('오타도 미등록 stage와 똑같이 잡힌다', () => {
  const result = validateNewsroomBudgetConfig(
    baseConfig({ stages: { source_discovry: { optional: true } } })
  );
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /source_discovry is not a stage id/);
});

test('모양 검사는 그대로 남아 있다', () => {
  const result = validateNewsroomBudgetConfig(
    baseConfig({ stages: { source_discovery: { optional: 'yes' } } })
  );
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [
    'geminiUsageBudget.stages.source_discovery.optional must be a boolean.'
  ]);
});
