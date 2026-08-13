'use strict';

// LLM merge contract for weekly duplicate articles (#489). buildWeeklyMergeResolver wires the
// newsroom LLM client (callLlmJson) and an article validator into the { mergeDuplicate, validateMerged }
// pair consumed by resolveWeeklyArticles. The LLM receives both the existing and the new article and
// returns append | merge | reject; merged output keeps source evidence traceable. Kept separate from
// resolveWeeklyArticles so the orchestration logic stays pure and unit-testable without a real model.

const WEEKLY_MERGE_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['decision', 'reason'],
  properties: {
    decision: { type: 'string', enum: ['append', 'merge', 'reject'] },
    target_article_id: { type: 'string' },
    reason: { type: 'string' },
    mergedArticle: { type: 'object' }
  }
};

const WEEKLY_MERGE_SYSTEM_INSTRUCTION = [
  '당신은 주간(weekly) 뉴스레터의 중복 기사 병합 결정을 내리는 editor입니다.',
  '같은 주(weekly newsletter) 안의 기존 기사(existing_article)와 새 기사(new_article)가 주어집니다.',
  'decision은 다음 중 하나입니다.',
  '- append: 서로 다른 별개 기사이면 둘 다 유지합니다(예: 같은 release-note 페이지의 서로 다른 버전).',
  '- merge: 같은 주제/사건이면 새 기사의 검증된 새 정보만 기존 기사에 병합한 mergedArticle을 만듭니다.',
  '- reject: 새 정보가 없으면 새 기사를 버립니다.',
  'merge일 때 mergedArticle은 기존 기사의 올바른 내용을 보존해야 합니다.',
  // #870: 채택 전 검증기가 "병합 결과의 출처 = 원본 두 기사 출처의 합집합"을 강제한다.
  // 지시문이 출처 교체를 허용하면 LLM이 규칙대로 답해도 거부돼 병합 경로가 닫힌다.
  'source evidence는 existing_article과 new_article의 sources를 모두 그대로 이어받아야 합니다.',
  'sources에서 URL을 빼거나 두 기사에 없던 URL을 새로 넣으면 그 병합은 거부됩니다.',
  'public_article.source_links도 그 sources 안의 URL만 인용해야 합니다.',
  '확실하지 않으면 append를 선택하세요. 새로운 사실을 지어내지 마세요.'
].join('\n');

function buildWeeklyMergeResolver({ callLlmJson, stage = 'weekly-merge', validateMergedArticle } = {}) {
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
