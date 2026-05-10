# tests 작업 지침

이 폴더는 Node built-in test runner 기반 regression test를 둡니다. production validator를 약화해서 test를 통과시키지 마세요.

## Fixture Trust Policy

- fixture를 추가하기 전에 `tests/fixtures/README.md`의 신뢰 정책을 먼저 확인하세요.
- `good/` 또는 golden fixture는 사람이 검수한 curated sample만 허용합니다.
- generated artifact 전체를 `good/` 또는 golden fixture로 복사하지 마세요.
- generated artifact에서 회귀 테스트 가치가 있는 경우 최소 입력만 `bad/` 또는 regression fixture로 축약하세요.
- `bad/` fixture의 `expected.status`는 `PASS`가 될 수 없습니다.
- source gap, watchlist, reference-only, exclude, undated evidence, generic AI without HAL connection sample을 main article PASS 기준으로 만들지 마세요.

## Test Style

- Node built-in test runner를 사용합니다.
- regression fixture는 최소 입력으로 유지합니다.
- test name은 보호하려는 policy를 설명해야 합니다.
- source gap, watch/reference page promotion prevention, duplicate URL binding, stale claims, quality hard blockers, image fallback contract, workflow script status output은 우선 test 대상입니다.

## Validation

테스트 구조 변경 후에는 아래 명령을 실행합니다.

```powershell
npm.cmd run test
npm.cmd run validate
```

관련 파일이 명확하면 targeted test도 함께 실행합니다.

```powershell
node --test "tests/**/*.test.js"
```
