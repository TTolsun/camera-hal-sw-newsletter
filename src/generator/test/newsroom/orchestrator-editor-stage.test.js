const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const { tempRoot } = require('../../../shared/test/helpers/fs');

// 추출 전 main()의 attempt-loop 안 editor 단계 블록(생성→검증/repair→결정론적 후처리)을
// 입력→동작으로 고정한다. 이 모듈의 책임은 orchestration(editor draft를 만들고 검증/repair한 뒤
// locked section 병합·이미지 해소·evidence 재바인딩·last-known-valid 기록·editor-draft 산출물
// 기록까지를 묶고, reviewable repair-failure면 early return을 신호로 돌려줌)이다. 무거운 협력자
// (LLM 호출 callLlmJson, editor 검증 validateOrRepairEditor, 이미지 해소, evidence 재바인딩 등)는
// require.cache 스텁으로 교체해, threading 계약과 sentinel(early return) 매핑만 결정론적으로 고정한다.
// 엄격한 editor 계약 검증·품질 점수 계산 자체는 각 도메인 테스트가 따로 검증한다.

// instanceof가 동작하도록 실제 EditorSemanticValidationError 클래스를 가져온다.
const {
  EditorSemanticValidationError
} = require('../../editor/editor-contract-helpers');

const STAGE_MODULE = '../../publish/orchestrator-editor-stage';
const STUBBED_MODULES = {
  '../../publish/orchestrator-llm-instrumentation': () => ({
    // editorDraft를 그대로 돌려주는 LLM 스텁. 인자(prompt 빌더)는 평가되지만 응답만 고정한다.
    callLlmJson: async () => ({ kind: 'editor-draft' })
  }),
  '../../publish/orchestrator-editor-validation': (state) => ({
    validateOrRepairEditor: state.validateOrRepairEditor,
    recordLastKnownValidEditor: (editor) => editor,
    currentPublishMode: () => 'normal'
  }),
  '../../editor/editor-output-contract': () => ({
    EditorSemanticValidationError,
    reconcileFactClaimEvidence: (editor) => editor
  }),
  '../../render/article-image-resolver': () => ({
    resolveIssueArticleImages: async () => {}
  }),
  '../../publish/orchestrator-image-warnings': () => ({
    warnResolvedImageFallbacks: () => {}
  }),
  '../../publish/orchestrator-artifact-writers': (state) => ({
    writeCanonicalReviewArtifacts: (args) => { state.canonicalCalls.push(args); }
  }),
  '../../publish/orchestrator-reporter-normalize': () => ({
    selectedReporterCapsules: () => []
  }),
  '../../publish/orchestrator-stage-prompts': () => ({
    editorSystemPrompt: () => 'editor-system-prompt'
  }),
  '../../publish/orchestrator-editor-retry-contract': () => ({
    assertEditorRetryOutputContract: () => {}
  }),
  '../../publish/orchestrator-repair-failure-artifacts': (state) => ({
    writeReviewableRepairFailureArtifacts: (args) => { state.repairFailureCalls.push(args); }
  })
};

function withStubbedStage(validateOrRepairEditor, run) {
  const state = {
    validateOrRepairEditor,
    canonicalCalls: [],
    repairFailureCalls: []
  };
  const stageKey = require.resolve(STAGE_MODULE);
  const saved = new Map();
  // 협력자 모듈을 require.cache 스텁으로 교체한다.
  for (const [relPath, factory] of Object.entries(STUBBED_MODULES)) {
    const key = require.resolve(relPath);
    saved.set(key, require.cache[key]);
    require.cache[key] = {
      id: key,
      filename: key,
      loaded: true,
      exports: factory(state)
    };
  }
  delete require.cache[stageKey];
  try {
    const { runEditorStage } = require(STAGE_MODULE);
    return run(runEditorStage, state);
  } finally {
    delete require.cache[stageKey];
    for (const [key, original] of saved.entries()) {
      if (original) {
        require.cache[key] = original;
      } else {
        delete require.cache[key];
      }
    }
    // 스테이지 모듈을 실제 협력자로 다시 로드해 다른 테스트로 스텁이 새지 않게 한다.
    delete require.cache[stageKey];
  }
}

function baseEditor() {
  return {
    sections: [
      {
        category: 'Android Camera',
        headline: 'CameraX release A',
        public_article: { headline: 'CameraX release A' },
        sources: [{ title: 'Source', url: 'https://example.com/a' }]
      }
    ]
  };
}

function baseArgs(overrides = {}) {
  return {
    date: '2026-05-08',
    reporter: { candidates: [] },
    attempt: 1,
    editorStage: 'editor attempt 1/1',
    editorRetryContract: null,
    publishMode: 'normal',
    commonContext: 'common',
    lockedContext: 'locked',
    lockedSections: [],
    excludedSections: [],
    newsroomDir: overrides.newsroomDir,
    articleCapsuleReport: { capsules: [] },
    backgroundContextReport: { items: [] },
    shortlistReport: { selected_articles: [] },
    seedEvidencePack: null,
    editor: null,
    attemptedSections: [],
    factCheck: null,
    qualityReport: null,
    retryHistory: [],
    root: overrides.root,
    ...overrides
  };
}

test('성공 경로: reviewableReturn=false로 editor/attemptedSections/rejectedGeneratedSections를 반환하고 editor-draft 산출물을 기록한다', async () => {
  await withStubbedStage(async () => baseEditor(), async (runEditorStage, state) => {
    const newsroomDir = tempRoot('editor-stage-');
    const result = await runEditorStage(baseArgs({ newsroomDir, root: newsroomDir }));

    // sentinel은 정상 경로를 가리킨다(early return 아님).
    assert.equal(result.reviewableReturn, false);
    // 이후 main()에서 재바인딩되는 세 local이 모두 반환된다.
    assert.ok(result.editor && Array.isArray(result.editor.sections));
    assert.equal(result.editor.sections.length, 1);
    assert.ok(Array.isArray(result.attemptedSections));
    assert.equal(result.attemptedSections.length, 1);
    assert.ok(Array.isArray(result.rejectedGeneratedSections));

    // canonical review 산출물 writer가 호출된다.
    assert.equal(state.canonicalCalls.length, 1);
    // reviewable repair-failure writer는 정상 경로에서 호출되지 않는다.
    assert.equal(state.repairFailureCalls.length, 0);

    // editor-draft-attempt-{n}.json / .md 산출물이 newsroomDir에 기록된다.
    const draftJson = path.join(newsroomDir, 'editor-draft-attempt-1.json');
    const draftMd = path.join(newsroomDir, 'editor-draft-attempt-1.md');
    assert.ok(fs.existsSync(draftJson));
    assert.ok(fs.existsSync(draftMd));
    assert.equal(JSON.parse(fs.readFileSync(draftJson, 'utf8')).sections.length, 1);
  });
});

test('reviewable 경로: validateOrRepairEditor가 EditorSemanticValidationError를 던지고 last-known-valid가 있으면 reviewableReturn=true를 반환하고 repair-failure 산출물을 쓴다', async () => {
  const { generationRunState } = require('../../publish/orchestrator-run-state');
  const savedLastKnown = generationRunState.lastKnownValidEditor;
  generationRunState.lastKnownValidEditor = baseEditor();
  try {
    const thrower = async () => {
      throw new EditorSemanticValidationError('editor semantic failure', { field: 'sections' });
    };
    await withStubbedStage(thrower, async (runEditorStage, state) => {
      const newsroomDir = tempRoot('editor-stage-');
      const result = await runEditorStage(baseArgs({ newsroomDir, root: newsroomDir }));

      // sentinel은 early return을 가리킨다(main()에서 `if (reviewableReturn) return;`로 매핑).
      assert.equal(result.reviewableReturn, true);
      // 정상 경로 local은 반환되지 않는다.
      assert.equal(result.editor, undefined);
      assert.equal(result.attemptedSections, undefined);
      assert.equal(result.rejectedGeneratedSections, undefined);

      // reviewable repair-failure writer가 정확히 한 번, editor 단계명으로 호출된다.
      assert.equal(state.repairFailureCalls.length, 1);
      assert.equal(state.repairFailureCalls[0].stage, 'editor attempt 1/1');
      // canonical review 산출물 writer는 reviewable 경로에서 호출되지 않는다.
      assert.equal(state.canonicalCalls.length, 0);
    });
  } finally {
    generationRunState.lastKnownValidEditor = savedLastKnown;
  }
});

test('last-known-valid가 없으면 EditorSemanticValidationError를 그대로 다시 던진다', async () => {
  const { generationRunState } = require('../../publish/orchestrator-run-state');
  const savedLastKnown = generationRunState.lastKnownValidEditor;
  generationRunState.lastKnownValidEditor = null;
  try {
    const thrower = async () => {
      throw new EditorSemanticValidationError('editor semantic failure', { field: 'sections' });
    };
    await withStubbedStage(thrower, async (runEditorStage) => {
      const newsroomDir = tempRoot('editor-stage-');
      await assert.rejects(
        () => runEditorStage(baseArgs({ newsroomDir, root: newsroomDir })),
        EditorSemanticValidationError
      );
    });
  } finally {
    generationRunState.lastKnownValidEditor = savedLastKnown;
  }
});
