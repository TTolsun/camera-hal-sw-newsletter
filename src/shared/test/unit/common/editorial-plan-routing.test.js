const assert = require('node:assert/strict');
const test = require('node:test');

const { LLM_STAGES } = require('../../../llm/stage-catalog');
const { LLM_STAGE_GROUPS, primaryModelForGroup } = require('../../../llm/model-policy');
const { temperatureForSampling, thinkingBudgetForSampling } = require('../../../llm/providers/gemini-provider');

// #700: editorial-plan은 prose 생성이 아니라 assessment/classification stage다. 자체 모델 노브
// (NEWSROOM_EDITORIALPLAN_MODEL, 기본 gemini-2.5-flash)를 갖는 전용 그룹으로 두어 비용 관측을
// 분리하되, temperature/thinking은 judge 수준을 재사용한다.
//
// #981 전에는 이 구분이 정규식 분기 순서에 걸려 있었다. 단계명 "editorial"이 /editor/에
// substring으로 오매칭돼 editor의 비싼 모델과 높은 temperature를 물려받던 사고를
// "editorial-plan 분기를 editor보다 먼저 둔다"로 막고 있었다. 이제는 catalog가 두 stage를
// 별개 definition으로 선언하므로 오매칭이 성립할 수 없다. 값 자체를 고정한다.
const tempThinkingCfg = {
  geminiTemperatureEditor: 0.4,
  geminiTemperatureJudge: 0.2,
  geminiThinkingBudgetEditor: 1024,
  geminiThinkingBudgetJudge: 1024
};

test('editorial-plan은 editor와 다른 model group을 쓴다', () => {
  assert.equal(LLM_STAGES.EDITORIAL_PLAN.modelGroup, LLM_STAGE_GROUPS.EDITORIAL_PLAN);
  assert.equal(LLM_STAGES.EDITOR.modelGroup, LLM_STAGE_GROUPS.EDITOR);

  const config = {
    llmStageModels: {
      editor: 'editor-model',
      editorialPlan: 'editorial-plan-model'
    }
  };
  assert.equal(primaryModelForGroup(config, LLM_STAGES.EDITORIAL_PLAN.modelGroup), 'editorial-plan-model');
  assert.equal(primaryModelForGroup(config, LLM_STAGES.EDITOR.modelGroup), 'editor-model');
});

test('editorial-plan의 sampling은 judge 수준을 재사용한다', () => {
  assert.equal(
    temperatureForSampling(LLM_STAGES.EDITORIAL_PLAN.sampling, tempThinkingCfg),
    tempThinkingCfg.geminiTemperatureJudge
  );
  assert.equal(
    thinkingBudgetForSampling(LLM_STAGES.EDITORIAL_PLAN.sampling, tempThinkingCfg),
    tempThinkingCfg.geminiThinkingBudgetJudge
  );
  // editor는 자기 값을 그대로 쓴다.
  assert.equal(
    temperatureForSampling(LLM_STAGES.EDITOR.sampling, tempThinkingCfg),
    tempThinkingCfg.geminiTemperatureEditor
  );
});
