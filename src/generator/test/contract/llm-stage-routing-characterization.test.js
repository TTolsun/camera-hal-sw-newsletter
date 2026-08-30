const assert = require('node:assert/strict');
const test = require('node:test');

const { modelGroupInfoForStage } = require('../../../shared/llm/model-policy');
const { temperatureForStage, thinkingBudgetForStage } = require('../../../shared/llm/providers/gemini-provider');
const { createDiagnosticsState } = require('../../../shared/llm/llm-diagnostics');
const { roleFromStageLabel } = require('../../select/stage-status-tracker');
const { publicArticleJudgeArtifactScope } = require('../../publish/orchestrator-judge-helpers');

// LLM stage routing characterization (#980).
//
// stage 정체성은 지금 사람이 읽는 자유 문자열 label 하나로 표현되고, 아래 다섯 resolver가
// 그 문자열을 각자 정규식으로 해석해 model group, temperature, thinking budget, status role,
// artifact scope를 유도한다. 분기 순서가 resolver마다 달라 같은 label이 축마다 다른 답을 받는다.
//
// 이 파일은 그 현행 결과를 있는 그대로 고정한다. 여기 적힌 값이 곧 "옳은 값"이라는 뜻은
// 아니다. 이상해 보이는 조합(예: editor completion은 model group이 repair인데 temperature는
// editor를 쓴다)도 그대로 기록해 두는 것이 목적이다. 그래야 #981(stage descriptor catalog
// 도입)이 routing을 바꾸지 않았음을 이 표 한 장으로 증명할 수 있다.
//
// 표에서 드러난 의심 항목의 의도 결정은 #979 umbrella에서 항목별로 다룬다.
// 이 파일은 프로덕션 코드를 바꾸지 않는다.

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
    modelGroup: 'reporter',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureReporter',
    thinkingField: 'geminiThinkingBudgetReporter',
    statusRole: 'reporter',
    artifactScope: 'editor'
  },
  {
    label: 'editor attempt 1/2',
    modelGroup: 'editor',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureEditor',
    thinkingField: 'geminiThinkingBudgetEditor',
    statusRole: 'editor',
    artifactScope: 'editor'
  },
  {
    label: 'fact-checker attempt 1/2',
    modelGroup: 'factcheck',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureFactcheck',
    thinkingField: 'geminiThinkingBudgetFactcheck',
    statusRole: 'factcheck',
    artifactScope: 'editor'
  },
  {
    // temperature/thinking 어느 쪽에도 background-context 분기가 없다.
    label: 'background-context attempt 1/2',
    modelGroup: 'reporter',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureDefault',
    thinkingField: NO_THINKING_MAPPING,
    statusRole: 'background-context',
    artifactScope: 'editor'
  },
  {
    // model group은 전용 그룹인데 sampling은 judge를 재사용하고 status role은 editor가 된다.
    label: 'editorial-plan attempt 1/2',
    modelGroup: 'editorialPlan',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureJudge',
    thinkingField: 'geminiThinkingBudgetJudge',
    statusRole: 'editor',
    artifactScope: 'editor'
  },
  {
    label: 'editor repair attempt 1/2',
    modelGroup: 'repair',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureRepair',
    thinkingField: 'geminiThinkingBudgetRepair',
    statusRole: 'repair',
    artifactScope: 'targeted-repair'
  },
  {
    // model group은 factcheck, status role은 repair로 갈린다.
    label: 'fact-checker repair attempt 1/2',
    modelGroup: 'factcheck',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureFactcheck',
    thinkingField: 'geminiThinkingBudgetFactcheck',
    statusRole: 'repair',
    artifactScope: 'editor'
  },
  {
    // model group은 repair인데 temperature/thinking은 editor를 쓴다.
    label: 'editor completion attempt 1/2',
    modelGroup: 'repair',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureEditor',
    thinkingField: 'geminiThinkingBudgetEditor',
    statusRole: 'editor',
    artifactScope: 'completion'
  },
  {
    label: 'fact-checker completion attempt 1/2',
    modelGroup: 'factcheck',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureFactcheck',
    thinkingField: 'geminiThinkingBudgetFactcheck',
    statusRole: 'factcheck',
    artifactScope: 'completion'
  },
  {
    // 어느 정규식에도 걸리지 않아 reporter로 기본 라우팅되고 경고만 남는다.
    label: 'weekly-merge',
    modelGroup: 'reporter',
    known: false,
    warning: 'unknown_stage_defaulted_to_reporter',
    temperatureField: 'geminiTemperatureDefault',
    thinkingField: NO_THINKING_MAPPING,
    statusRole: 'weekly-merge',
    artifactScope: 'editor'
  },
  {
    label: 'post-generation public quality judge',
    modelGroup: 'judge',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureJudge',
    thinkingField: 'geminiThinkingBudgetJudge',
    statusRole: 'judge',
    artifactScope: 'editor'
  },
  {
    // status role은 정해진 role이 아니라 label을 소문자로 바꾼 값이 그대로 나온다.
    label: 'sourceDiscovery',
    modelGroup: 'sourceDiscovery',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureSourceDiscovery',
    thinkingField: NO_THINKING_MAPPING,
    statusRole: 'sourcediscovery',
    artifactScope: 'editor'
  },

  // --- 파생 stage 9개 (부모 3 x 판정 3) ---
  {
    label: 'editor attempt 1/2 semantic repair',
    modelGroup: 'repair',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureRepair',
    thinkingField: 'geminiThinkingBudgetRepair',
    statusRole: 'repair',
    artifactScope: 'editor'
  },
  {
    label: 'editor attempt 1/2 public article judge',
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
    modelGroup: 'repair',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureRepair',
    thinkingField: 'geminiThinkingBudgetRepair',
    statusRole: 'repair',
    artifactScope: 'targeted-repair'
  },
  {
    // 부모가 editor repair면 같은 판정 stage의 status role이 judge가 아니라 repair가 된다.
    label: 'editor repair attempt 1/2 public article judge',
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
    modelGroup: 'repair',
    known: true,
    warning: '',
    temperatureField: 'geminiTemperatureRepair',
    thinkingField: 'geminiThinkingBudgetRepair',
    statusRole: 'repair',
    artifactScope: 'completion'
  },
  {
    label: 'editor completion attempt 1/2 public article judge',
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

test('stage label -> model group 현행 매핑', () => {
  PRODUCTION_STAGE_CASES.forEach((stageCase) => {
    const info = modelGroupInfoForStage(stageCase.label);
    assert.equal(info.group, stageCase.modelGroup, `model group mismatch: ${stageCase.label}`);
    assert.equal(info.known, stageCase.known, `known mismatch: ${stageCase.label}`);
    assert.equal(info.warning, stageCase.warning, `warning mismatch: ${stageCase.label}`);
  });
});

test('stage label -> temperature config field 현행 매핑', () => {
  PRODUCTION_STAGE_CASES.forEach((stageCase) => {
    const expected = TEMPERATURE_SENTINELS[stageCase.temperatureField];
    assert.equal(typeof expected, 'number', `unknown temperature field: ${stageCase.temperatureField}`);
    assert.equal(
      temperatureForStage(stageCase.label, SENTINEL_CONFIG),
      expected,
      `temperature mismatch: ${stageCase.label}`
    );
  });
});

test('stage label -> thinking budget config field 현행 매핑', () => {
  PRODUCTION_STAGE_CASES.forEach((stageCase) => {
    const actual = thinkingBudgetForStage(stageCase.label, SENTINEL_CONFIG);
    if (stageCase.thinkingField === NO_THINKING_MAPPING) {
      assert.equal(actual, 0, `thinking budget mismatch (매핑 없음 기대): ${stageCase.label}`);
      return;
    }
    const expected = THINKING_SENTINELS[stageCase.thinkingField];
    assert.equal(typeof expected, 'number', `unknown thinking field: ${stageCase.thinkingField}`);
    assert.equal(actual, expected, `thinking budget mismatch: ${stageCase.label}`);
  });
});

test('stage label -> status role 현행 매핑', () => {
  PRODUCTION_STAGE_CASES.forEach((stageCase) => {
    assert.equal(
      roleFromStageLabel(stageCase.label),
      stageCase.statusRole,
      `status role mismatch: ${stageCase.label}`
    );
  });
});

test('stage label -> public article judge artifact scope 현행 매핑', () => {
  PRODUCTION_STAGE_CASES.forEach((stageCase) => {
    assert.equal(
      publicArticleJudgeArtifactScope(stageCase.label),
      stageCase.artifactScope,
      `artifact scope mismatch: ${stageCase.label}`
    );
  });
});

// 같은 label이 축마다 다른 답을 받는 조합을 따로 못 박아 둔다. 위 표에서 이미 검증되지만,
// #981이 이 조합을 "무심코" 바꾸면 어느 축이 움직였는지 실패 메시지로 바로 드러나게 한다.
test('축이 갈리는 조합 3개가 현행 그대로다', () => {
  assert.equal(modelGroupInfoForStage('editor completion attempt 1/2').group, 'repair');
  assert.equal(temperatureForStage('editor completion attempt 1/2', SENTINEL_CONFIG), TEMPERATURE_SENTINELS.geminiTemperatureEditor);

  assert.equal(modelGroupInfoForStage('fact-checker repair attempt 1/2').group, 'factcheck');
  assert.equal(roleFromStageLabel('fact-checker repair attempt 1/2'), 'repair');

  assert.equal(modelGroupInfoForStage('editor repair attempt 1/2 public article judge').group, 'judge');
  assert.equal(roleFromStageLabel('editor repair attempt 1/2 public article judge'), 'repair');
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
