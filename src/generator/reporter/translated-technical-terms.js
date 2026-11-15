'use strict';

// 영어 번역문에서 공개 기사 누출 검사가 걸린 용어가 한국어 원문 대응어를 충실히 옮긴 카메라 기술 용어인지 판정한다.
// 번역 검사(translate/translation-checks.js)와 validate:public의 translation.en.json 검사가 같은 판정을 쓰도록
// 누출 규칙(public-prose-leakage.js) 옆에 둔다. 한국어판 누출 검사(publicProseLeakageIssues)는 바꾸지 않는다.
const { publicProseLeakageIssues } = require('./public-prose-leakage');

// 공개 기사 계약의 내부 용어 금지어 중 카메라 기술 용어로도 쓰이는 것만 둔 고정 표다. 한국어 원문이 왼쪽 용어의
// 한국어 대응어를 쓰면 그 번역은 새로 끼워 넣은 내부 용어가 아니라 원문을 옮긴 것이다(2026-W47: 폴백 → fallback,
// 검사기 → validators). 한국어판은 한국어 낱말이라 이 영어 규칙을 피했을 뿐이다. 'Review-only', 'publish gate',
// 'candidate shortage' 같은 순수 파이프라인 용어는 원문과 무관하게 계속 막아야 하므로 넣지 않는다.
const KOREAN_COUNTERPARTS = Object.freeze({
  fallback: ['폴백'],
  validator: ['검사기', '검증기', '밸리데이터']
});

// 문맥 금지어는 같은 문장·근처의 marker(internal 등)와 함께 걸린다. 일반 기술 문장에서도 자연스러운 marker만
// 한국어 대응어와 함께 둔다. debug, schema, pipeline, report, output, gate, policy, contract, public_article
// 같은 marker는 일부러 넣지 않아 원문과 무관하게 계속 막는다.
const KOREAN_MARKER_COUNTERPARTS = Object.freeze({
  internal: ['내부']
});

// 누출 이슈 메시지("... contains internal public-forbidden term: Fallback", "... contextual internal term:
// validator+internal_marker")에서 걸린 용어만 꺼낸다.
function leakedTerm(item) {
  if (item.type !== 'public_article_leakage') return '';
  const match = /contains (?:internal public-forbidden term|contextual internal term): ([^+]+?)(?:\+\w+)?$/.exec(item.message || '');
  return match ? match[1].toLowerCase() : '';
}

// 대응어 바로 뒤에 한글이 오면 조사나 복수 접미사일 때만 그 낱말로 본다('검사기들을'은 검사기, '검증기준'·
// '검증기간'은 다른 낱말이다).
const KOREAN_SUFFIX = '(?:들|은|는|이|가|을|를|의|에서|에|으로|로|와|과|도|만)*';

function koreanCount(words, value) {
  const serialized = JSON.stringify(value ?? '');
  return words.reduce((sum, word) => sum + (serialized.match(new RegExp(`${word}${KOREAN_SUFFIX}(?![가-힣])`, 'g')) || []).length, 0);
}

function englishCount(word, value) {
  return JSON.stringify(value ?? '').toLowerCase().split(word.toLowerCase()).length - 1;
}

// 번역문에서 걸린 누출 이슈가 한국어 원문의 짝이 되는 필드(item.key)에 있는 대응어를 충실히 옮긴 것이면 true다.
// 영어 단어가 그 한국어의 번역임을 결정론적으로 증명할 수는 없으므로, 같은 필드에서 영어 용어의 출현 횟수가
// 한국어 대응어의 출현 횟수 이하일 때만 면제한다. 다른 필드나 번역 대상이 아닌 필드(editorial_story 등)의
// 대응어는 보지 않는다. 문맥 이슈는 그 문맥을 만든 marker도 같은 원칙(원문에 대응어가 있고 횟수 이하)을 지켜야
// 한다. 어떤 marker가 걸렸는지는 메시지에 없으므로, 조건을 만족하는 marker만 번역문 필드에서 지우고 같은 판정
// (publicProseLeakageIssues)을 다시 돌려 이슈가 사라지는지 본다. debug 같은 다른 marker가 남아 있으면 이슈가
// 그대로여서 막힌다.
function isFaithfulTechnicalTerm(item, sourceSection, englishSection) {
  const term = leakedTerm(item);
  const sourceValue = sourceSection?.public_article?.[item.key];
  const englishValue = englishSection?.public_article?.[item.key];
  if (!term || !KOREAN_COUNTERPARTS[term]) return false;
  if (englishCount(term, englishValue) > koreanCount(KOREAN_COUNTERPARTS[term], sourceValue)) return false;
  if (!item.message.includes('contextual internal term')) return true;
  let serialized = JSON.stringify(englishValue ?? '');
  for (const [marker, words] of Object.entries(KOREAN_MARKER_COUNTERPARTS)) {
    if (englishCount(marker, englishValue) <= koreanCount(words, sourceValue)) serialized = serialized.replace(new RegExp(marker, 'gi'), 'inward');
  }
  return !publicProseLeakageIssues(JSON.parse(serialized), `public_article.${item.key}`).includes(item.message);
}

module.exports = { KOREAN_COUNTERPARTS, leakedTerm, isFaithfulTechnicalTerm };
