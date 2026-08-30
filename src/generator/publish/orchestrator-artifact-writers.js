// 발행 검토용 artifact writer — newsroom 디렉터리와 .tmp에 editor draft·canonical 검토 산출물·
// reporter 후보·generation status·cost/cache report를 기록한다(#655 god-file 분할). 본문은 추출 전과 동일하다.

const fs = require('fs');
const path = require('path');
const { writeJson } = require('../../shared/common/common');
const { readRuntimeConfig } = require('../../shared/common/runtime-config');
const { getLastLlmModelForStage, buildCostReport, buildCostReportMarkdown, getLlmCostCalls } = require('../../shared/llm/llm-client');
const { LLM_STAGES } = require('../../shared/llm/stage-catalog');
const { toEditorDraftArtifact } = require('../../shared/domain/newsletter-domain-normalize');
const { buildMarkdown, buildFactCheckMarkdown } = require('../render/newsletter-renderer');
const { buildQualityReportMarkdown } = require('../quality/newsletter-quality');
const { ensureArray } = require('../../shared/common/value-coercion');
const { newsroomDir: artifactNewsroomDir } = require('../../shared/common/artifact-paths');
const { buildSummaryCacheReport, buildSummaryCacheReportMarkdown } = require('../reporter/news-summary-cache');

const root = process.cwd();
const runtimeConfig = readRuntimeConfig(process.env);

/**
 * editor-draft.json에 실을 model 이름을 고른다.
 *
 * providerModel의 의미는 "이 run에서 base editor stage가 마지막으로 쓴 model"이다(#1002 1번).
 * 이보다 넓게 읽으면 안 된다. draft를 새로 쓰는 stage는 base editor 말고도 셋이 더 있기 때문이다.
 *
 * - editor.repair: orchestrator-repair-completion.js:229
 * - editor.completion: orchestrator-repair-completion.js:443
 * - *.semantic_repair: orchestrator-public-article-judge.js:43
 *   (:163-186이 그 결과 repairedEditor를 원본 editor 자리에 넣는다. 같은 파일 :124의
 *    public_article_judge_repair는 그 결과를 판정만 하고 draft를 쓰지 않는다 — :168에서
 *    runPublicArticleJudge의 stage 인자로만 쓰인다.)
 *
 * 이들 중 하나가 draft를 다시 쓴 실행에서도 여기 적히는 이름은 그 stage의 model이 아니라
 * base editor의 model이다. "마지막으로"인 이유는 llm-diagnostics.js:109가 quality attempt를
 * 구분하지 않고 stage id별로 덮어쓰기 때문이다. 그래서 fallback model로 넘어간 실행에서는
 * 더 이른 attempt의 draft에 마지막 attempt의 model 이름이 실릴 수 있다.
 *
 * "마지막에 draft를 쓴 stage"를 따라가도록 stage id 집합을 여기 열거하는 방식은 택하지
 * 않았다. 위 셋은 부모가 editor / editor.repair / editor.completion 셋이라 파생까지 하면
 * catalog의 editor draft 계열 stage가 열두 개고, 계열이 하나 늘 때마다 이 목록이 조용히
 * 낡아 같은 종류의 누락이 다시 생긴다.
 *
 * 정확한 귀속의 자리는 draft를 만든 생산자가 자기 model을 직접 넘기는 것이고, 그 seam은
 * 아래 options.providerModel로 이미 있다(orchestrator-repair-failure-artifacts.js:162가
 * 같은 경로로 options를 넘기는 실례다). 지금 그 배선을 깔지 않은 이유는 providerModel을
 * 읽는 소비자가 하나도 없고 editor-draft.json이 .gitignore:28 대상이라 발행 산출물로
 * 나가지 않기 때문이다. 소비자가 생기면 그때 생산자별로 providerModel을 넘기면 된다.
 */
function editorDraftArtifact(editor, date, options = {}) {
  return toEditorDraftArtifact(editor, {
    date,
    provider: runtimeConfig.llmProvider,
    providerModel:
      options.providerModel ||
      getLastLlmModelForStage(LLM_STAGES.EDITOR) ||
      runtimeConfig.llmStageModels?.editor ||
      runtimeConfig.llmModel ||
      'unknown',
    warnings: options.warnings,
    repairedFields: options.repairedFields,
    droppedFields: options.droppedFields,
    rawResponseStored: options.rawResponseStored
  });
}

function writeEditorDraftJson(filePath, editor, date, options = {}) {
  writeJson(filePath, editorDraftArtifact(editor, date, options));
}

function writeCanonicalReviewArtifacts({
  date,
  newsroomDir,
  reporter = null,
  editor = null,
  factCheck = null,
  qualityReport = null
}) {
  fs.mkdirSync(newsroomDir, { recursive: true });
  if (reporter) {
    writeJson(path.join(newsroomDir, 'reporter-candidates.json'), reporter);
  }
  if (editor) {
    writeEditorDraftJson(path.join(newsroomDir, 'editor-draft.json'), editor, date);
    fs.writeFileSync(path.join(newsroomDir, 'editor-draft.md'), buildMarkdown(editor), 'utf8');
  }
  if (factCheck) {
    writeJson(path.join(newsroomDir, 'fact-check-report.json'), factCheck);
    fs.writeFileSync(path.join(newsroomDir, 'fact-check-report.md'), buildFactCheckMarkdown(date, factCheck), 'utf8');
  }
  if (qualityReport) {
    writeJson(path.join(newsroomDir, 'quality-report.json'), qualityReport);
    fs.writeFileSync(path.join(newsroomDir, 'quality-report.md'), buildQualityReportMarkdown(qualityReport), 'utf8');
  }
}

function writeReporterArtifactsForAttempt(newsroomDir, reporter, attempt = null) {
  if (!reporter) return;
  fs.mkdirSync(newsroomDir, { recursive: true });
  writeJson(path.join(newsroomDir, 'reporter-candidates.json'), reporter);
  if (Number.isInteger(attempt) && attempt > 0) {
    writeJson(path.join(newsroomDir, `reporter-candidates-attempt-${attempt}.json`), reporter);
  }
}

function writeNewsletterDate(date, rootDir = root) {
  const tmpDir = path.join(rootDir, '.tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'newsletter-date.txt'), date, 'utf8');
}

function writeGenerationStatus(value, rootDir = root) {
  const tmpDir = path.join(rootDir, '.tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const content = `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(path.join(tmpDir, 'newsletter-generation-status.json'), content, 'utf8');
  if (value?.date) {
    const targetNewsroomDir = artifactNewsroomDir(rootDir, value.date);
    if (fs.existsSync(targetNewsroomDir)) {
      fs.writeFileSync(path.join(targetNewsroomDir, 'generation-status.json'), content, 'utf8');
    }
  }
}

function writeCostReport(date, rootDir = root) {
  const report = buildCostReport({
    date,
    calls: getLlmCostCalls(),
    warnCostUsd: runtimeConfig.newsroomWarnCostUsd,
    maxCostUsd: runtimeConfig.newsroomMaxCostUsd
  });
  const tmpDir = path.join(rootDir, '.tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, 'newsroom-cost-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );

  const targetNewsroomDir = artifactNewsroomDir(rootDir, date);
  if (fs.existsSync(targetNewsroomDir)) {
    fs.writeFileSync(
      path.join(targetNewsroomDir, 'cost-report.md'),
      buildCostReportMarkdown(report),
      'utf8'
    );
  }

  for (const warning of ensureArray(report.warnings)) {
    console.warn(`[cost] ${warning}`);
  }
  console.log(`[cost] Estimated LLM API cost: $${Number(report.totals.estimated_cost_usd || 0).toFixed(6)} USD across ${report.totals.request_count || 0} request(s).`);
  return report;
}

function writeSummaryCacheReport(date, diagnostics) {
  const report = buildSummaryCacheReport(date, diagnostics);
  const tmpDir = path.join(root, '.tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, 'summary-cache-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );

  const targetNewsroomDir = artifactNewsroomDir(root, date);
  if (fs.existsSync(targetNewsroomDir)) {
    fs.writeFileSync(
      path.join(targetNewsroomDir, 'summary-cache-report.json'),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8'
    );
    fs.writeFileSync(
      path.join(targetNewsroomDir, 'summary-cache-report.md'),
      buildSummaryCacheReportMarkdown(report),
      'utf8'
    );
  }

  console.log(`[cache] Summary cache hits: ${report.totals.hit_count}/${report.totals.candidate_count}; misses: ${report.totals.miss_count}.`);
  return report;
}

module.exports = {
  editorDraftArtifact,
  writeEditorDraftJson,
  writeCanonicalReviewArtifacts,
  writeReporterArtifactsForAttempt,
  writeNewsletterDate,
  writeGenerationStatus,
  writeCostReport,
  writeSummaryCacheReport
};
