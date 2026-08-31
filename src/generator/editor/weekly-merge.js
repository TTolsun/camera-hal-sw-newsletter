'use strict';
const { LLM_STAGES, stageRun } = require('../../shared/llm/stage-catalog');

// LLM merge contract for weekly duplicate articles (#489). buildWeeklyMergeResolver wires the
// newsroom LLM client (callLlmJson) and an article validator into the { mergeDuplicate, validateMerged }
// pair consumed by resolveWeeklyArticles. The LLM receives both the existing and the new article and
// returns append | merge | reject; the model authors only the merged prose (public_article) because
// resolveWeeklyArticles builds the adopted section deterministically around it (#870). Kept separate
// from resolveWeeklyArticles so the orchestration logic stays pure and unit-testable without a real model.

const { publicArticleSchema } = require('../render/newsletter-schema');

// 타입 표기는 저장소의 다른 response schema(newsletter-schema.js)와 같은 Gemini Type 이름을 쓴다.
// 여기만 소문자였는데, 그 모양으로 실제 API를 호출해 본 적이 없다.
const WEEKLY_MERGE_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  required: ['decision', 'reason'],
  properties: {
    decision: { type: 'STRING', enum: ['append', 'merge', 'reject'] },
    target_article_id: { type: 'STRING' },
    reason: { type: 'STRING' },
    // #870: 채택되는 section은 기존 기사에서 결정론적으로 만들어지고 모델이 쓰는 것은 산문뿐이다.
    // public_article 모양은 editor가 쓰는 정의를 그대로 재사용한다 — 여기서 따로 적으면
    // 채택 게이트(validatePublicArticle)가 요구하는 계약과 갈라진다.
    mergedArticle: {
      type: 'OBJECT',
      required: ['public_article'],
      properties: {
        public_article: publicArticleSchema
      }
    }
  }
};

const WEEKLY_MERGE_SYSTEM_INSTRUCTION = [
  '당신은 주간(weekly) 뉴스레터의 중복 기사 병합 결정을 내리는 editor입니다.',
  '같은 주(weekly newsletter) 안의 기존 기사(existing_article)와 새 기사(new_article)가 주어집니다.',
  'decision은 다음 중 하나입니다.',
  '- append: 서로 다른 별개 기사이면 둘 다 유지합니다(예: 같은 release-note 페이지의 서로 다른 버전).',
  '- merge: 같은 주제/사건이면 새 기사의 검증된 새 정보만 기존 기사에 병합한 mergedArticle을 만듭니다.',
  '- reject: 새 정보가 없으면 새 기사를 버립니다.',
  // #870: 채택되는 section은 existing_article에서 결정론적으로 만들어진다. 모델에게 section
  // 전체를 쓰게 하면 검증받지 않은 이미지 URL이 들어오거나, 반대로 이미지 필드를 빠뜨려
  // 기존 기사가 이미 해석해 둔 이미지를 잃는다.
  'merge일 때 mergedArticle에는 public_article 하나만 담습니다.',
  '이미지·분류·sources 같은 나머지 필드는 시스템이 existing_article에서 그대로 이어받으므로 쓰지 마세요.',
  // 채택 전 검증기가 "발행되는 인용 = 두 기사가 인용하던 URL의 합집합"을 강제한다.
  // 지시문이 인용 교체를 허용하면 LLM이 규칙대로 답해도 거부돼 병합 경로가 닫힌다.
  'public_article.source_links에는 existing_article과 new_article이 각각 public_article.source_links로',
  '인용하던 URL이 하나도 빠짐없이 모두 들어가야 합니다.',
  '두 기사에 없던 URL을 인용하면 그 병합은 거부됩니다.',
  // 게이트는 story 계약 필드가 모두 있어야 통과한다. 프롬프트가 이걸 요구하지 않으면
  // 대부분의 실제 병합이 계약 불일치로 떨어진다.
  'public_article에는 headline, lead, body_paragraphs(2문단 이상), camera_hal_takeaway,',
  'reader_checkpoints, source_links, source_subtitle, editorial_story(6개 항목 전부),',
  'story_contract_version을 모두 채웁니다.',
  'story_contract_version은 existing_article의 public_article.story_contract_version과 같은 값을 씁니다.',
  '확실하지 않으면 append를 선택하세요. 새로운 사실을 지어내지 마세요.'
].join('\n');

function buildWeeklyMergeResolver({ callLlmJson, stage = stageRun(LLM_STAGES.WEEKLY_MERGE), validateMergedArticle } = {}) {
  if (typeof callLlmJson !== 'function') return {};
  const mergeDuplicate = async ({ existing, incoming, reason }) => {
    const prompt = JSON.stringify({
      detection_reason: reason,
      existing_article: existing,
      new_article: incoming
    });
    return callLlmJson(stage, WEEKLY_MERGE_SYSTEM_INSTRUCTION, prompt, WEEKLY_MERGE_RESPONSE_SCHEMA, { temperature: 0 });
  };
  return {
    mergeDuplicate,
    validateMerged: typeof validateMergedArticle === 'function' ? validateMergedArticle : undefined
  };
}

module.exports = {
  WEEKLY_MERGE_RESPONSE_SCHEMA,
  WEEKLY_MERGE_SYSTEM_INSTRUCTION,
  buildWeeklyMergeResolver
};
