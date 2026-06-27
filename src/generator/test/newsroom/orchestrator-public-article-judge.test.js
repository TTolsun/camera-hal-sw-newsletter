const assert = require('node:assert/strict');
const test = require('node:test');

const { validatePublicArticleJudgeOrRepair } = require('../../publish/orchestrator-public-article-judge');

// 추출 전 main()의 editor public-article judge / semantic repair 흐름을 입력→출력으로 고정한다.
// 모듈의 책임은 orchestration(judge → 차단 시 repair → 재judge → status 기록)이며,
// callLlmJson/recordEditorSemanticStatus/validateEditor는 deps로 주입한다. judge 보고서
// 정규화/차단 판정 로직 자체는 orchestrator-judge-helpers 테스트가 따로 검증한다.

function editorWithOneSection() {
  return { date: '2026-05-08', sections: [{ headline: 'h1' }] };
}

function cleanJudgeReport() {
  return {
    overall_pass: true,
    sections: [{
      section_index: 1,
      public_article_pass: true,
      reader_checkpoints_pass: true,
      source_boundary_pass: true,
      public_prose_pass: true,
      issues: []
    }]
  };
}

function blockingJudgeReport() {
  return {
    overall_pass: false,
    sections: [{
      section_index: 1,
      public_article_pass: false,
      reader_checkpoints_pass: true,
      source_boundary_pass: true,
      public_prose_pass: true,
      issues: []
    }]
  };
}

const baseArgs = {
  date: '2026-05-08',
  reporter: { candidates: [] },
  attempt: 1,
  editorStage: 'editor attempt 1/3',
  commonContext: '',
  lockedContext: '',
  newsroomDir: null
};

test('judge가 통과하면 editor를 그대로 반환하고 judge 결과를 기록한다', async () => {
  const editor = editorWithOneSection();
  const calls = [];
  const recorded = [];
  const deps = {
    callLlmJson: async (stage) => { calls.push(stage); return cleanJudgeReport(); },
    recordEditorSemanticStatus: (status) => recorded.push(status),
    validateEditor: (value) => value
  };

  const result = await validatePublicArticleJudgeOrRepair({ ...baseArgs, editor }, deps);

  assert.equal(result, editor);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /public article judge$/);
  assert.equal(recorded.length, 1);
  assert.ok(recorded[0].editor_public_article_judge);
});

test('judge가 차단되면 repair를 시도하고, repair 검증 실패 시 repairSucceeded=false로 기록 후 throw한다', async () => {
  const editor = editorWithOneSection();
  const calls = [];
  const recorded = [];
  const deps = {
    callLlmJson: async (stage) => { calls.push(stage); return blockingJudgeReport(); },
    recordEditorSemanticStatus: (status) => recorded.push(status),
    validateEditor: () => { throw new Error('repaired editor invalid'); }
  };

  await assert.rejects(
    () => validatePublicArticleJudgeOrRepair({ ...baseArgs, editor }, deps),
    /repair failed|repaired editor invalid/i
  );

  // 초기 judge + repair LLM 호출 두 번
  assert.equal(calls.length, 2);
  assert.match(calls[0], /public article judge$/);
  assert.match(calls[1], /semantic repair$/);
  // 마지막 기록은 repair 시도/실패 상태
  const last = recorded[recorded.length - 1];
  assert.equal(last.repairAttempted, true);
  assert.equal(last.repairSucceeded, false);
});

// --- #725 desk-review advisory 흐름 ---

function deskAdvisoryReport() {
  return {
    overall_pass: true,
    sections: [{
      section_index: 1,
      public_article_pass: true,
      reader_checkpoints_pass: true,
      source_boundary_pass: true,
      public_prose_pass: true,
      issues: [{
        section_index: 1,
        field: 'desk_target_explanation',
        severity: 'P3',
        reason: 'target technology not explained'
      }]
    }]
  };
}

// stage로 분기하는 스텁: semantic repair는 repairOutput을, 그 외(judge/re-judge)는 judgeReports를
// 순서대로 반환한다(re-judge stage는 ".. public article judge repair"라 semantic repair와 구분된다).
function stagedDeps({ judgeReports, repairOutput, recorded, calls }) {
  let judgeCall = 0;
  return {
    callLlmJson: async (stage) => {
      calls.push(stage);
      if (/semantic repair$/.test(stage)) return repairOutput;
      const report = judgeReports[Math.min(judgeCall, judgeReports.length - 1)];
      judgeCall += 1;
      return report;
    },
    recordEditorSemanticStatus: (status) => recorded.push(status),
    validateEditor: (value) => value
  };
}

test('desk-only advisory가 repair를 트리거하고, repair가 해소하면 repaired editor를 반환한다', async () => {
  const editor = editorWithOneSection();
  const calls = [];
  const recorded = [];
  const deps = stagedDeps({
    judgeReports: [deskAdvisoryReport(), cleanJudgeReport()],
    repairOutput: editorWithOneSection(),
    recorded,
    calls
  });

  const result = await validatePublicArticleJudgeOrRepair({ ...baseArgs, editor }, deps);

  assert.deepEqual(result, editorWithOneSection());
  assert.equal(calls.length, 3);
  assert.match(calls[0], /public article judge$/);
  assert.match(calls[1], /semantic repair$/);
  assert.match(calls[2], /public article judge repair$/);
  const last = recorded[recorded.length - 1];
  assert.equal(last.repairAttempted, true);
  assert.equal(last.repairSucceeded, true);
});

test('repair 후에도 desk advisory가 남으면 throw하지 않고 editor를 반환하며 advisory를 기록한다', async () => {
  const editor = editorWithOneSection();
  const calls = [];
  const recorded = [];
  const deps = stagedDeps({
    judgeReports: [deskAdvisoryReport(), deskAdvisoryReport()],
    repairOutput: editorWithOneSection(),
    recorded,
    calls
  });

  const result = await validatePublicArticleJudgeOrRepair({ ...baseArgs, editor }, deps);

  assert.ok(result); // 발행 진행(차단 없음)
  const last = recorded[recorded.length - 1];
  assert.ok(last.editor_desk_advisory);
  assert.equal(last.editor_desk_advisory.length, 1);
  assert.equal(last.editor_desk_advisory[0].field, 'desk_target_explanation');
});

test('desk-only 트리거에서 repair가 실패해도 발행을 막지 않고 원본 editor를 반환한다', async () => {
  const editor = editorWithOneSection();
  const calls = [];
  const recorded = [];
  const deps = {
    callLlmJson: async (stage) => {
      calls.push(stage);
      if (/semantic repair$/.test(stage)) return editorWithOneSection();
      return deskAdvisoryReport();
    },
    recordEditorSemanticStatus: (status) => recorded.push(status),
    validateEditor: () => { throw new Error('repaired editor invalid'); }
  };

  const result = await validatePublicArticleJudgeOrRepair({ ...baseArgs, editor }, deps);

  assert.equal(result, editor); // 원본 발행
  const last = recorded[recorded.length - 1];
  assert.equal(last.repairAttempted, true);
  assert.equal(last.repairSucceeded, false);
  assert.ok(last.editor_desk_advisory);
});

test('repair 프롬프트에 desk 교정 지침이 포함된다', async () => {
  const editor = editorWithOneSection();
  const prompts = [];
  let judgeCall = 0;
  const deps = {
    callLlmJson: async (stage, prompt) => {
      prompts.push({ stage, prompt });
      if (/semantic repair$/.test(stage)) return editorWithOneSection();
      judgeCall += 1;
      return judgeCall === 1 ? deskAdvisoryReport() : cleanJudgeReport();
    },
    recordEditorSemanticStatus: () => {},
    validateEditor: (value) => value
  };

  await validatePublicArticleJudgeOrRepair({ ...baseArgs, editor }, deps);

  const repairPrompt = prompts.find(entry => /semantic repair$/.test(entry.stage));
  assert.ok(repairPrompt, 'semantic repair가 호출되어야 한다');
  assert.match(repairPrompt.prompt, /desk_target_explanation/);
});

test('차단도 desk advisory도 없으면 repair 없이 editor를 반환한다', async () => {
  const editor = editorWithOneSection();
  const calls = [];
  const recorded = [];
  const deps = stagedDeps({
    judgeReports: [cleanJudgeReport()],
    repairOutput: editorWithOneSection(),
    recorded,
    calls
  });

  const result = await validatePublicArticleJudgeOrRepair({ ...baseArgs, editor }, deps);

  assert.equal(result, editor);
  assert.equal(calls.length, 1); // judge만, repair 없음
});
