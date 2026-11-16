'use strict';

// #1380: 공개 기사 문체를 재는 참고 지표입니다.
// 이 모듈은 숫자만 계산합니다. 발행 판정, 점수 차감, 관문에는 연결하지 않습니다.
// 호출하는 쪽(quality report)이 이 값을 "참고 지표"로만 싣도록 하는 것이 계약입니다.

const LONG_SENTENCE_LENGTH = 120;

// 번역투 후보로 세는 표현은 이슈 #1380에서 허용한 패턴으로 한정합니다.
// 필요한 표현까지 오탐하므로 개수만 세고 문장을 고치거나 막지 않습니다.
const TRANSLATIONESE_PATTERNS = [
  { key: 'about', label: '~에 대해', pattern: /에\s*대(?:해|하여|한)/g },
  { key: 'through', label: '~를 통해', pattern: /[을를]\s*통(?:해|하여|한)/g },
  { key: 'in_terms_of', label: '~에 있어', pattern: /에\s*있어(?:서)?/g },
  { key: 'double_passive', label: '~되어진다', pattern: /되어\s*(?:진다|졌|지는|져)/g },
  { key: 'for_purpose', label: '~을 위해', pattern: /(?:을|를)?\s*위(?:해|하여)/g },
  // 연결어미 바로 뒤의 쉼표입니다. 예: "수정했으며, ..."
  { key: 'comma_after_connective', label: '연결어미 뒤 쉼표', pattern: /(?:하며|하고|이며|이고|지만|으나|하여|해서|므로|면서|는데|으며|으로써),/g }
];

// lead 첫 절이 "~위해/~하도록"으로 끝나면 목적절로 시작한 문장으로 봅니다.
const PURPOSE_CLAUSE_ENDING = /(?:위해|위하여|도록)$/;
const FIRST_CLAUSE_MAX_LENGTH = 60;

function toText(value) {
  return typeof value === 'string' ? value : '';
}

// 소제목, 코드 블록, 코드 스팬, 링크 주소는 문장 길이를 왜곡하므로 먼저 걷어냅니다.
function stripNonProse(markdown) {
  return toText(markdown)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s.*$/gm, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '');
}

function splitSentences(markdown) {
  return stripNonProse(markdown)
    .split(/\n+/)
    .flatMap(line => line.split(/(?<=[.!?。])\s+/))
    .map(sentence => sentence.replace(/\s+/g, ' ').trim())
    .filter(sentence => sentence.length > 0);
}

function firstClause(sentence) {
  const head = sentence.slice(0, FIRST_CLAUSE_MAX_LENGTH);
  const commaIndex = head.indexOf(',');
  return commaIndex >= 0 ? head.slice(0, commaIndex) : head;
}

function startsWithPurposeClause(lead) {
  const [sentence] = splitSentences(lead);
  if (!sentence) return false;
  return PURPOSE_CLAUSE_ENDING.test(firstClause(sentence).trim());
}

function countMatches(source, pattern) {
  return (source.match(pattern) || []).length;
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function articleProseFields(section) {
  const article = section && typeof section === 'object' ? section.public_article || {} : {};
  return {
    lead: toText(article.lead),
    prose: [article.lead, article.body_markdown, article.camera_hal_takeaway].map(toText).join('\n')
  };
}

// sections: 각 기사에 public_article.{lead, body_markdown, camera_hal_takeaway}가 있는 배열.
function measureProseStyle(sections) {
  const articles = (Array.isArray(sections) ? sections : []).map(articleProseFields);
  const sentences = articles.flatMap(article => splitSentences(article.prose));
  const proseText = sentences.join('\n');
  const totalLength = sentences.reduce((sum, sentence) => sum + sentence.length, 0);
  const longCount = sentences.filter(sentence => sentence.length > LONG_SENTENCE_LENGTH).length;
  const leads = articles.filter(article => article.lead.trim());
  const purposeLeadCount = leads.filter(article => startsWithPurposeClause(article.lead)).length;

  const translationese = {};
  for (const { key, pattern } of TRANSLATIONESE_PATTERNS) {
    translationese[key] = countMatches(proseText, pattern);
  }

  return {
    reference_only: true,
    long_sentence_threshold: LONG_SENTENCE_LENGTH,
    article_count: articles.length,
    sentence_count: sentences.length,
    avg_sentence_length: sentences.length ? round(totalLength / sentences.length) : 0,
    long_sentence_count: longCount,
    long_sentence_ratio: sentences.length ? round(longCount / sentences.length, 3) : 0,
    lead_count: leads.length,
    purpose_clause_lead_count: purposeLeadCount,
    purpose_clause_lead_ratio: leads.length ? round(purposeLeadCount / leads.length, 3) : 0,
    translationese_counts: translationese
  };
}

function proseStyleMarkdown(metrics) {
  if (!metrics || !metrics.sentence_count) return '- 측정할 문장이 없습니다.';
  const translationese = TRANSLATIONESE_PATTERNS
    .map(({ key, label }) => `${label} ${metrics.translationese_counts?.[key] ?? 0}`)
    .join(', ');
  return [
    `- 평균 문장 길이: ${metrics.avg_sentence_length}자 (문장 ${metrics.sentence_count}개)`,
    `- ${metrics.long_sentence_threshold}자 초과 문장: ${metrics.long_sentence_count}개 (${round(metrics.long_sentence_ratio * 100)}%)`,
    `- 목적절로 시작한 lead: ${metrics.purpose_clause_lead_count}/${metrics.lead_count}`,
    `- 번역투 후보: ${translationese}`,
    '- 이 지표는 참고용이며 발행 판정과 점수에 영향을 주지 않습니다.'
  ].join('\n');
}

module.exports = {
  LONG_SENTENCE_LENGTH,
  TRANSLATIONESE_PATTERNS,
  splitSentences,
  startsWithPurposeClause,
  measureProseStyle,
  proseStyleMarkdown
};
