const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const llmClient = require('../../../shared/llm/llm-client');
const { buildCostReport } = require('../../../shared/llm/llm-cost');
const { LLM_STAGES } = require('../../../shared/llm/stage-catalog');

// post-generation judge는 generate와 다른 프로세스(`npm run validate:post-generation`)에서
// 돈다. 그래서 judge 호출은 generate가 쓴 cost report에 들어갈 수 없었다(#1203 원인 2).
// judge 프로세스가 generate의 리포트에 자기 호출을 더해 다시 쓰는지 LLM 없이 확인한다.

const VALIDATOR_PATH = require.resolve('../../validate/validate-llm-publication-quality');
const DATE = '2026-09-28';
const JUDGE_STAGE_ID = LLM_STAGES.POST_GENERATION_QUALITY_JUDGE.id;
// cost-report.md의 Stage 칸은 사람이 읽는 label을 쓴다.
const JUDGE_LABEL_PATTERN = /\| post-generation public quality judge \|/;

function fakeProvider({ verdict, costUsd = 0.01 }) {
  return {
    id: 'fake',
    displayName: 'Fake',
    pricingSource: 'fake://pricing',
    getApiKey() { return 'fake-key'; },
    missingCredentialMessage: 'missing fake credential',
    configuredModelsForGroup() { return ['fake-judge-model']; },
    createModelContext() { return {}; },
    describeModelContext() { return ''; },
    buildRequest({ model }) { return { request: { model }, thinkingBudget: null }; },
    async execute() { return { text: JSON.stringify(verdict) }; },
    textFromResponse(response) { return response.text; },
    usageMetadataFromResponse() { return { usage_metadata_present: true }; },
    estimateCallCost() {
      return {
        prompt_tokens: 100,
        output_tokens: 10,
        thinking_tokens: 0,
        cached_tokens: 0,
        total_tokens: 110,
        billable_input_tokens: 100,
        billable_output_tokens: 10,
        estimated_cost_usd: costUsd,
        pricing_usd_per_million: {},
        pricing_source: 'fake://pricing',
        pricing_warning: ''
      };
    },
    isProModel() { return false; },
    proPolicySummary() { return { status: 'disabled' }; }
  };
}

const passVerdict = { date: DATE, overall_pass: true, summary: 'ok', issues: [] };
const failVerdict = {
  date: DATE,
  overall_pass: false,
  summary: 'bad',
  issues: [{ field: 'markdown', severity: 'P1', reason: 'broken' }]
};

// generate 프로세스가 남긴 리포트 모양. 비용 합계는 이 호출 둘에서 나온다.
function generateCall(stageKey, stageId, costUsd) {
  return {
    provider: 'fake',
    stage_key: stageKey,
    stage_id: stageId,
    label: stageKey,
    model: 'fake-model',
    usage_metadata_present: true,
    prompt_tokens: 1000,
    output_tokens: 100,
    thinking_tokens: 0,
    cached_tokens: 0,
    total_tokens: 1100,
    billable_input_tokens: 1000,
    billable_output_tokens: 100,
    estimated_cost_usd: costUsd,
    pricing_source: 'fake://pricing',
    pricing_warning: ''
  };
}

function setupRoot({ reportDate = DATE, writeReport = true } = {}) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'judge-cost-'));
  const newsletterDir = path.join(rootDir, 'articles', 'newsletters', DATE);
  fs.mkdirSync(newsletterDir, { recursive: true });
  fs.writeFileSync(path.join(newsletterDir, 'newsletter.md'), '# Newsletter\n', 'utf8');
  fs.writeFileSync(path.join(newsletterDir, 'index.html'), '<html><body>Newsletter</body></html>', 'utf8');
  fs.mkdirSync(path.join(rootDir, 'articles', 'content', 'newsroom', DATE), { recursive: true });
  fs.mkdirSync(path.join(rootDir, '.tmp'), { recursive: true });
  if (writeReport) {
    const report = buildCostReport({
      date: reportDate,
      calls: [
        generateCall('editor#1', 'editor', 0.02),
        generateCall('fact_checker#1', 'fact_checker', 0.03)
      ]
    });
    fs.writeFileSync(path.join(rootDir, '.tmp', 'newsroom-cost-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }
  return rootDir;
}

function tmpReportPath(rootDir) {
  return path.join(rootDir, '.tmp', 'newsroom-cost-report.json');
}

function markdownReportPath(rootDir) {
  return path.join(rootDir, 'articles', 'content', 'newsroom', DATE, 'cost-report.md');
}

function readTmpReport(rootDir) {
  return JSON.parse(fs.readFileSync(tmpReportPath(rootDir), 'utf8'));
}

// validator는 모듈 로드 시점의 cwd를 root로 쓴다. 테스트마다 cwd를 임시 root로 바꾸고 새로 읽는다.
async function runJudge(rootDir, verdict) {
  const previousCwd = process.cwd();
  process.chdir(rootDir);
  delete require.cache[VALIDATOR_PATH];
  llmClient.resetLlmDiagnostics();
  try {
    const { validateLlmPublicationQuality } = require(VALIDATOR_PATH);
    return await validateLlmPublicationQuality({ date: DATE, provider: fakeProvider({ verdict }) });
  } finally {
    process.chdir(previousCwd);
    delete require.cache[VALIDATOR_PATH];
  }
}

function judgeCalls(report) {
  return report.calls.filter(call => call.stage_id === JUDGE_STAGE_ID);
}

test('judge 호출이 generate cost report에 더해지고 합계가 다시 계산된다', async () => {
  const rootDir = setupRoot();
  await runJudge(rootDir, passVerdict);

  const report = readTmpReport(rootDir);
  assert.equal(report.date, DATE);
  assert.equal(report.calls.length, 3);
  assert.equal(judgeCalls(report).length, 1);
  assert.equal(report.totals.request_count, 3);
  assert.equal(report.totals.estimated_cost_usd, 0.06);
  assert.ok(report.by_stage.some(group => group.stage_key === `${JUDGE_STAGE_ID}#0`));

  const markdown = fs.readFileSync(markdownReportPath(rootDir), 'utf8');
  assert.match(markdown, JUDGE_LABEL_PATTERN);
});

test('judge 판정이 실패해도 cost report는 갱신된다', async () => {
  const rootDir = setupRoot();
  await assert.rejects(() => runJudge(rootDir, failVerdict), /LLM publication quality validation failed/);

  const report = readTmpReport(rootDir);
  assert.equal(judgeCalls(report).length, 1);
  assert.equal(report.totals.request_count, 3);
  assert.match(fs.readFileSync(markdownReportPath(rootDir), 'utf8'), JUDGE_LABEL_PATTERN);
});

test('같은 날짜로 judge를 두 번 돌려도 judge 호출은 한 건만 남는다', async () => {
  const rootDir = setupRoot();
  await runJudge(rootDir, passVerdict);
  await runJudge(rootDir, passVerdict);

  const report = readTmpReport(rootDir);
  assert.equal(judgeCalls(report).length, 1);
  assert.equal(report.calls.length, 3);
  assert.equal(report.totals.estimated_cost_usd, 0.06);
});

test('generate 리포트의 날짜가 다르면 합치지도 덮어쓰지도 않는다', async () => {
  const rootDir = setupRoot({ reportDate: '2026-09-21' });
  const before = fs.readFileSync(tmpReportPath(rootDir), 'utf8');
  await runJudge(rootDir, passVerdict);

  assert.equal(fs.readFileSync(tmpReportPath(rootDir), 'utf8'), before);
  assert.equal(fs.existsSync(markdownReportPath(rootDir)), false);
});

test('generate 리포트가 없으면 judge 호출만으로 리포트를 만들지 않는다', async () => {
  const rootDir = setupRoot({ writeReport: false });
  await runJudge(rootDir, passVerdict);

  assert.equal(fs.existsSync(tmpReportPath(rootDir)), false);
  assert.equal(fs.existsSync(markdownReportPath(rootDir)), false);
});
