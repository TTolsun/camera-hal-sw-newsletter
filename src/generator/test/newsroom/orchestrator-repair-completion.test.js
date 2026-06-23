const assert = require('node:assert/strict');
const test = require('node:test');

const { tempRoot } = require('../../../shared/test/helpers/fs');

// 추출 전 main()의 attempt-loop 안 repair 패스 + completion 패스 블록을 입력→동작으로 고정한다.
// 이 모듈의 책임은 orchestration(품질이 PASS가 아니면 repair를 돌리고, 부족하면 completion을
// 돌린 뒤, reviewable repair-failure면 early return 신호를, 정상이면 reassign된 loop local들을
// 반환)이다. 무거운 협력자(LLM 호출, editor 검증, 품질 게이트, repair-plan 계산, 이미지 해소 등)는
// require.cache 스텁으로 교체해 threading 계약과 두 sentinel(early return) 매핑만 결정론적으로
// 고정한다. 엄격한 editor 계약·품질 점수·repair-plan 계산 자체는 각 도메인 테스트가 따로 검증한다.

const STAGE_MODULE = '../../publish/orchestrator-repair-completion';

function passReport() {
  return { status: 'PASS', score: 95, threshold: 60, deductions: [], metrics: {} };
}

function makeStubs(state) {
  return {
    '../../publish/orchestrator-llm-instrumentation': (s) => ({
      callLlmJson: async (stage) => {
        if (s.llmThrows) { throw new Error('repair LLM failed'); }
        // 특정 단계(repair/completion)에서만 throw시켜 한 패스의 실패 경로만 고립한다.
        if (s.throwOnStageIncludes && String(stage).includes(s.throwOnStageIncludes)) {
          throw new Error(`LLM failed at ${stage}`);
        }
        return { patches: [] };
      }
    }),
    '../../publish/orchestrator-quality-gate-runner': () => ({
      // repair/completion 재게이트는 항상 PASS인 정합 셋을 돌려준다.
      runQualityGateAndPersist: (editor) => ({ editor, qualityReport: passReport() })
    }),
    '../../publish/orchestrator-editor-validation': (s) => ({
      validateEditor: (editor) => editor,
      validateTargetedRepairResult: () => {},
      applyRepairPatchesAndValidate: ({ editor }) => ({ ok: true, editor, violations: [] }),
      publicArticleJudgeDeps: {}
    }),
    '../../publish/orchestrator-public-article-judge': () => ({
      validatePublicArticleJudgeOrRepair: async (args) => args.editor
    }),
    '../../publish/orchestrator-repair-plan': (s) => ({
      buildFullSectionRepairPlan: () => s.repairPlan,
      buildSectionRepairPlan: () => s.repairPlan,
      sectionsMatchingRepairPlan: () => [],
      sectionsOutsideRepairPlan: (sections) => sections,
      // 기본은 completion 패스를 타지 않도록 false 고정(repair 경로만 보는 테스트).
      // completion 경로를 보는 테스트는 belowDemoteTarget(demote seed + target)로 진입한다.
      hasTooFewMainArticlesDeduction: () => s.tooFew || false,
      completionRefillTargetCount: (n) => n
    }),
    '../../publish/orchestrator-reporter-normalize': () => ({
      isReserveCandidate: () => false,
      selectedReporterCapsules: () => [],
      reserveReporterCapsules: () => [],
      reporterCandidateCapsules: () => []
    }),
    '../../publish/orchestrator-targeted-repair': () => ({
      targetedRepairError: (message) => Object.assign(new Error(message), { isTargetedRepairError: true }),
      validateCompletionSections: (sections) => sections
    }),
    '../../publish/orchestrator-repair-failure-artifacts': (s) => ({
      writeReviewableRepairFailureArtifacts: (args) => { s.repairFailureCalls.push(args); }
    }),
    '../../publish/orchestrator-image-warnings': () => ({
      warnResolvedImageFallbacks: () => {},
      pruneResolvedFallbackImageFalsePositives: (factCheck) => factCheck
    }),
    '../../publish/orchestrator-section-locking': () => ({
      reserveUsageForSections: () => [],
      mergeLockedSections: (sections) => ({ sections, rejected: [] }),
      appendUniqueSections: (current, candidates) => [...(current || []), ...(candidates || [])],
      sourceGapSections: () => [],
      reporterEligibilityFindings: () => [],
      applyReporterEligibilityFindingsToFactCheck: (factCheck) => factCheck
    }),
    '../../publish/orchestrator-completion': (s) => ({
      availableCompletionCandidates: () => s.completionCandidates || [],
      buildCompletionExclusionContext: () => '[]'
    }),
    '../../render/article-image-resolver': () => ({
      resolveIssueArticleImages: async () => {}
    }),
    '../../editor/editor-output-contract': () => ({
      reconcileFactClaimEvidence: (editor) => editor
    }),
    '../../quality/newsletter-quality': (s) => ({
      hardBlockedGroupsForDroppedSections: () => [],
      // repair try가 throw하면 catch에서 호출. s.salvage가 있으면 그 후보를, 없으면 null을 돌려준다.
      salvagePublishableSubset: () => s.salvage
    }),
    '../../publish/fact-check-postprocess': () => ({
      pruneCatchUpFramingFactCheckItems: (factCheck) => factCheck,
      sanitizeClaimEvidenceIds: (editor) => editor,
      stampCoverageType: (editor) => editor,
      validateFactCheck: (factCheck) => factCheck
    }),
    '../../publish/orchestrator-stage-prompts': () => ({
      editorRepairPatchSystemPrompt: () => 'repair-patch-system-prompt',
      factCheckRepairSystemPrompt: () => 'fact-check-repair-system-prompt',
      editorCompletionSystemPrompt: () => 'completion-system-prompt',
      factCheckCompletionSystemPrompt: () => 'fact-check-completion-system-prompt'
    })
  };
}

function withStubbed(setup, run) {
  const state = {
    repairPlan: setup.repairPlan,
    salvage: setup.salvage,
    llmThrows: setup.llmThrows || false,
    throwOnStageIncludes: setup.throwOnStageIncludes || '',
    completionCandidates: setup.completionCandidates || [],
    tooFew: setup.tooFew || false,
    repairFailureCalls: []
  };
  const stubs = makeStubs(state);
  const stageKey = require.resolve(STAGE_MODULE);
  const saved = new Map();
  for (const [relPath, factory] of Object.entries(stubs)) {
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
    const { runRepairAndCompletionPasses } = require(STAGE_MODULE);
    return run(runRepairAndCompletionPasses, state);
  } finally {
    delete require.cache[stageKey];
    for (const [key, original] of saved.entries()) {
      if (original) {
        require.cache[key] = original;
      } else {
        delete require.cache[key];
      }
    }
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
    totalAttempts: 1,
    commonContext: 'common',
    lockedContext: 'locked',
    lockedSections: [],
    excludedSections: [],
    newsroomDir: overrides.newsroomDir,
    articleCapsuleReport: { capsules: [] },
    backgroundContextReport: { items: [] },
    shortlistReport: { selected_articles: [] },
    seedEvidencePack: null,
    root: overrides.root,
    retryHistory: [],
    qualityGateContext: {},
    mainArticleCountBeforeRepair: 1,
    // repair 패스가 돌도록 PASS가 아닌 품질 보고서로 진입한다.
    editor: baseEditor(),
    factCheck: { items: [] },
    qualityReport: { status: 'NEEDS_FIX', score: 40, threshold: 60, deductions: [], metrics: {} },
    attemptedSections: [],
    eligibilityFindings: [],
    rejectedGeneratedSections: [],
    ...overrides
  };
}

test('clean repair 경로: reviewableReturn=false로 editor/factCheck/qualityReport와 threading된 loop local들을 반환한다', async () => {
  // repair-section patch plan(structural 아님) → 결정론 patch 경로, salvage 불필요.
  const repairPlan = [{ action: 'repair-section', headline: 'CameraX release A' }];
  await withStubbed({ repairPlan, salvage: null }, async (runRepairAndCompletionPasses, state) => {
    const newsroomDir = tempRoot('repair-completion-');
    const result = await runRepairAndCompletionPasses(baseArgs({ newsroomDir, root: newsroomDir }));

    // sentinel은 정상 경로를 가리킨다(early return 아님).
    assert.equal(result.reviewableReturn, false);
    // 이후 main()에서 재바인딩되는 핵심 local들이 모두 반환된다.
    assert.ok(result.editor && Array.isArray(result.editor.sections));
    assert.ok(result.factCheck);
    assert.equal(result.qualityReport.status, 'PASS');
    // 분리 전 블록 시작부에서 let으로 선언되던 loop local들이 빠짐없이 반환된다(threading 계약).
    assert.ok(Array.isArray(result.demotedSections));
    assert.ok(Array.isArray(result.repairActions));
    assert.ok(Array.isArray(result.replacedSections));
    assert.ok(Array.isArray(result.failedSections));
    assert.ok(Array.isArray(result.regeneratedSections));
    assert.ok(Array.isArray(result.rejectedRetryOutputs));
    assert.ok(Array.isArray(result.reserveCandidatesUsed));
    assert.equal(result.reservePoolOpened, false);
    assert.equal(result.reserveOpenReason, '');
    assert.ok(Array.isArray(result.candidateRejections));
    assert.equal(result.underfilledReason, '');
    assert.equal(result.completionFallbackToPrepass, false);
    assert.ok(Array.isArray(result.repairPlan));
    assert.ok(Array.isArray(result.skippedRepairPlan));
    assert.ok(Array.isArray(result.attemptedSections));
    assert.ok(Array.isArray(result.eligibilityFindings));
    assert.ok(Array.isArray(result.rejectedGeneratedSections));
    // repairActions가 repair-section patch로 채워진다(repair 패스가 실제로 돌았다는 증거).
    assert.ok(result.repairActions.some(a => a.includes('repair-section')));
    // 정상 경로에서는 reviewable repair-failure writer가 호출되지 않는다.
    assert.equal(state.repairFailureCalls.length, 0);
  });
});

test('repair-failure 경로: repair가 throw하고 salvage가 null이면 reviewableReturn=true를 반환하고 repair-failure 산출물을 쓴다', async () => {
  // structural plan(replace-or-demote) → validateEditor를 거치는 경로지만, 여기선 patch 경로의
  // applyRepairPatchesAndValidate가 ok:false면 throw한다. 더 단순하게: callLlmJson을 throw시켜
  // repair try를 실패시킨다. salvage:null이라 catch가 reviewable 산출물을 쓰고 sentinel을 돌려준다.
  const repairPlan = [{ action: 'repair-section', headline: 'CameraX release A' }];
  await withStubbed({ repairPlan, salvage: null, llmThrows: true }, async (runRepairAndCompletionPasses, state) => {
    const newsroomDir = tempRoot('repair-completion-');
    const result = await runRepairAndCompletionPasses(baseArgs({ newsroomDir, root: newsroomDir }));

    // sentinel은 early return을 가리킨다(main()에서 `if (reviewableReturn) return;`로 매핑).
    assert.equal(result.reviewableReturn, true);
    // 정상 경로 local은 반환되지 않는다.
    assert.equal(result.editor, undefined);
    assert.equal(result.qualityReport, undefined);
    assert.equal(result.repairPlan, undefined);
    // reviewable repair-failure writer가 정확히 한 번, repair 단계명으로 호출된다.
    assert.equal(state.repairFailureCalls.length, 1);
    assert.equal(state.repairFailureCalls[0].stage, 'editor repair attempt 1/1');
  });
});

// #656: 아래 세 케이스는 리팩토링 전에 보존해야 하는 "발행 회복력" 동작이다 — repair 실패 시
// publishable subset salvage(#628), completion 실패 시 pre-completion PASS 스냅샷으로 revert(#629),
// 그리고 pre-completion이 비-PASS면 reviewable로 fail-closed. 결과 기반 흐름으로 바꾸기 전에 고정한다.

function sectionWithUrl(headline, url) {
  return {
    category: 'Android Camera',
    headline,
    public_article: { headline },
    sources: [{ title: 'Source', url }]
  };
}

test('#628 repair-failure salvage 성공 경로: repair가 throw해도 salvage가 PASS subset을 돌려주면 reviewableReturn=false로 복구하고 dropped 섹션을 demote한다', async () => {
  // pre-repair editor는 두 섹션(A,B). salvage는 A만 남긴 publishable subset을 돌려준다 → B는 demote.
  const sectionA = sectionWithUrl('CameraX release A', 'https://example.com/a');
  const sectionB = sectionWithUrl('HAL change B', 'https://example.com/b');
  const repairPlan = [{ action: 'repair-section', headline: 'CameraX release A' }];
  const salvage = {
    editor: { sections: [sectionA] },
    factCheck: { items: [], salvaged: true },
    qualityReport: passReport(),
    kept_section_count: 1
  };
  await withStubbed({ repairPlan, salvage, llmThrows: true }, async (runRepairAndCompletionPasses, state) => {
    const newsroomDir = tempRoot('repair-completion-');
    const result = await runRepairAndCompletionPasses(baseArgs({
      newsroomDir,
      root: newsroomDir,
      editor: { sections: [sectionA, sectionB] },
      mainArticleCountBeforeRepair: 1
    }));

    // salvage로 발행 가능한 subset을 확보 → early return 아님(정상 발행 경로로 진행).
    assert.equal(result.reviewableReturn, false);
    // editor는 salvage subset(A만)으로 재바인딩된다.
    assert.deepEqual(result.editor.sections.map(s => s.headline), ['CameraX release A']);
    assert.equal(result.qualityReport.status, 'PASS');
    assert.equal(result.factCheck.salvaged, true);
    // drop된 B는 demotedSections에 들어간다.
    assert.ok(result.demotedSections.some(s => s.headline === 'HAL change B'));
    // salvage 성공이므로 reviewable repair-failure 산출물은 쓰지 않는다.
    assert.equal(state.repairFailureCalls.length, 0);
  });
});

test('#629 completion-failure revert 경로: completion이 throw해도 pre-completion이 PASS면 그 스냅샷으로 되돌려 reviewableReturn=false로 발행한다', async () => {
  // repair는 건너뛰고(PASS + 빈 plan) completion만 태운다. demote seed로 belowDemoteTarget 진입.
  const seed = sectionWithUrl('seed demote', 'https://example.com/seed');
  await withStubbed({
    repairPlan: [],
    salvage: null,
    completionCandidates: [{ id: 'reserve-1' }],
    throwOnStageIncludes: 'completion'
  }, async (runRepairAndCompletionPasses, state) => {
    const newsroomDir = tempRoot('repair-completion-');
    const result = await runRepairAndCompletionPasses(baseArgs({
      newsroomDir,
      root: newsroomDir,
      qualityReport: passReport(),
      eligibilityFindings: [{ section: seed }],
      mainArticleCountBeforeRepair: 2
    }));

    // pre-completion이 이미 PASS → top-up 실패가 발행을 막지 않는다.
    assert.equal(result.reviewableReturn, false);
    assert.equal(result.completionFallbackToPrepass, true);
    assert.ok(result.underfilledReason.includes('completion top-up failed'));
    assert.equal(result.qualityReport.status, 'PASS');
    // 자동 복구이므로 reviewable repair-failure 산출물은 쓰지 않는다.
    assert.equal(state.repairFailureCalls.length, 0);
  });
});

test('#629 completion-failure reviewable 경로: completion이 throw하고 pre-completion이 비-PASS면 reviewableReturn=true로 fail-closed하고 completion 단계명으로 산출물을 쓴다', async () => {
  // repair는 건너뛰지만(빈 plan) 들어온 qualityReport가 NEEDS_FIX → pre-completion이 비-PASS.
  const seed = sectionWithUrl('seed demote', 'https://example.com/seed');
  await withStubbed({
    repairPlan: [],
    salvage: null,
    completionCandidates: [{ id: 'reserve-1' }],
    throwOnStageIncludes: 'completion'
  }, async (runRepairAndCompletionPasses, state) => {
    const newsroomDir = tempRoot('repair-completion-');
    const result = await runRepairAndCompletionPasses(baseArgs({
      newsroomDir,
      root: newsroomDir,
      qualityReport: { status: 'NEEDS_FIX', score: 40, threshold: 60, deductions: [], metrics: {} },
      eligibilityFindings: [{ section: seed }],
      mainArticleCountBeforeRepair: 2
    }));

    // pre-completion이 PASS가 아니라 completion이 필수 보충이었으므로 reviewable로 떨어진다.
    assert.equal(result.reviewableReturn, true);
    assert.equal(result.editor, undefined);
    // reviewable repair-failure writer가 completion 단계명으로 정확히 한 번 호출된다.
    assert.equal(state.repairFailureCalls.length, 1);
    assert.equal(state.repairFailureCalls[0].stage, 'editor completion attempt 1/1');
  });
});
