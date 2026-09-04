// Google이 운영하는 JSON API(Gitiles, Gerrit)는 응답 앞에 `)]}'` 한 줄을 붙여 보낸다. 브라우저가
// 응답을 스크립트로 실행하는 공격을 막는 방어 접두사라 JSON.parse 전에 반드시 떼야 한다.
//
// 이 규칙을 모듈마다 따로 적어 두면 같은 정규식이 저장소에 여러 벌 생기고, 한쪽만 고친 순간
// 다른 수집기는 조용히 파싱에 실패한다(파싱 실패는 이 저장소에서 "이번 주 신호 없음"과 산출물에서
// 같은 모양이라 눈에 띄지 않는다). 그래서 collect layer는 이 한 곳만 쓴다.
const GOOGLE_JSON_PREFIX_PATTERN = /^\)\]\}'\s*/;

/**
 * 접두사를 떼고 JSON으로 읽는다. 읽지 못하면 null을 돌려준다(던지지 않는다) - 호출부는 대부분
 * "이 응답은 못 읽었다"와 "빈 결과"를 구분해 경고를 남겨야 하고, 예외를 잡는 것보다 값으로
 * 판단하는 쪽이 그 구분을 분명하게 만든다.
 */
function parseGoogleJson(text) {
  try {
    return JSON.parse(String(text).replace(GOOGLE_JSON_PREFIX_PATTERN, ''));
  } catch {
    return null;
  }
}

module.exports = { parseGoogleJson };
