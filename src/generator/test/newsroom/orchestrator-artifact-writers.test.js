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
