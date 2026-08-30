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
