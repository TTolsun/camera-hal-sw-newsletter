// attempt loop 종료 후 한 번만 실행되는 결정론적 finalize 블록(#655).
// runtime-demoted candidate를 shortlist에 반영하고, stale-claim scrub과 그 결과를
// editor/factCheck/qualityReport에 적용한 뒤 stale-claim-report 산출물을 기록하고,
// 마지막으로 thin-week salvage(통과한 subset만 발행)를 적용한다. early return/fail이
// 없는 순수 상태 전이라 main()에서 통째로 떼어 plain 함수로 만들 수 있다.
// main()의 loop local을 reads(파라미터)로 받아 writes(reassign된 editor/factCheck/
// qualityReport/shortlistReport)와 이후 main()에서 쓰이는 staleScrub을 반환한다.
// 협력자는 모두 이미 분리된 sibling/shared 모듈에서 직접 import하므로 god-file을
// import하지 않는다(순환 없음). generationRunState 진행상황 갱신은 god-file과 동일한
// run-state 모듈을 공유해 그대로 유지한다.
const fs = require('fs');
const path = require('path');
const { ensureArray } = require('../../shared/common/value-coercion');
const { writeJson } = require('../../shared/common/common');
const { sectionsAreDuplicate } = require('../../shared/common/section-identity');
const { normalizeShortlistReport } = require('../select/selection-diagnostics');
const {
  buildStaleClaimReportMarkdown,
  pruneResolvedStaleFactCheckItems,
  scrubStaleClaims
} = require('../quality/stale-claims');
const { qualityGatePolicy } = require('../../shared/common/newsletter-policy');
const {
  pruneCatchUpFramingFactCheckItems,
  sanitizeClaimEvidenceIds,
  stampCoverageType
} = require('./fact-check-postprocess');
const {
  buildNewsletterQualityReport,
  salvagePublishableSubset
} = require('../quality/newsletter-quality');
const { validateEditor } = require('./orchestrator-editor-validation');
const { pruneResolvedFallbackImageFalsePositives } = require('./orchestrator-image-warnings');
const {
  candidatesForSections,
  appendUniqueSections
} = require('./orchestrator-section-locking');
const { generationRunState } = require('./orchestrator-run-state');
const { writeSelectionDiagnosticsArtifact } = require('./orchestrator-recovery-writers');

function finalizeDraftAfterAttempts({
  date,
  editor,
  factCheck,
  qualityReport,
  reporter,
  shortlistReport,
  newsroomDir,
  seedEvidencePack,
  excludedSections,
  attemptedSections
}) {
  const runtimeDemotedCandidates = candidatesForSections(excludedSections, reporter);
  if (runtimeDemotedCandidates.length > 0) {
    // #837: normalizeShortlistReport는 selected_articles를 primary_selected_articles
    // (결정론 앵커)에서 다시 투영한다(selection-diagnostics.js:148-152). 그 재투영은
    // attempt 시작 지점에서 재조정 결과를 초기화하려고 의도된 것이고, attempt loop가
    // 끝난 여기서는 재조정된 main 집합을 결정론 집합으로 되감아 버린다. 그러면 배열은
    // 되감긴 5건인데 카운트는 재조정된 4건이라는 자기모순이 생긴다. 앵커는 그대로 두고
    // 현재 main 집합만 보존한다.
    const reconciledSelectedArticles = ensureArray(shortlistReport.selected_articles);
    shortlistReport = normalizeShortlistReport({
      ...shortlistReport,
      demoted_candidates: runtimeDemotedCandidates,
      demoted_candidate_count: runtimeDemotedCandidates.length
    }, reporter);
    shortlistReport.selected_articles = reconciledSelectedArticles;
    generationRunState.shortlistReport = shortlistReport;
    writeJson(path.join(newsroomDir, 'shortlisted-candidates.json'), shortlistReport);
    writeSelectionDiagnosticsArtifact(newsroomDir, shortlistReport);
  }

  const removedSections = appendUniqueSections(
    attemptedSections.filter(section => !ensureArray(editor.sections).some(finalSection => sectionsAreDuplicate(section, finalSection))),
    excludedSections
  );
  const staleScrub = scrubStaleClaims(editor, {
    date,
    removedSections,
    reporter
  });
  editor = validateEditor(staleScrub.editor, date, reporter, { strictClaims: true, requireStoryContract: true });
  factCheck = pruneResolvedStaleFactCheckItems(factCheck, staleScrub.report);
  factCheck = pruneResolvedFallbackImageFalsePositives(factCheck, editor);
  generationRunState.factCheck = factCheck;
  writeJson(path.join(newsroomDir, 'stale-claim-report.json'), staleScrub.report);
  fs.writeFileSync(
    path.join(newsroomDir, 'stale-claim-report.md'),
    buildStaleClaimReportMarkdown(staleScrub.report),
    'utf8'
  );
  editor = sanitizeClaimEvidenceIds(editor, reporter, seedEvidencePack);
  editor = stampCoverageType(editor, shortlistReport);
  factCheck = pruneCatchUpFramingFactCheckItems(factCheck, editor);
  generationRunState.factCheck = factCheck;
  qualityReport = buildNewsletterQualityReport(date, editor, reporter, factCheck, {
    threshold: qualityGatePolicy.threshold,
    shortlistReport,
    staleClaimReport: staleScrub.report,
    strictClaimValidation: true,
    seedEvidencePack
  });
  generationRunState.qualityReport = qualityReport;

  // Per-article 발행 회복력(thin-week salvage). 전체 draft가 일부 기사의
  // per-article binding 실패(예: 한 소스의 claim-binding 분산) 때문에만 NEEDS_FIX이고,
  // mainArticleCount.min 이상의 기사가 깨끗이 통과하면, 전체를 실패시키지 않고
  // 통과한 subset만 발행한다. salvagePublishableSubset은 subset에 quality gate를
  // 다시 적용해 PASS일 때만 결과를 반환(아니면 null)하므로, bound 안 된 콘텐츠를
  // 발행하지 않고 이번 실행에서 바인딩 실패한 기사만 drop한다. attempt loop 종료
  // 후(맨 끝)에 연결해 retry/lock 제어 흐름에 영향을 주지 않는다.
  if (qualityReport.status !== 'PASS') {
    const salvage = salvagePublishableSubset(date, editor, reporter, factCheck, qualityReport, {
      threshold: qualityGatePolicy.threshold,
      shortlistReport,
      staleClaimReport: staleScrub.report,
      strictClaimValidation: true,
      seedEvidencePack
    });
    if (salvage) {
      console.warn(`Thin-week salvage: dropped ${salvage.dropped_section_count} unpublishable article(s); publishing ${salvage.kept_section_count}.`);
      editor = validateEditor(salvage.editor, date, reporter, { strictClaims: true, requireStoryContract: true });
      factCheck = salvage.factCheck;
      qualityReport = salvage.qualityReport;
      generationRunState.factCheck = factCheck;
      generationRunState.qualityReport = qualityReport;
    }
  }

  return { editor, factCheck, qualityReport, shortlistReport, staleScrub };
}

module.exports = {
  finalizeDraftAfterAttempts
};
