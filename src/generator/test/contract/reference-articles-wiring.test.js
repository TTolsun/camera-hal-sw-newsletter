const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

// 라이브 결함(2026-08-10: 창 안 적격 후보 12건 중 기사 2건, 나머지는 어느 섹션에도 없음)을
// 실제로 고친 것은 "참고 섹션을 shortlistReport 전체에서 만든다"는 발행 파이프라인 배선이다.
// 모듈 단위 테스트는 buildReferenceArticlesForIssue 안쪽만 보므로, 호출부가 예전처럼 특정
// 창 후보만 넘기도록 되돌아가도 전 테스트가 초록이었다(QA 뮤테이션으로 실증).
// 이 파일은 그 배선 자체를 계약으로 고정한다. 같은 파일을 소스 텍스트로 검사하는 선례는
// prompt-contract.test.js에 있다.
function publishHostSource() {
  return fs.readFileSync(
    path.join(__dirname, '..', '..', 'publish', 'gemini-newsroom-newsletter.js'),
    'utf8'
  );
}

test('the publish host builds the reference section from the whole shortlist report', () => {
  const source = publishHostSource();

  assert.match(
    source,
    /editor\.reference_articles = buildReferenceArticlesForIssue\(shortlistReport\);/,
    '참고 섹션은 shortlistReport 하나를 그대로 넘겨 만든다(특정 창 후보만 추려 넘기지 않는다)'
  );
});

test('the publish host does not assemble the reference pool itself', () => {
  const source = publishHostSource();

  // 풀 조립·제외·상한·정렬 규칙이 호출부로 새면 모듈 테스트가 그 규칙을 더 이상 지키지 못한다.
  assert.doesNotMatch(
    source,
    /\bbuildReferenceArticles\(/,
    '저수준 빌더를 직접 부르지 않는다 — 조립은 reference-articles 모듈 안에서만 한다'
  );
  assert.doesNotMatch(
    source,
    /\breferenceArticleCandidatePool\(|\breferenceArticleExcludeUrls\(/,
    '풀/제외 헬퍼도 호출부에서 직접 조합하지 않는다'
  );
});
