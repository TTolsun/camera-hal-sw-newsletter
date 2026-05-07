# 테스트 baseline

기록일: 2026-05-05

## 실행 명령

```powershell
npm.cmd ci
npm.cmd run test
npm.cmd run validate
npm.cmd run test:artifact
npm.cmd run test:selection-diagnostics
```

## 결과

- `npm.cmd ci`: 통과. 42 packages 설치, 취약점 0개.
- `npm.cmd run test`: 통과. `node --test tests/*.test.js scripts/test-*.js`, 132개 테스트 pass.
- `npm.cmd run validate`: 통과.
  - `validate:config`: 통과.
  - `validate:site`: 통과. 6개 newsletter entry 검증.
  - `validate:images`: 통과. 4개 article image 검증.
  - `validate:quality`: 통과.
  - `validate:localization`: 통과.
- `npm.cmd run test:artifact`: 통과.
- `npm.cmd run test:selection-diagnostics`: 통과.

## baseline warning

현재 `npm.cmd run validate`는 과거 발행 이슈에 대해 아래 warning을 출력했습니다. 이 warning은 이번 작업의 generated artifact audit 대상입니다.

- `2026-05-04`: unresolved fact-check `must_fix`가 있음.
- `2026-05-04`: `selectedImage`가 fallback 이후에도 external URL을 가리킨다는 image warning이 있음.
- `2026-05-03`: main article count가 현재 Article Composition Policy 기준에 미달함.
- `2026-05-02`: main article count가 현재 Article Composition Policy 기준을 초과함.
- `2026-05-02`: fact-check `source_gap_count`가 6개임.

## 정책

이 baseline은 검증 약화의 근거가 아닙니다. 이후 변경은 `npm.cmd run test`와 `npm.cmd run validate`를 모두 통과해야 하며, generated artifact를 curated golden fixture로 승격하지 않습니다.
