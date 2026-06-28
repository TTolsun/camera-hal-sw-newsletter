// 발행 orchestrator의 단일 실행 상태(run state) 싱글톤.
// reporter/editor/fact-check/quality 시도 전반에서 마지막으로 유효했던 산출물,
// 재시도 이력, 단계 추적기(stageTracker)를 공유하기 위한 가변 상태다.
// CommonJS 모듈 캐시 덕분에 이 모듈을 require하는 모든 곳이 같은 인스턴스를 본다.
// god-file에서 분리해 두면 generationRunState에 결합된 orchestration 로직을
// 같은 디렉터리의 sibling 모듈로 점진적으로 추출할 수 있다(#655).
const { createStageStatusTracker } = require('../select/stage-status-tracker');

const generationRunState = {
  date: '',
  retryHistory: [],
  currentQualityAttempt: 0,
  qualityReport: null,
  factCheck: null,
  shortlistReport: null,
  selectedInputs: [],
  lastKnownValidEditor: null,
  lastKnownValidReporter: null,
  lastKnownValidFactCheck: null,
  lastKnownValidQualityReport: null,
  lastKnownValidAttempt: 0,
  editorSemanticValidation: null,
  editorPublicArticleJudge: null,
  editorDeskAdvisory: [],
  repairAttempted: false,
  repairSucceeded: false,
  candidateInput: null,
  stageTracker: createStageStatusTracker()
};

module.exports = { generationRunState };
