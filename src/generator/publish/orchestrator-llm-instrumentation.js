// 발행 orchestrator의 LLM-call 계측 래퍼(#655, #398).
// 모든 LLM 단계(reporter/editor/repair/factcheck/background-context/judge)가 callLlmJson
// 한 지점을 통과하므로, 여기서 stageTracker의 start/pass/fail만 기록하면 내부 시퀀스 전체가
// 잡힌다. 기록 전용이라 결과나 게이트 판정에 영향이 없다. 의존성은 모두 module-level import
// (callLlmJsonRaw, roleFromStageLabel)와 generationRunState 싱글턴이라 god-file-local 함수 주입이
// 없어 god-file을 import하지 않는다(순환 없음). 같은 이름으로 재노출해 god-file의 모든 호출처와
// publicArticleJudgeDeps 주입을 그대로 유지한다. 이 모듈은 후속 slice가 import하는 핵심 seam이다.
const { callLlmJson: callLlmJsonRaw } = require('../../shared/llm/llm-client');
const { roleFromStageLabel } = require('../select/stage-status-tracker');
const { generationRunState } = require('./orchestrator-run-state');

async function callLlmJson(stage, ...args) {
  const role = roleFromStageLabel(stage);
  const attempt = generationRunState.currentQualityAttempt;
  generationRunState.stageTracker.start(role, attempt, stage);
  try {
    const result = await callLlmJsonRaw(stage, ...args);
    generationRunState.stageTracker.pass(role, attempt, stage);
    return result;
  } catch (error) {
    generationRunState.stageTracker.fail(role, attempt, stage, error && error.message);
    throw error;
  }
}

module.exports = { callLlmJson };
