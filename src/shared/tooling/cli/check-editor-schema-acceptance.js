#!/usr/bin/env node

// editor 단계가 쓰는 모델들이 현재 editorSchema를 실제로 받아주는지 라이브로 재는 도구입니다.
//
// 왜 필요한가: Gemini의 constrained decoding은 응답 스키마의 "상태 수"가 많으면 호출 자체를
// 거부합니다(too many states). 이 한계는 공표된 수치가 없어서 코드를 읽어 예측할 수 없고,
// 모델이 업데이트되면 조용히 달라집니다. 그래서 스키마를 손댈 때마다 실측으로만 확인할 수
// 있습니다.
//
// 왜 모델 전부인가: primary가 거부하면 editor 단계가 통째로 막히고, fallback이 거부하면
// primary가 503으로 죽는 주에 발행이 막힙니다. 그래서 하나라도 거부하면 실패로 봅니다.
//
// 실제 발행과 같은 조건으로 재야 의미가 있으므로 아래 넷을 프로덕션과 공유합니다.
//
// 1. 모델 목록 — `configuredModelsForStage(config, 'editor')`. 하드코딩하면 라우팅이 바뀐 뒤
//    쓰이지도 않는 모델을 재고 통과를 보고합니다.
// 2. 설정 — `readRuntimeConfig(env)`. 모듈 네임스페이스를 그대로 넘기면 temperature와
//    thinking 설정이 undefined가 되어 실제 요청과 다른 요청을 재게 됩니다.
// 3. provider — `resolveProvider`. 구체 provider를 직접 부르면 registry 밖 호출 지점이 됩니다.
// 4. 성공 판정 — 응답 텍스트를 꺼내 JSON으로 파싱될 때까지. 200이지만 본문이 비었거나 JSON이
//    아니면 프로덕션에서는 실패인데 여기서만 통과하면 거짓 초록불입니다.
//
// 판정을 흐리는 함정도 있습니다. 503·429 같은 일시 장애와 잘못된 키(400 INVALID_ARGUMENT)도
// 예외로 오는데, 이것을 "스키마 거부"로 세면 멀쩡한 스키마를 되돌리게 됩니다. 스키마 거부
// 판정은 런타임이 쓰는 정본(`isSchemaComplexityError`)을 그대로 재사용하고, 나머지는 전부
// "확인 못 함"으로 따로 셉니다.

const { resolveProvider } = require('../../llm/providers/provider-registry');
const { configuredModelsForStage } = require('../../llm/model-policy');
const { readRuntimeConfig } = require('../../common/runtime-config');
const {
  LlmCallTimeoutError,
  errorText,
  extractJson,
  isSchemaComplexityError
} = require('../../llm/llm-errors');
const { callWithTimeout } = require('../../llm/llm-client');
const { editorSchema } = require('../../../generator/render/newsletter-schema');

const PROBE_STAGE = 'editor';
const PROBE_SYSTEM_INSTRUCTION = 'Reply with the smallest possible valid JSON object for the given schema.';
const PROBE_PROMPT = 'Schema acceptance probe. Do not write real newsletter content.';

// 자격증명·권한 문제는 400으로 오지만 스키마와 무관합니다. 스키마 거부보다 먼저 걸러야
// "키가 잘못됐다"가 "스키마가 거부됐다"로 둔갑하지 않습니다.
const CREDENTIAL_PATTERNS = [
  /api key not valid/i,
  /api_key_invalid/i,
  /permission denied/i,
  /unauthorized/i,
  /unauthenticated/i,
  /\b40[13]\b/
];

// 오류 본문에 자격증명이 섞여 나올 수 있어 그대로 찍지 않습니다. Actions의 secret 마스킹은
// GitHub Secrets를 거칠 때만 걸리고 로컬 실행에는 적용되지 않습니다.
const SECRET_LIKE_PATTERN = /\b(?:AIza[0-9A-Za-z_-]{10,}|sk-[0-9A-Za-z_-]{10,}|[A-Za-z0-9_-]{32,})\b/g;
const KEYED_SECRET_PATTERN = /((?:api[_-]?key|key|token|authorization|bearer)["'\s:=]+)([^\s"',&]+)/gi;
const MAX_REASON_LENGTH = 300;

function editorAcceptanceModels(config) {
  return configuredModelsForStage(config, PROBE_STAGE);
}

function redactReason(value) {
  const text = String(value || '')
    .replace(KEYED_SECRET_PATTERN, '$1[redacted]')
    .replace(SECRET_LIKE_PATTERN, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > MAX_REASON_LENGTH ? `${text.slice(0, MAX_REASON_LENGTH)}…` : text;
}

function classifyProbeError(error) {
  const text = errorText(error);
  if (error instanceof LlmCallTimeoutError) {
    return { schemaRejected: false, message: redactReason(text) };
  }
  if (CREDENTIAL_PATTERNS.some(pattern => pattern.test(text))) {
    return { schemaRejected: false, message: redactReason(text) };
  }
  // 스키마 거부 판정은 런타임이 발행을 막을 때 쓰는 것과 같은 함수여야 합니다.
  // 여기서 따로 정의하면 도구와 런타임의 답이 갈립니다.
  if (isSchemaComplexityError(error)) {
    return { schemaRejected: true, message: redactReason(text) };
  }
  // 분류가 안 되면 스키마 탓으로 단정하지 않습니다. 단정하면 멀쩡한 스키마를 되돌립니다.
  return { schemaRejected: false, message: redactReason(text) };
}

async function probeSchemaAcceptance({
  provider = null,
  models = null,
  schema = editorSchema,
  config = null,
  env = process.env,
  options = {}
} = {}) {
  const resolvedConfig = config || readRuntimeConfig(env);
  const resolvedProvider = provider || resolveProvider(resolvedConfig.llmProvider);
  const resolvedModels = models || editorAcceptanceModels(resolvedConfig);
  const apiKey = resolvedProvider.getApiKey({ options, env, config: resolvedConfig });
  if (!apiKey) throw new Error(resolvedProvider.missingCredentialMessage);

  const results = [];
  for (const modelName of resolvedModels) {
    try {
      const context = resolvedProvider.createModelContext({ modelName, apiKey, config: resolvedConfig, options });
      const built = resolvedProvider.buildRequest({
        model: modelName,
        stage: PROBE_STAGE,
        systemInstruction: PROBE_SYSTEM_INSTRUCTION,
        prompt: PROBE_PROMPT,
        responseSchema: schema,
        config: resolvedConfig
      });
      const response = await callWithTimeout(
        resolvedProvider.execute({ context, request: built.request, modelName, stage: PROBE_STAGE }),
        resolvedConfig.geminiCallTimeoutMs,
        PROBE_STAGE,
        modelName
      );
      // 200을 받았다고 끝이 아닙니다. 프로덕션은 여기까지 통과해야 성공으로 봅니다.
      extractJson(resolvedProvider.textFromResponse(response), PROBE_STAGE, resolvedProvider.displayName);
      results.push({ model: modelName, accepted: true, reason: '' });
    } catch (error) {
      const { schemaRejected, message } = classifyProbeError(error);
      results.push({ model: modelName, accepted: schemaRejected ? false : null, reason: message });
    }
  }
  return results;
}

function summarizeAcceptance(results = []) {
  const accepted = results.filter(item => item.accepted === true);
  const rejected = results.filter(item => item.accepted === false);
  const inconclusive = results.filter(item => item.accepted === null);

  const lines = results.map(item => {
    if (item.accepted === true) return `  수용   ${item.model}`;
    if (item.accepted === false) return `  거부   ${item.model} — ${item.reason}`;
    return `  확인 못 함  ${item.model} — ${item.reason}`;
  });

  const ok = results.length > 0 && rejected.length === 0 && inconclusive.length === 0;
  const headline = ok
    ? `editor schema 수용 실측 통과: ${accepted.length}/${results.length} 모델`
    : `editor schema 수용 실측 실패: 거부 ${rejected.length}건, 확인 못 함 ${inconclusive.length}건`;

  return {
    ok,
    acceptedCount: accepted.length,
    rejectedCount: rejected.length,
    inconclusiveCount: inconclusive.length,
    results,
    text: [headline, ...lines].join('\n')
  };
}

async function main() {
  const config = readRuntimeConfig(process.env);
  console.log(`editor schema 수용 실측 대상: ${editorAcceptanceModels(config).join(', ')}`);
  const summary = summarizeAcceptance(await probeSchemaAcceptance({ config }));
  console.log(summary.text);
  if (!summary.ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(error => {
    console.error(`editor schema 수용 실측을 실행하지 못했습니다: ${redactReason(errorText(error))}`);
    process.exitCode = 1;
  });
}

module.exports = {
  classifyProbeError,
  editorAcceptanceModels,
  probeSchemaAcceptance,
  redactReason,
  summarizeAcceptance
};
