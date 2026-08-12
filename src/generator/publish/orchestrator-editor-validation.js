// 발행 orchestrator의 editor-validation cluster와 background-context stage(#655).
// publish-mode(generationRunState)에 결합된 editor 검증기 validateEditor, targeted-repair 어댑터
// validateTargetedRepairResult/applyRepairPatchesAndValidate, last-known-valid 기록기
// recordLastKnownValidEditor, background-context LLM stage buildBackgroundContextReport,
// publish-mode 조회 currentPublishMode, editor semantic 검증·복구 흐름 validateOrRepairEditor를
// god-file에서 분리했다. 협력자는 모두 실제 출처에서 직접 import한다. callLlmJson는
// orchestrator-llm-instrumentation, recordEditorSemanticStatus는 orchestrator-status-builders,
// repairEditorSemanticWithLlm/validatePublicArticleJudgeOrRepair는 orchestrator-public-article-judge,
// generationRunState는 orchestrator-run-state에서 가져오며 이 모듈들은 god-file을 import하지 않아
// 순환이 없다. publicArticleJudgeDeps는 여기서 { callLlmJson, recordEditorSemanticStatus,
// validateEditor }로 만들어 export하고, god-file은 main()의 두 judge 호출처에서 이걸 import해
// 쓴다. validateOrRepairEditor는 같은 local publicArticleJudgeDeps를 쓴다.
const { ensureArray } = require('../../shared/common/value-coercion');
const { backgroundContextSchema } = require('../render/newsletter-schema');
const { capsuleInputFromReport } = require('../select/article-capsules');
const { buildStaticBackgroundContextReport } = require('../reporter/background-context');
const {
  reconcileFactClaimEvidence,
  repairEditorOutputContract,
  validateEditorOutputContract
} = require('../editor/editor-output-contract');
const { normalizeEditorSection } = require('./orchestrator-reporter-normalize');
const {
  backgroundContextStageEnabled,
  normalizeBackgroundContextReport
} = require('./orchestrator-report-builders');
const { cloneJson } = require('./orchestrator-shared-helpers');
const targetedRepairModule = require('./orchestrator-targeted-repair');
const { generationRunState } = require('./orchestrator-run-state');
const { callLlmJson } = require('./orchestrator-llm-instrumentation');
const { recordEditorSemanticStatus } = require('./orchestrator-status-builders');
const {
  repairEditorSemanticWithLlm,
  validatePublicArticleJudgeOrRepair
} = require('./orchestrator-public-article-judge');

async function buildBackgroundContextReport({ date, articleCapsuleReport, commonContext, stage }) {
  const fallbackReport = buildStaticBackgroundContextReport(date, articleCapsuleReport);
  if (!backgroundContextStageEnabled()) return fallbackReport;
  try {
    const result = await callLlmJson(
      stage,
      [
        'AOSP Camera / Driver / SoC Platform Newsletter의 optional background context를 생성합니다.',
        '한국어 technical background만 반환하세요. web browsing은 하지 마세요.',
        '제공된 article capsules와 Android Camera, CameraX, Camera2, Camera HAL, libcamera, V4L2, SoC, native build/test/debug workflows에 대한 model knowledge만 사용하세요.',
        'raw source table text, UI fragments, release table dumps, source snippets를 background_context에 복사하지 마세요.',
        'title, url, source_candidate_hash는 제공된 article capsule 또는 static fallback item에서 정확히 보존하세요.',
        'background_basis는 context가 external source lookup이 아니라 supplied capsule metadata와 model knowledge에 기반했음을 설명해야 합니다.',
        'background_sources_used는 출력하지 마세요. 대신 background_basis를 사용하세요.',
        'background_context는 what_changed와 구분하고, HAL/driver 영향성은 source facts가 직접 뒷받침하는 범위로만 설명하세요.',
        'Jetpack Compose, Jetpack Navigation 3, CameraX-adjacent, Android adaptive UI capsule은 Android UI/platform 개념 배경을 간단히 설명하고 camera preview/capture UX 검증과 연결하세요. direct HAL change로 승격하지 마세요.',
        'schema와 일치하는 JSON만 반환하세요.'
      ].join('\n'),
      `${commonContext}\n\nArticle capsule context JSON:\n${JSON.stringify(capsuleInputFromReport(articleCapsuleReport, 'selected'), null, 2)}\n\nStatic fallback background context JSON:\n${JSON.stringify(fallbackReport, null, 2)}`,
      backgroundContextSchema
    );
    const normalized = normalizeBackgroundContextReport(result, date, fallbackReport);
    if (ensureArray(normalized.background_contexts).length > 0) return normalized;
  } catch (error) {
    console.warn(`Gemini background-context stage failed; using deterministic static background: ${error.message}`);
  }
  return {
    ...fallbackReport,
    stage: 'static-fallback-after-background-context-error',
    background_context_error: 'gemini background-context stage unavailable'
  };
}

function currentPublishMode(shortlistReport = generationRunState.shortlistReport) {
  return (shortlistReport && shortlistReport.publish_mode) || 'DEEP';
}

function validateEditor(value, date, reporter = { candidates: [] }, options = {}) {
  return validateEditorOutputContract(value, date, {
    reporter,
    normalizeSection: (section, index) => normalizeEditorSection(section, index, reporter),
    strictClaims: options.strictClaims === true,
    requireStoryContract: options.requireStoryContract === true,
    seedEvidencePack: options.seedEvidencePack || null,
    publishMode: options.publishMode || currentPublishMode()
  });
}

// targeted-repair 모듈의 두 함수는 publish-mode(generationRunState)에 결합된 validateEditor를
// 주입받아야 한다. orchestrator에서 validateEditor와 generationRunState.date 기본값을 바인딩한
// 얇은 래퍼로 노출해, 기존 호출처(production·test)의 시그니처를 그대로 유지한다(#655).
function validateTargetedRepairResult(args = {}) {
  return targetedRepairModule.validateTargetedRepairResult({ date: generationRunState.date, ...args, validateEditor });
}

function applyRepairPatchesAndValidate(args = {}) {
  return targetedRepairModule.applyRepairPatchesAndValidate({ date: generationRunState.date, ...args, validateEditor });
}

function recordLastKnownValidEditor(editor, {
  date,
  reporter = { candidates: [] },
  factCheck = null,
  qualityReport = null,
  attempt = 0,
  strictClaims = true,
  requireStoryContract = false,
  seedEvidencePack = null
} = {}) {
  const validated = validateEditor(cloneJson(editor), date, reporter, {
    strictClaims,
    requireStoryContract,
    seedEvidencePack
  });
  generationRunState.lastKnownValidEditor = cloneJson(validated);
  generationRunState.lastKnownValidReporter = cloneJson(reporter);
  generationRunState.lastKnownValidFactCheck = cloneJson(factCheck);
  generationRunState.lastKnownValidQualityReport = cloneJson(qualityReport);
  generationRunState.lastKnownValidAttempt = attempt;
  return validated;
}

// editor public-article judge / semantic repair 비동기 흐름은
// orchestrator-public-article-judge.js로 분리되어 있다. callLlmJson/recordEditorSemanticStatus/
// validateEditor는 god-file local(run-state 결합)이라 deps 객체로 묶어 주입한다.
const publicArticleJudgeDeps = { callLlmJson, recordEditorSemanticStatus, validateEditor };

async function validateOrRepairEditor(value, {
  date,
  reporter,
  attempt,
  editorStage,
  commonContext,
  lockedContext,
  newsroomDir,
  articleCapsuleReport = null,
  seedEvidencePack = null,
  publishMode = currentPublishMode()
}) {
  // editor LLM이 일부 fact claim에 capsule이 제공한 evidence_id/source_urls를 빠뜨려도(부분 누락),
  // 그 정보는 candidate의 allowed_claim_evidence에 있으므로 claim binding 검증 전에 결정론적으로
  // 재바인딩한다. 그러지 않으면 reconcile가 검증 이후(#502 지점)에 돌아, 복구 가능한 evidence_id
  // 누락이 editor 단계에서 먼저 hard-fail해 발행 가능한 draft가 통째로 막힌다. reconcile는 strict
  // 오라클이 evidence가 claim을 실제 뒷받침한다고 확인할 때만 채우므로(없던 근거를 만들지 않음)
  // 게이트 약화가 아니다.
  value = reconcileFactClaimEvidence(value, { reporter, seedEvidencePack });
  const result = await repairEditorOutputContract({
    value,
    date,
    reporter,
    attempt,
    stage: editorStage,
    newsroomDir,
    strictClaims: true,
    requireStoryContract: true,
    publishMode,
    seedEvidencePack,
    normalizeSection: (section, index) => normalizeEditorSection(section, index, reporter),
    repairFn: async ({ invalidEditor, validationError }) => repairEditorSemanticWithLlm({
      date,
      editorStage,
      commonContext,
      lockedContext,
      reporter,
      articleCapsuleReport,
      seedEvidencePack,
      invalidEditor,
      validationError
    }, publicArticleJudgeDeps)
  });
  recordEditorSemanticStatus(result);
  return validatePublicArticleJudgeOrRepair({
    date,
    editor: result.editor,
    reporter,
    attempt,
    editorStage,
    commonContext,
    lockedContext,
    newsroomDir
  }, publicArticleJudgeDeps);
}

module.exports = {
  buildBackgroundContextReport,
  currentPublishMode,
  validateEditor,
  validateTargetedRepairResult,
  applyRepairPatchesAndValidate,
  recordLastKnownValidEditor,
  validateOrRepairEditor,
  publicArticleJudgeDeps
};
