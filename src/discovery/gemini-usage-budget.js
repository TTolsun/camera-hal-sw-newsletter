const fs = require('fs');
const path = require('path');

const {
  readJson,
  writeJson
} = require('../shared/common/common');

const DEFAULT_BUDGET_PATH = path.join('config', 'newsroom-budget.json');
const BUDGET_STATUS = Object.freeze({
  OK: 'ok',
  SOFT_LIMIT_EXCEEDED: 'soft_limit_exceeded',
  HARD_LIMIT_REACHED: 'hard_limit_reached'
});

class GeminiUsageBudgetError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'GeminiUsageBudgetError';
    this.details = details;
    this.stage = details.stage || '';
  }
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function defaultStageCounts(config) {
  const stages = Object.keys(config?.geminiUsageBudget?.stages || {});
  return Object.fromEntries(stages.map(stage => [stage, {
    requested_attempts: 0,
    successful_responses: 0,
    failed_attempts: 0
  }]));
}

function loadNewsroomBudgetConfig(root = process.cwd(), configPath = DEFAULT_BUDGET_PATH) {
  return readJson(path.resolve(root, configPath));
}

function normalizeBudgetConfig(config = {}) {
  const budget = config.geminiUsageBudget || {};
  return {
    enabled: budget.enabled !== false,
    targetCallsPerRun: Number(budget.targetCallsPerRun ?? 700),
    softLimitCallsPerRun: Number(budget.softLimitCallsPerRun ?? 750),
    hardLimitCallsPerRun: Number(budget.hardLimitCallsPerRun ?? 850),
    allocation: isObject(budget.allocation) ? budget.allocation : {},
    stages: isObject(budget.stages) ? budget.stages : {}
  };
}

// stage_counts는 stage id로 묶는다(#993). 예산 config가 같은 어휘를 쓰므로 defaultStageCounts가
// 까는 키와 정확히 맞는다.
//
// 진단 항목의 키 자체는 canonical stage run key(`<id>#<quality attempt>`)지만 여기서는 쓰지
// 않는다. quality attempt는 발행 파이프라인의 재시도 회차인데 예산은 run 단위 총량 문제라
// 나눌 이유가 없다. 대신 #982가 모든 항목에 실어 둔 stage_id 필드를 읽는다 -- 키를 파싱하지
// 않는다.
function diagnosticStageCounts(diagnostics = {}) {
  const modelUsage = diagnostics.model_usage || {};
  const calls = Array.isArray(diagnostics.cost_report?.calls) ? diagnostics.cost_report.calls : [];
  const counts = {};

  function bucket(key) {
    if (!counts[key]) {
      counts[key] = {
        requested_attempts: 0,
        successful_responses: 0,
        failed_attempts: 0
      };
    }
    return counts[key];
  }

  for (const entry of Object.values(modelUsage)) {
    const stageBucket = bucket(String(entry?.stage_id || 'unknown'));
    for (const usage of Object.values(entry?.models || {})) {
      stageBucket.requested_attempts += Number(usage.requests || 0);
      stageBucket.failed_attempts +=
        Number(usage.invalid_json || 0) +
        Number(usage.quota_errors || 0) +
        Number(usage.api_errors || 0);
    }
  }

  for (const call of calls) {
    bucket(String(call.stage_id || 'unknown')).successful_responses += 1;
  }

  return counts;
}

function sumStageField(stageCounts, field) {
  return Object.values(stageCounts || {}).reduce((sum, item) => sum + Number(item?.[field] || 0), 0);
}

function mergeStageCounts(base = {}, next = {}) {
  const merged = JSON.parse(JSON.stringify(base));
  for (const [stage, counts] of Object.entries(next)) {
    if (!merged[stage]) {
      merged[stage] = {
        requested_attempts: 0,
        successful_responses: 0,
        failed_attempts: 0
      };
    }
    for (const field of ['requested_attempts', 'successful_responses', 'failed_attempts']) {
      merged[stage][field] = Number(counts[field] || 0);
    }
  }
  return merged;
}

function createGeminiUsageBudget({
  config,
  root = process.cwd(),
  configPath = DEFAULT_BUDGET_PATH
} = {}) {
  const rawConfig = config || (fs.existsSync(path.resolve(root, configPath))
    ? loadNewsroomBudgetConfig(root, configPath)
    : {});
  const budgetConfig = normalizeBudgetConfig(rawConfig);
  let stageCounts = defaultStageCounts(rawConfig);
  const optionalStagesSkipped = [];
  let budgetOverHardLimitRequiredStage = false;

  function stageOptional(stage) {
    return budgetConfig.stages?.[stage]?.optional !== false;
  }

  function requestedAttemptCount() {
    return sumStageField(stageCounts, 'requested_attempts');
  }

  function budgetStatus() {
    if (requestedAttemptCount() >= budgetConfig.hardLimitCallsPerRun) return BUDGET_STATUS.HARD_LIMIT_REACHED;
    if (requestedAttemptCount() > budgetConfig.softLimitCallsPerRun) return BUDGET_STATUS.SOFT_LIMIT_EXCEEDED;
    return BUDGET_STATUS.OK;
  }

  return {
    config: budgetConfig,

    canRequest(stage) {
      if (!budgetConfig.enabled) {
        return { ok: true, status: BUDGET_STATUS.OK, optional: stageOptional(stage) };
      }
      const status = budgetStatus();
      const optional = stageOptional(stage);
      if (status === BUDGET_STATUS.HARD_LIMIT_REACHED && optional) {
        return { ok: false, status, optional };
      }
      if (status === BUDGET_STATUS.HARD_LIMIT_REACHED && !optional) {
        budgetOverHardLimitRequiredStage = true;
      }
      return { ok: true, status, optional };
    },

    assertCanRequest(stage) {
      const result = this.canRequest(stage);
      if (!result.ok) {
        this.recordSkipped(stage, `hard_limit_reached_before_${stage}`);
        throw new GeminiUsageBudgetError(`Gemini usage budget hard limit reached before optional stage: ${stage}`, {
          stage,
          budget_status: result.status
        });
      }
      return result;
    },

    recordSkipped(stage, reason) {
      optionalStagesSkipped.push({ stage, reason });
    },

    mergeDiagnostics(diagnostics) {
      stageCounts = mergeStageCounts(stageCounts, diagnosticStageCounts(diagnostics));
    },

    report({ date = '', calls = [] } = {}) {
      const requested = requestedAttemptCount();
      const successful = sumStageField(stageCounts, 'successful_responses');
      const failed = sumStageField(stageCounts, 'failed_attempts');
      return {
        // 2: stage_counts와 예산 config의 키가 작업 이름에서 stage id로 바뀌었다(#993).
        schema_version: 2,
        report_type: 'gemini_usage',
        newsletter_date: date,
        target_calls_per_run: budgetConfig.targetCallsPerRun,
        soft_limit_calls_per_run: budgetConfig.softLimitCallsPerRun,
        hard_limit_calls_per_run: budgetConfig.hardLimitCallsPerRun,
        pre_call_guard_unit: 'logical_llm_call',
        retry_attempt_guard: false,
        requested_attempt_count: requested,
        successful_response_count: successful,
        failed_attempt_count: failed,
        stage_counts: stageCounts,
        budget_status: budgetStatus(),
        optional_stages_skipped: optionalStagesSkipped,
        budget_over_hard_limit_required_stage: budgetOverHardLimitRequiredStage,
        calls
      };
    },

    writeReport(filePath, options = {}) {
      const report = this.report(options);
      writeJson(filePath, report);
      return report;
    }
  };
}

module.exports = {
  BUDGET_STATUS,
  GeminiUsageBudgetError,
  createGeminiUsageBudget,
  diagnosticStageCounts,
  loadNewsroomBudgetConfig
};
