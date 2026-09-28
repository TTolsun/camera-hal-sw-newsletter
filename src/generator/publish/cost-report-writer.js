// newsroom cost report 파일 writer — `.tmp/newsroom-cost-report.json`과 newsroom `cost-report.md`를 쓴다.
// generate 프로세스(writeCostReport)와 post-generation judge 프로세스가 같은 경로·형식으로 쓰도록 한곳에 둔다(#1203).

const fs = require('fs');
const path = require('path');
const { buildCostReport, buildCostReportMarkdown } = require('../../shared/llm/llm-client');
const { ensureArray } = require('../../shared/common/value-coercion');
const { newsroomDir: artifactNewsroomDir } = require('../../shared/common/artifact-paths');

function costReportTmpPath(rootDir) {
  return path.join(rootDir, '.tmp', 'newsroom-cost-report.json');
}

function writeCostReportFiles(report, date, rootDir) {
  fs.mkdirSync(path.join(rootDir, '.tmp'), { recursive: true });
  fs.writeFileSync(costReportTmpPath(rootDir), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const targetNewsroomDir = artifactNewsroomDir(rootDir, date);
  if (fs.existsSync(targetNewsroomDir)) {
    fs.writeFileSync(path.join(targetNewsroomDir, 'cost-report.md'), buildCostReportMarkdown(report), 'utf8');
  }
}

/**
 * 다른 프로세스에서 나간 한 stage의 호출을 generate가 남긴 cost report에 합쳐 다시 쓴다.
 *
 * - 합칠 기준은 같은 날짜의 generate 리포트뿐이다. 파일이 없거나 날짜가 다르면 건너뛴다.
 *   이 stage 호출만으로 리포트를 새로 쓰면 generate 호출이 빠진 합계가 완전한 리포트처럼
 *   커밋되고, 다른 날짜 리포트와 섞으면 두 run의 비용이 한 호에 붙기 때문이다.
 * - 같은 stage_id의 기존 호출은 빼고 이번 호출을 더한다. 같은 날짜로 다시 돌려도
 *   그 stage 호출이 쌓이지 않는다(멱등).
 * - 합계·경고는 writeCostReport와 같은 빌더로 다시 계산하고, 경고 threshold는 generate 리포트의 값을 그대로 쓴다.
 */
function mergeStageCallsIntoCostReport({ date, stageId, calls, rootDir }) {
  const tmpPath = costReportTmpPath(rootDir);
  if (!fs.existsSync(tmpPath)) {
    console.warn(`[cost] ${path.relative(rootDir, tmpPath)} not found; ${stageId} calls were not added to the cost report.`);
    return null;
  }
  const existing = JSON.parse(fs.readFileSync(tmpPath, 'utf8'));
  if (existing?.date !== date) {
    console.warn(`[cost] Cost report date ${existing?.date || 'unknown'} does not match ${date}; ${stageId} calls were not added.`);
    return null;
  }

  const keptCalls = ensureArray(existing.calls).filter(call => call?.stage_id !== stageId);
  const report = buildCostReport({
    date,
    calls: [...keptCalls, ...ensureArray(calls)],
    warnCostUsd: existing.warning_threshold_usd,
    maxCostUsd: existing.max_threshold_usd
  });
  writeCostReportFiles(report, date, rootDir);
  console.log(`[cost] Added ${ensureArray(calls).length} ${stageId} call(s); estimated LLM API cost is now $${Number(report.totals.estimated_cost_usd || 0).toFixed(6)} USD across ${report.totals.request_count || 0} request(s).`);
  return report;
}

module.exports = {
  mergeStageCallsIntoCostReport,
  writeCostReportFiles
};
