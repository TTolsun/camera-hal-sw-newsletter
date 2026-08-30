'use strict';

// Per-stage status tracking for the newsletter generation pipeline (#398).
//
// Single responsibility: record which internal stages ran and whether each one
// passed or failed, so the workflow run summary can color the pipeline sequence
// (Reporter -> Editor -> Repair -> Fact-check -> Quality -> Render -> Publish).
//
// This is record-only instrumentation: pure data, no IO, no LLM, and
// intentionally free of any control flow that could affect a gate decision.
// Deriving which absent stages count as "skipped" is left to the renderer,
// which knows the canonical sequence per workflow profile.
//
// 한 행은 한 attempt의 한 stage다(#979 3·4·8번). 예전에는 role이 행의 키였는데, role은
// 다이어그램에 칠할 묶음이라 stage보다 거칠다 -- LLM stage 21개가 role 8개를 나눠 쓰고
// `repair` 하나에 9개가 몰린다. 그래서 같은 role의 stage들이 한 행으로 뭉개졌고, 나중에
// 실행된 stage가 앞선 stage의 상태를 덮었다. 2026-08-24 실행에서는 editorial-plan 호출이
// editor 행에 덮여 기록에서 통째로 사라졌다(model_routing에는 6종, 이 로그에는 5종).
//
// role은 지우지 않는다. 행마다 stage_id와 role을 함께 남기고, 다이어그램은 지금처럼 role로
// 묶어 읽는다.

// SKIPPED는 기록기가 만들지 않는다. 어떤 단계가 건너뛴 것인지는 정식 시퀀스를 아는
// 렌더러가 "기록에 없음"에서 파생한다.
const STAGE_STATUSES = Object.freeze({
  STARTED: 'started',
  PASSED: 'passed',
  FAILED: 'failed',
  SKIPPED: 'skipped'
});

function createStageStatusTracker() {
  const entries = [];

  function find(stageId, attempt) {
    const normalizedAttempt = Number(attempt) || 0;
    return entries.find(entry => entry.stage_id === stageId && entry.attempt === normalizedAttempt);
  }

  // 기록 전용이라는 계약이 인자 모양보다 우선한다. 잘못 부른 호출이 발행을 죽이면 안 되므로
  // 던지지 않고, 대신 경고를 남겨 마이그레이션 누락이 조용히 통과하지 않게 한다 -- stage_id나
  // role이 없는 행은 다이어그램에서 그 단계를 통째로 사라지게 만든다.
  function upsert(call, status) {
    const { stageId, role, attempt, label, reason } = call || {};
    if (!stageId || !role) {
      console.warn(`[stage-status] stageId와 role 없이 기록을 시도했다: ${JSON.stringify(call)}`);
    }
    const existing = find(stageId, attempt);
    if (existing) {
      existing.status = status;
      if (label) existing.stage = label;
      // reason은 지금 status를 설명하는 값이다. 남겨두면 실패했다가 다시 통과한 행이
      // "passed인데 reason=NEEDS_FIX"로 남는다(커밋된 06-20·07-27·08-10 로그에 실재한다).
      if (reason) existing.reason = reason;
      else delete existing.reason;
      return existing;
    }
    const entry = {
      stage_id: stageId,
      role,
      attempt: Number(attempt) || 0,
      status,
      // 사람이 읽는 이름. LLM stage는 label을 주고, 결정론 단계는 role이 곧 이름이다.
      stage: label || role
    };
    if (reason) entry.reason = reason;
    entries.push(entry);
    return entry;
  }

  return {
    start(call) {
      return upsert(call, STAGE_STATUSES.STARTED);
    },
    pass(call) {
      return upsert(call, STAGE_STATUSES.PASSED);
    },
    fail(call) {
      return upsert(call, STAGE_STATUSES.FAILED);
    },
    toLog() {
      return entries.map(entry => ({ ...entry }));
    }
  };
}

module.exports = {
  STAGE_STATUSES,
  createStageStatusTracker
};
