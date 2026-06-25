// attempt loop 안의 editor 단계 블록(#655).
// main()의 for-attempt 루프에서 editor draft를 생성(callLlmJson)하고, 검증/repair한 뒤
// (validateOrRepairEditor + assertEditorRetryOutputContract) editor 확정 직후의 결정론적
// 후처리(locked section 병합, 이미지 해소, evidence 재바인딩, last-known-valid 기록,
// canonical review 산출물·editor-draft-attempt 기록)까지를 fact-check 단계 직전에서 끊어
// 떼어낸다. 이 블록은 main() 안에서 유일하게 reviewable repair-failure 경로로 early return
// 하던 지점을 포함하므로, plain 함수로는 그 return을 재현할 수 없다. 그래서 정상 경로는
// { reviewableReturn: false, editor, attemptedSections, rejectedGeneratedSections }를,
// reviewable 경로는 { reviewableReturn: true }를 돌려준다. 호출처(main)는 그 플래그로
// `if (reviewableReturn) return;`를 실행해 원래 early `return;`과 동일하게 main()을 끝낸다.
// 협력자는 모두 이미 분리된 sibling/shared 모듈에서 직접 import하므로 god-file을 import하지
// 않는다(순환 없음). generationRunState는 god-file과 동일한 run-state 모듈을 공유한다.
const fs = require('fs');
const path = require('path');
const { writeJson } = require('../../shared/common/common');
const { editorSchema } = require('../render/newsletter-schema');
const { resolveIssueArticleImages } = require('../render/article-image-resolver');
const {
  EditorSemanticValidationError,
  reconcileFactClaimEvidence
} = require('../editor/editor-output-contract');
const {
  buildMarkdown,
  ensureArray
} = require('../render/newsletter-renderer');
const { selectedReporterCapsules } = require('./orchestrator-reporter-normalize');
const { callLlmJson } = require('./orchestrator-llm-instrumentation');
const {
  validateOrRepairEditor,
  recordLastKnownValidEditor,
  currentPublishMode
} = require('./orchestrator-editor-validation');
const {
  writeReviewableRepairFailureArtifacts
} = require('./orchestrator-repair-failure-artifacts');
const {
  assertEditorRetryOutputContract
} = require('./orchestrator-editor-retry-contract');
const { editorSystemPrompt } = require('./orchestrator-stage-prompts');
const {
  mergeLockedSections,
  appendUniqueSections
} = require('./orchestrator-section-locking');
const { warnResolvedImageFallbacks } = require('./orchestrator-image-warnings');
const { writeCanonicalReviewArtifacts } = require('./orchestrator-artifact-writers');
const { generationRunState } = require('./orchestrator-run-state');
const { editorFacingEditorialPlan } = require('./orchestrator-editorial-plan-stage');

async function runEditorStage({
  date,
  reporter,
  attempt,
  editorStage,
  editorRetryContract,
  publishMode,
  commonContext,
  lockedContext,
  lockedSections,
  excludedSections,
  newsroomDir,
  articleCapsuleReport,
  backgroundContextReport,
  editorialPlanReport,
  shortlistReport,
  seedEvidencePack,
  editor,
  attemptedSections,
  factCheck,
  qualityReport,
  retryHistory,
  root
}) {
  const editorDraft = await callLlmJson(
    editorStage,
    editorSystemPrompt({ editorRetryContract, publishMode, hasLockedSections: lockedSections.length > 0, hasCatchUpCoverage: ensureArray(shortlistReport?.selected_articles).some(item => item.coverage_type === 'catch_up') }),
    [
      commonContext,
      lockedContext,
      editorRetryContract ? `Editor retry output contract JSON:\n${JSON.stringify(editorRetryContract, null, 2)}` : '',
      `Primary selected article capsule JSON:\n${JSON.stringify(selectedReporterCapsules(date, reporter, articleCapsuleReport, { seedEvidencePack }), null, 2)}`,
      `Background context JSON:\n${JSON.stringify(backgroundContextReport, null, 2)}`,
      // #700: editorial plan은 필수 단계라 여기 도달하면 항상 존재한다. coverage 권한 신호
      // (coverage_decision/impact_level)는 editorFacingEditorialPlan이 빼므로 editor가 선택된 기사를
      // demote/병합하도록 유도하지 않는다(어떤 기사를 main으로 낼지는 selection이 결정).
      `Internal editorial plan JSON (작성 안내용 내부 자료입니다. 어떤 기사를 main article로 낼지는 selection이 이미 정했으니 선택된 기사를 모두 작성하고, 각 기사의 target_description/editorial_angle/why_it_matters/reader_takeaway/misunderstanding_risks/source_limitations를 자연스러운 한국어 prose로 반영하세요):\n${JSON.stringify(editorFacingEditorialPlan(editorialPlanReport), null, 2)}`
    ].filter(Boolean).join('\n\n'),
    editorSchema
  );
  try {
    editor = await validateOrRepairEditor(editorDraft, {
      date,
      reporter,
      attempt,
      editorStage,
      commonContext,
      lockedContext,
      newsroomDir,
      articleCapsuleReport,
      seedEvidencePack,
      publishMode: currentPublishMode()
    });
    assertEditorRetryOutputContract(editor, editorRetryContract, reporter);
  } catch (error) {
    if (error instanceof EditorSemanticValidationError && generationRunState.lastKnownValidEditor) {
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
        stage: editorStage
      });
      return { reviewableReturn: true };
    }
    throw error;
  }
  attemptedSections = appendUniqueSections(attemptedSections, editor.sections);

  const merged = mergeLockedSections(lockedSections, editor.sections, excludedSections);
  let rejectedGeneratedSections = [...merged.rejected];
  editor.sections = merged.sections;
  attemptedSections = appendUniqueSections(attemptedSections, editor.sections);
  await resolveIssueArticleImages(editor, { root });
  warnResolvedImageFallbacks(editor);
  // #502: editor draft 확정 직후, fact-check/quality/render 이전에 미해결 evidence_id를 한 번
  // 결정론적으로 재바인딩한다(strict 오라클 통과 시에만; 미지원이면 unbound 유지). 이렇게 해야
  // fact-check / quality 점수 / render 산출물 / publish 판정이 동일한 reconciled draft를 본다.
  editor = reconcileFactClaimEvidence(editor, { reporter, seedEvidencePack });
  editor = recordLastKnownValidEditor(editor, { date, reporter, attempt, requireStoryContract: true, seedEvidencePack });
  writeCanonicalReviewArtifacts({ date, newsroomDir, reporter, editor });
  writeJson(path.join(newsroomDir, `editor-draft-attempt-${attempt}.json`), editor);
  fs.writeFileSync(path.join(newsroomDir, `editor-draft-attempt-${attempt}.md`), buildMarkdown(editor), 'utf8');

  return { reviewableReturn: false, editor, attemptedSections, rejectedGeneratedSections };
}

module.exports = {
  runEditorStage
};
