// 타입 강제(coercion) 공통 헬퍼.
// ensureArray: 비배열 입력은 빈 배열로 떨군다(drop-to-empty). 코드베이스의 지배적 구현이며,
// 단일 값을 배열로 감싸는 변형(wrap-single)과는 의미가 다르므로 그 변형 파일은 이 모듈을 쓰지 않는다.

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

module.exports = { ensureArray };
