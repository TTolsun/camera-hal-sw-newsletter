// 공개 뉴스레터 이슈의 title 계약이다. title은 사이트 h1과 newsletters.json에 그대로
// 노출되는 표시값이라 한국어를 담아야 하고, validate:localization이 발행 직전에 이 규칙을
// hard fail로 강제한다. title 본문은 매 실행마다 editor(LLM)가 새로 쓰기 때문에 한국어가
// 하나도 없는 영어 title이 나올 수 있고, 그때 되돌릴 자리가 canonical title이다.
// canonical title은 코드가 만드는 고정 문구라 한국어가 없어도 예외로 허용한다.

const KOREAN_DISPLAY_PATTERN = /[가-힣]/;
const CANONICAL_ISSUE_TITLE_PATTERN = /^Camera HAL \/ SW Newsletter - \d{4}-\d{2}-\d{2}$/;

function canonicalIssueTitle(date) {
  return `Camera HAL / SW Newsletter - ${date}`;
}

function hasKoreanDisplayValue(value) {
  return KOREAN_DISPLAY_PATTERN.test(String(value || ''));
}

function isCanonicalIssueTitle(value, date) {
  const title = String(value || '');
  return CANONICAL_ISSUE_TITLE_PATTERN.test(title) && title === canonicalIssueTitle(date);
}

// 발행해도 되는 title인가: 한국어 표시값이 있거나 canonical title이어야 한다.
function isPublishableIssueTitle(value, date) {
  return hasKoreanDisplayValue(value) || isCanonicalIssueTitle(value, date);
}

module.exports = {
  CANONICAL_ISSUE_TITLE_PATTERN,
  canonicalIssueTitle,
  hasKoreanDisplayValue,
  isCanonicalIssueTitle,
  isPublishableIssueTitle
};
