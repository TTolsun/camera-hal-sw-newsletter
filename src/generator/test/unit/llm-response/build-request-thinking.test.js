const assert = require('node:assert/strict');
const test = require('node:test');

const {
  thinkingConfigForStage,
  budgetToThinkingLevel,
  buildRequest
} = require('../../../reporter/providers/gemini-provider');

// 단계별 thinking budget(코드 정본 기본값 반영: factcheck 2048, judge 512, repair 1024)
const baseConfig = {
  geminiThinkingBudgetReporter: 0,
  geminiThinkingBudgetEditor: 1024,
  geminiThinkingBudgetRepair: 1024,
  geminiThinkingBudgetFactcheck: 2048,
  geminiThinkingBudgetJudge: 512,
  geminiThinkingBudgetScoring: 0,
  geminiTemperatureDefault: 0.35,
  geminiTemperatureSourceDiscovery: 0.45,
  geminiTemperatureReporter: 0.30,
  geminiTemperatureEditor: 0.40,
  geminiTemperatureFactcheck: 0.20,
  geminiTemperatureRepair: 0.25,
  geminiTemperatureJudge: 0.20
};

test('budgetToThinkingLevel — 경계 매핑 (<=512 LOW / <=2048 MEDIUM / >2048 HIGH)', () => {
  assert.equal(budgetToThinkingLevel(0), 'LOW');
  assert.equal(budgetToThinkingLevel(512), 'LOW');
  assert.equal(budgetToThinkingLevel(513), 'MEDIUM');
  assert.equal(budgetToThinkingLevel(1024), 'MEDIUM');
  assert.equal(budgetToThinkingLevel(2048), 'MEDIUM');
  assert.equal(budgetToThinkingLevel(2049), 'HIGH');
});

test('Gemini 3.x editor — thinkingBudget 대신 thinkingLevel(MEDIUM) 사용', () => {
  const result = thinkingConfigForStage('editor attempt 1/2', baseConfig, 'gemini-3.5-flash');
  assert.equal(result.mode, 'thinking_level');
  assert.equal(result.thinkingLevel, 'MEDIUM');
  // cost-report 연속성: requested/applied는 budget 숫자로 유지
  assert.equal(result.requested, 1024);
  assert.equal(result.applied, 1024);
});

test('flash-lite judge budget 0 — thinkingConfig 생략(mode omit)', () => {
  const config = { ...baseConfig, geminiThinkingBudgetJudge: 0 };
  const result = thinkingConfigForStage('public article judge', config, 'gemini-2.5-flash-lite');
  assert.equal(result.mode, 'omit');
});

test('flash-lite judge budget 512 — 유효 최소값 그대로', () => {
  const result = thinkingConfigForStage('public article judge', baseConfig, 'gemini-2.5-flash-lite');
  assert.equal(result.mode, 'budget');
  assert.equal(result.applied, 512);
});

test('flash-lite — 0<budget<512는 512로 클램프', () => {
  const config = { ...baseConfig, geminiThinkingBudgetJudge: 300 };
  const result = thinkingConfigForStage('public article judge', config, 'gemini-2.5-flash-lite');
  assert.equal(result.mode, 'budget');
  assert.equal(result.applied, 512);
});

test('flash-lite — 상한 24576 초과는 클램프', () => {
  const config = { ...baseConfig, geminiThinkingBudgetJudge: 30000 };
  const result = thinkingConfigForStage('public article judge', config, 'gemini-2.5-flash-lite');
  assert.equal(result.applied, 24576);
});

test('Gemini 2.5-flash factcheck — budget 2048 그대로(level 변환 없음)', () => {
  const result = thinkingConfigForStage('fact-checker attempt 1/2', baseConfig, 'gemini-2.5-flash');
  assert.equal(result.mode, 'budget');
  assert.equal(result.applied, 2048);
});

test('Gemini 2.5-flash — budget 0은 off로 그대로 전송', () => {
  const result = thinkingConfigForStage('reporter attempt 1/2', baseConfig, 'gemini-2.5-flash');
  assert.equal(result.mode, 'budget');
  assert.equal(result.applied, 0);
});

test('Gemini 2.5-flash — 상한 24576 초과는 클램프(flash-lite와 일관)', () => {
  const config = { ...baseConfig, geminiThinkingBudgetFactcheck: 30000 };
  const result = thinkingConfigForStage('fact-checker attempt 1/2', config, 'gemini-2.5-flash');
  assert.equal(result.mode, 'budget');
  assert.equal(result.applied, 24576);
});

function thinkingConfigFromRequest(stage, model, config = baseConfig) {
  return buildRequest({
    model,
    stage,
    systemInstruction: 'sys',
    prompt: 'p',
    responseSchema: {},
    config
  }).request.config.thinkingConfig;
}

test('buildRequest — 3.x editor는 thinkingLevel만 전송(thinkingBudget 없음)', () => {
  assert.deepEqual(thinkingConfigFromRequest('editor attempt 1/2', 'gemini-3.5-flash'), { thinkingLevel: 'MEDIUM' });
});

test('buildRequest — flash-lite judge budget 0이면 thinkingConfig 자체 없음', () => {
  const config = { ...baseConfig, geminiThinkingBudgetJudge: 0 };
  assert.equal(thinkingConfigFromRequest('public article judge', 'gemini-2.5-flash-lite', config), undefined);
});

test('buildRequest — flash-lite judge 512는 thinkingBudget 전송', () => {
  assert.deepEqual(thinkingConfigFromRequest('public article judge', 'gemini-2.5-flash-lite'), { thinkingBudget: 512 });
});

test('buildRequest — 2.5-flash factcheck는 thinkingBudget 전송', () => {
  assert.deepEqual(thinkingConfigFromRequest('fact-checker attempt 1/2', 'gemini-2.5-flash'), { thinkingBudget: 2048 });
});
