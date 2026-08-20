// render/headline 기록 직후, terminal recovery routing 직전에 한 번만 실행되는 결정론적
// 발행 가부 결정 + generation-status 기록 블록(#655).
// generationStatus 분류 → editorial-reviewable 판정 → reviewable이 아니면 공개 산출물
// (newsletter.md/index.html/newsletters.json/weekly)을 기록하고 npm validate를 실제로
// 실행한다(side effect). 그 뒤 finalPublishReady/finalCompositionMode/files를 계산하고
// generation-status.json을 기록한다. early return/fail이 없는 순수 결정·기록 단계라
// main()에서 통째로 떼어 함수로 만들 수 있다(이후 terminal routing의 early return/fail은
// main()에 그대로 둔다).
// main()의 reads(date/editor/factCheck/qualityReport/shortlistReport/retryHistory/
// staleScrub/newsroomDir/newsletterDir/newsletterMarkdown/newsletterHtmlContent/
// mustFixCount/todoFound/emptySourceSections/baseFiles)를 파라미터로 받아, 이후 main()의
// terminal routing에서 실제로 쓰이는 값(editorialReviewable/shouldWritePublicArtifacts/
// failureKind/validateResult/generationStatus/files/generationStatusArtifact)만 반환한다.
// 협력자는 모두 이미 분리된 sibling/shared 모듈에서 직접 import하므로 god-file을 import하지
// 않는다(순환 없음). root는 god-file과 동일하게 process.cwd()로, FAILURE_KIND_EDITORIAL_REVIEWABLE
// 상수는 god-file과 동일한 리터럴로 load 시점에 한 번 파생한다.
const fs = require('fs');
const path = require('path');
const { ensureArray } = require('../../shared/common/value-coercion');
const { writeJson } = require('../../shared/common/common');
const { issueTags } = require('../render/newsletter-renderer');
const { articlePolicy } = require('../../shared/common/newsletter-policy');
const { COMPOSITION_MODES } = require('../select/newsroom-selection');
const {
  classifyGenerationStatus,
  isEditorialReviewableStatus
} = require('./orchestrator-generation-status');
const {
  buildGenerationStatus,
  editorSemanticStatusExtra,
  selectionStatusExtra
} = require('./orchestrator-status-builders');
const { runValidate } = require('./orchestrator-validate-runner');
const {
  updateNewsletterData,
  persistHeadlineStateArtifacts
} = require('./orchestrator-terminal-contracts');
const { buildWeeklyMergeResolver } = require('../editor/weekly-merge');
const {
  editorRenderedGroupKeys,
  editorExplicitlyDemotedGroups,
  editorHardBlockedGroups,
  validateMergedWeeklyArticle
} = require('./orchestrator-report-builders');
const {
  writeWeeklyNewsletterArtifacts
} = require('../render/weekly-newsletter-output');
const { runWeeklyDeepDive } = require('../render/weekly-deep-dive');
const { callLlmJson } = require('./orchestrator-llm-instrumentation');
const { writeGenerationStatus } = require('./orchestrator-artifact-writers');
const {
  writeSelectionDiagnosticsArtifact
} = require('./orchestrator-recovery-writers');

const root = process.cwd();
const FAILURE_KIND_EDITORIAL_REVIEWABLE = 'editorial_reviewable';

async function decidePublishReadinessAndWriteStatus({
  date,
  editor,
  factCheck,
  qualityReport,
  shortlistReport,
  retryHistory,
  staleScrub,
  newsroomDir,
  newsletterDir,
  newsletterMarkdown,
  newsletterHtmlContent,
  mustFixCount,
  todoFound,
  emptySourceSections,
  baseFiles
}) {
  const generationStatus = classifyGenerationStatus({
    underfilled: shortlistReport.underfilled,
    factCheckStatus: factCheck.status,
    mustFixCount,
    qualityStatus: qualityReport.status
  });
  const editorialReviewable = isEditorialReviewableStatus(generationStatus);
  const failureKind = editorialReviewable ? FAILURE_KIND_EDITORIAL_REVIEWABLE : '';
  const newsletterMd = path.join(newsletterDir, 'newsletter.md');
  const newsletterHtml = path.join(newsletterDir, 'index.html');
  const shouldWritePublicArtifacts = !editorialReviewable;
  let weeklyArtifactFiles = [];
  let weeklyFinalArticles = [];
  // #873: 아래 catch는 데일리 발행을 지키려고 실행을 계속시킨다. 그래서 weekly 계약 거부
  // (혼합 stamp를 막는 render 패밀리 검사, 인덱스 계약 버전 판정)가 stderr 한 줄로 사라지고,
  // 커밋되는 산출물에는 weekly가 왜 빠졌는지가 남지 않았다. 결과를 값으로 들고 나가
  // generation-status에 기록한다. 'not_attempted'(reviewable이라 weekly를 아예 안 씀)와
  // 'failed'(쓰려다 거부됨)를 구분해야 "이번 주는 원래 없다"와 "빠졌다"가 갈린다.
  let weeklyOutputStatus = 'not_attempted';
  let weeklyOutputFailureReason = '';
  if (shouldWritePublicArtifacts) {
    fs.writeFileSync(newsletterMd, newsletterMarkdown, 'utf8');
    fs.writeFileSync(newsletterHtml, newsletterHtmlContent, 'utf8');
    updateNewsletterData(date, editor);
    // 추가 weekly 출력(#486~#490): publish-ready일 때만 weekly 디렉터리 페이지/별도 인덱스를 생성하고,
    // 같은 주 안의 중복 기사는 LLM이 append/merge/reject로 결정하며 merge는 검증 통과 시에만 교체한다.
    // 데일리 산출물은 위에서 이미 기록했으므로, weekly 실패가 데일리 실행을 깨지 않도록 try/catch로 감싼다.
    try {
      const weeklyMerge = buildWeeklyMergeResolver({
        callLlmJson,
        // #870: 병합 결과는 이 주 issue.json에 실려 나가고, 그 이슈의 계약 마커는 오늘
        // editor draft의 마커다(weekly issue는 `{...editor}` 위에 만들어진다). 마커를 빼면
        // story 계약 기사가 항상 mismatch로 떨어져 병합 채택 경로가 통째로 닫힌다.
        validateMergedArticle: (mergedArticle, origins) => validateMergedWeeklyArticle(mergedArticle, origins, {
          public_contract_version: editor.public_contract_version,
          generation_contract_version: editor.generation_contract_version
        })
      });
      const weeklyResult = await writeWeeklyNewsletterArtifacts({
        root, date, editor, tags: issueTags(editor), ...weeklyMerge
      });
      weeklyArtifactFiles = weeklyResult.files;
      weeklyFinalArticles = ensureArray(weeklyResult.articles);
      if (ensureArray(weeklyResult.mergeWarnings).length > 0 ||
        ensureArray(weeklyResult.mergeDecisions).some(decision => /merge/.test(decision.decision))) {
        writeJson(path.join(newsroomDir, 'weekly-merge-report.json'), {
          schema_version: 1,
          date,
          weekly_key: weeklyResult.weeklyKey,
          decisions: weeklyResult.mergeDecisions,
          warnings: weeklyResult.mergeWarnings
        });
      }
    } catch (error) {
      weeklyOutputFailureReason = String(error?.message || error || 'Unknown weekly output failure.');
      console.error(`weekly newsletter output skipped: ${weeklyOutputFailureReason}`);
    }
    // 상태는 files와 같은 값에서 파생한다. try 끝에서 따로 마킹하면, weekly 3종과 인덱스를
    // 이미 기록한 뒤 부가 산출물(weekly-merge-report.json) 쓰기가 실패했을 때 catch가
    // 'failed'로 덮어, 같은 PR의 변경 파일 목록에는 weekly 4종이 있는데 상태만 실패로 남는
    // 모순이 생긴다. 파생시키면 "files에 weekly가 있다 == written"이 불변식이 된다.
    weeklyOutputStatus = weeklyArtifactFiles.length > 0 ? 'written' : 'failed';
  }
  const headlineArtifactResult = persistHeadlineStateArtifacts({
    date,
    shortlistReport,
    shouldWritePublicArtifacts,
    editor
  });
  if (headlineArtifactResult.exposureCoverage) {
    shortlistReport.article_exposure_coverage = headlineArtifactResult.exposureCoverage;
    writeJson(path.join(newsroomDir, 'shortlisted-candidates.json'), shortlistReport);
    writeSelectionDiagnosticsArtifact(newsroomDir, shortlistReport);
  }
  const validateResult = editorialReviewable
    ? {
        ok: false,
        text: `${FAILURE_KIND_EDITORIAL_REVIEWABLE}: skipped public validation because this review PR is not publishable.`
      }
    : runValidate();
  const finalPublishReady =
    !editorialReviewable &&
    shortlistReport.publish_ready === true &&
    ensureArray(editor.sections).length >= articlePolicy.mainArticleCount.min &&
    ensureArray(editor.sections).length <= articlePolicy.mainArticleCount.max &&
    generationStatus === 'PASS' &&
    qualityReport.status === 'PASS' &&
    validateResult.ok &&
    !todoFound &&
    emptySourceSections.length === 0 &&
    mustFixCount === 0;
  const finalCompositionMode = finalPublishReady
    ? shortlistReport.composition_mode
    : generationStatus === 'UNDERFILLED_NEEDS_FIX'
      ? COMPOSITION_MODES.THIN_WEEK_REVIEW
      : COMPOSITION_MODES.NEEDS_FIX;
  const finalEditorReviewRequired =
    finalPublishReady === true
      ? false
      : editorialReviewable ||
        shortlistReport.editor_review_required === true ||
        finalCompositionMode !== COMPOSITION_MODES.NORMAL;
  const files = shouldWritePublicArtifacts
    ? baseFiles.concat([
        // changedArtifacts/review-inventory에 쓰이는 디스크-상대 경로(articles/ 아래).
        `articles/newsletters/${date}/newsletter.md`,
        `articles/newsletters/${date}/index.html`,
        'articles/data/newsletters.json',
        ...headlineArtifactResult.files,
        ...weeklyArtifactFiles
      ])
    : baseFiles;
  const generationStatusArtifact = buildGenerationStatus({
    date,
    status: generationStatus,
    retryHistory,
    qualityReport,
    factCheck,
    extra: {
      failure_stage: '',
      failure_reason: '',
      quality_status: qualityReport.status,
      quality_score: qualityReport.score,
      quality_threshold: qualityReport.threshold,
      quality_deduction_count: ensureArray(qualityReport.deductions).length,
      locked_article_count: retryHistory.at(-1)?.locked_article_headlines.length || 0,
      repaired_section_count: retryHistory.reduce((sum, item) => sum + ensureArray(item.regenerated_sections).length, 0),
      failed_section_count: retryHistory.at(-1)?.failed_sections.length || 0,
      skipped_repair_section_count: retryHistory.reduce((sum, item) => sum + ensureArray(item.skipped_repair_sections).length, 0),
      rejected_duplicate_article_count: retryHistory.reduce((sum, item) => sum + item.rejected_duplicate_headlines.length, 0),
      validate_ok: validateResult.ok,
      failure_kind: failureKind,
      public_output_expected: shouldWritePublicArtifacts,
      // #873: weekly 기록 결과와 거부 사유. 관측용 값이라 발행 게이트 판정
      // (finalPublishReady/failureKind/files)에는 들어가지 않는다.
      weekly_output_status: weeklyOutputStatus,
      weekly_output_failure_reason: weeklyOutputFailureReason,
      todo_found: todoFound,
      empty_source_sections: emptySourceSections,
      source_gap_count: factCheck.source_gap_count,
      stale_claim_status: staleScrub.report?.status || 'UNKNOWN',
      stale_claim_removed_count: ensureArray(staleScrub.report?.stale_claim_items_removed).length +
        ensureArray(staleScrub.report?.unsupported_release_claims_removed).length +
        ensureArray(staleScrub.report?.unused_references_removed).length,
      stale_claim_hard_failure_count: ensureArray(staleScrub.report?.hard_failures).length,
      completion_fallback_to_prepass: retryHistory.some(item => item.completion_fallback_to_prepass === true),
      ...editorSemanticStatusExtra(),
      ...selectionStatusExtra(shortlistReport, {
        renderedMainArticleCount: ensureArray(editor.sections).length,
        renderedGroupKeys: editorRenderedGroupKeys(editor),
        explicitlyDemotedGroups: editorExplicitlyDemotedGroups(editor),
        hardBlockedGroups: editorHardBlockedGroups(editor),
        lockedArticleCount: retryHistory.at(-1)?.locked_article_headlines.length || 0,
        demotedArticleCount: retryHistory.at(-1)?.demoted_article_count ?? retryHistory.at(-1)?.demoted_sections?.length ?? 0,
        finalPublishReady,
        publishGatePassed: finalPublishReady,
        compositionMode: finalCompositionMode,
        editorReviewRequired: finalEditorReviewRequired
      })
    }
  });
  writeGenerationStatus(generationStatusArtifact);
  // 심층(deep-dive)은 선택 부가 기능이라 이 함수가 할 일을 **전부 마친 뒤** 마지막에 실행한다.
  // 앞쪽에서 부르면 여기서 나는 throw 하나가 그 주의 headline state·validate·generation-status
  // 기록까지 통째로 건너뛰게 하고, weekly writer 안이나 그 catch 안에서 부르면 위클리 공개 3종이
  // 아예 기록되지 않거나 실패가 console 한 줄로 사라진다.
  // throw가 나면 호출 위치와 무관하게 워크플로의 이미지 바인딩 스텝은 함께 skip된다(그 스텝이
  // generate 성공을 조건으로 걸기 때문). 이것은 불변식 3(구현 오류는 시끄럽게 실패)의 대가다.
  // 예상 콘텐츠 실패(미발동·큐 빔)는 값으로 돌아온다. 구현 오류(큐 JSON 손상 등)만 throw하며,
  // 그 throw는 여기서 그대로 전파된다 — 조용한 skip으로 위장하지 않는다(불변식 3).
  if (weeklyArtifactFiles.length > 0) {
    runWeeklyDeepDive({ root, date, articles: weeklyFinalArticles });
  }
  return {
    editorialReviewable,
    shouldWritePublicArtifacts,
    failureKind,
    validateResult,
    generationStatus,
    files,
    generationStatusArtifact
  };
}

module.exports = {
  decidePublishReadinessAndWriteStatus
};
