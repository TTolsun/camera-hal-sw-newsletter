const assert = require('node:assert/strict');
const test = require('node:test');

const {
  maybeHandleSelectionShortage,
  warnSelectionUnderfill,
  maybeFailOnSelectionErrors
} = require('../../publish/orchestrator-selection-preflight');

// 발행 안전 경로(LLM 생성 전 early-exit)를 고정한다. io 함수를 spy로 주입해
// 각 가드의 제어흐름(반환값/throw)과 부수효과 호출을 추출 전 동작과 일치시킨다.
function makeIo() {
  const calls = [];
  const record = name => (...args) => { calls.push({ name, args }); };
  return {
    calls,
    io: {
      buildGenerationStatus: (...args) => {
        calls.push({ name: 'buildGenerationStatus', args });
        return { status: args[0].status };
      },
      writeGenerationStatus: record('writeGenerationStatus'),
      writeDateReviewPackage: record('writeDateReviewPackage'),
      writeRecoveryPrompt: record('writeRecoveryPrompt'),
      selectionStatusExtra: () => ({}),
      fail: message => { calls.push({ name: 'fail', args: [message] }); throw new Error(message); }
    }
  };
}

test('maybeHandleSelectionShortage: shortage면 true 반환 + status/review package 기록', () => {
  const { io, calls } = makeIo();
  const handled = maybeHandleSelectionShortage({
    date: '2026-06-22',
    shortlistReport: { candidate_shortage_reviewable: true, shortage_reason_codes: ['x'], selection_errors: [] },
    io
  });
  assert.equal(handled, true);
  const names = calls.map(c => c.name);
  assert.ok(names.includes('buildGenerationStatus'));
  assert.ok(names.includes('writeGenerationStatus'));
  assert.ok(names.includes('writeDateReviewPackage'));
});

test('maybeHandleSelectionShortage: shortage 아니면 false 반환 + 부수효과 없음', () => {
  const { io, calls } = makeIo();
  const handled = maybeHandleSelectionShortage({
    date: '2026-06-22',
    shortlistReport: { candidate_shortage_reviewable: false },
    io
  });
  assert.equal(handled, false);
  assert.equal(calls.length, 0);
});

test('warnSelectionUnderfill: 경고 있으면 status+recovery 기록하고 early-exit 없음', () => {
  const { io, calls } = makeIo();
  const result = warnSelectionUnderfill({
    date: '2026-06-22',
    newsroomDir: '/newsroom',
    shortlistReport: { selection_warnings: ['w'], selected_articles: [] },
    io
  });
  assert.equal(result, undefined);
  const names = calls.map(c => c.name);
  assert.ok(names.includes('writeGenerationStatus'));
  assert.ok(names.includes('writeRecoveryPrompt'));
});

test('warnSelectionUnderfill: 경고 없으면 no-op', () => {
  const { io, calls } = makeIo();
  warnSelectionUnderfill({
    date: '2026-06-22',
    newsroomDir: '/newsroom',
    shortlistReport: { selection_warnings: [] },
    io
  });
  assert.equal(calls.length, 0);
});

test('maybeFailOnSelectionErrors: 오류 있으면 fail()로 throw하고 writer를 모두 기록', () => {
  const { io, calls } = makeIo();
  assert.throws(() => maybeFailOnSelectionErrors({
    date: '2026-06-22',
    newsroomDir: '/newsroom',
    shortlistReport: { selection_errors: ['e'], selected_articles: [] },
    io
  }), /deterministic selection/);
  const names = calls.map(c => c.name);
  assert.ok(names.includes('writeRecoveryPrompt'));
  assert.ok(names.includes('writeGenerationStatus'));
  assert.ok(names.includes('writeDateReviewPackage'));
  assert.ok(names.includes('fail'));
});

test('maybeFailOnSelectionErrors: 오류 없으면 no-op이고 throw하지 않는다', () => {
  const { io, calls } = makeIo();
  maybeFailOnSelectionErrors({
    date: '2026-06-22',
    newsroomDir: '/newsroom',
    shortlistReport: { selection_errors: [] },
    io
  });
  assert.equal(calls.length, 0);
});
