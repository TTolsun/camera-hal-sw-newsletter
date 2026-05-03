# Reporter와 최종 선택 진단 인수인계

## 변경 파일

- `plan.md`
- `scripts/lib/selection-diagnostics.js`
- `scripts/lib/newsroom-selection.js`
- `scripts/gemini-newsroom-newsletter.js`
- `scripts/lib/newsletter-quality.js`
- `scripts/lib/newsletter-renderer.js`
- `.github/workflows/weekly-newsroom-pr.yml`
- `scripts/test-selection-diagnostics.js`
- `package.json`

## 실행한 명령

- `node --check scripts/lib/selection-diagnostics.js`
- `node --check scripts/lib/newsroom-selection.js`
- `node --check scripts/gemini-newsroom-newsletter.js`
- `node --check scripts/test-selection-diagnostics.js`
- `node --check scripts/lib/newsletter-renderer.js`
- `node --check scripts/lib/newsletter-quality.js`
- `git diff --check`
- `npm.cmd run test:selection-diagnostics`
- `npm.cmd test`
- `npm.cmd run validate`

## 테스트 결과

- Selection diagnostics fixture가 통과했습니다.
- 전체 `node --test` suite가 통과했습니다. 결과: 33 tests passed.
- `npm.cmd run validate`가 통과했습니다.
- 2026-05-03 underfilled/non-publishable review quality report를 포함해 review-only/generated artifact warning은 기존 상태로 남아 있습니다. 이 PR은 해당 이슈를 통과 상태로 만들지 않습니다.

## 호환성 note

- `reporter-candidates.json`은 `selected`를 reporter-stage `reporter_selected`의 deprecated alias로 유지합니다.
- `shortlisted-candidates.json`은 `selected`를 deterministic final-selection `final_selected`의 alias로 유지합니다.
- Editor input, retry completion, quality weak-score deduction은 이제 `final_selected` / `selected_for_editor`를 사용하므로 deterministic final-selection behavior는 유지하면서 reporter artifact terminology가 명확해졌습니다.
- 기존 count field는 보존했고 final-prefixed alias와 reporter/final comparison count를 추가했습니다.
- Quality threshold, final article minimum, slot classifier logic, source extraction, watch-page parsing은 바꾸지 않았습니다.

## 남은 risk

- Reporter data는 reporter stage 이후에만 있으므로 early deterministic-selection failure artifact에서는 reporter count가 여전히 `unknown`일 수 있습니다.
- Retry duplicate suppression은 deterministic final selection 이후 reporter candidate를 editor-usable하지 않게 표시할 수 있습니다. 기존 behavior를 보존하지만 retry-attempt reporter flag가 original deterministic shortlist와 다를 수 있습니다.
- 기존 generated historical artifact는 다시 쓰지 않았습니다. 새 schema field는 새로 생성되는 newsroom artifact에만 나타납니다.

## 다음 권장 PR

Slot classifier false-positive cleanup.
