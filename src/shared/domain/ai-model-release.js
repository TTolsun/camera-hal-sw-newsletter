// 공식 AI 소스의 주요 모델 출시 글 판정(#1258).
//
// 이런 글(예: "Claude Sonnet 5.5")은 카메라 키워드가 거의 없어 relevance 점수로는 전역 상한(50건)을
// 넘지 못하고, generic_tech_watchlist라 main 기사 자격도 없다. 그래도 AI 개발 도구는 이 뉴스레터의
// 다루는 범위이므로, 2026-10-07 결정에 따라 '참고 / 더 읽을거리'에 전용 칸을 둔다. main 자격과
// 카메라 참고 항목의 상한·순서는 건드리지 않는다.
//
// 판정은 일부러 좁다. 제목이 모델 계열명 + 버전으로 시작하는 공식 출처의 dated 글만 받는다.
// "A model guide for the GPT-6 family"처럼 모델을 언급만 하는 글, "Claude Code v2.1.288" 같은
// 주간 패치 릴리스, 고객 사례는 여기 들지 않는다.

const AI_MODEL_RELEASE_TITLE = new RegExp(
  '^(?:(?:introducing|announcing|meet)\\s+)?(?:the\\s+)?(?:' + [
    '(?:claude\\s+)?(?:fable|mythos|opus|sonnet|haiku)\\s+\\d+(?:\\.\\d+)?',
    'gpt-\\d+(?:\\.\\d+)?',
    'gemini\\s+\\d+(?:\\.\\d+)?',
    'gemma\\s+\\d+(?:\\.\\d+)?',
    'llama\\s+\\d+(?:\\.\\d+)?'
  ].join('|') + ')(?![\\w.])',
  'i'
);

// 한 호에 이 칸으로 싣는 최대 건수. 수집 단계 예외 레인과 참고 섹션이 같은 값을 쓴다.
const AI_MODEL_RELEASE_REFERENCE_LIMIT = 2;

function isAiModelReleaseTitle(title) {
  return AI_MODEL_RELEASE_TITLE.test(String(title || '').trim());
}

/**
 * 정규화된 후보가 모델 출시 참고 칸 대상인지. 출처가 공식 AI 소스이고, 원문에서 게시일을
 * 읽었으며, 제목이 모델 출시 형태여야 한다.
 */
function isAiModelReleaseCandidate(candidate = {}) {
  return candidate.source_category === 'ai' &&
    candidate.source_reliability === 'official' &&
    candidate.has_published_date === true &&
    isAiModelReleaseTitle(candidate.title);
}

module.exports = {
  AI_MODEL_RELEASE_REFERENCE_LIMIT,
  isAiModelReleaseCandidate,
  isAiModelReleaseTitle
};
