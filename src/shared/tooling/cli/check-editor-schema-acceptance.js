#!/usr/bin/env node

// editor 단계가 쓰는 세 모델이 현재 editorSchema를 실제로 받아주는지 라이브로 재는 도구입니다.
//
// 왜 필요한가: Gemini의 constrained decoding은 응답 스키마의 "상태 수"가 많으면 호출 자체를
// 거부합니다(too many states). 이 한계는 문서로 공표된 수치가 없어서 코드를 읽어 예측할 수
// 없고, 모델이 업데이트되면 조용히 달라집니다. 그래서 스키마를 손댈 때마다 실측으로만
// 확인할 수 있습니다.
//
// 왜 세 모델 전부인가: primary(gemini-3.5-flash)가 거부하면 editor 단계가 통째로 막히고,
// fallback 둘이 거부하면 primary가 503으로 죽는 주에 발행이 막힙니다. 그래서 한 모델이라도
// 거부하면 실패로 봅니다.
//
// 판정을 흐리는 함정이 하나 있습니다. 503·429 같은 일시 장애도 예외로 오는데, 이것을
// "스키마 거부"로 세면 멀쩡한 스키마를 되돌리게 됩니다. 그래서 스키마 거부와 장애를
// 나눠서 세고, 장애는 "확인 못 함"으로 따로 보고합니다.

const geminiProvider = require('../../llm/providers/gemini-provider');
const runtimeConfig = require('../../common/runtime-config');
const { editorSchema } = require('../../../generator/render/newsletter-schema');

// editor 단계의 primary + fallback 둘. runtime-config의 editor 라우팅과 같은 집합입니다.
const EDITOR_SCHEMA_ACCEPTANCE_MODELS = Object.freeze([
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite'
]);

// 스키마를 거부할 때 오는 응답과, 그냥 서버가 아플 때 오는 응답을 나눕니다.
const SCHEMA_REJECTION_PATTERNS = [
  /too many states/i,
  /invalid json payload/i,
  /invalid argument/i,
  /response ?schema/i,
  /\b400\b/
];
const TRANSIENT_PATTERNS = [
  /\b429\b/,
  /\b(500|502|503|504)\b/,
  /rate limit/i,
  /quota/i,
  /unavailable/i,
  /deadline exceeded/i,
  /timeout/i
];

const PROBE_SYSTEM_INSTRUCTION = 'Reply with the smallest possible valid JSON object for the given schema.';
const PROBE_PROMPT = 'Schema acceptance probe. Do not write real newsletter content.';

function classifyProbeError(error) {
  const message = String(error?.message || error || '');
  if (TRANSIENT_PATTERNS.some(pattern => pattern.test(message))) {
    return { schemaRejected: false, message };
  }
  if (SCHEMA_REJECTION_PATTERNS.some(pattern => pattern.test(message))) {
    return { schemaRejected: true, message };
  }
  // 분류가 안 되면 스키마 탓으로 단정하지 않습니다. 단정하면 멀쩡한 스키마를 되돌리게 됩니다.
  return { schemaRejected: false, message };
}

async function probeSchemaAcceptance({
  provider = geminiProvider,
  models = EDITOR_SCHEMA_ACCEPTANCE_MODELS,
  schema = editorSchema,
  config = runtimeConfig,
  env = process.env,
  options = {}
} = {}) {
  const apiKey = provider.getApiKey({ options, env, config });
  if (!apiKey) throw new Error(provider.missingCredentialMessage);

  const results = [];
  for (const modelName of models) {
    try {
      const context = provider.createModelContext({ modelName, apiKey, config, options });
      const built = provider.buildRequest({
        model: modelName,
        stage: 'editor',
        systemInstruction: PROBE_SYSTEM_INSTRUCTION,
        prompt: PROBE_PROMPT,
        responseSchema: schema,
        config
      });
      await provider.execute({ context, request: built.request || built });
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
  const results = await probeSchemaAcceptance();
  const summary = summarizeAcceptance(results);
  console.log(summary.text);
  if (!summary.ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(error => {
    console.error(`editor schema 수용 실측을 실행하지 못했습니다: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  EDITOR_SCHEMA_ACCEPTANCE_MODELS,
  classifyProbeError,
  probeSchemaAcceptance,
  summarizeAcceptance
};
