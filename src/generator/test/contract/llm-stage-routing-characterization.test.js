const assert = require('node:assert/strict');
const test = require('node:test');

const { LABEL_KINDS, stageDefinitionById, stageRun } = require('../../../shared/llm/stage-catalog');
const { temperatureForSampling, thinkingBudgetForSampling } = require('../../../shared/llm/providers/gemini-provider');
const { createDiagnosticsState } = require('../../../shared/llm/llm-diagnostics');
const { publicArticleJudgeArtifactScope } = require('../../publish/orchestrator-judge-helpers');

// 표의 stage id로 run을 만든다. 파생 stage는 부모 run이 있어야 label이 나온다.
function runForStageId(stageId) {
  const definition = stageDefinitionById(stageId);
  if (!definition) throw new Error(`unknown stage id in table: ${stageId}`);
  if (definition.label.kind === LABEL_KINDS.DERIVED) {
    return stageRun(definition, { parentRun: runForStageId(definition.label.parentId) });
  }
  return stageRun(definition, { qualityAttempt: 1, totalAttempts: 2 });
}

// LLM stage routing characterization (#980, #981).
//
// production stage 21개의 routing 결과를 표 한 장으로 고정한다. 열은 label, model group,
// temperature/thinking config field, status role, artifact scope다.
//
// #980에서 이 표는 자유 문자열 label을 정규식으로 해석하던 resolver 다섯의 답을 고정했다.
// #981이 그 resolver들을 stage catalog로 대체하면서, 같은 값을 이제 catalog를 통해 확인한다.
// 표에 적힌 값은 그때와 byte 단위로 같다 -- 바뀐 것은 값이 아니라 그 값이 나오는 경로다.
//
// 여기 적힌 값이 곧 "옳은 값"이라는 뜻은 아니다. 이상해 보이는 조합(예: editor completion은
// model group이 repair인데 sampling은 editor를 쓴다)도 그대로 기록해 두는 것이 목적이다.
// 의심 항목의 의도 결정은 #979 umbrella에서 항목별로 다룬다.

// temperature/thinking은 기본 숫자가 아니라 "어느 config field로 해석되는가"가 계약이다.
// 그래서 field마다 고유한 sentinel 값을 넣고, 돌아온 값이 그 field에서 왔는지 확인한다.
// 기본값 자체는 runtime-config 테스트가 따로 지킨다.
const TEMPERATURE_SENTINELS = {
  geminiTemperatureDefault: 0.101,
  geminiTemperatureSourceDiscovery: 0.102,
  geminiTemperatureReporter: 0.103,
  geminiTemperatureEditor: 0.104,
  geminiTemperatureFactcheck: 0.105,
  geminiTemperatureRepair: 0.106,
  geminiTemperatureJudge: 0.107
};

const THINKING_SENTINELS = {
  geminiThinkingBudgetReporter: 3001,
  geminiThinkingBudgetEditor: 3002,
  geminiThinkingBudgetRepair: 3003,
  geminiThinkingBudgetFactcheck: 3004,
  geminiThinkingBudgetJudge: 3005,
  geminiThinkingBudgetScoring: 3006
};

const SENTINEL_CONFIG = Object.freeze({ ...TEMPERATURE_SENTINELS, ...THINKING_SENTINELS });

// thinkingField가 null이면 "매핑되는 분기가 없어 0으로 떨어진다"는 뜻이다.
// 누락인지 의도인지는 코드에서 구분되지 않는다(#979 2번 항목).
const NO_THINKING_MAPPING = null;

// artifact scope는 판정(public article judge) stage에서만 조회된다. 나머지 stage에 대한
// 예전 label 기반 함수의 답은 어떤 호출자도 보지 않던 값이라 고정하지 않는다.
const SCOPE_NOT_CONSULTED = null;

// 파생 stage는 부모 label 뒤에 문자열을 덧붙여 만든다. 부모가 셋인 이유는
// orchestrator-repair-completion.js:313이 editorStage로 repair stage를,
// :480이 completion stage를 판정 경로에 넘기기 때문이다. 즉 같은 판정 stage가
// 한 quality attempt 안에서 서로 다른 부모 셋을 가진다.

// 아래 표가 "어떤 stage를 덮는가"를 표와 독립적으로 한 번 더 적어 둔다. 표에서 case 하나가
// 빠지고 다른 label로 바뀌어도 개수와 중복만으로는 알 수 없기 때문이다.
const EXPECTED_BASE_LABELS = [
  'reporter attempt 1/2',
  'editor attempt 1/2',
  'fact-checker attempt 1/2',
  'background-context attempt 1/2',
  'editorial-plan attempt 1/2',
  'editor repair attempt 1/2',
  'fact-checker repair attempt 1/2',
  'editor completion attempt 1/2',
  'fact-checker completion attempt 1/2',
  'weekly-merge',
  'post-generation public quality judge',
  'sourceDiscovery'
];

const JUDGE_PARENT_LABELS = [
  'editor attempt 1/2',
  'editor repair attempt 1/2',
  'editor completion attempt 1/2'
];

const JUDGE_SUFFIXES = [
  'semantic repair',
  'public article judge',
  'public article judge repair'
];

const EXPECTED_LABELS = [
  ...EXPECTED_BASE_LABELS,
  ...JUDGE_PARENT_LABELS.flatMap(parent => JUDGE_SUFFIXES.map(suffix => `${parent} ${suffix}`))
];

const PRODUCTION_STAGE_CASES = [
  // --- 기본 stage 12개 ---
  {
    label: 'reporter attempt 1/2',
    stageId: 'reporter',
    modelGroup: 'reporter',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureReporter',
    thinkingField: 'geminiThinkingBudgetReporter',
    statusRole: 'reporter',
    artifactScope: SCOPE_NOT_CONSULTED
  },
  {
    label: 'editor attempt 1/2',
    stageId: 'editor',
    modelGroup: 'editor',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureEditor',
    thinkingField: 'geminiThinkingBudgetEditor',
    statusRole: 'editor',
    artifactScope: SCOPE_NOT_CONSULTED
  },
  {
    label: 'fact-checker attempt 1/2',
    stageId: 'fact_checker',
    modelGroup: 'factcheck',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureFactcheck',
    thinkingField: 'geminiThinkingBudgetFactcheck',
    statusRole: 'factcheck',
    artifactScope: SCOPE_NOT_CONSULTED
  },
  {
    // temperature/thinking 어느 쪽에도 background-context 분기가 없다.
    label: 'background-context attempt 1/2',
    stageId: 'background_context',
    modelGroup: 'reporter',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureDefault',
    thinkingField: NO_THINKING_MAPPING,
    statusRole: 'background-context',
    artifactScope: SCOPE_NOT_CONSULTED
  },
  {
    // model group은 전용 그룹인데 sampling은 judge를 재사용하고 status role은 editor가 된다.
    label: 'editorial-plan attempt 1/2',
    stageId: 'editorial_plan',
    modelGroup: 'editorialPlan',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureJudge',
    thinkingField: 'geminiThinkingBudgetJudge',
    statusRole: 'editor',
    artifactScope: SCOPE_NOT_CONSULTED
  },
  {
    label: 'editor repair attempt 1/2',
    stageId: 'editor.repair',
    modelGroup: 'repair',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureRepair',
    thinkingField: 'geminiThinkingBudgetRepair',
    statusRole: 'repair',
    artifactScope: SCOPE_NOT_CONSULTED
  },
  {
    // model group은 factcheck, status role은 repair로 갈린다.
    label: 'fact-checker repair attempt 1/2',
    stageId: 'fact_checker.repair',
    modelGroup: 'factcheck',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureFactcheck',
    thinkingField: 'geminiThinkingBudgetFactcheck',
    statusRole: 'repair',
    artifactScope: SCOPE_NOT_CONSULTED
  },
  {
    // model group은 repair인데 temperature/thinking은 editor를 쓴다.
    label: 'editor completion attempt 1/2',
    stageId: 'editor.completion',
    modelGroup: 'repair',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureEditor',
    thinkingField: 'geminiThinkingBudgetEditor',
    statusRole: 'editor',
    artifactScope: SCOPE_NOT_CONSULTED
  },
  {
    label: 'fact-checker completion attempt 1/2',
    stageId: 'fact_checker.completion',
    modelGroup: 'factcheck',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureFactcheck',
    thinkingField: 'geminiThinkingBudgetFactcheck',
    statusRole: 'factcheck',
    artifactScope: SCOPE_NOT_CONSULTED
  },
  {
    // 어느 정규식에도 걸리지 않아 reporter로 기본 라우팅되고 경고만 남는다.
    label: 'weekly-merge',
    stageId: 'weekly_merge',
    modelGroup: 'reporter',
    known: false,
    warning: 'unknown_stage_defaulted_to_reporter',
    temperatureField: 'geminiTemperatureDefault',
    thinkingField: NO_THINKING_MAPPING,
    statusRole: 'weekly-merge',
    artifactScope: SCOPE_NOT_CONSULTED
  },
  {
    label: 'post-generation public quality judge',
    stageId: 'post_generation_quality_judge',
    modelGroup: 'judge',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureJudge',
    thinkingField: 'geminiThinkingBudgetJudge',
    statusRole: 'judge',
    artifactScope: SCOPE_NOT_CONSULTED
  },
  {
    // status role은 정해진 role이 아니라 label을 소문자로 바꾼 값이 그대로 나온다.
    label: 'sourceDiscovery',
    stageId: 'source_discovery',
    modelGroup: 'sourceDiscovery',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureSourceDiscovery',
    thinkingField: NO_THINKING_MAPPING,
    statusRole: 'sourcediscovery',
    artifactScope: SCOPE_NOT_CONSULTED
  },

  // --- 파생 stage 9개 (부모 3 x 판정 3) ---
  {
    label: 'editor attempt 1/2 semantic repair',
    stageId: 'editor.semantic_repair',
    modelGroup: 'repair',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureRepair',
    thinkingField: 'geminiThinkingBudgetRepair',
    statusRole: 'repair',
    artifactScope: SCOPE_NOT_CONSULTED
  },
  {
    label: 'editor attempt 1/2 public article judge',
    stageId: 'editor.public_article_judge',
    modelGroup: 'judge',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureJudge',
    thinkingField: 'geminiThinkingBudgetJudge',
    statusRole: 'judge',
    artifactScope: 'editor'
  },
  {
    // model/sampling은 judge인데 status role은 repair로 기록된다.
    label: 'editor attempt 1/2 public article judge repair',
    stageId: 'editor.public_article_judge_repair',
    modelGroup: 'judge',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureJudge',
    thinkingField: 'geminiThinkingBudgetJudge',
    statusRole: 'repair',
    artifactScope: 'editor'
  },
  {
    label: 'editor repair attempt 1/2 semantic repair',
    stageId: 'editor.repair.semantic_repair',
    modelGroup: 'repair',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureRepair',
    thinkingField: 'geminiThinkingBudgetRepair',
    statusRole: 'repair',
    artifactScope: SCOPE_NOT_CONSULTED
  },
  {
    // 부모가 editor repair면 같은 판정 stage의 status role이 judge가 아니라 repair가 된다.
    label: 'editor repair attempt 1/2 public article judge',
    stageId: 'editor.repair.public_article_judge',
    modelGroup: 'judge',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureJudge',
    thinkingField: 'geminiThinkingBudgetJudge',
    statusRole: 'repair',
    artifactScope: 'targeted-repair'
  },
  {
    label: 'editor repair attempt 1/2 public article judge repair',
    stageId: 'editor.repair.public_article_judge_repair',
    modelGroup: 'judge',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureJudge',
    thinkingField: 'geminiThinkingBudgetJudge',
    statusRole: 'repair',
    artifactScope: 'targeted-repair'
  },
  {
    label: 'editor completion attempt 1/2 semantic repair',
    stageId: 'editor.completion.semantic_repair',
    modelGroup: 'repair',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureRepair',
    thinkingField: 'geminiThinkingBudgetRepair',
    statusRole: 'repair',
    artifactScope: SCOPE_NOT_CONSULTED
  },
  {
    label: 'editor completion attempt 1/2 public article judge',
    stageId: 'editor.completion.public_article_judge',
    modelGroup: 'judge',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureJudge',
    thinkingField: 'geminiThinkingBudgetJudge',
    statusRole: 'judge',
    artifactScope: 'completion'
  },
  {
    label: 'editor completion attempt 1/2 public article judge repair',
    stageId: 'editor.completion.public_article_judge_repair',
    modelGroup: 'judge',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureJudge',
    thinkingField: 'geminiThinkingBudgetJudge',
    statusRole: 'repair',
    artifactScope: 'completion'
  }
];

test('표가 production stage 21개를 정확히 그대로 덮는다', () => {
  assert.equal(EXPECTED_LABELS.length, 21);

  const labels = PRODUCTION_STAGE_CASES.map(stageCase => stageCase.label);
  assert.equal(new Set(labels).size, labels.length, '표에 중복 label이 있다');

  // 개수와 중복만 보면 case 하나가 빠지고 다른 label로 바뀌어도 통과한다. 기대 목록과
  // 집합 비교까지 해야 표가 production stage를 조용히 놓치는 일을 막을 수 있다.
  assert.deepEqual([...labels].sort(), [...EXPECTED_LABELS].sort());
});

test('stage id -> label 현행 매핑', () => {
  PRODUCTION_STAGE_CASES.forEach((stageCase) => {
    assert.equal(runForStageId(stageCase.stageId).label, stageCase.label);
  });
});

test('stage -> model group 현행 매핑', () => {
  PRODUCTION_STAGE_CASES.forEach((stageCase) => {
    assert.equal(
      stageDefinitionById(stageCase.stageId).modelGroup,
      stageCase.modelGroup,
      `model group mismatch: ${stageCase.label}`
    );
  });
});

test('stage -> temperature config field 현행 매핑', () => {
  PRODUCTION_STAGE_CASES.forEach((stageCase) => {
    const expected = TEMPERATURE_SENTINELS[stageCase.temperatureField];
    assert.equal(typeof expected, 'number', `unknown temperature field: ${stageCase.temperatureField}`);
    assert.equal(
      temperatureForSampling(stageDefinitionById(stageCase.stageId).sampling, SENTINEL_CONFIG),
      expected,
      `temperature mismatch: ${stageCase.label}`
    );
  });
});

test('stage -> thinking budget config field 현행 매핑', () => {
  PRODUCTION_STAGE_CASES.forEach((stageCase) => {
    const actual = thinkingBudgetForSampling(stageDefinitionById(stageCase.stageId).sampling, SENTINEL_CONFIG);
    if (stageCase.thinkingField === NO_THINKING_MAPPING) {
      assert.equal(actual, 0, `thinking budget mismatch (매핑 없음 기대): ${stageCase.label}`);
      return;
    }
    const expected = THINKING_SENTINELS[stageCase.thinkingField];
    assert.equal(typeof expected, 'number', `unknown thinking field: ${stageCase.thinkingField}`);
    assert.equal(actual, expected, `thinking budget mismatch: ${stageCase.label}`);
  });
});

test('stage -> status role 현행 매핑', () => {
  PRODUCTION_STAGE_CASES.forEach((stageCase) => {
    assert.equal(
      stageDefinitionById(stageCase.stageId).statusRole,
      stageCase.statusRole,
      `status role mismatch: ${stageCase.label}`
    );
  });
});

// artifact scope는 label이 아니라 stage id로 정해진다(#981). 값 자체는 고정된 그대로다.
test('stage id -> public article judge artifact scope 현행 매핑', () => {
  PRODUCTION_STAGE_CASES.forEach((stageCase) => {
    if (stageCase.artifactScope === SCOPE_NOT_CONSULTED) return;
    assert.equal(
      publicArticleJudgeArtifactScope(stageCase.stageId),
      stageCase.artifactScope,
      `artifact scope mismatch: ${stageCase.label}`
    );
  });
});

// 축이 갈리는 조합. 표에서 이미 검증되지만, 무심코 바뀌면 어느 축이 움직였는지
// 실패 메시지로 바로 드러나게 못 박아 둔다.
test('축이 갈리는 조합 3개가 현행 그대로다', () => {
  const completion = stageDefinitionById('editor.completion');
  assert.equal(completion.modelGroup, 'repair');
  assert.equal(temperatureForSampling(completion.sampling, SENTINEL_CONFIG), TEMPERATURE_SENTINELS.geminiTemperatureEditor);

  const factCheckRepair = stageDefinitionById('fact_checker.repair');
  assert.equal(factCheckRepair.modelGroup, 'factcheck');
  assert.equal(factCheckRepair.statusRole, 'repair');

  const repairJudge = stageDefinitionById('editor.repair.public_article_judge');
  assert.equal(repairJudge.modelGroup, 'judge');
  assert.equal(repairJudge.statusRole, 'repair');
});

// 진단 조회는 label 문자열 exact 일치다. 그래서 orchestrator-artifact-writers.js:25의
// getLlmModelUsage(options.stage || 'editor')는 항상 빗나간다 -- 어떤 호출자도 options.stage를
// 넘기지 않고, 리터럴 'editor'는 기록 키인 'editor attempt 1/2'와 같지 않다.
// 여기서는 고치지 않고 현행 동작으로 기록만 한다. 실제 수정은 #982에서 기본값을 제거하며 한다.
test('진단 model usage 조회는 label exact 일치이고, 리터럴 editor는 항상 빗나간다', () => {
  const diagnostics = createDiagnosticsState();
  diagnostics.recordSuccess('editor attempt 1/2', 'gemini-3.5-flash');

  assert.equal(diagnostics.getModelUsage('editor attempt 1/2'), 'gemini-3.5-flash');
  assert.equal(diagnostics.getModelUsage('editor'), '');
});
