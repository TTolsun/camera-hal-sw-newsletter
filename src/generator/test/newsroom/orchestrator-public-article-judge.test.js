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
