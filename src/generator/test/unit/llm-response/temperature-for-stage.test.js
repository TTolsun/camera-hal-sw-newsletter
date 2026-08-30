const assert = require('node:assert/strict');
const test = require('node:test');

const {
  temperatureForSampling,
  thinkingBudgetForSampling
} = require('../../../../shared/llm/providers/gemini-provider');
const {
  LLM_STAGES,
  TEMPERATURE_PROFILES,
  THINKING_PROFILES
} = require('../../../../shared/llm/stage-catalog');
const { readRuntimeConfig } = require('../../../../shared/common/runtime-config');

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

// sampling profile 어휘는 두 곳에 정의돼 있다(#1002 2번).
//
// - catalog: stage-catalog.js의 TEMPERATURE_PROFILES / THINKING_PROFILES
// - provider: gemini-provider.js의 TEMPERATURE_FIELD_BY_PROFILE / THINKING_FIELD_BY_PROFILE
//
// 경계 자체는 의도한 것이다. shared catalog가 특정 provider의 config 모양에 묶이면 안 되기
// 때문이다. 문제는 두 표가 어긋나도 아무도 막지 않는다는 점이다. catalog에 profile을 새로
// 넣고 provider 표를 빠뜨리면 defineStage는 catalog만 보므로 통과하고, 그 stage의 첫 호출에서
// 비로소 unknown_temperature_profile로 던진다 -- 실패가 발행 중에 터진다.
//
// 그래서 두 표가 같은 어휘를 덮는지를 여기서 잠근다. provider의 내부 상수를 꺼내 비교하는
// 대신 실제로 두 함수를 호출한다. 어휘 일치는 provider 표의 모양이 아니라 "catalog의 모든
// profile로 값을 얻을 수 있는가"라는 행동이 계약이기 때문이다.
//
// catalog 값을 하드코딩하지 않고 순회해야 한다. 하드코딩하면 새 profile이 추가돼도 이
// 테스트가 그대로 초록이라 존재 이유가 사라진다.
//
// 아래 두 테스트만 이 파일 위쪽의 config 리터럴이 아니라 readRuntimeConfig가 만든 실제
// 런타임 config를 쓴다. 어휘는 사실 세 곳에 있다 -- catalog, provider 표, 그리고 config를
// 실제로 채우는 runtime-config.js다. 리터럴로 검사하면 앞의 둘만 맞춰도 초록이 되는데,
// runtime-config에 field가 없으면 런타임에서는 temperatureForSampling이 undefined를 돌려주고
// gemini-provider의 요청 조립에서 그 키가 통째로 사라져 **던지지 않고 조용히** API 기본
// sampling으로 발행된다. 막으려던 실패가 한 칸 아래로 옮겨가 더 조용해지는 것이다.
// 실제 config를 쓰면 catalog profile -> provider field 이름 -> 실제 config field가 한 사슬로
// 잠긴다. 위쪽 리터럴은 field별 값을 못 박는 sentinel 용도라 그대로 둔다.

const runtimeConfig = readRuntimeConfig({});

test('catalog의 모든 temperature profile이 provider 표와 런타임 config에 있다', () => {
  const profiles = Object.values(TEMPERATURE_PROFILES);
  assert.ok(profiles.length > 0, 'catalog에 temperature profile이 하나도 없다');

  profiles.forEach((profile) => {
    // 표에 없으면 던지고, 표에는 있는데 runtime-config에 field가 없으면 undefined다.
    const temperature = temperatureForSampling(sampling(profile), runtimeConfig);
    assert.equal(
      typeof temperature,
      'number',
      `temperature profile이 런타임 config에서 값을 못 얻는다: ${profile}`
    );
  });
});

test('catalog의 모든 thinking profile이 provider 표와 런타임 config에 있고, disabled만 0으로 빠진다', () => {
  const profiles = Object.values(THINKING_PROFILES);
  assert.ok(profiles.length > 0, 'catalog에 thinking profile이 하나도 없다');

  profiles.forEach((profile) => {
    const budget = thinkingBudgetForSampling(sampling('default', profile), runtimeConfig);
    if (profile === THINKING_PROFILES.DISABLED) {
      // DISABLED는 provider 표에 없다. thinkingBudgetForSampling이 표를 보기 전에 0으로
      // 처리하는 명시적 예외이므로, 예외의 값 자체도 함께 잠근다.
      assert.equal(budget, 0, 'disabled는 표를 거치지 않고 0이어야 한다');
      return;
    }
    assert.equal(
      typeof budget,
      'number',
      `thinking profile이 런타임 config에서 값을 못 얻는다: ${profile}`
    );
  });
});

test('catalog definition이 실제로 이 매핑을 쓴다', () => {
  assert.equal(temperatureForSampling(LLM_STAGES.EDITOR.sampling, config), 0.55);
  assert.equal(temperatureForSampling(LLM_STAGES.FACT_CHECKER.sampling, config), 0.20);
  // background-context는 전용 temperature 분기가 없어 default로 떨어진다(#979 2번 항목).
  assert.equal(temperatureForSampling(LLM_STAGES.BACKGROUND_CONTEXT.sampling, config), 0.35);
  assert.equal(thinkingBudgetForSampling(LLM_STAGES.BACKGROUND_CONTEXT.sampling, config), 0);
});
