const assert = require('node:assert/strict');
const test = require('node:test');

// #700 LLM editorial assessment & planning 단계의 계약을 고정한다.
// - 순수 단위(enabled flag·static fallback·normalizer·schema·prompt)는 직접 호출로 검증한다.
// - best-effort 안전: 비활성/실패 시 null을 돌려 발행을 막지 않는다.
// - editor 주입: plan이 있으면 editor user prompt에 들어가고, 없으면(off/실패) editor 입력은
//   byte-불변이다(현재 발행 경로 보존). 이건 callLlmJson 캡처 스텁으로 확인한다.

const {
  editorialPlanStageEnabled,
  normalizeEditorialPlanReport,
  buildEditorialPlanReport,
  editorFacingEditorialPlan
} = require('../../publish/orchestrator-editorial-plan-stage');
const { editorialPlanSchema } = require('../../render/newsletter-schema');
const { editorialPlanPrompt } = require('../../reporter/newsletter-prompts');
const { editorialPlanSystemPrompt } = require('../../publish/orchestrator-stage-prompts');

test('editorialPlanStageEnabled는 기본 ON이며 명시적 off 값에만 꺼진다(#700)', () => {
  // #700: "LLM 주도 편집 뉴스룸"을 실제 동작 모드로 만들기 위해 background-context와 동일하게
  // 기본 ON이다. env 미설정/빈 값은 ON, off 계열만 OFF.
  assert.equal(editorialPlanStageEnabled({}), true);
  assert.equal(editorialPlanStageEnabled({ NEWSROOM_EDITORIAL_PLAN_STAGE: '' }), true);
  assert.equal(editorialPlanStageEnabled({ NEWSROOM_EDITORIAL_PLAN_STAGE: 'gemini' }), true);
  assert.equal(editorialPlanStageEnabled({ NEWSROOM_EDITORIAL_PLAN_STAGE: '1' }), true);
  assert.equal(editorialPlanStageEnabled({ NEWSROOM_EDITORIAL_PLAN_STAGE: 'true' }), true);
  assert.equal(editorialPlanStageEnabled({ NEWSROOM_EDITORIAL_PLAN_STAGE: '0' }), false);
  assert.equal(editorialPlanStageEnabled({ NEWSROOM_EDITORIAL_PLAN_STAGE: 'off' }), false);
  assert.equal(editorialPlanStageEnabled({ NEWSROOM_EDITORIAL_PLAN_STAGE: 'false' }), false);
  assert.equal(editorialPlanStageEnabled({ NEWSROOM_EDITORIAL_PLAN_STAGE: 'disabled' }), false);
});

test('buildEditorialPlanReport는 명시적 off일 때 LLM을 부르지 않고 null을 돌린다', async () => {
  const saved = process.env.NEWSROOM_EDITORIAL_PLAN_STAGE;
  process.env.NEWSROOM_EDITORIAL_PLAN_STAGE = 'off';
  try {
    const result = await buildEditorialPlanReport({
      date: '2026-05-08',
      articleCapsuleReport: { capsules: [] },
      commonContext: 'common',
      stage: 'editorial-plan attempt 1/1'
    });
    assert.equal(result, null);
  } finally {
    if (saved === undefined) delete process.env.NEWSROOM_EDITORIAL_PLAN_STAGE;
    else process.env.NEWSROOM_EDITORIAL_PLAN_STAGE = saved;
  }
});

test('normalizeEditorialPlanReport는 식별자를 보존하고 타입을 강제하며 식별자 없는 항목을 거른다', () => {
  const raw = {
    editorial_plans: [
      {
        title: 'Mali-C55 ISP CCM patch',
        url: 'https://example.com/mali-c55',
        source_candidate_hash: 'abc123',
        coverage_decision: 'main_article',
        impact_level: 'Design Reference',
        direct_hal_impact: 'true', // boolean이 아니면 false로 강제되어야 한다
        target_description: 'Arm Mali-C55 ISP IP',
        editorial_angle: 'lower-stack ISP 제어 참고',
        why_it_matters: 'media pipeline 구성 시 참고',
        reader_takeaway: 'V4L2 media graph 검토',
        misunderstanding_risks: ['이미지 센서로 오해', ''],
        source_limitations: ['특정 보드 한정']
      },
      { title: '', url: '', source_candidate_hash: '' } // 식별자 없음 → 제거
    ]
  };
  const normalized = normalizeEditorialPlanReport(raw, '2026-05-08');
  assert.equal(normalized.date, '2026-05-08');
  assert.equal(normalized.editorial_plans.length, 1);
  const item = normalized.editorial_plans[0];
  assert.equal(item.source_candidate_hash, 'abc123');
  assert.equal(item.coverage_decision, 'main_article');
  assert.equal(item.direct_hal_impact, false); // 'true' 문자열은 boolean true가 아니므로 false
  assert.deepEqual(item.misunderstanding_risks, ['이미지 센서로 오해']); // 빈 문자열 제거
  assert.deepEqual(item.source_limitations, ['특정 보드 한정']);
});

test('editorFacingEditorialPlan은 coverage 권한 신호를 제거하고 framing은 유지하며 원본은 안 바꾼다', () => {
  const report = {
    date: '2026-05-08',
    editorial_plans: [{
      title: 'T', url: 'U', source_candidate_hash: 'H',
      coverage_decision: 'main_article', impact_level: 'Direct Impact',
      direct_hal_impact: false, target_description: 'TD', editorial_angle: 'EA',
      why_it_matters: 'W', reader_takeaway: 'R', misunderstanding_risks: ['m'], source_limitations: ['s']
    }]
  };
  const item = editorFacingEditorialPlan(report).editorial_plans[0];
  // coverage 권한 신호는 제거된다.
  assert.equal('coverage_decision' in item, false);
  assert.equal('impact_level' in item, false);
  // framing 필드는 유지된다.
  assert.equal(item.target_description, 'TD');
  assert.equal(item.editorial_angle, 'EA');
  assert.equal(item.direct_hal_impact, false);
  assert.deepEqual(item.misunderstanding_risks, ['m']);
  assert.deepEqual(item.source_limitations, ['s']);
  assert.equal(item.title, 'T');
  // 원본 report(artifact용)는 coverage_decision을 그대로 유지한다.
  assert.equal(report.editorial_plans[0].coverage_decision, 'main_article');
});

test('editorFacingEditorialPlan은 null/비배열을 안전하게 통과한다', () => {
  assert.equal(editorFacingEditorialPlan(null), null);
  assert.deepEqual(editorFacingEditorialPlan({ x: 1 }), { x: 1 });
});

test('editorialPlanSchema는 plan 식별자와 핵심 추론 필드를 required로 둔다', () => {
  const item = editorialPlanSchema.properties.editorial_plans.items;
  for (const key of [
    'title', 'url', 'source_candidate_hash',
    'coverage_decision', 'impact_level', 'direct_hal_impact',
    'target_description', 'editorial_angle', 'why_it_matters', 'reader_takeaway'
  ]) {
    assert.ok(item.required.includes(key), `missing required: ${key}`);
  }
  assert.equal(item.properties.direct_hal_impact.type, 'BOOLEAN');
  assert.equal(item.properties.misunderstanding_risks.type, 'ARRAY');
});

test('editorialPlanPrompt는 coverage/impact enum과 안전 경계를 담는다', () => {
  const prompt = editorialPlanPrompt();
  assert.match(prompt, /main_article, short_mention, reference_only, exclude/);
  assert.match(prompt, /Direct Impact, Design Reference, Trend Watch, Exclude/);
  assert.match(prompt, /public 본문에 라벨로 노출하지 않습니다/);
  assert.match(prompt, /direct_hal_impact는 source가 직접 HAL\/runtime 변경을 뒷받침할 때만 true/);
  assert.match(prompt, /이미지 센서 제조사, SoC\/platform vendor, ISP IP 제공자, 패치 작성자, 테스트 보드, 적용 디바이스를 혼동하지 마세요/);
  assert.match(prompt, /발행 안전 판단의 최종 강제는 deterministic validation layer가 담당/);
});

test('editorialPlanSystemPrompt는 assessor 페르소나와 plan 계약을 조립한다', () => {
  const prompt = editorialPlanSystemPrompt();
  assert.match(prompt, /AI editorial assessor/);
  assert.match(prompt, /selection을 다시 하지 말고/);
  assert.match(prompt, /Editorial plan contract/);
});

// --- editor 주입(byte-불변) 확인: callLlmJson 캡처 스텁으로 runEditorStage의 user prompt를 본다 ---

const STAGE_MODULE = '../../publish/orchestrator-editor-stage';
function baseEditor() {
  return {
    sections: [{
      category: 'Android Camera',
      headline: 'CameraX release A',
      public_article: { headline: 'CameraX release A' },
      sources: [{ title: 'Source', url: 'https://example.com/a' }]
    }]
  };
}
const STUBS = {
  '../../publish/orchestrator-llm-instrumentation': (state) => ({
    callLlmJson: async (_stage, _sys, user) => { state.userPrompts.push(user); return baseEditor(); }
  }),
  '../../publish/orchestrator-editor-validation': () => ({
    validateOrRepairEditor: async (editor) => editor,
    recordLastKnownValidEditor: (editor) => editor,
    currentPublishMode: () => 'normal'
  }),
  '../../editor/editor-output-contract': () => ({
    EditorSemanticValidationError: class EditorSemanticValidationError extends Error {},
    reconcileFactClaimEvidence: (editor) => editor
  }),
  '../../render/article-image-resolver': () => ({ resolveIssueArticleImages: async () => {} }),
  '../../publish/orchestrator-image-warnings': () => ({ warnResolvedImageFallbacks: () => {} }),
  '../../publish/orchestrator-artifact-writers': () => ({ writeCanonicalReviewArtifacts: () => {} }),
  '../../publish/orchestrator-reporter-normalize': () => ({ selectedReporterCapsules: () => [] }),
  '../../publish/orchestrator-stage-prompts': () => ({ editorSystemPrompt: () => 'editor-system-prompt' }),
  '../../publish/orchestrator-editor-retry-contract': () => ({ assertEditorRetryOutputContract: () => {} }),
  '../../publish/orchestrator-repair-failure-artifacts': () => ({ writeReviewableRepairFailureArtifacts: () => {} })
};

function withCapturingStage(run) {
  const { tempRoot } = require('../../../shared/test/helpers/fs');
  const state = { userPrompts: [], newsroomDir: tempRoot('editorial-plan-') };
  const stageKey = require.resolve(STAGE_MODULE);
  const saved = new Map();
  for (const [relPath, factory] of Object.entries(STUBS)) {
    const key = require.resolve(relPath);
    saved.set(key, require.cache[key]);
    require.cache[key] = { id: key, filename: key, loaded: true, exports: factory(state) };
  }
  delete require.cache[stageKey];
  try {
    const { runEditorStage } = require(STAGE_MODULE);
    return run(runEditorStage, state);
  } finally {
    delete require.cache[stageKey];
    for (const [key, original] of saved.entries()) {
      if (original) require.cache[key] = original; else delete require.cache[key];
    }
    delete require.cache[stageKey];
  }
}

function baseArgs(state, overrides = {}) {
  return {
    date: '2026-05-08', reporter: { candidates: [] }, attempt: 1, editorStage: 'editor attempt 1/1',
    editorRetryContract: null, publishMode: 'normal', commonContext: 'common', lockedContext: 'locked',
    lockedSections: [], excludedSections: [], newsroomDir: state.newsroomDir,
    articleCapsuleReport: { capsules: [] }, backgroundContextReport: { items: [] },
    shortlistReport: { selected_articles: [] }, seedEvidencePack: null, editor: null,
    attemptedSections: [], factCheck: null, qualityReport: null, retryHistory: [], root: state.newsroomDir,
    ...overrides
  };
}

test('editorialPlanReport가 없으면 editor user prompt에 plan 블록이 없다(off-path byte-불변)', async () => {
  await withCapturingStage(async (runEditorStage, state) => {
    await runEditorStage(baseArgs(state)); // editorialPlanReport 미전달(undefined)
    assert.equal(state.userPrompts.length, 1);
    assert.doesNotMatch(state.userPrompts[0], /Internal editorial plan JSON/);
  });
});

test('editorialPlanReport가 있으면 editor user prompt에 plan 블록이 들어간다', async () => {
  await withCapturingStage(async (runEditorStage, state) => {
    const editorialPlanReport = {
      date: '2026-05-08',
      editorial_plans: [{ source_candidate_hash: 'abc123', coverage_decision: 'main_article', editorial_angle: 'lower-stack ISP 참고' }]
    };
    await runEditorStage(baseArgs(state, { editorialPlanReport }));
    assert.equal(state.userPrompts.length, 1);
    assert.match(state.userPrompts[0], /Internal editorial plan JSON/);
    assert.match(state.userPrompts[0], /lower-stack ISP 참고/);
    assert.match(state.userPrompts[0], /선택된 기사를 모두 작성하고/);
    // coverage 권한 신호(coverage_decision)는 editor-facing plan에서 제거된다(strip 검증).
    assert.doesNotMatch(state.userPrompts[0], /coverage_decision/);
  });
});

// #700: 기본 ON 경로가 실제로 LLM stage를 호출하고 plan을 만든다(off-path가 아닌 동작 모드 검증).
// callLlmJson을 캡처 스텁으로 바꿔, env 미설정(default ON)일 때 stage가 호출되는지와 정규화 결과를 본다.
test('buildEditorialPlanReport는 기본(ON)일 때 LLM을 호출하고 정규화된 plan을 돌린다', async () => {
  const instrKey = require.resolve('../../publish/orchestrator-llm-instrumentation');
  const stageKey = require.resolve('../../publish/orchestrator-editorial-plan-stage');
  const savedInstr = require.cache[instrKey];
  const savedEnv = process.env.NEWSROOM_EDITORIAL_PLAN_STAGE;
  let calls = 0;
  require.cache[instrKey] = {
    id: instrKey, filename: instrKey, loaded: true,
    exports: {
      callLlmJson: async () => {
        calls += 1;
        return {
          editorial_plans: [{
            title: 'T', url: 'https://example.com/a', source_candidate_hash: 'abc123',
            coverage_decision: 'short_mention', impact_level: 'Design Reference',
            direct_hal_impact: false, target_description: 'TD', editorial_angle: 'EA',
            why_it_matters: 'W', reader_takeaway: 'R',
            misunderstanding_risks: ['m'], source_limitations: ['s']
          }]
        };
      }
    }
  };
  delete require.cache[stageKey];
  delete process.env.NEWSROOM_EDITORIAL_PLAN_STAGE; // 미설정 = 기본 ON
  try {
    const { buildEditorialPlanReport } = require('../../publish/orchestrator-editorial-plan-stage');
    const report = await buildEditorialPlanReport({
      date: '2026-05-08',
      articleCapsuleReport: { selected_capsules: [{ source_candidate_hash: 'abc123', title: 'T', url: 'https://example.com/a' }] },
      commonContext: 'common',
      stage: 'editorial-plan attempt 1/1'
    });
    assert.equal(calls, 1);
    assert.ok(report);
    assert.equal(report.date, '2026-05-08');
    assert.equal(report.editorial_plans.length, 1);
    assert.equal(report.editorial_plans[0].coverage_decision, 'short_mention');
  } finally {
    delete require.cache[stageKey];
    if (savedInstr) require.cache[instrKey] = savedInstr; else delete require.cache[instrKey];
    delete require.cache[stageKey];
    if (savedEnv === undefined) delete process.env.NEWSROOM_EDITORIAL_PLAN_STAGE;
    else process.env.NEWSROOM_EDITORIAL_PLAN_STAGE = savedEnv;
  }
});
