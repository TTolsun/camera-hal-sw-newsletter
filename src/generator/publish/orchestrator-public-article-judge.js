// 발행 orchestrator의 editor public-article judge / semantic repair 비동기 흐름.
// editor draft를 public-article judge(LLM)로 검사하고, 차단 이슈가 있으면 semantic repair(LLM)
// 후 다시 judge한다. attempt/repair/completion 경로의 editor 검증 어댑터와 main()이 호출한다.
// LLM 계측 래퍼 callLlmJson, generationRunState 기록기 recordEditorSemanticStatus, editor 검증기
// validateEditor는 orchestrator god-file에 정의된 run-state 결합 함수라 deps로 주입받는다.
// 나머지 협력자(prompt/schema/judge helper/editor contract/capsule)는 직접 import한다.
const path = require('path');
const { ensureArray } = require('../../shared/common/value-coercion');
const { editorSchema, publicArticleJudgeSchema } = require('../render/newsletter-schema');
const {
  assertSectionsAndSourcesPreserved,
  EditorSemanticValidationError,
  serializeEditorValidationError
} = require('../editor/editor-output-contract');
const { claimRepairEvidencePrompt, publicArticleJudgePrompt } = require('../reporter/newsletter-prompts');
const { writeJson } = require('../../shared/common/common');
const { cloneJson } = require('./orchestrator-shared-helpers');
const {
  publicArticleJudgeInput,
  normalizePublicArticleJudgeReport,
  publicArticleJudgeBlockingIssues,
  deskAdvisoryIssues,
  publicArticleJudgeError,
  judgeRepairError,
  publicArticleJudgeArtifactScope
} = require('./orchestrator-judge-helpers');
const { selectedReporterCapsules } = require('./orchestrator-reporter-normalize');
const { DERIVED_STAGE_KINDS, derivedStageRun } = require('../../shared/llm/stage-catalog');

async function repairEditorSemanticWithLlm({
  date,
  editorStage,
  commonContext,
  lockedContext,
  reporter,
  articleCapsuleReport,
  seedEvidencePack = null,
  invalidEditor,
  validationError
}, { callLlmJson }) {
  const beforeSectionCount = ensureArray(invalidEditor?.sections).length;
  return callLlmJson(
    derivedStageRun(editorStage, DERIVED_STAGE_KINDS.SEMANTIC_REPAIR),
    [
      'AOSP Camera / Driver / SoC Platform Newsletter editor JSON draft를 repair하세요.',
      '같은 schema와 일치하는 complete editor JSON object 하나를 반환하세요.',
      'Editor semantic validation error JSON에 표시된 validation error만 수정하세요.',
      'Validation repair에 필요한 local edit가 아니면 한국어 reader-facing prose를 보존하세요. 새로 쓰는 reader-facing text는 반드시 한국어여야 합니다.',
      `현재 editor draft는 정확히 ${beforeSectionCount}개의 main sections를 가집니다. Repaired output도 동일한 sections 수를 같은 순서로 유지하세요.`,
      'Section을 추가, 제거, 합치기, 분할, 재정렬, 교체하지 마세요. Validation error가 명시한 field만 in-place로 수정하세요.',
      'Validation error가 명시적으로 해당 field를 가리키지 않으면 article headline, category, source URL, image field, action_items, references를 변경하지 마세요.',
      claimRepairEvidencePrompt(),
      'sections.group_coverage failure는 missing selected representative group을 selected capsule만 사용해 article로 복구하세요. 해당 group을 render할 수 없으면 article_group_key, reason_code, reason text를 포함해 explicitly_demoted_groups[] 또는 hard_blocked_groups[]에 기록하세요.',
      'sections.blocked_context failure는 article sources와 headline에서 blocked context URL/title을 제거하세요. Blocked context는 diagnostic context로만 남길 수 있습니다.',
      'sections.hal_signal_capsule failure는 validation error가 가리킨 각 section에 why_now, reader_owners, check_within_2_weeks, impact_axes, do_not_overstate key를 모두 가진 hal_signal_capsule을 채우세요. 제공된 capsule metadata와 해당 article evidence 범위 안에서 다섯 key를 전부 빈 값 없이 작성하고, 다른 field는 바꾸지 마세요.',
      'sections.claims failure는 source-backed article_sections.verified_facts[]의 각 항목마다 matching claim_type=fact claim이 있도록 claims를 추가하거나 조정하세요. (confirmed_facts / evidence_summary는 claim 바인딩 대상이 아닙니다.)',
      'validation error JSON의 details.issues[].uncovered_facts[](article_index/field/text)와 deterministic_repair_failure_reason_codes를 먼저 읽고, 그 verified_fact에만 정확히 대응하는 claim_type=fact claim을 추가하세요. 목록에 없는 fact나 section은 건드리지 말고, 새 fact·evidence_id·source URL은 만들지 마세요.',
      'Claim repair에는 허용된 claim_type과 impact_level 값만 사용하세요. 직접 HAL contract를 뒷받침하는 근거가 없으면 CameraX/adaptive UI impact는 app_api_or_framework_adjacent로 매핑하세요.',
      'briefing failure는 briefing을 정확히 3개 item으로 고치고 draft의 나머지는 보존하세요.',
      'desk_target_explanation / desk_layer_distinction / desk_source_limitations / desk_subject_attribution issue가 있으면, 해당 section의 한국어 prose를 source와 reporter_evidence 범위 안에서 수정하세요: 대상 기술을 설명하고, 레이어(HAL/framework/kernel/V4L2/sensor/ISP/toolchain/trend)를 구분하고, source 한계를 보존하고, 주체(제조사/작성자/vendor/board/device) 혼동을 바로잡으세요. section 수·순서·headline·source·claims는 바꾸지 마세요.',
      'Source fact 또는 source material을 만들지 마세요. 근거에 없는 대상 설명이나 한계를 지어내지 말고, 그런 경우 prose를 과장 없이 두세요.',
      'Schema-compliant JSON만 반환하세요.'
    ].join('\n'),
    [
      commonContext,
      lockedContext,
      `Primary selected article capsule JSON:\n${JSON.stringify(selectedReporterCapsules(date, reporter || { candidates: [] }, articleCapsuleReport, { seedEvidencePack }), null, 2)}`,
      `Editor semantic validation error JSON:\n${JSON.stringify(validationError, null, 2)}`,
      `Invalid editor draft JSON:\n${JSON.stringify(invalidEditor, null, 2)}`
    ].filter(Boolean).join('\n\n'),
    editorSchema
  );
}

function writePublicArticleJudgeArtifact(newsroomDir, attempt, phase, report, error = null, stage = null) {
  if (!newsroomDir) return;
  // 파일명 scope는 label 철자가 아니라 stage id로 정한다(#981).
  const scope = publicArticleJudgeArtifactScope(stage && stage.definition ? stage.definition.id : '');
  const baseSuffix = phase === 'repair' ? `repair-attempt-${attempt}` : `attempt-${attempt}`;
  const suffix = scope === 'editor' ? baseSuffix : `${scope}-${baseSuffix}`;
  writeJson(path.join(newsroomDir, `editor-public-article-judge-${suffix}.json`), report);
  if (error) {
    writeJson(path.join(newsroomDir, `editor-public-article-judge-error-${suffix}.json`), serializeEditorValidationError(error, {
      stage: error.stage || '',
      attempt
    }));
  }
}

async function runPublicArticleJudge({ date, editor, reporter, stage, attempt, newsroomDir, phase = 'attempt' }, { callLlmJson, recordEditorSemanticStatus }) {
  const rawReport = await callLlmJson(
    stage,
    publicArticleJudgePrompt(),
    `Public article judge input JSON:\n${JSON.stringify(publicArticleJudgeInput(date, editor, reporter), null, 2)}`,
    publicArticleJudgeSchema
  );
  const report = normalizePublicArticleJudgeReport(rawReport, editor, date);
  const blockingIssues = publicArticleJudgeBlockingIssues(report);
  const deskAdvisory = deskAdvisoryIssues(report);
  if (blockingIssues.length === 0) {
    writePublicArticleJudgeArtifact(newsroomDir, attempt, phase, report, null, stage);
    recordEditorSemanticStatus({ editor_public_article_judge: report });
    return { ok: true, report, deskAdvisory };
  }
  const error = publicArticleJudgeError(report, stage.label, attempt, phase);
  writePublicArticleJudgeArtifact(newsroomDir, attempt, phase, report, error, stage);
  return { ok: false, report, error, deskAdvisory };
}

async function validatePublicArticleJudgeOrRepair({
  date,
  editor,
  reporter,
  attempt,
  editorStage,
  commonContext,
  lockedContext,
  newsroomDir
}, deps) {
  const { recordEditorSemanticStatus, validateEditor } = deps;
  const judgeStage = derivedStageRun(editorStage, DERIVED_STAGE_KINDS.PUBLIC_ARTICLE_JUDGE);
  const judgeRepairStage = derivedStageRun(editorStage, DERIVED_STAGE_KINDS.PUBLIC_ARTICLE_JUDGE_REPAIR);
  const initialJudge = await runPublicArticleJudge({
    date,
    editor,
    reporter,
    stage: judgeStage,
    attempt,
    newsroomDir,
    phase: 'attempt'
  }, deps);
  const initialDeskAdvisory = ensureArray(initialJudge.deskAdvisory);

  // 차단도 desk advisory(#725)도 없으면 그대로 통과한다.
  if (initialJudge.ok && initialDeskAdvisory.length === 0) return editor;

  // 차단 없이 desk advisory만으로 repair에 들어온 경우(desk-only). 이때는 repair가 실패해도
  // 편집 품질 때문에 발행을 막지 않는다(desk 축은 advisory).
  const deskOnly = initialJudge.ok;

  // repair에는 차단 issue와 desk advisory issue를 함께 넘긴다.
  const initialDetails = serializeEditorValidationError(
    judgeRepairError(initialJudge.report, judgeStage.label, attempt),
    {
      stage: judgeStage.label,
      attempt,
      repairAttempted: false,
      repairSucceeded: false
    }
  );
  let repairedRaw;
  try {
    repairedRaw = await repairEditorSemanticWithLlm({
      date,
      editorStage,
      commonContext,
      lockedContext,
      invalidEditor: cloneJson(editor),
      validationError: initialDetails
    }, deps);
    const repairedEditor = validateEditor(repairedRaw, date, reporter, {
      strictClaims: true,
      requireStoryContract: true
    });
    assertSectionsAndSourcesPreserved(editor, repairedRaw);
    const repairedJudge = await runPublicArticleJudge({
      date,
      editor: repairedEditor,
      reporter,
      stage: judgeRepairStage,
      attempt,
      newsroomDir,
      phase: 'repair'
    }, deps);
    const residualDeskAdvisory = ensureArray(repairedJudge.deskAdvisory);
    if (repairedJudge.ok) {
      recordEditorSemanticStatus({
        editor_semantic_validation: initialDetails,
        editor_public_article_judge: repairedJudge.report,
        ...(residualDeskAdvisory.length > 0 ? { editor_desk_advisory: residualDeskAdvisory } : {}),
        repairAttempted: true,
        repairSucceeded: true
      });
      return repairedEditor;
    }
    throw repairedJudge.error;
  } catch (repairError) {
    // desk-only 트리거에서 repair가 실패하면 발행을 막지 않고 원본 editor를 반환한다(#725).
    if (deskOnly) {
      recordEditorSemanticStatus({
        editor_public_article_judge: initialJudge.report,
        editor_desk_advisory: initialDeskAdvisory,
        repairAttempted: true,
        repairSucceeded: false
      });
      return editor;
    }
    const semanticRepairError = repairError instanceof EditorSemanticValidationError
      ? repairError
      : new EditorSemanticValidationError(`Public article judge repair failed: ${repairError.message}`, {
        field: 'sections.public_article',
        cause: repairError.message,
        sectionCount: Array.isArray(repairedRaw?.sections) ? repairedRaw.sections.length : null,
        initial: initialDetails
      });
    const repairDetails = {
      ...serializeEditorValidationError(semanticRepairError),
      stage: judgeRepairStage.label,
      attempt,
      initial: initialDetails
    };
    recordEditorSemanticStatus({
      editor_semantic_validation: repairDetails,
      editor_public_article_judge: semanticRepairError.editorPublicArticleJudge || initialJudge.report,
      repairAttempted: true,
      repairSucceeded: false
    });
    semanticRepairError.editorSemanticValidation = repairDetails;
    semanticRepairError.editorPublicArticleJudge = semanticRepairError.editorPublicArticleJudge || initialJudge.report;
    semanticRepairError.repairAttempted = true;
    semanticRepairError.repairSucceeded = false;
    throw semanticRepairError;
  }
}

module.exports = {
  repairEditorSemanticWithLlm,
  validatePublicArticleJudgeOrRepair
};
