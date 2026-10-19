const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

// llm-client는 로드 시점에 재시도 설정과 raw output 경로를 읽는다. invalid JSON 재시도 테스트가
// 기다리지 않고, raw output이 저장소 .tmp에 남지 않도록 먼저 정한다.
process.env.GEMINI_MAX_RETRIES = '1';
process.env.GEMINI_RETRY_DELAYS_MS = '0';
process.env.LLM_RAW_OUTPUT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'judge-cost-raw-'));

const llmClient = require('../../../shared/llm/llm-client');
const { buildCostReport } = require('../../../shared/llm/llm-cost');
const { LLM_STAGES } = require('../../../shared/llm/stage-catalog');

// post-generation judge는 generate와 다른 프로세스(`npm run validate:post-generation`)에서
// 돈다. 그래서 judge 호출은 generate가 쓴 cost report에 들어갈 수 없었다(#1203 원인 2).
// judge 프로세스가 generate의 리포트에 자기 호출을 더해 다시 쓰는지 LLM 없이 확인한다.

const VALIDATOR_PATH = require.resolve('../../validate/validate-llm-publication-quality');
const DATE = '2026-09-28';
const { weeklyKeyForDate } = require('../../reporter/weekly-newsletter');
const JUDGE_STAGE_ID = LLM_STAGES.POST_GENERATION_QUALITY_JUDGE.id;
// cost-report.md의 Stage 칸은 사람이 읽는 label을 쓴다.
const JUDGE_LABEL_PATTERN = /\| post-generation public quality judge \|/;

function fakeProvider({ verdict, costUsd = 0.01, models = ['fake-judge-model'], rawText = null, onRequest = () => {} }) {
  return {
    id: 'fake',
    displayName: 'Fake',
    pricingSource: 'fake://pricing',
    getApiKey() { return 'fake-key'; },
    missingCredentialMessage: 'missing fake credential',
    configuredModelsForGroup() { return models; },
    createModelContext() { return {}; },
    describeModelContext() { return ''; },
    buildRequest(input) { onRequest(input); return { request: { model: input.model }, thinkingBudget: null }; },
    async execute() { return { text: rawText ?? JSON.stringify(verdict) }; },
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

function setupRoot({ runDate = DATE, reportDate = runDate, writeReport = true, warnCostUsd = 0.15 } = {}) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'judge-cost-'));
  const weeklyKey = weeklyKeyForDate(runDate);
  const newsletterDir = path.join(rootDir, 'articles', 'newsletters', weeklyKey);
  fs.mkdirSync(newsletterDir, { recursive: true });
  fs.writeFileSync(path.join(newsletterDir, 'newsletter.md'), '# Newsletter\n', 'utf8');
  fs.writeFileSync(path.join(newsletterDir, 'index.html'), '<html><body>Newsletter</body></html>', 'utf8');
  fs.writeFileSync(path.join(newsletterDir, 'issue.json'), JSON.stringify({ weekly_key: weeklyKey, coverage_week_key: '2026-W39' }));
  fs.mkdirSync(path.join(rootDir, 'articles/data'), { recursive: true });
  fs.writeFileSync(path.join(rootDir, 'articles/data/newsletters-weekly.json'), JSON.stringify([
    { weeklyKey, date: runDate, html: 'newsletters/' + weeklyKey + '/index.html', md: 'newsletters/' + weeklyKey + '/newsletter.md' }
  ]));
  fs.mkdirSync(path.join(rootDir, 'articles', 'content', 'newsroom', runDate), { recursive: true });
  fs.mkdirSync(path.join(rootDir, '.tmp'), { recursive: true });
  if (writeReport) {
    const report = buildCostReport({
      date: reportDate,
      warnCostUsd,
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
async function runJudge(rootDir, verdict, providerOptions = {}, runDate = DATE) {
  const previousCwd = process.cwd();
  process.chdir(rootDir);
  delete require.cache[VALIDATOR_PATH];
  llmClient.resetLlmDiagnostics();
  try {
    const { validateLlmPublicationQuality } = require(VALIDATOR_PATH);
    return await validateLlmPublicationQuality({ date: runDate, provider: fakeProvider({ verdict, ...providerOptions }) });
  } finally {
    process.chdir(previousCwd);
    delete require.cache[VALIDATOR_PATH];
  }
}

// console.warn을 잡아 [cost] 경고 문구를 확인한다.
function captureWarnings(t) {
  const warn = t.mock.method(console, 'warn', () => {});
  return () => warn.mock.calls.map(call => String(call.arguments[0]));
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

test('generate 리포트가 없으면 judge 호출만으로 리포트를 만들지 않는다', async t => {
  const warnings = captureWarnings(t);
  const rootDir = setupRoot({ writeReport: false });
  await runJudge(rootDir, passVerdict);

  assert.equal(fs.existsSync(tmpReportPath(rootDir)), false);
  assert.equal(fs.existsSync(markdownReportPath(rootDir)), false);
  // 존재 검사로 건너뛴 것이지, 읽기 예외가 catch로 삼켜진 것이 아니어야 한다.
  assert.ok(warnings().some(line => /newsroom-cost-report\.json not found/.test(line)), warnings().join('\n'));
  assert.ok(!warnings().some(line => /Failed to add post-generation judge calls/.test(line)));
});

// callLlmJson 자체가 throw해도(모든 모델이 invalid JSON) 응답을 받은 judge 호출은 리포트에 남는다.
// llm-client는 JSON 파싱 전에 cost call을 기록하므로 모델 2개 x 시도 2번(GEMINI_MAX_RETRIES=1) = 4건이다.
test('judge 호출이 throw해도 원래 에러가 그대로 나오고 응답받은 호출은 기록된다', async () => {
  const rootDir = setupRoot();
  await assert.rejects(
    () => runJudge(rootDir, passVerdict, { rawText: 'not json', models: ['fake-judge-a', 'fake-judge-b'] }),
    /API failed for all configured models/
  );

  const report = readTmpReport(rootDir);
  assert.equal(judgeCalls(report).length, 4);
  assert.equal(report.calls.length, 6);
  assert.equal(report.totals.request_count, 6);
});

// 비용 기록은 warning-only 회계라 판정 결과를 바꾸면 안 된다.
test('cost report가 깨진 JSON이어도 judge 판정은 그대로 통과한다', async t => {
  const warnings = captureWarnings(t);
  const rootDir = setupRoot({ writeReport: false });
  fs.writeFileSync(tmpReportPath(rootDir), '{ broken', 'utf8');

  const result = await runJudge(rootDir, passVerdict);
  assert.equal(result.overall_pass, true);
  assert.equal(fs.readFileSync(tmpReportPath(rootDir), 'utf8'), '{ broken');
  assert.ok(warnings().some(line => /Failed to add post-generation judge calls/.test(line)), warnings().join('\n'));
});

test('병합한 리포트는 generate의 threshold로 경고를 다시 계산해 찍는다', async t => {
  const warnings = captureWarnings(t);
  // generate 리포트의 경고 기준은 0.05다. 합계 0.06은 기본값(0.15)으로는 경고가 아니다.
  const rootDir = setupRoot({ warnCostUsd: 0.05 });
  await runJudge(rootDir, passVerdict);

  const report = readTmpReport(rootDir);
  assert.equal(report.warning_threshold_usd, 0.05);
  const expected = 'Estimated LLM cost 0.06 USD reached NEWSROOM_WARN_COST_USD 0.05 USD.';
  assert.ok(report.warnings.includes(expected), report.warnings.join('\n'));
  assert.ok(warnings().includes(`[cost] ${expected}`), warnings().join('\n'));
});

test('weekly-only judge binds actual execution, publication week and independent coverage week', async () => {
  const runDate = '2026-10-22';
  const rootDir = setupRoot({ runDate });
  const indexPath = path.join(rootDir, 'articles/data/newsletters-weekly.json');
  const entries = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  entries[0].date = '2026-10-19';
  fs.writeFileSync(indexPath, JSON.stringify(entries));
  const statusPath = path.join(rootDir, 'articles/content/newsroom', runDate, 'generation-status.json');
  fs.writeFileSync(statusPath, JSON.stringify({ publication_mode: 'fallback_public' }));
  let input;
  const report = await runJudge(rootDir, passVerdict, { onRequest(request) { input = JSON.parse(request.prompt.slice(request.prompt.indexOf('{'))); } }, runDate);
  assert.equal(input.execution_date, runDate);
  assert.equal(input.publication_week_key, '2026-W43');
  assert.equal(input.coverage_week_key, '2026-W39');
  assert.equal(input.newsletter_entry.date, '2026-10-19');
  assert.equal(input.generation_status.publication_mode, 'fallback_public');
  assert.match(input.markdown, /Newsletter/);
  assert.equal(report.date, runDate);
  assert.ok(fs.existsSync(path.join(path.dirname(statusPath), 'llm-publication-quality-report.json')));
  assert.equal(fs.existsSync(path.join(rootDir, 'articles/newsletters', runDate)), false);
});

test('weekly judge handles ISO year boundary without deriving a week from coverage', async () => {
  const runDate = '2027-01-01';
  const rootDir = setupRoot({ runDate });
  let input;
  await runJudge(rootDir, passVerdict, { onRequest(request) { input = JSON.parse(request.prompt.slice(request.prompt.indexOf('{'))); } }, runDate);
  assert.equal(input.publication_week_key, '2026-W53');
  assert.equal(input.execution_date, runDate);
});

for (const defect of ['missing index', 'invalid index', 'missing entry', 'wrong route', 'missing issue', 'wrong issue week', 'missing markdown', 'empty html']) {
  test('weekly judge rejects ' + defect + ' before calling provider despite stale dated files', async () => {
    const rootDir = setupRoot();
    const indexPath = path.join(rootDir, 'articles/data/newsletters-weekly.json');
    const weeklyDir = path.join(rootDir, 'articles/newsletters', weeklyKeyForDate(DATE));
    const datedDir = path.join(rootDir, 'articles/newsletters', DATE);
    fs.mkdirSync(datedDir);
    fs.writeFileSync(path.join(datedDir, 'index.html'), '<p>stale</p>');
    fs.writeFileSync(path.join(datedDir, 'newsletter.md'), 'stale');
    if (defect === 'missing index') fs.unlinkSync(indexPath);
    if (defect === 'invalid index') fs.writeFileSync(indexPath, '{}');
    if (defect === 'missing entry') fs.writeFileSync(indexPath, '[]');
    if (defect === 'wrong route') {
      const entries = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      entries[0].html = 'newsletters/' + DATE + '/index.html';
      fs.writeFileSync(indexPath, JSON.stringify(entries));
    }
    if (defect === 'missing issue') fs.unlinkSync(path.join(weeklyDir, 'issue.json'));
    if (defect === 'wrong issue week') fs.writeFileSync(path.join(weeklyDir, 'issue.json'), '{"weekly_key":"2026-W01"}');
    if (defect === 'missing markdown') fs.unlinkSync(path.join(weeklyDir, 'newsletter.md'));
    if (defect === 'empty html') fs.writeFileSync(path.join(weeklyDir, 'index.html'), '  ');
    let calls = 0;
    await assert.rejects(() => runJudge(rootDir, passVerdict, { onRequest() { calls += 1; } }), /Invalid public weekly index|public weekly issue.json|Missing public/);
    assert.equal(calls, 0);
    assert.equal(judgeCalls(readTmpReport(rootDir)).length, 0);
  });
}

test('weekly judge sees the accumulated issue tail beyond previous daily truncation limits', async () => {
  const rootDir = setupRoot();
  const weeklyDir = path.join(rootDir, 'articles/newsletters', weeklyKeyForDate(DATE));
  fs.writeFileSync(path.join(weeklyDir, 'newsletter.md'), 'x'.repeat(21000) + ' FINAL_MARKDOWN_ARTICLE');
  fs.writeFileSync(path.join(weeklyDir, 'index.html'), '<p>' + 'x'.repeat(13000) + ' FINAL_HTML_ARTICLE</p>');
  let input;
  const report = await runJudge(rootDir, passVerdict, { onRequest(request) { input = JSON.parse(request.prompt.slice(request.prompt.indexOf('{'))); } });
  assert.ok(input.markdown.endsWith('FINAL_MARKDOWN_ARTICLE'));
  assert.ok(input.html_text.endsWith('FINAL_HTML_ARTICLE'));
  assert.equal(report.publication_week_key, '2026-W40');
  assert.equal(report.coverage_week_key, '2026-W39');
});
