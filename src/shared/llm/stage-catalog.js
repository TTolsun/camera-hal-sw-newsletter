'use strict';

// LLM stage catalog (#981).
//
// stage 정체성을 사람이 읽는 자유 문자열 대신 정적 정의(definition)로 소유한다. 예전에는
// "editor completion attempt 1/3" 같은 label을 model-policy, provider의 temperature/thinking,
// status tracker, judge artifact scope가 각자 정규식으로 다시 해석했고, 분기 순서가 달라
// 같은 호출이 축마다 다른 답을 받았다(#980이 그 현행 결과를 표로 고정해 두었다).
//
// 두 개념을 분리한다.
//
// - definition: 정적 정의. id, model group, sampling profile, status role.
// - run: 실행 인스턴스. quality attempt, 부모 run, 사람이 읽는 label.
//
// run은 논리적 LLM 호출 하나당 한 번 만들고, 진단·아티팩트 조회까지 같은 객체를 재사용한다.
//
// sampling은 provider별 config field 이름(geminiTemperatureJudge 같은)이 아니라 의미 기반
// profile을 쓴다. shared catalog가 특정 provider의 config 모양에 묶이면 안 되고, provider가
// profile을 자기 field로 변환해야 stage 예외 분기가 provider에 남지 않는다.
//
// 이 파일은 #980이 고정한 현행 routing을 그대로 옮긴 것이다. 이상해 보이는 조합(예:
// editor completion은 model group이 repair인데 sampling은 editor를 쓴다)도 보존한다.
// 의미 교정은 #979에서 항목별로 한다.

const { LLM_STAGE_GROUPS, assertLlmStageGroup } = require('./model-policy');

// temperature profile 어휘. provider가 자기 config field로 변환한다.
const TEMPERATURE_PROFILES = Object.freeze({
  DEFAULT: 'default',
  SOURCE_DISCOVERY: 'sourceDiscovery',
  REPORTER: 'reporter',
  EDITOR: 'editor',
  FACTCHECK: 'factcheck',
  REPAIR: 'repair',
  JUDGE: 'judge'
});

// thinking profile 어휘. DISABLED는 "이 stage는 thinking을 쓰지 않는다"는 명시적 선언이다.
// 누락이나 null과 구분하기 위해 값으로 둔다.
const THINKING_PROFILES = Object.freeze({
  DISABLED: 'disabled',
  REPORTER: 'reporter',
  EDITOR: 'editor',
  FACTCHECK: 'factcheck',
  REPAIR: 'repair',
  JUDGE: 'judge'
});

const TEMPERATURE_PROFILE_VALUES = Object.freeze(Object.values(TEMPERATURE_PROFILES));
const THINKING_PROFILE_VALUES = Object.freeze(Object.values(THINKING_PROFILES));

// label 종류. 현행 label을 byte 단위로 재현하기 위한 최소 구분이다.
// - ATTEMPT: `<prefix> attempt <qualityAttempt>/<totalAttempts>`
// - STATIC:  고정 문자열. quality attempt 루프 밖에서 실행되는 stage.
// - DERIVED: `<부모 label> <suffix>`
const LABEL_KINDS = Object.freeze({
  ATTEMPT: 'attempt',
  STATIC: 'static',
  DERIVED: 'derived'
});

function assertTemperatureProfile(profile) {
  if (!TEMPERATURE_PROFILE_VALUES.includes(profile)) {
    throw new Error(`unknown_temperature_profile: ${String(profile)}`);
  }
  return profile;
}

function assertThinkingProfile(profile) {
  if (!THINKING_PROFILE_VALUES.includes(profile)) {
    throw new Error(`unknown_thinking_profile: ${String(profile)}`);
  }
  return profile;
}

function defineStage(spec) {
  assertLlmStageGroup(spec.modelGroup);
  assertTemperatureProfile(spec.sampling.temperatureProfile);
  assertThinkingProfile(spec.sampling.thinkingProfile);
  if (!spec.id) throw new Error('stage definition requires an id');
  if (!spec.statusRole) throw new Error(`stage definition requires a statusRole: ${spec.id}`);
  if (spec.label.kind === LABEL_KINDS.DERIVED && !spec.label.parentId) {
    throw new Error(`derived stage definition requires a parentId: ${spec.id}`);
  }
  return Object.freeze({
    id: spec.id,
    modelGroup: spec.modelGroup,
    sampling: Object.freeze({ ...spec.sampling }),
    statusRole: spec.statusRole,
    label: Object.freeze({ ...spec.label })
  });
}

// 판정 계열 stage는 부모별로 정의가 따로 있다. 키가 겹치는 문제만이 아니라, 부모에 따라
// status role과 artifact scope가 실제로 달라 정책 단위 자체가 다르기 때문이다. 부모가 셋인
// 이유는 orchestrator-repair-completion.js가 editorStage 자리에 repair stage(:313)와
// completion stage(:480)를 넣어 판정을 돌리기 때문이다.
const JUDGE_FAMILY = [
  {
    parent: { id: 'editor', key: 'EDITOR' },
    semanticRepairStatusRole: 'repair',
    judgeStatusRole: 'judge',
    judgeRepairStatusRole: 'repair'
  },
  {
    parent: { id: 'editor.repair', key: 'EDITOR_REPAIR' },
    semanticRepairStatusRole: 'repair',
    // 부모 label에 repair가 들어 있어 status tracker가 judge보다 repair를 먼저 잡는다.
    judgeStatusRole: 'repair',
    judgeRepairStatusRole: 'repair'
  },
  {
    parent: { id: 'editor.completion', key: 'EDITOR_COMPLETION' },
    semanticRepairStatusRole: 'repair',
    judgeStatusRole: 'judge',
    judgeRepairStatusRole: 'repair'
  }
];

const BASE_STAGES = {
  REPORTER: defineStage({
    id: 'reporter',
    modelGroup: LLM_STAGE_GROUPS.REPORTER,
    sampling: {
      temperatureProfile: TEMPERATURE_PROFILES.REPORTER,
      thinkingProfile: THINKING_PROFILES.REPORTER
    },
    statusRole: 'reporter',
    label: { kind: LABEL_KINDS.ATTEMPT, prefix: 'reporter' }
  }),
  EDITOR: defineStage({
    id: 'editor',
    modelGroup: LLM_STAGE_GROUPS.EDITOR,
    sampling: {
      temperatureProfile: TEMPERATURE_PROFILES.EDITOR,
      thinkingProfile: THINKING_PROFILES.EDITOR
    },
    statusRole: 'editor',
    label: { kind: LABEL_KINDS.ATTEMPT, prefix: 'editor' }
  }),
  FACT_CHECKER: defineStage({
    id: 'fact_checker',
    modelGroup: LLM_STAGE_GROUPS.FACTCHECK,
    sampling: {
      temperatureProfile: TEMPERATURE_PROFILES.FACTCHECK,
      thinkingProfile: THINKING_PROFILES.FACTCHECK
    },
    statusRole: 'factcheck',
    label: { kind: LABEL_KINDS.ATTEMPT, prefix: 'fact-checker' }
  }),
  BACKGROUND_CONTEXT: defineStage({
    // model group은 reporter인데 sampling에는 전용 분기가 없어 default temperature와
    // thinking 없음으로 떨어진다(#979 2번).
    id: 'background_context',
    modelGroup: LLM_STAGE_GROUPS.REPORTER,
    sampling: {
      temperatureProfile: TEMPERATURE_PROFILES.DEFAULT,
      thinkingProfile: THINKING_PROFILES.DISABLED
    },
    statusRole: 'background-context',
    label: { kind: LABEL_KINDS.ATTEMPT, prefix: 'background-context' }
  }),
  EDITORIAL_PLAN: defineStage({
    // 전용 model group을 쓰지만 sampling은 judge를 재사용하고 status role은 editor가 된다(#979 3번).
    id: 'editorial_plan',
    modelGroup: LLM_STAGE_GROUPS.EDITORIAL_PLAN,
    sampling: {
      temperatureProfile: TEMPERATURE_PROFILES.JUDGE,
      thinkingProfile: THINKING_PROFILES.JUDGE
    },
    statusRole: 'editor',
    label: { kind: LABEL_KINDS.ATTEMPT, prefix: 'editorial-plan' }
  }),
  EDITOR_REPAIR: defineStage({
    id: 'editor.repair',
    modelGroup: LLM_STAGE_GROUPS.REPAIR,
    sampling: {
      temperatureProfile: TEMPERATURE_PROFILES.REPAIR,
      thinkingProfile: THINKING_PROFILES.REPAIR
    },
    statusRole: 'repair',
    label: { kind: LABEL_KINDS.ATTEMPT, prefix: 'editor repair' }
  }),
  FACT_CHECKER_REPAIR: defineStage({
    // model group은 factcheck인데 status role은 repair로 갈린다.
    id: 'fact_checker.repair',
    modelGroup: LLM_STAGE_GROUPS.FACTCHECK,
    sampling: {
      temperatureProfile: TEMPERATURE_PROFILES.FACTCHECK,
      thinkingProfile: THINKING_PROFILES.FACTCHECK
    },
    statusRole: 'repair',
    label: { kind: LABEL_KINDS.ATTEMPT, prefix: 'fact-checker repair' }
  }),
  EDITOR_COMPLETION: defineStage({
    // model group은 repair인데 sampling은 editor를 쓴다(#979 1번).
    id: 'editor.completion',
    modelGroup: LLM_STAGE_GROUPS.REPAIR,
    sampling: {
      temperatureProfile: TEMPERATURE_PROFILES.EDITOR,
      thinkingProfile: THINKING_PROFILES.EDITOR
    },
    statusRole: 'editor',
    label: { kind: LABEL_KINDS.ATTEMPT, prefix: 'editor completion' }
  }),
  FACT_CHECKER_COMPLETION: defineStage({
    id: 'fact_checker.completion',
    modelGroup: LLM_STAGE_GROUPS.FACTCHECK,
    sampling: {
      temperatureProfile: TEMPERATURE_PROFILES.FACTCHECK,
      thinkingProfile: THINKING_PROFILES.FACTCHECK
    },
    statusRole: 'factcheck',
    label: { kind: LABEL_KINDS.ATTEMPT, prefix: 'fact-checker completion' }
  }),
  WEEKLY_MERGE: defineStage({
    // 예전에는 어느 정규식에도 걸리지 않아 reporter로 조용히 라우팅됐다. 현행 결과를 보존한다(#979 5번).
    id: 'weekly_merge',
    modelGroup: LLM_STAGE_GROUPS.REPORTER,
    sampling: {
      temperatureProfile: TEMPERATURE_PROFILES.DEFAULT,
      thinkingProfile: THINKING_PROFILES.DISABLED
    },
    statusRole: 'weekly-merge',
    label: { kind: LABEL_KINDS.STATIC, text: 'weekly-merge' }
  }),
  POST_GENERATION_QUALITY_JUDGE: defineStage({
    id: 'post_generation_quality_judge',
    modelGroup: LLM_STAGE_GROUPS.JUDGE,
    sampling: {
      temperatureProfile: TEMPERATURE_PROFILES.JUDGE,
      thinkingProfile: THINKING_PROFILES.JUDGE
    },
    statusRole: 'judge',
    label: { kind: LABEL_KINDS.STATIC, text: 'post-generation public quality judge' }
  }),
  SOURCE_DISCOVERY: defineStage({
    // status role이 정해진 어휘가 아니라 label 소문자 값 그대로다. 현행 결과를 보존한다(#979 6번).
    id: 'source_discovery',
    modelGroup: LLM_STAGE_GROUPS.SOURCE_DISCOVERY,
    sampling: {
      temperatureProfile: TEMPERATURE_PROFILES.SOURCE_DISCOVERY,
      thinkingProfile: THINKING_PROFILES.DISABLED
    },
    statusRole: 'sourcediscovery',
    label: { kind: LABEL_KINDS.STATIC, text: 'sourceDiscovery' }
  })
};

const JUDGE_STAGES = {};
JUDGE_FAMILY.forEach((family) => {
  JUDGE_STAGES[`${family.parent.key}_SEMANTIC_REPAIR`] = defineStage({
    id: `${family.parent.id}.semantic_repair`,
    modelGroup: LLM_STAGE_GROUPS.REPAIR,
    sampling: {
      temperatureProfile: TEMPERATURE_PROFILES.REPAIR,
      thinkingProfile: THINKING_PROFILES.REPAIR
    },
    statusRole: family.semanticRepairStatusRole,
    label: { kind: LABEL_KINDS.DERIVED, parentId: family.parent.id, suffix: 'semantic repair' }
  });
  JUDGE_STAGES[`${family.parent.key}_PUBLIC_ARTICLE_JUDGE`] = defineStage({
    id: `${family.parent.id}.public_article_judge`,
    modelGroup: LLM_STAGE_GROUPS.JUDGE,
    sampling: {
      temperatureProfile: TEMPERATURE_PROFILES.JUDGE,
      thinkingProfile: THINKING_PROFILES.JUDGE
    },
    statusRole: family.judgeStatusRole,
    label: { kind: LABEL_KINDS.DERIVED, parentId: family.parent.id, suffix: 'public article judge' }
  });
  JUDGE_STAGES[`${family.parent.key}_PUBLIC_ARTICLE_JUDGE_REPAIR`] = defineStage({
    id: `${family.parent.id}.public_article_judge_repair`,
    modelGroup: LLM_STAGE_GROUPS.JUDGE,
    sampling: {
      temperatureProfile: TEMPERATURE_PROFILES.JUDGE,
      thinkingProfile: THINKING_PROFILES.JUDGE
    },
    statusRole: family.judgeRepairStatusRole,
    label: { kind: LABEL_KINDS.DERIVED, parentId: family.parent.id, suffix: 'public article judge repair' }
  });
});

const LLM_STAGES = Object.freeze({ ...BASE_STAGES, ...JUDGE_STAGES });

const DEFINITIONS_BY_ID = new Map(
  Object.values(LLM_STAGES).map(definition => [definition.id, definition])
);

function stageDefinitionById(id) {
  return DEFINITIONS_BY_ID.get(id) || null;
}

function formatStageLabel(definition, { qualityAttempt, totalAttempts, parentRun }) {
  if (definition.label.kind === LABEL_KINDS.STATIC) {
    return definition.label.text;
  }
  if (definition.label.kind === LABEL_KINDS.DERIVED) {
    return `${parentRun.label} ${definition.label.suffix}`;
  }
  return `${definition.label.prefix} attempt ${qualityAttempt}/${totalAttempts}`;
}

/**
 * 논리적 LLM 호출 하나를 나타내는 run을 만든다. 호출 직전에 그 stage를 실제로 실행하는
 * 모듈이 만들고, 이후 진단·아티팩트 조회까지 같은 객체를 재사용한다.
 *
 * qualityAttempt는 발행 파이프라인의 품질 재시도 회차다. provider가 내부에서 도는 재시도
 * (retry)와 다르기 때문에 attempt라고 부르지 않는다.
 */
function stageRun(definition, { qualityAttempt = 0, totalAttempts = 0, parentRun = null } = {}) {
  if (!definition || !DEFINITIONS_BY_ID.has(definition.id)) {
    throw new Error(`unknown_stage_definition: ${String(definition && definition.id)}`);
  }
  if (definition.label.kind === LABEL_KINDS.DERIVED) {
    if (!parentRun) {
      throw new Error(`derived stage run requires a parentRun: ${definition.id}`);
    }
    if (parentRun.definition.id !== definition.label.parentId) {
      throw new Error(
        `derived stage run parent mismatch: ${definition.id} expects ${definition.label.parentId}, got ${parentRun.definition.id}`
      );
    }
  }

  const effectiveQualityAttempt = definition.label.kind === LABEL_KINDS.DERIVED
    ? parentRun.qualityAttempt
    : Number(qualityAttempt) || 0;
  const effectiveTotalAttempts = definition.label.kind === LABEL_KINDS.DERIVED
    ? parentRun.totalAttempts
    : Number(totalAttempts) || 0;

  return Object.freeze({
    definition,
    qualityAttempt: effectiveQualityAttempt,
    totalAttempts: effectiveTotalAttempts,
    parentRunKey: parentRun ? stageRunKey(parentRun) : null,
    label: formatStageLabel(definition, {
      qualityAttempt: effectiveQualityAttempt,
      totalAttempts: effectiveTotalAttempts,
      parentRun
    })
  });
}

/**
 * 진단·비용 집계의 canonical key. 이 함수 하나만 key 형식을 안다.
 *
 * totalAttempts는 키에 넣지 않는다. 총 재시도 수가 바뀌면 같은 회차의 키가 달라지기
 * 때문이며, 예전 label(`editor attempt 1/2`)이 정확히 그 결함을 갖고 있었다.
 * 총 재시도 수는 label과 관측 metadata에만 남는다.
 */
function stageRunKey(run) {
  if (!run || !run.definition) throw new Error('stageRunKey requires a stage run');
  return `${run.definition.id}#${run.qualityAttempt}`;
}

function isStageRun(value) {
  return Boolean(value && value.definition && DEFINITIONS_BY_ID.has(value.definition.id));
}

/**
 * production boundary 방어. descriptor가 아닌 값(예전 자유 문자열 label)이 들어오면 던진다.
 * 호환 경로를 두지 않는 것이 이 리팩터링의 전제다.
 */
function assertStageRun(value) {
  if (!isStageRun(value)) {
    throw new Error(`expected a stage run from the catalog, got: ${String(value && value.label ? value.label : value)}`);
  }
  return value;
}

module.exports = {
  LABEL_KINDS,
  LLM_STAGES,
  TEMPERATURE_PROFILES,
  THINKING_PROFILES,
  assertStageRun,
  isStageRun,
  stageDefinitionById,
  stageRun,
  stageRunKey
};
