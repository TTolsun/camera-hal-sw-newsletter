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
