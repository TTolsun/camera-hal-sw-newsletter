'use strict';

// LLM 호출 진단 상태(#982).
//
// 항목의 키는 사람이 읽는 label이 아니라 canonical stage run key(`<stage id>#<quality attempt>`)다.
// 예전에는 label이 곧 키였고, 그래서 조회하는 쪽이 키를 얻으려고 label을 byte 단위로 다시
// 조립해야 했다. 지금은 catalog의 stageRunKey 하나만 키 형식을 안다.
//
// label은 지우지 않는다. 각 항목이 stageRunIdentity로 stage_id·quality_attempt·label·
// parent_run_key를 함께 싣는다 -- 키는 기계가, label은 사람이 읽는다.

const {
  STAGE_KEY_FORMAT,
  assertStageDefinition,
  stageRunIdentity,
  stageRunKey
} = require('./stage-catalog');

function createDiagnosticsState() {
  const diagnostics = {
    // model_usage / model_routing의 키와 cost_report.calls[].stage_key가 어느 형식인지
    // 알리는 표식. 호환 목적이 아니라 과거 아티팩트와 구분하기 위한 것이다.
    stage_key_format: STAGE_KEY_FORMAT,
    quota_error_count: 0,
    invalid_json_count: 0,
    model_usage: {},
    model_routing: {},
    cost_report: {
      calls: []
    }
  };
  // "이 run key가 마지막으로 성공한 model"과 "이 stage가 마지막으로 성공한 model"은 다른
  // 질문이다. 후자는 quality attempt를 특정하지 못하는 호출자(editor draft artifact writer)가
  // 쓴다.
  const modelByRunKey = new Map();
  const modelByStageId = new Map();

  function usageFor(run, modelName) {
    const key = stageRunKey(run);
    if (!diagnostics.model_usage[key]) {
      diagnostics.model_usage[key] = { ...stageRunIdentity(run), models: {} };
    }
    const models = diagnostics.model_usage[key].models;
    if (!models[modelName]) {
      models[modelName] = {
        requests: 0,
        successes: 0,
        invalid_json: 0,
        quota_errors: 0,
        api_errors: 0
      };
    }
    return models[modelName];
  }

  return {
    clone() {
      return JSON.parse(JSON.stringify(diagnostics));
    },

    costCalls() {
      return this.clone().cost_report.calls;
    },

    getModelUsage(run) {
      return modelByRunKey.get(stageRunKey(run)) || '';
    },

    // quality attempt를 모르는 호출자를 위한 조회. 이 stage가 이번 실행에서 마지막으로
    // 성공한 model을 돌려준다.
    getLastModelForStage(definition) {
      return modelByStageId.get(assertStageDefinition(definition).id) || '';
    },

    recordApiError(run, modelName) {
      usageFor(run, modelName).api_errors += 1;
    },

    recordCostCall(call) {
      diagnostics.cost_report.calls.push(call);
    },

    recordModelRouting(run, routing) {
      // 정체성을 나중에 편다. 항목이 map의 키와 어긋나면 그 항목은 아무것도 가리키지 못하므로,
      // routing이 같은 이름의 필드를 들고 와도 정체성 쪽이 이긴다.
      diagnostics.model_routing[stageRunKey(run)] = {
        ...routing,
        ...stageRunIdentity(run)
      };
    },

    recordInvalidJson(run, modelName) {
      diagnostics.invalid_json_count += 1;
      usageFor(run, modelName).invalid_json += 1;
    },

    recordQuotaError(run, modelName) {
      diagnostics.quota_error_count += 1;
      usageFor(run, modelName).quota_errors += 1;
    },

    recordRequest(run, modelName) {
      usageFor(run, modelName).requests += 1;
    },

    recordSuccess(run, modelName) {
      usageFor(run, modelName).successes += 1;
      modelByRunKey.set(stageRunKey(run), modelName);
      modelByStageId.set(run.definition.id, modelName);
    },

    reset() {
      diagnostics.quota_error_count = 0;
      diagnostics.invalid_json_count = 0;
      diagnostics.model_usage = {};
      diagnostics.model_routing = {};
      diagnostics.cost_report = { calls: [] };
      modelByRunKey.clear();
      modelByStageId.clear();
    }
  };
}

module.exports = {
  createDiagnosticsState
};
