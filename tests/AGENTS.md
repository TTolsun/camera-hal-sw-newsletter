# tests 작업 지침

- fixture를 추가하기 전에 `tests/fixtures/README.md`의 신뢰 정책을 먼저 확인하세요.
- generated artifact 전체를 `good/` 또는 golden fixture로 복사하지 마세요.
- 과거 생성 산출물에서 회귀 테스트 가치가 있는 경우 최소 입력만 `bad/` 또는 regression fixture로 축약하세요.
- `bad/` fixture의 `expected.status`를 `PASS`로 두지 마세요.
- source gap, watchlist, reference-only, exclude, undated evidence, generic AI without HAL connection sample을 main article PASS 기준으로 만들지 마세요.
- 테스트 구조 변경 후에는 `npm.cmd run test`와 관련 세부 테스트를 실행하세요.
