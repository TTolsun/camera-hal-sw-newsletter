const { stageDefinitionById } = require('../../llm/stage-catalog');

// 예산 config는 LLM stage id 어휘를 쓴다(#993). 예전에는 작업 이름을 썼고, 그중 하나가
// stage label과 철자가 같아 우연히 조인되다가 #982에서 조용히 끊겼다. 그 침묵이 3개월
// 갔으므로, 어휘가 어긋나는 순간 config 검증에서 잡는다 -- 런타임에 던지면 수집·발굴
// 자체를 막으니 발행 전 검증 단계가 맞는 자리다.
function validateStageKeys(errors, path, keys) {
  for (const key of keys) {
    if (!stageDefinitionById(key)) {
      errors.push(`${path}.${key} is not a stage id in the LLM stage catalog.`);
    }
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validatePositiveInteger(errors, path, value) {
  if (!Number.isInteger(value) || value < 0) {
    errors.push(`${path} must be an integer >= 0.`);
  }
}

function validateNewsroomBudgetConfig(config) {
  const errors = [];

  if (!isPlainObject(config)) {
    return { ok: false, errors: ['root must be an object.'] };
  }
  if (config.schemaVersion !== 1) {
    errors.push('schemaVersion must be 1.');
  }

  const budget = config.geminiUsageBudget;
  if (!isPlainObject(budget)) {
    errors.push('geminiUsageBudget must be an object.');
    return { ok: false, errors };
  }
  if (typeof budget.enabled !== 'boolean') {
    errors.push('geminiUsageBudget.enabled must be a boolean.');
  }

  validatePositiveInteger(errors, 'geminiUsageBudget.targetCallsPerRun', budget.targetCallsPerRun);
  validatePositiveInteger(errors, 'geminiUsageBudget.softLimitCallsPerRun', budget.softLimitCallsPerRun);
  validatePositiveInteger(errors, 'geminiUsageBudget.hardLimitCallsPerRun', budget.hardLimitCallsPerRun);

  if (
    Number.isInteger(budget.targetCallsPerRun) &&
    Number.isInteger(budget.softLimitCallsPerRun) &&
    budget.softLimitCallsPerRun < budget.targetCallsPerRun
  ) {
    errors.push('geminiUsageBudget.softLimitCallsPerRun must be >= targetCallsPerRun.');
  }
  if (
    Number.isInteger(budget.softLimitCallsPerRun) &&
    Number.isInteger(budget.hardLimitCallsPerRun) &&
    budget.hardLimitCallsPerRun < budget.softLimitCallsPerRun
  ) {
    errors.push('geminiUsageBudget.hardLimitCallsPerRun must be >= softLimitCallsPerRun.');
  }

  if (!isPlainObject(budget.allocation)) {
    errors.push('geminiUsageBudget.allocation must be an object.');
  } else {
    for (const [stage, value] of Object.entries(budget.allocation)) {
      validatePositiveInteger(errors, `geminiUsageBudget.allocation.${stage}`, value);
    }
    validateStageKeys(errors, 'geminiUsageBudget.allocation', Object.keys(budget.allocation));
  }

  if (!isPlainObject(budget.stages)) {
    errors.push('geminiUsageBudget.stages must be an object.');
  } else {
    for (const [stage, value] of Object.entries(budget.stages)) {
      if (!isPlainObject(value)) {
        errors.push(`geminiUsageBudget.stages.${stage} must be an object.`);
        continue;
      }
      if (typeof value.optional !== 'boolean') {
        errors.push(`geminiUsageBudget.stages.${stage}.optional must be a boolean.`);
      }
    }
    validateStageKeys(errors, 'geminiUsageBudget.stages', Object.keys(budget.stages));
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

function validateNewsroomBudgetConfigText(text) {
  try {
    return validateNewsroomBudgetConfig(JSON.parse(text));
  } catch (error) {
    return {
      ok: false,
      errors: [`Invalid JSON: ${error.message}`]
    };
  }
}

module.exports = {
  validateNewsroomBudgetConfig,
  validateNewsroomBudgetConfigText
};
