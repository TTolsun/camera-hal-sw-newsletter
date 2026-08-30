const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const { runQualityGateAndPersist } = require('../../publish/orchestrator-quality-gate-runner');
const { generationRunState } = require('../../publish/orchestrator-run-state');
const { createStageStatusTracker } = require('../../select/stage-status-tracker');
const { editor, tempNewsroomDir } = require('../../../shared/test/helpers/editor-builders');

// 추출 전 main() 내부 runQualityGateAndPersist closure를 입력→출력으로 고정한다.
// runner의 책임은 orchestration(품질 게이트 빌드 → generationRunState 반영 →
// last-known-valid editor 기록 → 표준/시도별 아티팩트 영속화 → stageTracker 갱신)이며,
// 품질 점수 계산 자체는 newsletter-quality 테스트가 따로 검증한다.

function baseContext(newsroomDir, recordLastKnownValidEditor) {
  return {
    date: '2026-05-08',
    reporter: { candidates: [] },
    shortlistReport: { selected_articles: [] },
    seedEvidencePack: null,
    newsroomDir,
    qualityThreshold: 60,
    recordLastKnownValidEditor
  };
}

test('attempt 경로: 품질 게이트를 빌드해 generationRunState에 반영하고 editor+report를 반환한다', () => {
  const newsroomDir = tempNewsroomDir();
  const draft = editor();
  let recorded = null;
  const result = runQualityGateAndPersist(
    draft,
    { status: 'PASS', must_fix: [] },
    1,
    'attempt',
    baseContext(newsroomDir, (ed, ctx) => { recorded = { ed, ctx }; return ed; })
  );

  assert.equal(result.editor, draft);
  assert.ok(result.qualityReport);
  assert.equal(typeof result.qualityReport.status, 'string');
  assert.equal(generationRunState.qualityReport, result.qualityReport);
  // last-known-valid 기록이 currentEditor + 표준 컨텍스트로 호출됨
  assert.equal(recorded.ed, draft);
  assert.equal(recorded.ctx.requireStoryContract, true);
  assert.equal(recorded.ctx.attempt, 1);
  // 표준 attempt(infix 없음) 파일 영속화
  assert.ok(fs.existsSync(path.join(newsroomDir, 'quality-report-attempt-1.json')));
  assert.ok(fs.existsSync(path.join(newsroomDir, 'quality-report-attempt-1.md')));
});

// 게이트는 한 attempt 안에서 세 번 돈다(attempt -> repair -> completion). 셋을 한 행에
// 기록하면 나중 결과가 앞 결과를 덮어 실패가 사라진다 -- 커밋된 06-20·07-27·08-10 로그에
// {status:passed, reason:NEEDS_FIX}인 모순 행이 그렇게 생겼다.
test('한 attempt의 게이트 세 경로가 서로 다른 행으로 남는다', () => {
  const newsroomDir = tempNewsroomDir();
  const draft = editor();
  const context = baseContext(newsroomDir, (ed) => ed);
  const originalTracker = generationRunState.stageTracker;
  const tracker = createStageStatusTracker();
  generationRunState.stageTracker = tracker;
  try {
    runQualityGateAndPersist(draft, { status: 'PASS', must_fix: [] }, 1, 'attempt', context);
    runQualityGateAndPersist(draft, { status: 'PASS', must_fix: [] }, 1, 'repair', context);
    runQualityGateAndPersist(draft, { status: 'PASS', must_fix: [] }, 1, 'completion', context);
  } finally {
    generationRunState.stageTracker = originalTracker;
  }
  const log = tracker.toLog();
  assert.deepEqual(log.map(entry => entry.stage_id), [
    'quality_gate',
    'quality_gate.repair',
    'quality_gate.completion'
  ]);
  // 다이어그램이 묶어 읽는 role은 셋 다 같다.
  assert.deepEqual([...new Set(log.map(entry => entry.role))], ['quality_gate']);
});

test('repair/completion 경로는 infix가 붙은 quality-report 파일을 쓴다', () => {
  const newsroomDir = tempNewsroomDir();
  const draft = editor();
  const context = baseContext(newsroomDir, (ed) => ed);
  runQualityGateAndPersist(draft, { status: 'PASS', must_fix: [] }, 2, 'repair', context);
  runQualityGateAndPersist(draft, { status: 'PASS', must_fix: [] }, 2, 'completion', context);
  assert.ok(fs.existsSync(path.join(newsroomDir, 'quality-report-repair-attempt-2.json')));
  assert.ok(fs.existsSync(path.join(newsroomDir, 'quality-report-completion-attempt-2.json')));
});
