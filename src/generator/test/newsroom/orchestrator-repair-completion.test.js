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
        if (s.throwOnStageIncludes && String(stage.label).includes(s.throwOnStageIncludes)) {
          throw new Error(`LLM failed at ${stage.label}`);
        }
        return { patches: [] };
      }
    }),
    '../../publish/orchestrator-quality-gate-runner': (s) => ({
      // repair/completion 재게이트는 항상 PASS인 정합 셋을 돌려준다.
      runQualityGateAndPersist: (editor) => {
        s.regateCalls.push(editor);
        return { editor, qualityReport: s.regateNotPass ? { ...passReport(), status: 'NEEDS_FIX' } : passReport() };
      }
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
      reviewReporterCapsules: () => [],
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
      // repair try가 throw하면 catch에서 호출. s.salvageThrows면 oracle 불일치를 모사해 throw하고,
      // 아니면 s.salvage(후보 또는 null)를 돌려준다.
      salvagePublishableSubset: () => {
        s.salvageCalls += 1;
        if (s.salvageThrows) { throw new Error('salvage oracle mismatch'); }
        return s.salvage;
      }
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
    salvageThrows: setup.salvageThrows || false,
    llmThrows: setup.llmThrows || false,
    throwOnStageIncludes: setup.throwOnStageIncludes || '',
    completionCandidates: setup.completionCandidates || [],
    tooFew: setup.tooFew || false,
    repairFailureCalls: [],
    salvageCalls: 0,
    regateCalls: [],
    regateNotPass: setup.regateNotPass || false
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

test('#628 salvage 자체가 throw하면 null로 떨어져 terminal로 새지 않고 reviewableReturn=true로 fail-closed한다', async () => {
  // attemptRepairFailureSalvage의 catch 경로: salvagePublishableSubset/검증이 throw해도
  // 예외가 위로 새지 않고 null이 되어 reviewable repair-failure로 안전하게 떨어진다.
  const repairPlan = [{ action: 'repair-section', headline: 'CameraX release A' }];
  await withStubbed({ repairPlan, salvage: null, salvageThrows: true, llmThrows: true }, async (runRepairAndCompletionPasses, state) => {
    const newsroomDir = tempRoot('repair-completion-');
    const result = await runRepairAndCompletionPasses(baseArgs({ newsroomDir, root: newsroomDir }));

    assert.equal(result.reviewableReturn, true);
    assert.equal(result.editor, undefined);
    assert.equal(state.repairFailureCalls.length, 1);
    assert.equal(state.repairFailureCalls[0].stage, 'editor repair attempt 1/1');
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

// repair 뒤 재검토가 일부 기사만 unpublishable로 막은 경우의 salvage(salvageUnpublishableAfterReview).
// salvagePublishableSubset 자체(하한·subset 재게이트)는 quality 도메인 테스트가 검증하므로 여기서는
// 스텁으로 두고, "원인이 unpublishable뿐일 때만 위임하고 결과를 어떻게 돌려주는가"를 고정한다.
function reviewBlockedReport(overrides = {}) {
  return {
    status: 'NEEDS_FIX',
    deductions: [],
    unpublishable_articles: [{ section_index: 1, headline: 'HAL change B', reason: '원문이 뒷받침하지 않는 단정' }],
    metrics: { source_gap_count: 0, must_fix_count: 0, blocking_deduction_count: 0 },
    ...overrides
  };
}

function runReviewSalvage(setup, overrides = {}) {
  const sectionA = sectionWithUrl('CameraX release A', 'https://example.com/a');
  const sectionB = sectionWithUrl('HAL change B', 'https://example.com/b');
  let delegated = 0;
  let regates = 0;
  const result = withStubbed({ repairPlan: [], salvage: setup.salvage, regateNotPass: setup.regateNotPass }, (run, state) => {
    const { salvageUnpublishableAfterReview } = require(STAGE_MODULE);
    const out = salvageUnpublishableAfterReview({
      date: '2026-05-08',
      editor: { sections: [sectionA, sectionB] },
      reporter: { candidates: [] },
      factCheck: { status: 'PASS', items: [] },
      qualityReport: reviewBlockedReport(),
      shortlistReport: {},
      seedEvidencePack: null,
      attempt: 1,
      qualityGateContext: {},
      ...overrides
    });
    regates = state.regateCalls.length;
    delegated = state.salvageCalls;
    return out;
  });
  return { result, delegated, regates, sectionA, sectionB };
}

test('재검토 후 기사 1건만 unpublishable이면 그 기사만 강등하고 남은 PASS subset을 돌려준다', () => {
  const sectionA = sectionWithUrl('CameraX release A', 'https://example.com/a');
  const salvage = {
    editor: { sections: [sectionA] },
    factCheck: { status: 'PASS', items: [], salvaged: true },
    qualityReport: passReport(),
    kept_section_count: 1
  };
  const { result } = runReviewSalvage({ salvage });
  assert.ok(result);
  assert.deepEqual(result.editor.sections.map(s => s.headline), ['CameraX release A']);
  assert.equal(result.qualityReport.status, 'PASS');
  assert.deepEqual(result.droppedSections.map(s => s.headline), ['HAL change B']);
  // 강등 사유(unpublishable reason)가 repair_actions용 문자열에 남는다.
  assert.equal(result.droppedActions.length, 1);
  assert.match(result.droppedActions[0], /^demote\(source-review-salvage\): .*HAL change B/);
});

test('재게이트가 PASS가 아니면 채택하지 않고 이전 상태로 산출물을 다시 기록한 뒤 null을 돌려준다', () => {
  const sectionA = sectionWithUrl('CameraX release A', 'https://example.com/a');
  const salvage = {
    editor: { sections: [sectionA] }, factCheck: { status: 'PASS', items: [] },
    qualityReport: passReport(), kept_section_count: 1
  };
  const { result, regates } = runReviewSalvage({ salvage, regateNotPass: true });
  assert.equal(result, null);
  // salvage subset 재게이트 1회 + 이전 상태 복원 기록 1회.
  assert.equal(regates, 2);
});

test('빼고 나면 하한 미만이거나 subset 게이트가 PASS 아니면(salvage가 null) null이라 다음 attempt로 간다', () => {
  const { result } = runReviewSalvage({ salvage: null });
  assert.equal(result, null);
});

test('hard blocker / must_fix / source gap / fact-check NEEDS_FIX가 있으면 salvage를 시도하지 않는다', () => {
  const salvage = {
    editor: { sections: [] }, factCheck: {}, qualityReport: passReport(), kept_section_count: 1
  };
  const blocked = [
    { qualityReport: reviewBlockedReport({ metrics: { source_gap_count: 0, must_fix_count: 0, blocking_deduction_count: 1 } }) },
    { qualityReport: reviewBlockedReport({ metrics: { source_gap_count: 0, must_fix_count: 1, blocking_deduction_count: 0 } }) },
    { qualityReport: reviewBlockedReport({ metrics: { source_gap_count: 1, must_fix_count: 0, blocking_deduction_count: 0 } }) },
    { factCheck: { status: 'NEEDS_FIX', items: [] } },
    { qualityReport: reviewBlockedReport({ unpublishable_articles: [] }) },
    { qualityReport: passReport() }
  ];
  for (const overrides of blocked) {
    const { result, delegated } = runReviewSalvage({ salvage }, overrides);
    assert.equal(result, null);
    assert.equal(delegated, 0);
  }
});
