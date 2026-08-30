// 발행 orchestrator의 품질 게이트 실행 단위.
// attempt/repair/completion 세 경로가 같은 시퀀스(품질 게이트 빌드 → generationRunState 반영
// → last-known-valid editor 기록 → 표준/시도별 리뷰 아티팩트 영속화 → stageTracker 갱신)를
// 반복하던 것을 한 함수로 통합한다. attemptType별로 파일명 infix만 달라진다.
const fs = require('fs');
const path = require('path');
const {
  buildNewsletterQualityReport,
  buildQualityReportMarkdown
} = require('../quality/newsletter-quality');
const { writeJson } = require('../../shared/common/common');
const { writeCanonicalReviewArtifacts } = require('./orchestrator-artifact-writers');
const { generationRunState } = require('./orchestrator-run-state');

const QUALITY_REPORT_FILENAME_INFIX = { attempt: '', repair: 'repair-', completion: 'completion-' };

// 한 attempt 안에서 게이트가 세 번 돈다(attempt -> repair -> completion). 세 번을 한 행에
// 기록하면 나중 결과가 앞 결과를 덮어 실패가 사라진다. stage id를 단계별로 갈라 행을
// 분리한다 -- 다이어그램이 묶어 읽는 role은 셋 다 quality_gate로 같다.
const QUALITY_GATE_STAGE_ID = {
  attempt: 'quality_gate',
  repair: 'quality_gate.repair',
  completion: 'quality_gate.completion'
};

// 시그니처는 추출 전 main() 내부 closure와 동일한 (currentEditor, currentFactCheck, attempt,
// attemptType)에 context 한 개를 더한 형태다. context는 한 attempt 안에서 변하지 않는
// 입력/협력자(date·reporter·shortlistReport·seedEvidencePack·newsroomDir·qualityThreshold·
// recordLastKnownValidEditor)를 묶는다. recordLastKnownValidEditor는 orchestrator god-file에
// 정의된 editor 검증 체인 함수라 순환을 피하려고 주입받고, 나머지 협력자(quality 빌드/렌더,
// 아티팩트 writer, run state)는 모듈에서 직접 가져온다. 동작은 추출 전과 동일하다.
function runQualityGateAndPersist(currentEditor, currentFactCheck, attempt, attemptType, context) {
  const {
    date,
    reporter,
    shortlistReport,
    seedEvidencePack,
    newsroomDir,
    qualityThreshold,
    recordLastKnownValidEditor
  } = context;
  const infix = QUALITY_REPORT_FILENAME_INFIX[attemptType] || '';
  const qualityGateStageId = QUALITY_GATE_STAGE_ID[attemptType] || QUALITY_GATE_STAGE_ID.attempt;
  const qualityReport = buildNewsletterQualityReport(date, currentEditor, reporter, currentFactCheck, {
    threshold: qualityThreshold,
    shortlistReport,
    strictClaimValidation: true,
    seedEvidencePack
  });
  generationRunState.qualityReport = qualityReport;
  const persistedEditor = recordLastKnownValidEditor(currentEditor, {
    date,
    reporter,
    factCheck: currentFactCheck,
    qualityReport,
    attempt,
    requireStoryContract: true,
    seedEvidencePack
  });
  writeCanonicalReviewArtifacts({ date, newsroomDir, reporter, editor: persistedEditor, factCheck: currentFactCheck, qualityReport });
  writeJson(path.join(newsroomDir, `quality-report-${infix}attempt-${attempt}.json`), qualityReport);
  fs.writeFileSync(path.join(newsroomDir, `quality-report-${infix}attempt-${attempt}.md`), buildQualityReportMarkdown(qualityReport), 'utf8');
  if (qualityReport && qualityReport.status === 'PASS') {
    generationRunState.stageTracker.pass({ stageId: qualityGateStageId, role: 'quality_gate', attempt });
  } else {
    generationRunState.stageTracker.fail({
      stageId: qualityGateStageId,
      role: 'quality_gate',
      attempt,
      reason: qualityReport && qualityReport.status
    });
  }
  return { editor: persistedEditor, qualityReport };
}

module.exports = { runQualityGateAndPersist };
