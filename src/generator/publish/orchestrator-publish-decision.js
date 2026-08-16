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
      console.error(`weekly newsletter output skipped: ${error.message}`);
    }
    // 심층(deep-dive)은 선택 부가 기능이라, 그 주의 공개 산출물이 디스크에 기록되고
    // weeklyArtifactFiles에 등록된 **뒤에** 실행한다. 위 try 안에서 부르면(또는 weekly writer
    // 안에서 부르면) 실패가 위 catch에 삼켜져 console 한 줄로 사라지거나, 위클리 공개 3종이
    // 통째로 기록되지 않는 주가 생긴다.
    // 예상 콘텐츠 실패(미발동·큐 빔)는 여기서도 값으로 돌아온다. 구현 오류(큐 JSON 손상 등)만
    // throw하고, 그 throw는 위 catch 바깥이라 그대로 전파된다 — 조용한 skip으로 위장하지
    // 않는다(불변식 3).
    if (weeklyArtifactFiles.length > 0) {
      runWeeklyDeepDive({ root, date, articles: weeklyFinalArticles });
    }
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
