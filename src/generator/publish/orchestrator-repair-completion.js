// attempt loop 안의 repair 패스 + completion 패스 블록(#655).
// main()의 for-attempt 루프에서 editor + fact-check 단계 직후, 품질이 PASS가 아니고 repair
// plan이 있으면 repair 패스(결정론 patch 또는 structural demote + judge/fact-check 재실행 +
// 재게이트, 실패 시 #628 salvage)를 돌리고, 이어서 main article 수가 부족하면 completion 패스
// (reserve candidate로 부족분 채우기 + judge/fact-check 재실행 + 재게이트, 실패 시 pre-completion
// PASS 스냅샷으로 되돌리거나 reviewable failure)를 돌린다. 두 패스는 demotedSections/repairActions/
// eligibilityFindings/editor/factCheck/qualityReport/attemptedSections/rejectedGeneratedSections
// 등 다수의 가변 loop local을 공유하므로 한 함수로 묶어 패스 사이 fragile threading을 피한다.
//
// 이 블록은 main()을 reviewable repair-failure로 early return 하던 지점을 두 군데 포함한다
// (salvage 불가 repair 실패, pre-completion 비-PASS인 completion 실패). plain 함수로는 그
// return을 재현할 수 없으므로, 두 reviewable 경로는 { reviewableReturn: true }를 반환하고
// 정상 fall-through는 { reviewableReturn: false, ...뒤에서 쓰이는 reassign된 loop local }를
// 반환한다. 호출처(main)는 reviewableReturn 플래그로 원래 값 없는 return;(이후 코드 미실행)과
// 동일하게 main()을 끝내고, 정상 경로는 반환된 local을 그대로 되묶는다.
//
// 협력자는 모두 이미 분리된 sibling/shared 모듈에서 직접 import하므로 god-file을 import하지
// 않는다(순환 없음). validateTargetedRepairResult / validateEditor / applyRepairPatchesAndValidate /
// publicArticleJudgeDeps는 publish-mode(generationRunState)에 결합된 editor 검증 seam이라
// orchestrator-editor-validation에서 import한다. generationRunState / runtimeConfig는 god-file과
// 동일한 모듈에서 재파생한다.
const fs = require('fs');
const path = require('path');
const { writeJson } = require('../../shared/common/common');
const { readRuntimeConfig } = require('../../shared/common/runtime-config');
const {
  editorCompletionSchema,
  editorRepairPatchSchema,
  factCheckSchema
} = require('../render/newsletter-schema');
const { resolveIssueArticleImages } = require('../render/article-image-resolver');
const { stableSectionKey, sectionSummary } = require('../../shared/common/section-identity');
const {
  pruneCatchUpFramingFactCheckItems,
  sanitizeClaimEvidenceIds,
  stampCoverageType,
  validateFactCheck
} = require('./fact-check-postprocess');
const {
  articlePolicy,
  qualityGatePolicy
} = require('../../shared/common/newsletter-policy');
const {
  hardBlockedGroupsForDroppedSections,
  salvagePublishableSubset
} = require('../quality/newsletter-quality');
const { reconcileFactClaimEvidence } = require('../editor/editor-output-contract');
const { REPAIR_PATCH_CONTRACT_VIOLATION } = require('../repair/repair-patch-contract');
const {
  buildMarkdown,
  buildFactCheckMarkdown,
  ensureArray
} = require('../render/newsletter-renderer');
const {
  sectionLabel,
  cloneJson
} = require('./orchestrator-shared-helpers');
const {
  buildSectionRepairPlan,
  buildFullSectionRepairPlan,
  sectionsMatchingRepairPlan,
  sectionsOutsideRepairPlan,
  hasTooFewMainArticlesDeduction,
  completionRefillTargetCount
} = require('./orchestrator-repair-plan');
const {
  isReserveCandidate,
  selectedReporterCapsules,
  reserveReporterCapsules,
  reporterCandidateCapsules
} = require('./orchestrator-reporter-normalize');
const {
  targetedRepairError,
  validateCompletionSections
} = require('./orchestrator-targeted-repair');
const {
  writeReviewableRepairFailureArtifacts
} = require('./orchestrator-repair-failure-artifacts');
const {
  warnResolvedImageFallbacks,
  pruneResolvedFallbackImageFalsePositives
} = require('./orchestrator-image-warnings');
const {
  reserveUsageForSections,
  mergeLockedSections,
  appendUniqueSections,
  sourceGapSections,
  reporterEligibilityFindings,
  applyReporterEligibilityFindingsToFactCheck
} = require('./orchestrator-section-locking');
const {
  availableCompletionCandidates,
  buildCompletionExclusionContext
} = require('./orchestrator-completion');
const { callLlmJson } = require('./orchestrator-llm-instrumentation');
const { runQualityGateAndPersist } = require('./orchestrator-quality-gate-runner');
const {
  validatePublicArticleJudgeOrRepair
} = require('./orchestrator-public-article-judge');
const {
  validateEditor,
  validateTargetedRepairResult,
  applyRepairPatchesAndValidate,
  publicArticleJudgeDeps
} = require('./orchestrator-editor-validation');
const {
  editorRepairPatchSystemPrompt,
  factCheckRepairSystemPrompt,
  editorCompletionSystemPrompt,
  factCheckCompletionSystemPrompt
} = require('./orchestrator-stage-prompts');
const { generationRunState } = require('./orchestrator-run-state');

const runtimeConfig = readRuntimeConfig(process.env);

// #628 repair-failure salvage: 약한 섹션 하나의 repair 실패가 발행 가능한 강한 카메라 기사 전체를
// 막지 않게, 정합 pre-repair snapshot에서 발행 가능한 subset을 뽑아 같은 quality gate로 재검증한다.
// salvagePublishableSubset은 subset에 게이트를 재적용해 PASS일 때만 후보를 돌려주므로(아니면 null)
// 게이트를 약화하지 않는다. salvage/검증 자체가 throw하면(드문 oracle 불일치) null을 돌려, 호출처가
// FAILED 경로로 안전하게 떨어지게 한다. 결과는 검증된 salvage 번들 또는 null이다(예외를 던지지 않음).
function attemptRepairFailureSalvage({
  date,
  preRepairEditor,
  reporter,
  preRepairFactCheck,
  preRepairQualityReport,
  shortlistReport,
  seedEvidencePack
}) {
  try {
    const candidate = salvagePublishableSubset(
      date, preRepairEditor, reporter, preRepairFactCheck, preRepairQualityReport,
      { threshold: qualityGatePolicy.threshold, shortlistReport, strictClaimValidation: true, seedEvidencePack }
    );
    if (!candidate) return null;
    const salvagedEditor = validateEditor(candidate.editor, date, reporter, { strictClaims: true, requireStoryContract: true });
    return { ...candidate, editor: salvagedEditor };
  } catch (salvageError) {
    console.warn(`Repair-failure salvage could not produce a valid subset: ${salvageError.message}`);
    return null;
  }
}

// #629 completion-failure 복구: completion(target 채우기)은 best-effort다. completion 직전 draft가
// 이미 quality gate를 PASS(min 충족)했다면, target 보충 실패가 그 발행을 막지 않게 pre-completion
// 스냅샷으로 되돌릴 복구 번들을 돌려준다(재검증 없음 — 이미 PASS인 스냅샷). pre-completion이 PASS가
// 아니면(completion이 필수 보충이었던 경우) null을 돌려, 호출처가 FAILED_REPAIR_REVIEWABLE로
// fail-closed하게 한다. (salvagePublishableSubset은 '일부 실패 섹션 drop' 용도라 전부 PASS인
// pre-completion에는 부적합 — 전부 keep이면 null을 반환한다. 그래서 여기선 스냅샷을 그대로 복원한다.)
function recoverCompletionTopUpFailure({
  error,
  missingArticleCount,
  preCompletionEditor,
  preCompletionFactCheck,
  preCompletionQualityReport,
  completionTargetCount
}) {
  if (!(preCompletionQualityReport && preCompletionQualityReport.status === 'PASS')) return null;
  const publishedCount = ensureArray(preCompletionEditor.sections).length;
  console.warn(`Completion top-up for ${missingArticleCount} article(s) failed; publishing ${publishedCount} already-passing main article(s) below target ${completionTargetCount}. (${error.message})`);
  return {
    editor: preCompletionEditor,
    factCheck: preCompletionFactCheck,
    qualityReport: preCompletionQualityReport,
    underfilledReason: `completion top-up failed; published ${publishedCount} passing article(s) below target ${completionTargetCount}`
  };
}

async function runRepairAndCompletionPasses({
  date,
  reporter,
  attempt,
  totalAttempts,
  commonContext,
  lockedContext,
  lockedSections,
  excludedSections,
  newsroomDir,
  articleCapsuleReport,
  backgroundContextReport,
  shortlistReport,
  seedEvidencePack,
  root,
  retryHistory,
  qualityGateContext,
  mainArticleCountBeforeRepair,
  editor,
  factCheck,
  qualityReport,
  attemptedSections,
  eligibilityFindings,
  rejectedGeneratedSections
}) {
  let repairActions = [];
  let demotedSections = appendUniqueSections(
    sourceGapSections(editor, factCheck),
    eligibilityFindings.map(finding => finding.section)
  );
  let replacedSections = [];
  let failedSections = [];
  let regeneratedSections = [];
  let rejectedRetryOutputs = [];
  let reserveCandidatesUsed = [];
  let reservePoolOpened = false;
  let reserveOpenReason = '';
  let candidateRejections = [];
  let underfilledReason = '';
  // completion(target 채우기)이 실패했지만 직전 pre-completion draft가 이미 PASS라 그 상태로
  // 되돌려 발행한 경우(자동 복구)를 정상 thin-week underfill과 구분하기 위한 구조 플래그.
  let completionFallbackToPrepass = false;
  const fullRepairPlan = buildFullSectionRepairPlan(editor, qualityReport, factCheck, eligibilityFindings);
  const repairPlan = buildSectionRepairPlan(editor, qualityReport, factCheck, eligibilityFindings, {
    maxSectionRepairs: runtimeConfig.newsroomMaxSectionRepairs
  });
  const skippedRepairPlan = fullRepairPlan.slice(repairPlan.length);
  demotedSections = appendUniqueSections(
    demotedSections,
    sectionsMatchingRepairPlan(
      editor.sections,
      repairPlan.filter(item => item.action === 'replace-or-demote')
    )
  );
  // repair 패스가 reserve candidate를 쓸 수 있는지. demote된 섹션이 있으면 reserve로 보충 가능하다는
  // 의미다. 공유 후처리(reporterEligibilityFindings)와 두 repair 분기 모두에서 참조하므로 if/else
  // 바깥, demote 보강 직후(regen/demote 이전 값)에 선언한다.
  const repairAllowsReserve = demotedSections.length > 0;
  if (qualityReport.status !== 'PASS' && repairPlan.length > 0) {
    const repairStage = `editor repair attempt ${attempt}/${totalAttempts}`;
    // #628 salvage용 일관 snapshot. repair try 안에서 editor/factCheck/qualityReport는
    // 재할당되지만(특히 structural 경로는 mergeLockedSections로 section 순서/구성이 바뀜),
    // 이 시점의 셋은 직전 runQualityGateAndPersist가 만든 정합 셋이다. salvage는 article_results를
    // editor.sections 인덱스에 위치 대응시키므로, 재할당된 editor에 stale qualityReport를 쓰면
    // 인덱스가 어긋난다. 그래서 항상 이 정합 pre-repair snapshot에서만 salvage한다(이 섹션들은
    // 이미 image/evidence 재조정을 거친 검증된 draft이기도 하다).
    const preRepairEditor = editor;
    const preRepairFactCheck = factCheck;
    const preRepairQualityReport = qualityReport;
    try {
      repairActions = repairPlan.map(item => `${item.action}: ${item.headline}`);
      failedSections = sectionsMatchingRepairPlan(editor.sections, repairPlan);
      const preservedSections = sectionsOutsideRepairPlan(editor.sections, repairPlan);
      const repairFactCheckStage = `fact-checker repair attempt ${attempt}/${totalAttempts}`;
      console.warn(`Quality attempt ${attempt}/${totalAttempts} is below threshold; running editor repair pass for ${repairPlan.length} section(s).`);
      // #482: repair-section만 있는 plan은 article-preserving이므로 field-level
      // patch를 결정론적으로 적용해 모델이 어떤 기사가 존재하는지 바꾸지 못하게
      // 한다. 구조 변경 action(replace-section / replace-or-demote)은 정당하게
      // section을 재구성하므로 아래 else 분기의 full-section 경로와 가드를 쓴다.
      const structuralRepairPlan = repairPlan.filter(item => item.action !== 'repair-section');
      if (structuralRepairPlan.length === 0) {
        repairActions = repairPlan.map(item => `repair-section(patch): ${item.headline}`);
        const failedKeys = new Set(failedSections.map(stableSectionKey));
        const patchTargets = ensureArray(editor.sections)
          .map((section, index) => ({ section, index }))
          .filter(({ section }) => failedKeys.has(stableSectionKey(section)))
          .map(({ section, index }) => ({
            section_index: index,
            section_key: stableSectionKey(section),
            summary: sectionSummary(section, index),
            article_sections: section.article_sections,
            public_article: section.public_article
          }));
        const patchResponse = await callLlmJson(
          repairStage,
          editorRepairPatchSystemPrompt(),
          `${commonContext}\n\nFailed sections to patch JSON:\n${JSON.stringify(patchTargets, null, 2)}\n\nRepair plan JSON:\n${JSON.stringify(repairPlan, null, 2)}\n\nPrimary selected article capsule JSON:\n${JSON.stringify(selectedReporterCapsules(date, reporter, articleCapsuleReport, { seedEvidencePack }), null, 2)}\n\nCurrent fact-check JSON:\n${JSON.stringify(factCheck, null, 2)}\n\nCurrent quality deductions JSON:\n${JSON.stringify(ensureArray(qualityReport?.deductions), null, 2)}`,
          editorRepairPatchSchema
        );
        const patches = ensureArray(patchResponse && patchResponse.patches);
        writeJson(path.join(newsroomDir, `editor-repair-patches-attempt-${attempt}.json`), { patches });
        const patchResult = applyRepairPatchesAndValidate({ editor, patches, reporter, date, seedEvidencePack });
        if (!patchResult.ok) {
          throw targetedRepairError('Editor repair violated the article-preserving patch contract.', {
            field: 'sections.repair_patch',
            reason: REPAIR_PATCH_CONTRACT_VIOLATION,
            violations: patchResult.violations,
            sectionCount: ensureArray(editor.sections).length
          });
        }
        // seedEvidencePack을 함께 전달해 revertUncoveredPatchedVerifiedFacts의 keep/revert 판정과
        // 이 strict 게이트가 같은 evidence 입력으로 커버리지를 보게 한다. pack 없이 재게이트하면
        // seed-pack 근거로만 protected token이 해소되는 유지된 fact가 여기서 다시
        // missing_matching_fact_claim으로 죽는다(오라클 입력 불일치).
        editor = validateEditor(patchResult.editor, date, reporter, { strictClaims: true, requireStoryContract: true, seedEvidencePack });
      } else {
      // #632: replace/demote를 LLM 전체-재생성 대신 결정론 강등으로 처리한다. 실패(structural)
      // 섹션을 떨어뜨리고 통과 섹션만 남긴다. 이로써 #628의 identity-drift throw와 evidence_id 반복
      // 루프를 일으키던 regen 호출(callLlmJson + mergeLockedSections + validateTargetedRepairResult)이
      // 사라진다. 아래 공유 후처리(judge / fact-check 재실행 / 재게이트)가 강등된 draft를 다시 검증하고,
      // 그 다음 completion 패스가 부족분을 reserve candidate로 채워 기사 수를 보존한다.
      // 기본 newsroomMaxSectionRepairs=1이라 plan은 1개 섹션(여기선 structural 1개)이다. >1로 설정해
      // repair-section과 structural이 섞이면 structural만 강등되고 repair-section은 이번 attempt에선
      // 미수정으로 남는다(재게이트 NEEDS_FIX→재시도/ salvage로 안전 처리; 발행 안전 구멍은 아님).
      const structuralFailed = sectionsMatchingRepairPlan(editor.sections, structuralRepairPlan);
      const keptSections = sectionsOutsideRepairPlan(editor.sections, structuralRepairPlan);
      repairActions = structuralRepairPlan.map(item => `${item.action}(deterministic-demote): ${item.headline}`);
      demotedSections = appendUniqueSections(demotedSections, structuralFailed);
      regeneratedSections = [];
      replacedSections = structuralFailed.map(sectionLabel);
      editor = validateEditor({
        ...editor,
        sections: keptSections,
        hard_blocked_groups: [
          ...ensureArray(editor.hard_blocked_groups),
          ...hardBlockedGroupsForDroppedSections(structuralFailed)
        ]
      }, date, reporter, { strictClaims: true, requireStoryContract: true });
      }
      editor = await validatePublicArticleJudgeOrRepair({
        date,
        editor,
        reporter,
        attempt,
        editorStage: repairStage,
        commonContext,
        lockedContext,
        newsroomDir
      }, publicArticleJudgeDeps);
      attemptedSections = appendUniqueSections(attemptedSections, editor.sections);
      await resolveIssueArticleImages(editor, { root });
      warnResolvedImageFallbacks(editor);
      // #502: 영속화·fact-check 이전에 미해결 evidence_id를 결정론적으로 재바인딩(fail-closed).
      editor = reconcileFactClaimEvidence(editor, { reporter, seedEvidencePack });
      writeJson(path.join(newsroomDir, `editor-repair-attempt-${attempt}.json`), editor);
      writeJson(path.join(newsroomDir, `editor-repair-sections-attempt-${attempt}.json`), {
        locked_sections: preservedSections.map((section, index) => sectionSummary(section, index)),
        failed_sections: failedSections.map((section, index) => sectionSummary(section, index)),
        regenerated_sections: regeneratedSections.map((section, index) => sectionSummary(section, index)),
        rejected_retry_outputs: rejectedRetryOutputs,
        max_section_repairs: runtimeConfig.newsroomMaxSectionRepairs,
        repair_plan: repairPlan,
        skipped_repair_plan: skippedRepairPlan
      });
      fs.writeFileSync(path.join(newsroomDir, `editor-repair-attempt-${attempt}.md`), buildMarkdown(editor), 'utf8');

      factCheck = validateFactCheck(await callLlmJson(
        repairFactCheckStage,
        factCheckRepairSystemPrompt(),
      `${commonContext}\n\nPrimary selected article capsule JSON:\n${JSON.stringify(selectedReporterCapsules(date, reporter, articleCapsuleReport, { seedEvidencePack }), null, 2)}\n\nReserve article capsule pool JSON:\n${JSON.stringify(reserveReporterCapsules(date, reporter, articleCapsuleReport, { seedEvidencePack }), null, 2)}\n\nRepaired editor draft JSON:\n${JSON.stringify(editor, null, 2)}`,
        factCheckSchema
      ));
      eligibilityFindings = reporterEligibilityFindings(editor, reporter, lockedSections, {
        allowReserve: repairAllowsReserve
      });
      factCheck = applyReporterEligibilityFindingsToFactCheck(factCheck, eligibilityFindings);
      factCheck = pruneResolvedFallbackImageFalsePositives(factCheck, editor);
      editor = sanitizeClaimEvidenceIds(editor, reporter, seedEvidencePack);
      editor = stampCoverageType(editor, shortlistReport);
      factCheck = pruneCatchUpFramingFactCheckItems(factCheck, editor);
      generationRunState.factCheck = factCheck;
      writeJson(path.join(newsroomDir, `fact-check-repair-attempt-${attempt}.json`), factCheck);
      fs.writeFileSync(path.join(newsroomDir, `fact-check-repair-attempt-${attempt}.md`), buildFactCheckMarkdown(date, factCheck), 'utf8');

      ({ editor, qualityReport } = runQualityGateAndPersist(editor, factCheck, attempt, 'repair', qualityGateContext));
      demotedSections = appendUniqueSections(
        demotedSections,
        sourceGapSections(editor, factCheck).concat(eligibilityFindings.map(finding => finding.section))
      );
    } catch (error) {
      // #628 salvage: 정합 pre-repair snapshot에서 발행 가능한 subset을 뽑아 같은 quality gate로
      // 재검증한다(메커니즘은 attemptRepairFailureSalvage 참고). 루프 뒤 thin-week salvage와 같은
      // 메커니즘이며, repair catch가 그 경로에 닿기 전에 return하던 갭만 메운다. salvage가 null이면
      // (subset 없음 또는 oracle 불일치 throw) 아래 else에서 reviewable로 안전하게 떨어진다.
      const repairSalvage = attemptRepairFailureSalvage({
        date,
        preRepairEditor,
        reporter,
        preRepairFactCheck,
        preRepairQualityReport,
        shortlistReport,
        seedEvidencePack
      });
      if (repairSalvage) {
        const keptKeys = new Set(ensureArray(repairSalvage.editor.sections).map(stableSectionKey).filter(Boolean));
        const droppedSections = ensureArray(preRepairEditor.sections).filter(before => {
          const key = stableSectionKey(before);
          return key ? !keptKeys.has(key) : true;
        });
        console.warn(`Repair pass failed for ${repairPlan.length} section(s); salvaging ${repairSalvage.kept_section_count} publishable article(s) and demoting ${droppedSections.length}. (${error.message})`);
        editor = repairSalvage.editor;
        factCheck = repairSalvage.factCheck;
        qualityReport = repairSalvage.qualityReport;
        generationRunState.factCheck = factCheck;
        generationRunState.qualityReport = qualityReport;
        demotedSections = appendUniqueSections(demotedSections, droppedSections);
        // 발행 가능한 PASS subset을 확보했으므로 return하지 않는다. 이번 attempt의 나머지
        // (completion은 PASS라 skip, lock/retryHistory 기록)를 정상 통과한 뒤 PASS로 자연
        // 종료(break)하고 일반 발행 경로로 진행한다. FAILED 아티팩트를 쓰지 않으므로 #627의
        // "FAILED + public 노출 공존 → validate:site 깨짐" 문제는 발생하지 않는다.
      } else {
        writeReviewableRepairFailureArtifacts({
          date,
          newsroomDir,
          error,
          reporter,
          factCheck,
          qualityReport,
          retryHistory,
          shortlistReport,
          attempt,
          stage: repairStage
        });
        // salvage 불가: repair 실패는 그 자체로 종착점이다. writeReviewableRepairFailureArtifacts가
        // 이미 FAILED_REPAIR_REVIEWABLE 리뷰 패키지(public 노출 없음)를 기록했으므로 여기서 return해
        // 발행 가능 경로로 떨어지지 않게 한다. break로 떨어지면 후처리가 품질을 PASS로 다시 계산해
        // newsletters.json 노출을 쓰고, 그 뒤 validate:site retention이 깨지며 terminal FAILED로 리뷰
        // PR이 사라진다. 형제 catch(editor-validate/completion)도 동일하게 return한다.
        return { reviewableReturn: true };
      }
    }
  }

  // #632: 결정론 demote로 줄어든 슬롯을 reserve로 되채워 기사 수를 보존한다(min 미만 보충은
  // 기존 동작 그대로). target = demote 이전 수(단, max 이내, 최소 min). reserve가 없으면 아래
  // 내부 가드(completionCandidates.length > 0)에서 생성하지 않으므로 얇은 날엔 줄어든 채 발행된다.
  const completionTargetCount = completionRefillTargetCount(mainArticleCountBeforeRepair);
  const currentMainArticleCount = ensureArray(editor.sections).length;
  const belowDemoteTarget = demotedSections.length > 0 && currentMainArticleCount < completionTargetCount;
  if (hasTooFewMainArticlesDeduction(qualityReport) || belowDemoteTarget) {
    const missingArticleCount = Math.max(
      articlePolicy.mainArticleCount.min - currentMainArticleCount,
      belowDemoteTarget ? completionTargetCount - currentMainArticleCount : 0
    );
    const completionExcludedSections = appendUniqueSections(
      excludedSections,
      demotedSections.concat(eligibilityFindings.map(finding => finding.section))
    );
    const completionCandidateRejections = [];
    const completionAllowsReserve = completionExcludedSections.length > 0;
    const completionCandidates = availableCompletionCandidates(
      reporter,
      editor.sections,
      completionExcludedSections,
      completionCandidateRejections,
      { allowReserve: completionAllowsReserve }
    );
    if (completionAllowsReserve && completionCandidates.some(isReserveCandidate)) {
      reservePoolOpened = true;
      reserveOpenReason = reserveOpenReason || `completion_missing_${missingArticleCount}_article_after_demote_or_remove`;
    }
    candidateRejections = candidateRejections.concat(completionCandidateRejections);
    if (missingArticleCount > 0 && completionCandidates.length > 0) {
      const completionStage = `editor completion attempt ${attempt}/${totalAttempts}`;
      // completion(target 채우기) 실패 시 되돌릴, 이미 quality gate를 통과한 pre-completion 스냅샷.
      const preCompletionEditor = cloneJson(editor);
      const preCompletionFactCheck = cloneJson(factCheck);
      const preCompletionQualityReport = cloneJson(qualityReport);
      try {
        const completionFactCheckStage = `fact-checker completion attempt ${attempt}/${totalAttempts}`;
        console.warn(`Quality attempt ${attempt}/${totalAttempts} has only ${editor.sections.length} main article(s); requesting ${missingArticleCount} completion article(s).`);
        const beforeCompletionSections = editor.sections;
        const completionSections = validateCompletionSections(await callLlmJson(
          completionStage,
          editorCompletionSystemPrompt({ missingArticleCount }),
        `${commonContext}\n\nCompletion exclusion context JSON:\n${buildCompletionExclusionContext(lockedSections, editor.sections, completionExcludedSections)}\n\nCurrent editor section summaries JSON:\n${JSON.stringify(editor.sections.map((section, index) => sectionSummary(section, index)), null, 2)}\n\nEligible primary/reserve article capsules for additional articles JSON:\n${JSON.stringify(reporterCandidateCapsules(date, completionCandidates, articleCapsuleReport, { seedEvidencePack }), null, 2)}\n\nBackground context JSON:\n${JSON.stringify(backgroundContextReport, null, 2)}\n\nCandidate rejection diagnostics JSON:\n${JSON.stringify(completionCandidateRejections, null, 2)}\n\nCurrent quality deductions JSON:\n${JSON.stringify(ensureArray(qualityReport?.deductions), null, 2)}`,
          editorCompletionSchema
        ), date, reporter);
        const completionMerged = mergeLockedSections(editor.sections, completionSections, completionExcludedSections);
        validateTargetedRepairResult({
          beforeSections: beforeCompletionSections,
          repairSections: completionSections,
          afterSections: completionMerged.sections,
          lockedSections: beforeCompletionSections,
          mode: 'completion',
          allowCountChange: true,
          date,
          reporter,
          baseIssue: editor
        });
        rejectedGeneratedSections = rejectedGeneratedSections.concat(completionMerged.rejected);
        reserveCandidatesUsed = reserveCandidatesUsed.concat(reserveUsageForSections(completionMerged.sections, reporter));
        editor = validateEditor({
          ...editor,
          sections: completionMerged.sections
        }, date, reporter, { strictClaims: true, requireStoryContract: true });
        editor = await validatePublicArticleJudgeOrRepair({
          date,
          editor,
          reporter,
          attempt,
          editorStage: completionStage,
          commonContext,
          lockedContext,
          newsroomDir
        }, publicArticleJudgeDeps);
        attemptedSections = appendUniqueSections(attemptedSections, editor.sections);
        await resolveIssueArticleImages(editor, { root });
        warnResolvedImageFallbacks(editor);
        // #502: 영속화·fact-check 이전에 미해결 evidence_id를 결정론적으로 재바인딩(fail-closed).
        editor = reconcileFactClaimEvidence(editor, { reporter, seedEvidencePack });
        writeJson(path.join(newsroomDir, `editor-completion-attempt-${attempt}.json`), editor);
        fs.writeFileSync(path.join(newsroomDir, `editor-completion-attempt-${attempt}.md`), buildMarkdown(editor), 'utf8');

        factCheck = validateFactCheck(await callLlmJson(
          completionFactCheckStage,
          factCheckCompletionSystemPrompt(),
        `${commonContext}\n\nPrimary selected article capsule JSON:\n${JSON.stringify(selectedReporterCapsules(date, reporter, articleCapsuleReport, { seedEvidencePack }), null, 2)}\n\nReserve article capsule pool JSON:\n${JSON.stringify(reserveReporterCapsules(date, reporter, articleCapsuleReport, { seedEvidencePack }), null, 2)}\n\nBackground context JSON:\n${JSON.stringify(backgroundContextReport, null, 2)}\n\nCompleted editor draft JSON:\n${JSON.stringify(editor, null, 2)}`,
          factCheckSchema
        ));
        eligibilityFindings = reporterEligibilityFindings(editor, reporter, lockedSections, {
          allowReserve: completionAllowsReserve
        });
        factCheck = applyReporterEligibilityFindingsToFactCheck(factCheck, eligibilityFindings);
        factCheck = pruneResolvedFallbackImageFalsePositives(factCheck, editor);
        editor = sanitizeClaimEvidenceIds(editor, reporter, seedEvidencePack);
        editor = stampCoverageType(editor, shortlistReport);
        factCheck = pruneCatchUpFramingFactCheckItems(factCheck, editor);
        generationRunState.factCheck = factCheck;
        writeJson(path.join(newsroomDir, `fact-check-completion-attempt-${attempt}.json`), factCheck);
        fs.writeFileSync(path.join(newsroomDir, `fact-check-completion-attempt-${attempt}.md`), buildFactCheckMarkdown(date, factCheck), 'utf8');

        ({ editor, qualityReport } = runQualityGateAndPersist(editor, factCheck, attempt, 'completion', qualityGateContext));
        repairActions.push(`complete-missing-articles: requested ${missingArticleCount}, added ${Math.max(0, editor.sections.length - (articlePolicy.mainArticleCount.min - missingArticleCount))}`);
        demotedSections = appendUniqueSections(
          demotedSections,
          sourceGapSections(editor, factCheck).concat(eligibilityFindings.map(finding => finding.section))
        );
      } catch (error) {
        // #629 복구: pre-completion이 PASS면 그 스냅샷으로 되돌려 발행을 진행하고(메커니즘은
        // recoverCompletionTopUpFailure 참고), null이면(필수 보충이 실패) FAILED_REPAIR_REVIEWABLE을
        // 기록하고 return해 발행 경로로 떨어지지 않게 한다(repair catch와 같은 구조).
        const completionRecovery = recoverCompletionTopUpFailure({
          error,
          missingArticleCount,
          preCompletionEditor,
          preCompletionFactCheck,
          preCompletionQualityReport,
          completionTargetCount
        });
        if (completionRecovery) {
          editor = completionRecovery.editor;
          factCheck = completionRecovery.factCheck;
          qualityReport = completionRecovery.qualityReport;
          generationRunState.factCheck = factCheck;
          generationRunState.qualityReport = qualityReport;
          completionFallbackToPrepass = true;
          underfilledReason = completionRecovery.underfilledReason;
        } else {
          writeReviewableRepairFailureArtifacts({
            date,
            newsroomDir,
            error,
            reporter,
            factCheck,
            qualityReport,
            retryHistory,
            shortlistReport,
            attempt,
            stage: completionStage
          });
          return { reviewableReturn: true };
        }
      }
    } else {
      underfilledReason = missingArticleCount > 0
        ? `missing ${missingArticleCount} article(s); no eligible non-duplicate primary/reserve completion candidate remains`
        : '';
      console.warn(`Quality attempt ${attempt}/${totalAttempts} has too few main articles, but no eligible non-duplicate completion candidates remain.`);
    }
  }

  return {
    reviewableReturn: false,
    editor,
    factCheck,
    qualityReport,
    attemptedSections,
    eligibilityFindings,
    rejectedGeneratedSections,
    demotedSections,
    repairActions,
    replacedSections,
    failedSections,
    regeneratedSections,
    rejectedRetryOutputs,
    reserveCandidatesUsed,
    reservePoolOpened,
    reserveOpenReason,
    candidateRejections,
    underfilledReason,
    completionFallbackToPrepass,
    repairPlan,
    skippedRepairPlan
  };
}

module.exports = {
  runRepairAndCompletionPasses
};
