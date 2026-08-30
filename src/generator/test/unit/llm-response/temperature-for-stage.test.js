const assert = require('node:assert/strict');
const test = require('node:test');

const {
  temperatureForSampling,
  thinkingBudgetForSampling
} = require('../../../../shared/llm/providers/gemini-provider');
const { LLM_STAGES } = require('../../../../shared/llm/stage-catalog');

// sampling profile -> provider config field 매핑을 고정한다(#981).
//
// #981 전에는 stage label을 정규식으로 해석해 temperature를 골랐고, 이 파일은 그 정규식의
// 동의어("fact-check" vs "fact-checker")와 분기 우선순위(repair가 editor보다 먼저)를
// 지키는 회귀 테스트였다. 이제 stage는 catalog definition이 sampling profile을 직접 선언하므로
// 동의어도 우선순위도 존재하지 않는다. 남는 계약은 profile 이름이 어느 config field를
// 가리키는가 하나다.

const config = {
  geminiTemperatureDefault: 0.35,
  geminiTemperatureSourceDiscovery: 0.45,
  geminiTemperatureReporter: 0.30,
  geminiTemperatureEditor: 0.55,
  geminiTemperatureFactcheck: 0.20,
  geminiTemperatureRepair: 0.25,
  geminiTemperatureJudge: 0.10,
  geminiThinkingBudgetReporter: 512,
  geminiThinkingBudgetEditor: 1024,
  geminiThinkingBudgetRepair: 2048,
  geminiThinkingBudgetFactcheck: 4096,
  geminiThinkingBudgetJudge: 8192
};

function sampling(temperatureProfile, thinkingProfile = 'disabled') {
  return { temperatureProfile, thinkingProfile };
}

test('temperature profile 7개가 각자의 config field를 가리킨다', () => {
  assert.equal(temperatureForSampling(sampling('default'), config), 0.35);
  assert.equal(temperatureForSampling(sampling('sourceDiscovery'), config), 0.45);
  assert.equal(temperatureForSampling(sampling('reporter'), config), 0.30);
  assert.equal(temperatureForSampling(sampling('editor'), config), 0.55);
  assert.equal(temperatureForSampling(sampling('factcheck'), config), 0.20);
  assert.equal(temperatureForSampling(sampling('repair'), config), 0.25);
  assert.equal(temperatureForSampling(sampling('judge'), config), 0.10);
});

test('thinking profile 5개가 각자의 config field를 가리키고, disabled는 0이다', () => {
  assert.equal(thinkingBudgetForSampling(sampling('default', 'reporter'), config), 512);
  assert.equal(thinkingBudgetForSampling(sampling('default', 'editor'), config), 1024);
  assert.equal(thinkingBudgetForSampling(sampling('default', 'repair'), config), 2048);
  assert.equal(thinkingBudgetForSampling(sampling('default', 'factcheck'), config), 4096);
  assert.equal(thinkingBudgetForSampling(sampling('default', 'judge'), config), 8192);
  // disabled는 누락이나 null이 아니라 "이 stage는 thinking을 쓰지 않는다"는 명시적 선언이다.
  assert.equal(thinkingBudgetForSampling(sampling('default', 'disabled'), config), 0);
});

test('어휘 밖의 profile은 조용히 기본값으로 떨어지지 않고 던진다', () => {
  assert.throws(() => temperatureForSampling(sampling('made-up'), config), /unknown_temperature_profile/);
  assert.throws(() => thinkingBudgetForSampling(sampling('default', 'made-up'), config), /unknown_thinking_profile/);
  assert.throws(() => temperatureForSampling(undefined, config), /unknown_temperature_profile/);
});

test('catalog definition이 실제로 이 매핑을 쓴다', () => {
  assert.equal(temperatureForSampling(LLM_STAGES.EDITOR.sampling, config), 0.55);
  assert.equal(temperatureForSampling(LLM_STAGES.FACT_CHECKER.sampling, config), 0.20);
  // background-context는 전용 temperature 분기가 없어 default로 떨어진다(#979 2번 항목).
  assert.equal(temperatureForSampling(LLM_STAGES.BACKGROUND_CONTEXT.sampling, config), 0.35);
  assert.equal(thinkingBudgetForSampling(LLM_STAGES.BACKGROUND_CONTEXT.sampling, config), 0);
});
