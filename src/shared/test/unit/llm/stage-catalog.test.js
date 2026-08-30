const assert = require('node:assert/strict');
const test = require('node:test');

const {
  LLM_STAGES,
  TEMPERATURE_PROFILES,
  THINKING_PROFILES,
  assertStageRun,
  isStageRun,
  stageDefinitionById,
  stageRun,
  stageRunKey
} = require('../../../llm/stage-catalog');
const { LLM_STAGE_GROUPS } = require('../../../llm/model-policy');

// #980이 고정한 21개 label을 catalog가 byte 단위로 그대로 만들어내는지 확인한다.
// 이 목록이 catalog와 예전 자유 문자열 label 사이의 다리다. 여기가 어긋나면 #981의
// 전제("routing과 label을 보존한다")가 깨진 것이다.
const EXPECTED_LABELS = [
  [LLM_STAGES.REPORTER, 'reporter attempt 1/2'],
  [LLM_STAGES.EDITOR, 'editor attempt 1/2'],
  [LLM_STAGES.FACT_CHECKER, 'fact-checker attempt 1/2'],
  [LLM_STAGES.BACKGROUND_CONTEXT, 'background-context attempt 1/2'],
  [LLM_STAGES.EDITORIAL_PLAN, 'editorial-plan attempt 1/2'],
  [LLM_STAGES.EDITOR_REPAIR, 'editor repair attempt 1/2'],
  [LLM_STAGES.FACT_CHECKER_REPAIR, 'fact-checker repair attempt 1/2'],
  [LLM_STAGES.EDITOR_COMPLETION, 'editor completion attempt 1/2'],
  [LLM_STAGES.FACT_CHECKER_COMPLETION, 'fact-checker completion attempt 1/2'],
  [LLM_STAGES.WEEKLY_MERGE, 'weekly-merge'],
  [LLM_STAGES.POST_GENERATION_QUALITY_JUDGE, 'post-generation public quality judge'],
  [LLM_STAGES.SOURCE_DISCOVERY, 'sourceDiscovery']
];

const JUDGE_PARENTS = [
  { parent: LLM_STAGES.EDITOR, prefix: 'editor attempt 1/2', key: 'EDITOR' },
  { parent: LLM_STAGES.EDITOR_REPAIR, prefix: 'editor repair attempt 1/2', key: 'EDITOR_REPAIR' },
  { parent: LLM_STAGES.EDITOR_COMPLETION, prefix: 'editor completion attempt 1/2', key: 'EDITOR_COMPLETION' }
];

const JUDGE_SUFFIXES = [
  { key: 'SEMANTIC_REPAIR', suffix: 'semantic repair' },
  { key: 'PUBLIC_ARTICLE_JUDGE', suffix: 'public article judge' },
  { key: 'PUBLIC_ARTICLE_JUDGE_REPAIR', suffix: 'public article judge repair' }
];

function runFor(definition) {
  return stageRun(definition, { qualityAttempt: 1, totalAttempts: 2 });
}

test('catalog가 production stage 21개를 정의한다', () => {
  assert.equal(Object.keys(LLM_STAGES).length, 21);
  const ids = Object.values(LLM_STAGES).map(definition => definition.id);
  assert.equal(new Set(ids).size, ids.length, 'definition id가 중복이다');
});

test('definition의 group과 sampling profile이 모두 유효한 어휘다', () => {
  const groups = Object.values(LLM_STAGE_GROUPS);
  const temperatures = Object.values(TEMPERATURE_PROFILES);
  const thinkings = Object.values(THINKING_PROFILES);
  Object.values(LLM_STAGES).forEach((definition) => {
    assert.ok(groups.includes(definition.modelGroup), `invalid model group: ${definition.id}`);
    assert.ok(temperatures.includes(definition.sampling.temperatureProfile), `invalid temperature profile: ${definition.id}`);
    assert.ok(thinkings.includes(definition.sampling.thinkingProfile), `invalid thinking profile: ${definition.id}`);
    assert.equal(typeof definition.statusRole, 'string');
    assert.notEqual(definition.statusRole, '');
  });
});

test('기본 stage 12개의 label이 현행과 byte 단위로 같다', () => {
  EXPECTED_LABELS.forEach(([definition, expected]) => {
    assert.equal(runFor(definition).label, expected);
  });
});

test('파생 stage 9개의 label이 현행과 byte 단위로 같다', () => {
  JUDGE_PARENTS.forEach((parentSpec) => {
    const parentRun = runFor(parentSpec.parent);
    JUDGE_SUFFIXES.forEach((suffixSpec) => {
      const definition = LLM_STAGES[`${parentSpec.key}_${suffixSpec.key}`];
      assert.ok(definition, `missing definition: ${parentSpec.key}_${suffixSpec.key}`);
      const run = stageRun(definition, { parentRun });
      assert.equal(run.label, `${parentSpec.prefix} ${suffixSpec.suffix}`);
    });
  });
});

test('파생 run은 부모의 quality attempt와 parentRunKey를 물려받는다', () => {
  const parentRun = stageRun(LLM_STAGES.EDITOR, { qualityAttempt: 3, totalAttempts: 4 });
  const judgeRun = stageRun(LLM_STAGES.EDITOR_PUBLIC_ARTICLE_JUDGE, { parentRun });

  assert.equal(judgeRun.qualityAttempt, 3);
  assert.equal(judgeRun.totalAttempts, 4);
  assert.equal(judgeRun.parentRunKey, 'editor#3');
  assert.equal(judgeRun.label, 'editor attempt 3/4 public article judge');
});

test('stageRunKey는 id와 quality attempt만 쓴다', () => {
  assert.equal(stageRunKey(stageRun(LLM_STAGES.EDITOR_COMPLETION, { qualityAttempt: 1, totalAttempts: 2 })), 'editor.completion#1');
  // 총 재시도 수가 바뀌어도 같은 회차의 키는 그대로다. 예전 label은 그러지 못했다.
  assert.equal(stageRunKey(stageRun(LLM_STAGES.EDITOR_COMPLETION, { qualityAttempt: 1, totalAttempts: 9 })), 'editor.completion#1');
  assert.equal(stageRunKey(stageRun(LLM_STAGES.WEEKLY_MERGE)), 'weekly_merge#0');
});

test('한 quality attempt 안에서 부모가 다르면 판정 stage의 키도 다르다', () => {
  const editorRun = stageRun(LLM_STAGES.EDITOR, { qualityAttempt: 1, totalAttempts: 2 });
  const repairRun = stageRun(LLM_STAGES.EDITOR_REPAIR, { qualityAttempt: 1, totalAttempts: 2 });
  const completionRun = stageRun(LLM_STAGES.EDITOR_COMPLETION, { qualityAttempt: 1, totalAttempts: 2 });

  const keys = [
    stageRunKey(stageRun(LLM_STAGES.EDITOR_PUBLIC_ARTICLE_JUDGE, { parentRun: editorRun })),
    stageRunKey(stageRun(LLM_STAGES.EDITOR_REPAIR_PUBLIC_ARTICLE_JUDGE, { parentRun: repairRun })),
    stageRunKey(stageRun(LLM_STAGES.EDITOR_COMPLETION_PUBLIC_ARTICLE_JUDGE, { parentRun: completionRun }))
  ];

  assert.deepEqual(keys, [
    'editor.public_article_judge#1',
    'editor.repair.public_article_judge#1',
    'editor.completion.public_article_judge#1'
  ]);
});

test('파생 run은 부모 없이도, 엉뚱한 부모로도 만들 수 없다', () => {
  assert.throws(
    () => stageRun(LLM_STAGES.EDITOR_PUBLIC_ARTICLE_JUDGE, { qualityAttempt: 1, totalAttempts: 2 }),
    /requires a parentRun/
  );
  const wrongParent = stageRun(LLM_STAGES.REPORTER, { qualityAttempt: 1, totalAttempts: 2 });
  assert.throws(
    () => stageRun(LLM_STAGES.EDITOR_PUBLIC_ARTICLE_JUDGE, { parentRun: wrongParent }),
    /parent mismatch/
  );
});

test('catalog 밖의 값으로는 run을 만들 수 없다', () => {
  assert.throws(() => stageRun({ id: 'made.up' }, { qualityAttempt: 1, totalAttempts: 2 }), /unknown_stage_definition/);
  assert.throws(() => stageRun(null), /unknown_stage_definition/);
});

test('assertStageRun은 예전 자유 문자열 label을 거부한다', () => {
  assert.throws(() => assertStageRun('editor attempt 1/2'), /expected a stage run/);
  assert.throws(() => assertStageRun(undefined), /expected a stage run/);
  assert.equal(isStageRun('editor attempt 1/2'), false);

  const run = runFor(LLM_STAGES.EDITOR);
  assert.equal(isStageRun(run), true);
  assert.equal(assertStageRun(run), run);
});

test('id로 definition을 되찾을 수 있다', () => {
  assert.equal(stageDefinitionById('editor.completion'), LLM_STAGES.EDITOR_COMPLETION);
  assert.equal(stageDefinitionById('made.up'), null);
});
