const assert = require('node:assert/strict');
const test = require('node:test');

const { editorDraftArtifact } = require('../../publish/orchestrator-artifact-writers');
const llmClient = require('../../../shared/llm/llm-client');
const { LLM_STAGES, stageRun } = require('../../../shared/llm/stage-catalog');

// editor-draft.json의 model.providerModel이 실제로 쓴 model을 담는지 확인한다(#982).
//
// 예전에는 이 값을 `getLlmModelUsage(options.stage || 'editor')`로 찾았다. 어떤 호출자도
// options.stage를 넘기지 않았고 기록 키는 'editor attempt 1/2'였으므로 리터럴 'editor'는
// 절대 맞지 않았다. 조회는 항상 ''를 돌려줬고 값은 늘 설정 파일의 기본 model로 떨어졌다 --
// 즉 fallback model로 넘어간 실행에서도 primary model 이름을 적고 있었다.
//
// 이제 stage는 호출자 변수가 아니다. editor-draft.json은 언제나 editor 단계의 산출물이므로
// writer가 editor 정의로 직접 조회한다.

// provider를 통째로 가짜로 주입해 LLM 없이 호출 경로를 돈다.
function fakeProvider(modelName) {
  return {
    id: 'fake',
    displayName: 'Fake',
    pricingSource: 'fake://pricing',
    getApiKey() { return 'fake-key'; },
    missingCredentialMessage: 'missing fake credential',
    configuredModelsForGroup() { return [modelName]; },
    createModelContext() { return {}; },
    describeModelContext() { return ''; },
    buildRequest({ model }) { return { request: { model }, thinkingBudget: null }; },
    async execute() { return { text: '{"ok":true}' }; },
    textFromResponse(response) { return response.text; },
    usageMetadataFromResponse() { return { usage_metadata_present: true }; },
    estimateCallCost() {
      return {
        prompt_tokens: 0,
        output_tokens: 0,
        thinking_tokens: 0,
        cached_tokens: 0,
        total_tokens: 0,
        billable_input_tokens: 0,
        billable_output_tokens: 0,
        estimated_cost_usd: 0,
        pricing_usd_per_million: {},
        pricing_source: 'fake://pricing',
        pricing_warning: ''
      };
    },
    isProModel() { return false; },
    proPolicySummary() { return { status: 'disabled' }; }
  };
}

const emptyEditor = { sections: [] };

test('editor draft는 editor 단계가 실제로 쓴 model을 기록한다', async () => {
  llmClient.resetLlmDiagnostics();
  const run = stageRun(LLM_STAGES.EDITOR, { qualityAttempt: 2, totalAttempts: 3 });
  await llmClient.callLlmJson(run, 'system', 'prompt', {}, { provider: fakeProvider('fallback-editor-model') });

  const artifact = editorDraftArtifact(emptyEditor, '2026-08-30');
  assert.equal(artifact.model.providerModel, 'fallback-editor-model');
});

test('editor 단계 기록이 없으면 설정 기본값으로 떨어진다', () => {
  llmClient.resetLlmDiagnostics();
  const artifact = editorDraftArtifact(emptyEditor, '2026-08-30');
  assert.notEqual(artifact.model.providerModel, 'fallback-editor-model');
  assert.equal(typeof artifact.model.providerModel, 'string');
  assert.ok(artifact.model.providerModel.length > 0);
});

test('호출자가 준 providerModel이 진단 조회보다 우선한다', async () => {
  llmClient.resetLlmDiagnostics();
  const run = stageRun(LLM_STAGES.EDITOR, { qualityAttempt: 1, totalAttempts: 1 });
  await llmClient.callLlmJson(run, 'system', 'prompt', {}, { provider: fakeProvider('recorded-model') });

  const artifact = editorDraftArtifact(emptyEditor, '2026-08-30', { providerModel: 'explicit-model' });
  assert.equal(artifact.model.providerModel, 'explicit-model');
});

// providerModel의 귀속 범위를 못 박는다(#1002 1번).
//
// draft를 새로 쓰는 stage는 base editor 말고도 editor.repair, editor.completion,
// *.semantic_repair, *.public_article_judge_repair가 있다. 그 stage가 draft를 다시 써도
// 여기 적히는 이름은 base editor의 model이다 -- 즉 이 값은 "이 draft를 만든 model"이 아니라
// "base editor stage가 쓴 model"로 읽어야 한다.
//
// 의도한 좁은 의미이므로 현행 동작을 그대로 잠근다. 나중에 누가 조회 범위를 무심코 넓히면
// (예: 마지막에 draft를 쓴 stage를 따라가게 바꾸면) 이 테스트가 드러낸다.
test('repair가 draft를 다시 써도 providerModel은 base editor의 model이다', async () => {
  llmClient.resetLlmDiagnostics();
  const editorStage = stageRun(LLM_STAGES.EDITOR, { qualityAttempt: 1, totalAttempts: 2 });
  const repairStage = stageRun(LLM_STAGES.EDITOR_REPAIR, { qualityAttempt: 1, totalAttempts: 2 });

  await llmClient.callLlmJson(editorStage, 'system', 'prompt', {}, { provider: fakeProvider('base-editor-model') });
  // repair가 나중에, 그리고 다른 model로 실행된 상태. draft 자체는 이 stage가 다시 썼다.
  await llmClient.callLlmJson(repairStage, 'system', 'prompt', {}, { provider: fakeProvider('repair-model') });

  const artifact = editorDraftArtifact(emptyEditor, '2026-08-30');
  assert.equal(artifact.model.providerModel, 'base-editor-model');
});

// 정확한 귀속이 필요해지면 draft를 만든 생산자가 자기 model을 넘기면 된다. 그 seam이
// options.providerModel이고, 진단 조회보다 우선한다. 배선만 없을 뿐 자리는 이미 있다.
test('생산자가 넘긴 providerModel은 repair 기록이 있어도 이긴다', async () => {
  llmClient.resetLlmDiagnostics();
  const editorStage = stageRun(LLM_STAGES.EDITOR, { qualityAttempt: 1, totalAttempts: 2 });
  const repairStage = stageRun(LLM_STAGES.EDITOR_REPAIR, { qualityAttempt: 1, totalAttempts: 2 });

  await llmClient.callLlmJson(editorStage, 'system', 'prompt', {}, { provider: fakeProvider('base-editor-model') });
  await llmClient.callLlmJson(repairStage, 'system', 'prompt', {}, { provider: fakeProvider('repair-model') });

  const artifact = editorDraftArtifact(emptyEditor, '2026-08-30', { providerModel: 'repair-model' });
  assert.equal(artifact.model.providerModel, 'repair-model');
});
