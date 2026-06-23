const assert = require('node:assert/strict');
const test = require('node:test');

const {
  modelGroupForStage,
  primaryModelForStage,
  LLM_STAGE_GROUPS
} = require('../../../llm/model-policy');
const {
  temperatureForStage,
  thinkingBudgetForStage
} = require('../../../llm/providers/gemini-provider');

// #700: editorial-plan은 prose 생성이 아니라 assessment/classification stage다. 자체 모델 노브
// (NEWSROOM_EDITORIALPLAN_MODEL, 기본 gemini-2.5-flash)를 갖는 전용 그룹으로 두어 비용 관측을
// 분리하되, temperature/thinking은 적절한 judge 수준(0.20 / 1024)을 재사용한다. 단계명 "editorial"이
// /editor/에 substring으로 오매칭되어 editor의 비싼 모델(gemini-3.5-flash)·높은 temperature(0.4)를
// 물려받던 것을 고친 회귀 테스트. editor 분기보다 먼저 가로채는지 고정.
const tempThinkingCfg = {
  geminiTemperatureEditor: 0.4,
  geminiTemperatureJudge: 0.20,
  geminiThinkingBudgetEditor: 1024,
  geminiThinkingBudgetJudge: 1024
};
const modelCfg = {
  llmStageModels: {
    editor: 'gemini-3.5-flash',
    judge: 'gemini-2.5-flash-lite',
    editorialPlan: 'gemini-2.5-flash'
  }
};

for (const stage of ['editorial-plan attempt 1/1', 'editorial plan', 'editorial-plan']) {
  test(`editorial-plan 라우팅: "${stage}"는 전용 그룹(editor 오매칭 아님)`, () => {
    assert.equal(modelGroupForStage(stage), LLM_STAGE_GROUPS.EDITORIAL_PLAN);
    assert.notEqual(modelGroupForStage(stage), LLM_STAGE_GROUPS.EDITOR);
    // 모델은 전용 노브(gemini-2.5-flash), editor의 비싼 gemini-3.5-flash가 아니다.
    assert.equal(primaryModelForStage(modelCfg, stage), 'gemini-2.5-flash');
    // temperature/thinking은 judge 수준 재사용(낮은 temp로 분류 일관성↑), editor(0.4) 아님.
    assert.equal(temperatureForStage(stage, tempThinkingCfg), 0.20);
    assert.notEqual(temperatureForStage(stage, tempThinkingCfg), 0.4);
    assert.equal(thinkingBudgetForStage(stage, tempThinkingCfg), 1024);
  });
}

test('editor 단계는 여전히 editor 프로필(회귀 안전)', () => {
  assert.equal(modelGroupForStage('editor attempt 1/1'), LLM_STAGE_GROUPS.EDITOR);
  assert.equal(primaryModelForStage(modelCfg, 'editor attempt 1/1'), 'gemini-3.5-flash');
  assert.equal(temperatureForStage('editor attempt 1/1', tempThinkingCfg), 0.4);
});
