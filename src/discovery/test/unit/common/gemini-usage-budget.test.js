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
        source_discovery: { optional: true },
        // 배선된 적 없는 필수 stage. 한도 초과 시 필수 stage는 막지 않는다는 규칙이 살아
        // 있는지 확인하려고 남긴다(#979 9번: 실제 파이프라인에는 아직 필수 stage가 없다).
        final_generation: { optional: false }
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
        { stage_key: 'source_discovery#0', stage_id: 'source_discovery', model: 'gemini-2.5-flash' },
        { stage_key: 'source_discovery#0', stage_id: 'source_discovery', model: 'gemini-2.5-flash' }
      ]
    }
  });

  assert.deepEqual(counts.source_discovery, {
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
    cost_report: { calls: [{ stage_key: 'source_discovery#0', stage_id: 'source_discovery' }] }
  });

  assert.equal(budget.canRequest('source_discovery').ok, false);
  assert.equal(budget.canRequest('final_generation').ok, true);
  const report = budget.report({ date: '2026-05-16' });
  assert.equal(report.budget_status, 'hard_limit_reached');
  assert.equal(report.budget_over_hard_limit_required_stage, true);
});

// 아래는 리뷰가 짚은 미커버 계약이다(#993). fixture가 늘 stage 하나뿐이라 "stage별로 갈라
// 센다"는 성질 자체가 증명되지 않았고, stage_id 누락 누수와 게이트가 던지는 경로도
// 실행된 적이 없었다.

function usageEntry(stageId, models) {
  return {
    stage_key: `${stageId}#0`,
    stage_id: stageId,
    quality_attempt: 0,
    label: stageId,
    parent_run_key: null,
    models
  };
}

test('stage가 둘이면 버킷도 둘로 갈린다', () => {
  const counts = diagnosticStageCounts({
    model_usage: {
      'source_discovery#0': usageEntry('source_discovery', { m: { requests: 3, api_errors: 1 } }),
      'reporter#1': usageEntry('reporter', { m: { requests: 2 } })
    },
    cost_report: {
      calls: [
        { stage_id: 'source_discovery' },
        { stage_id: 'reporter' },
        { stage_id: 'reporter' }
      ]
    }
  });

  assert.deepEqual(Object.keys(counts).sort(), ['reporter', 'source_discovery']);
  assert.equal(counts.source_discovery.requested_attempts, 3);
  assert.equal(counts.source_discovery.successful_responses, 1);
  assert.equal(counts.source_discovery.failed_attempts, 1);
  assert.equal(counts.reporter.requested_attempts, 2);
  assert.equal(counts.reporter.successful_responses, 2);
});

// 두 소스(model_usage / cost call)가 서로 다른 stage를 가리키면 합계는 맞는데 귀속이
// 어긋난다. 조인이 끊긴 상태가 정확히 이 모양이라 버킷 키로 드러나야 한다.
test('두 소스가 다른 stage를 가리키면 버킷이 갈려 드러난다', () => {
  const counts = diagnosticStageCounts({
    model_usage: { 'source_discovery#0': usageEntry('source_discovery', { m: { requests: 1 } }) },
    cost_report: { calls: [{ stage_id: 'reporter' }] }
  });

  assert.deepEqual(Object.keys(counts).sort(), ['reporter', 'source_discovery']);
  assert.equal(counts.source_discovery.successful_responses, 0);
  assert.equal(counts.reporter.requested_attempts, 0);
});

// stage_id는 stageRunIdentity가 항상 채우므로 이 버킷이 보이면 계약 위반이다.
// 조용히 사라지지 않고 unknown으로 모이는지 고정한다.
test('stage_id가 없는 항목은 unknown 버킷에 모인다', () => {
  const counts = diagnosticStageCounts({
    model_usage: { 'mystery#0': { models: { m: { requests: 2 } } } },
    cost_report: { calls: [{ model: 'm' }] }
  });

  assert.deepEqual(Object.keys(counts), ['unknown']);
  assert.equal(counts.unknown.requested_attempts, 2);
  assert.equal(counts.unknown.successful_responses, 1);
});

test('config에 없는 stage는 optional로 취급되어 한도 초과 시 차단된다', () => {
  const budget = createGeminiUsageBudget({ config: config() });
  budget.mergeDiagnostics({
    model_usage: { 'source_discovery#0': usageEntry('source_discovery', { m: { requests: 3 } }) },
    cost_report: { calls: [] }
  });

  // 배포 config는 source_discovery 하나만 나열한다. 나머지 budgeted stage는 미등재라
  // optional 기본값으로 떨어지고, 한도를 넘기면 막힌다.
  assert.equal(budget.canRequest('editorial_plan').ok, false);
  assert.throws(() => budget.assertCanRequest('editorial_plan'), /hard limit reached before optional stage/);

  const report = budget.report({ date: '2026-08-30' });
  assert.deepEqual(report.optional_stages_skipped, [
    { stage: 'editorial_plan', reason: 'hard_limit_reached_before_editorial_plan' }
  ]);
});

test('리포트가 스키마 버전을 싣는다', () => {
  const budget = createGeminiUsageBudget({ config: config() });
  assert.equal(budget.report({ date: '2026-08-30' }).schema_version, 2);
});
