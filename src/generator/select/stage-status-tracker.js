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

  // role을 생략하면 stage_id를 그대로 쓴다. quality_gate·render처럼 다이어그램 노드가 곧
  // stage인 결정론 단계를 위한 규칙이다 -- LLM stage는 role이 stage id와 다르므로 반드시 준다.
  function upsert({ stageId, role, attempt, label, reason }, status) {
    const existing = find(stageId, attempt);
    if (existing) {
      existing.status = status;
      if (label) existing.stage = label;
      if (reason) existing.reason = reason;
      return existing;
    }
    const entry = {
      stage_id: stageId,
      role: role || stageId,
      attempt: Number(attempt) || 0,
      status,
      stage: label || role || stageId
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
    skip(call) {
      return upsert(call, STAGE_STATUSES.SKIPPED);
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
