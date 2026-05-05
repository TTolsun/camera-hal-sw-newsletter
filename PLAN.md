# 테스트 신뢰성 복구와 generated artifact 감사 계획

## 요약

이번 작업은 기능 추가가 아니라 테스트 신뢰성 복구입니다. generated artifact와 curated fixture를 분리하고, 과거 발행 산출물 중 현재 editorial policy와 quality gate의 hard blocker가 명확한 이슈만 public archive에서 제거합니다.

## 구현 범위

- `tests/helpers/`에 fixture loader와 test builder를 추가합니다.
- `tests/fixtures/`에 fixture 정책과 최소 regression fixture를 둡니다.
- 기존 inline test sample을 helper 또는 fixture 파일로 옮깁니다.
- `fixture-policy.test.js`로 good/bad fixture 계약을 자동 검증합니다.
- `package.json`과 `02-validate-site.yml`에서 `npm run test`와 `npm run validate`가 PR gate에 함께 묶이도록 정리합니다.
- `2026-05-05` 이슈에서는 FreeBSD 15.1 Beta main article을 제거하고, 4개 main article 기준으로 newsletter/public artifact와 quality artifact를 재계산합니다.
- legacy public issue는 `quality-report.json` 부재만으로 삭제하지 않습니다. 먼저 `newsletter.md`와 `index.html`을 수동 감사하고, hard blocker가 명확한 경우에만 `data/newsletters.json`, `newsletters/YYYY-MM-DD/`, `content/newsroom/YYYY-MM-DD/` 사이에 dangling reference 없이 제거합니다.
- hard blocker가 명확하지 않은 legacy issue는 삭제하지 않고 `docs/testing/generated-artifact-audit.md`에 legacy warning으로 기록합니다.

## 검증

- `npm.cmd run test`
- `npm.cmd run validate`
- `npm.cmd run test:artifact`
- `npm.cmd run test:selection-diagnostics`

## 위험 관리

- quality threshold, hard blocker, validator를 완화하지 않습니다.
- quality report 숫자만 수동으로 맞추지 않습니다. 삭제 또는 기사 제거 후에는 현재 산출물 기준으로 quality artifact를 재계산하거나 재생성합니다.
- generated artifact 전체를 golden fixture로 복사하지 않습니다.
- 회귀 가치가 있는 과거 샘플은 최소 입력만 bad/regression fixture로 보존합니다.
- `content/collected-news/**`는 raw collection evidence이므로 public reference가 없으면 삭제하지 않습니다.
