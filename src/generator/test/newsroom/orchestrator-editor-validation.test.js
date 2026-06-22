const assert = require('node:assert/strict');
const test = require('node:test');

// 이 테스트는 god-file에서 분리한 editor-validation cluster + background-context stage(#655)의
// 동작을 고정한다. 일곱 함수는 publish-mode(generationRunState)에 결합돼 있고 분리 후에도
// 동작이 불변이어야 한다. currentPublishMode는 shortlistReport의 publish_mode를 읽고,
// validateEditor는 editor-output-contract로 위임하며 publishMode 기본값을 채우고,
// recordLastKnownValidEditor는 run state에 마지막 유효 draft를 기록하고,
// validateTargetedRepairResult는 validateEditor와 run-state.date를 targeted-repair 모듈에 주입하며,
// buildBackgroundContextReport는 stage를 끄면 LLM 없이 static fallback을 반환하고,
// publicArticleJudgeDeps는 정확히 세 함수를 묶는다.

const editorValidation = require('../../publish/orchestrator-editor-validation');
const {
  buildBackgroundContextReport,
  currentPublishMode,
  validateEditor,
  validateTargetedRepairResult,
  applyRepairPatchesAndValidate,
  recordLastKnownValidEditor,
  validateOrRepairEditor,
  publicArticleJudgeDeps
} = editorValidation;
const { callLlmJson } = require('../../publish/orchestrator-llm-instrumentation');
const { recordEditorSemanticStatus } = require('../../publish/orchestrator-status-builders');
const { generationRunState } = require('../../publish/orchestrator-run-state');
const { DATE, editor } = require('../../../shared/test/helpers/editor-builders');

function resetLastKnownValidState() {
  generationRunState.lastKnownValidEditor = null;
  generationRunState.lastKnownValidReporter = null;
  generationRunState.lastKnownValidFactCheck = null;
  generationRunState.lastKnownValidQualityReport = null;
  generationRunState.lastKnownValidAttempt = 0;
}

test('모듈은 일곱 함수와 publicArticleJudgeDeps를 export한다', () => {
  assert.equal(typeof buildBackgroundContextReport, 'function');
  assert.equal(typeof currentPublishMode, 'function');
  assert.equal(typeof validateEditor, 'function');
  assert.equal(typeof validateTargetedRepairResult, 'function');
  assert.equal(typeof applyRepairPatchesAndValidate, 'function');
  assert.equal(typeof recordLastKnownValidEditor, 'function');
  assert.equal(typeof validateOrRepairEditor, 'function');
  assert.equal(typeof publicArticleJudgeDeps, 'object');
});

test('publicArticleJudgeDeps는 callLlmJson/recordEditorSemanticStatus/validateEditor를 그대로 묶는다', () => {
  assert.deepEqual(
    Object.keys(publicArticleJudgeDeps).sort(),
    ['callLlmJson', 'recordEditorSemanticStatus', 'validateEditor']
  );
  assert.equal(publicArticleJudgeDeps.callLlmJson, callLlmJson);
  assert.equal(publicArticleJudgeDeps.recordEditorSemanticStatus, recordEditorSemanticStatus);
  assert.equal(publicArticleJudgeDeps.validateEditor, validateEditor);
});

test('currentPublishMode는 shortlistReport의 publish_mode를 읽고 없으면 DEEP을 반환한다', () => {
  assert.equal(currentPublishMode({ publish_mode: 'SHALLOW' }), 'SHALLOW');
  assert.equal(currentPublishMode({}), 'DEEP');
  assert.equal(currentPublishMode(null), 'DEEP');
});

test('currentPublishMode는 인자가 없으면 generationRunState.shortlistReport를 본다', () => {
  const previous = generationRunState.shortlistReport;
  generationRunState.shortlistReport = { publish_mode: 'BROAD' };
  try {
    assert.equal(currentPublishMode(), 'BROAD');
  } finally {
    generationRunState.shortlistReport = previous;
  }
});

test('validateEditor는 editor-output-contract로 위임해 유효 draft를 그대로 반환한다', () => {
  const result = validateEditor(editor(), DATE);
  assert.ok(result);
  assert.equal(Array.isArray(result.sections), true);
  assert.equal(result.sections.length, 3);
});

test('validateEditor는 briefing이 누락된 draft를 거부한다(게이트 보존)', () => {
  assert.throws(() => validateEditor(editor({ briefing: undefined }), DATE));
});

test('recordLastKnownValidEditor는 run state에 마지막 유효 draft의 복제본을 기록한다', () => {
  resetLastKnownValidState();
  const reporter = { candidates: [] };
  const factCheck = { status: 'PASS' };
  const qualityReport = { status: 'PASS', score: 90 };
  const validated = recordLastKnownValidEditor(editor(), {
    date: DATE,
    reporter,
    factCheck,
    qualityReport,
    attempt: 3,
    strictClaims: false
  });
  assert.ok(validated);
  assert.deepEqual(generationRunState.lastKnownValidEditor, validated);
  assert.deepEqual(generationRunState.lastKnownValidReporter, reporter);
  assert.deepEqual(generationRunState.lastKnownValidFactCheck, factCheck);
  assert.deepEqual(generationRunState.lastKnownValidQualityReport, qualityReport);
  assert.equal(generationRunState.lastKnownValidAttempt, 3);
  // run state에는 입력의 복제본을 저장한다(원본 변경이 새지 않도록).
  assert.notEqual(generationRunState.lastKnownValidEditor, validated);
  resetLastKnownValidState();
});

test('validateTargetedRepairResult는 validateEditor를 주입해 빈 draft를 거부한다', () => {
  const previousDate = generationRunState.date;
  generationRunState.date = DATE;
  try {
    assert.throws(() => validateTargetedRepairResult({
      editor: { title: 't', summary: 's', briefing: ['a', 'b', 'c'], sections: [] },
      previousEditor: editor(),
      reporter: { candidates: [] }
    }));
  } finally {
    generationRunState.date = previousDate;
  }
});

test('buildBackgroundContextReport는 stage를 끄면 LLM 없이 static fallback을 반환한다', async () => {
  const previous = process.env.NEWSROOM_BACKGROUND_CONTEXT_STAGE;
  process.env.NEWSROOM_BACKGROUND_CONTEXT_STAGE = 'off';
  try {
    const report = await buildBackgroundContextReport({
      date: DATE,
      articleCapsuleReport: { capsules: [] },
      commonContext: '',
      stage: 'background-context'
    });
    assert.equal(report.stage, 'static-fallback');
    assert.equal(report.date, DATE);
    assert.ok(Array.isArray(report.background_contexts));
  } finally {
    if (previous === undefined) {
      delete process.env.NEWSROOM_BACKGROUND_CONTEXT_STAGE;
    } else {
      process.env.NEWSROOM_BACKGROUND_CONTEXT_STAGE = previous;
    }
  }
});

test('god-file은 분리된 함수를 같은 참조로 재노출한다(re-export 보존)', () => {
  const godFile = require('../../publish/gemini-newsroom-newsletter');
  assert.equal(godFile.applyRepairPatchesAndValidate, applyRepairPatchesAndValidate);
  assert.equal(godFile.recordLastKnownValidEditor, recordLastKnownValidEditor);
  assert.equal(godFile.validateTargetedRepairResult, validateTargetedRepairResult);
});
