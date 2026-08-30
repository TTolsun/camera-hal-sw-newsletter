const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createGeminiUsageBudget,
  diagnosticStageCounts
} = require('../../../gemini-usage-budget');

function config(overrides = {}) {
  return {
    geminiUsageBudget: {
      enabled: true,
      targetCallsPerRun: 2,
      softLimitCallsPerRun: 2,
      hardLimitCallsPerRun: 3,
      stages: {
        sourceDiscovery: { optional: true },
        finalGeneration: { optional: false }
      },
      ...overrides
    }
  };
}

test('budget report separates requested attempts, successful responses, and failures', () => {
  const counts = diagnosticStageCounts({
    model_usage: {
      'source_discovery#0': {
        stage_key: 'source_discovery#0',
        stage_id: 'source_discovery',
        quality_attempt: 0,
        label: 'sourceDiscovery',
        parent_run_key: null,
        models: {
          'gemini-2.5-flash': {
            requests: 3,
            successes: 1,
            invalid_json: 1,
            quota_errors: 0,
            api_errors: 1
          }
        }
      }
    },
    cost_report: {
      calls: [
        { stage_key: 'source_discovery#0', model: 'gemini-2.5-flash' },
        { stage_key: 'source_discovery#0', model: 'gemini-2.5-flash' }
      ]
    }
  });

  assert.deepEqual(counts['source_discovery#0'], {
    requested_attempts: 3,
    successful_responses: 2,
    failed_attempts: 2
  });
});

test('optional stages are blocked after hard limit while required stages are reported', () => {
  const budget = createGeminiUsageBudget({ config: config() });
  budget.mergeDiagnostics({
    model_usage: {
      'source_discovery#0': {
        stage_key: 'source_discovery#0',
        stage_id: 'source_discovery',
        quality_attempt: 0,
        label: 'sourceDiscovery',
        parent_run_key: null,
        models: {
          model: {
            requests: 3,
            successes: 1,
            invalid_json: 0,
            quota_errors: 1,
            api_errors: 1
          }
        }
      }
    },
    cost_report: { calls: [{ stage_key: 'source_discovery#0' }] }
  });

  assert.equal(budget.canRequest('sourceDiscovery').ok, false);
  assert.equal(budget.canRequest('finalGeneration').ok, true);
  const report = budget.report({ date: '2026-05-16' });
  assert.equal(report.budget_status, 'hard_limit_reached');
  assert.equal(report.budget_over_hard_limit_required_stage, true);
});
