const { normalizeArticleUrl } = require('./article-identity');
// 타입 강제(coercion) 공통 헬퍼.
// ensureArray: 비배열 입력은 빈 배열로 떨군다(drop-to-empty). 코드베이스의 지배적 구현이며,
// 단일 값을 배열로 감싸는 변형(wrap-single)과는 의미가 다르므로 그 변형 파일은 이 모듈을 쓰지 않는다.

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

// isTrue/isFalse: generation-status.json은 boolean이 'true'/'false' 문자열로 직렬화될 수 있어
// 발행 상태 분류가 두 표현을 동일하게 다뤄야 한다. 미지정(undefined/null)은 둘 다 거짓이다
// (isFalse는 isTrue의 단순 부정이 아니다). 발행 상태를 분류하는 여러 파일이 이 정본을 공유한다.
function isTrue(value) {
  return value === true || value === 'true';
}

function isFalse(value) {
  return value === false || value === 'false';
}

module.exports = { ensureArray, isTrue, isFalse };
