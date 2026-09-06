const assert = require('node:assert/strict');
const test = require('node:test');

// #700 LLM editorial assessment & planning 단계의 계약을 고정한다.
// - 순수 단위(normalizer·schema·prompt)는 직접 호출로 검증한다.
// - editorial-plan은 항상 실행되는 필수 단계다. LLM 호출 실패 또는 빈 결과면 throw해서
//   파이프라인을 멈춘다(뒤 단계 비용 차단). 그래서 editor 단계는 항상 plan을 받는다.
// - editor 주입: plan이 editor user prompt에 들어가고 coverage 권한 신호는 strip된다.
//   이건 callLlmJson 캡처 스텁으로 확인한다.

const {
  normalizeEditorialPlanReport,
  buildEditorialPlanReport,
  editorFacingEditorialPlan
} = require('../../publish/orchestrator-editorial-plan-stage');
const { editorialPlanSchema } = require('../../render/newsletter-schema');
const { editorialPlanPrompt } = require('../../reporter/newsletter-prompts');
const { editorialPlanSystemPrompt } = require('../../publish/orchestrator-stage-prompts');

test('buildEditorialPlanReport는 LLM 호출이 실패하면 throw해서 파이프라인을 멈춘다', async () => {
  // fail-fast: editorial-plan이 실패하면 editor/fact-check/quality 같은 뒤 단계를 돌리지 않고
  // 즉시 멈춰 비용을 막는다(best-effort null 폐기). callLlmJson 스텁이 던지면 그대로 전파한다.
  const instrKey = require.resolve('../../publish/orchestrator-llm-instrumentation');
  const stageKey = require.resolve('../../publish/orchestrator-editorial-plan-stage');
  const savedInstr = require.cache[instrKey];
  require.cache[instrKey] = {
    id: instrKey, filename: instrKey, loaded: true,
    exports: { callLlmJson: async () => { throw new Error('Gemini 503'); } }
  };
  delete require.cache[stageKey];
  try {
    const { buildEditorialPlanReport } = require('../../publish/orchestrator-editorial-plan-stage');
    await assert.rejects(
      buildEditorialPlanReport({
        date: '2026-05-08',
        articleCapsuleReport: { selected_capsules: [{ source_candidate_hash: 'h', title: 'T', url: 'https://example.com/a' }] },
        commonContext: 'common',
        stage: 'editorial-plan attempt 1/1'
      }),
      /Gemini 503/
    );
  } finally {
    delete require.cache[stageKey];
    if (savedInstr) require.cache[instrKey] = savedInstr; else delete require.cache[instrKey];
    delete require.cache[stageKey];
  }
});

test('buildEditorialPlanReport는 plan이 비면 throw한다(빈 결과로 발행하지 않음)', async () => {
  const instrKey = require.resolve('../../publish/orchestrator-llm-instrumentation');
  const stageKey = require.resolve('../../publish/orchestrator-editorial-plan-stage');
  const savedInstr = require.cache[instrKey];
  require.cache[instrKey] = {
    id: instrKey, filename: instrKey, loaded: true,
    exports: { callLlmJson: async () => ({ editorial_plans: [] }) }
  };
  delete require.cache[stageKey];
  try {
    const { buildEditorialPlanReport } = require('../../publish/orchestrator-editorial-plan-stage');
    await assert.rejects(
      buildEditorialPlanReport({
        date: '2026-05-08',
        articleCapsuleReport: { selected_capsules: [] },
        commonContext: 'common',
        stage: 'editorial-plan attempt 1/1'
      }),
      /editorial plan/i
    );
  } finally {
    delete require.cache[stageKey];
    if (savedInstr) require.cache[instrKey] = savedInstr; else delete require.cache[instrKey];
    delete require.cache[stageKey];
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
  assert.match(prompt, /main_article, exclude/);
  // #969: short_mention은 렌더 경로가 없어 exclude와 결과가 같았다. 등급을 제시하면 편집 계획이
  // 그것을 고르고, 독자에게는 아무것도 도달하지 않는다. 선택지는 실제 결과와 1:1이어야 한다.
  assert.doesNotMatch(prompt, /short_mention/, '렌더 경로 없는 등급을 다시 제시하면 안 된다');
  // #1000: reference_only는 렌더 목적지가 실재했지만 그 섹션(render/reference-articles.js)이
  // coverage_decision을 읽지 않아 결과는 exclude와 같았다. 같은 이유로 어휘에서 뺐다.
  assert.doesNotMatch(prompt, /reference_only/, '결과가 exclude와 같은 등급을 다시 제시하면 안 된다');
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

// --- editor 주입(plan injection + coverage-strip) 확인: callLlmJson 캡처 스텁으로 runEditorStage의 user prompt를 본다 ---

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

// #700: editorial-plan은 항상 실행되는 필수 단계다. callLlmJson을 캡처 스텁으로 바꿔,
// 항상 stage가 호출되는지와 정규화 결과를 본다(flag·off-path 없음).
test('buildEditorialPlanReport는 항상 LLM을 호출하고 정규화된 plan을 돌린다', async () => {
  const instrKey = require.resolve('../../publish/orchestrator-llm-instrumentation');
  const stageKey = require.resolve('../../publish/orchestrator-editorial-plan-stage');
  const savedInstr = require.cache[instrKey];
  let calls = 0;
  require.cache[instrKey] = {
    id: instrKey, filename: instrKey, loaded: true,
    exports: {
      callLlmJson: async () => {
        calls += 1;
        return {
          editorial_plans: [{
            title: 'T', url: 'https://example.com/a', source_candidate_hash: 'abc123',
            // #1000: 프롬프트가 더는 제시하지 않는 등급이다. 여기 남겨 두는 이유는 정규화가
            // 등급을 판정하지 않고 원문 그대로 통과시켜야 하기 때문이다 — 판정은 재조정기가
            // 하고, 그때 모델이 실제로 쓴 문자열이 강등 기록에 남아야 한다.
            coverage_decision: 'reference_only', impact_level: 'Design Reference',
            direct_hal_impact: false, target_description: 'TD', editorial_angle: 'EA',
            why_it_matters: 'W', reader_takeaway: 'R',
            misunderstanding_risks: ['m'], source_limitations: ['s']
          }]
        };
      }
    }
  };
  delete require.cache[stageKey];
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
    assert.equal(report.editorial_plans[0].coverage_decision, 'reference_only');
  } finally {
    delete require.cache[stageKey];
    if (savedInstr) require.cache[instrKey] = savedInstr; else delete require.cache[instrKey];
    delete require.cache[stageKey];
  }
});
