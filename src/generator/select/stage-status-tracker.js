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

const STAGE_STATUSES = Object.freeze({
  STARTED: 'started',
  PASSED: 'passed',
  FAILED: 'failed',
  SKIPPED: 'skipped'
});

// Map a runtime stage label to its canonical role. Labels look like
// "reporter attempt 1/2", "editor repair attempt 1/2", "fact-checker attempt 1/2",
// "background-context attempt 1/2", "editor public article judge".
function roleFromStageLabel(label) {
  const text = String(label || '').toLowerCase();
  if (text.includes('repair')) return 'repair';
  if (text.includes('judge')) return 'judge';
  if (text.includes('fact')) return 'factcheck';
  if (text.includes('background-context') || text.includes('background context')) {
    return 'background-context';
  }
  if (text.includes('reporter')) return 'reporter';
  if (text.includes('completion') || text.includes('editor')) return 'editor';
  return text.trim() || 'unknown';
}

function createStageStatusTracker() {
  const entries = [];

  function find(role, attempt) {
    const normalizedAttempt = Number(attempt) || 0;
    return entries.find(entry => entry.role === role && entry.attempt === normalizedAttempt);
  }

  function upsert(role, attempt, status, label, reason) {
    const existing = find(role, attempt);
    if (existing) {
      existing.status = status;
      if (label) existing.stage = label;
      if (reason) existing.reason = reason;
      return existing;
    }
    const entry = {
      role,
      attempt: Number(attempt) || 0,
      status,
      stage: label || role
    };
    if (reason) entry.reason = reason;
    entries.push(entry);
    return entry;
  }

  return {
    start(role, attempt, label) {
      return upsert(role, attempt, STAGE_STATUSES.STARTED, label);
    },
    pass(role, attempt, label) {
      return upsert(role, attempt, STAGE_STATUSES.PASSED, label);
    },
    fail(role, attempt, label, reason) {
      return upsert(role, attempt, STAGE_STATUSES.FAILED, label, reason);
    },
    skip(role, attempt, label) {
      return upsert(role, attempt, STAGE_STATUSES.SKIPPED, label);
    },
    toLog() {
      return entries.map(entry => ({ ...entry }));
    }
  };
}

module.exports = {
  STAGE_STATUSES,
  roleFromStageLabel,
  createStageStatusTracker
};
