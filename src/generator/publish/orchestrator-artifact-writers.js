// 발행 검토용 artifact writer (Tier-A) — root에 무관하게 newsroom 디렉터리에 editor draft·
// canonical 검토 산출물·reporter 후보를 기록한다(#655 god-file 분할). 본문은 추출 전과 동일하다.

const fs = require('fs');
const path = require('path');
const { writeJson } = require('../../shared/common/common');
const { readRuntimeConfig } = require('../../shared/common/runtime-config');
const { getLlmModelUsage } = require('../../shared/llm/llm-client');
const { toEditorDraftArtifact } = require('../../shared/domain/newsletter-domain-normalize');
const { buildMarkdown, buildFactCheckMarkdown } = require('../render/newsletter-renderer');
const { buildQualityReportMarkdown } = require('../quality/newsletter-quality');

const runtimeConfig = readRuntimeConfig(process.env);

function editorDraftArtifact(editor, date, options = {}) {
  return toEditorDraftArtifact(editor, {
    date,
    provider: runtimeConfig.llmProvider,
    providerModel:
      options.providerModel ||
      getLlmModelUsage(options.stage || 'editor') ||
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

module.exports = {
  editorDraftArtifact,
  writeEditorDraftJson,
  writeCanonicalReviewArtifacts,
  writeReporterArtifactsForAttempt
};
