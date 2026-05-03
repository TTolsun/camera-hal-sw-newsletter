# Reporter와 최종 선택 진단 계획

## 확인한 파일

- `scripts/gemini-newsroom-newsletter.js`
- `scripts/lib/newsroom-selection.js`
- `scripts/lib/newsletter-quality.js`
- `scripts/lib/newsletter-renderer.js`
- `.github/workflows/weekly-newsroom-pr.yml`
- `package.json`

## 현재 `selected` field 작성/읽기 위치

- `scripts/lib/newsroom-selection.js`는 deterministic final shortlist output에 `selected`와 `selected_for_editor`를 기록합니다.
- `scripts/gemini-newsroom-newsletter.js`는 Gemini reporter output에서 `candidate.selected`를 reporter-stage intent로 검증한 뒤, reporter artifact와 editor input을 쓰기 전에 deterministic final selection을 강제합니다.
- `scripts/gemini-newsroom-newsletter.js`는 editor input, retry completion candidate, duplicate removal, reporter eligibility check에서 `candidate.selected`를 읽습니다.
- `scripts/lib/newsletter-quality.js`는 selected reporter candidate quality deduction을 위해 reporter `candidate.selected`를 읽습니다.
- `.github/workflows/weekly-newsroom-pr.yml`은 generation status count를 읽고 PR 본문에 deterministic diagnostics를 출력합니다.

## Schema 호환성 계획

- `reporter-candidates.json`에서는 `selected`를 deprecated reporter-stage alias로 유지하고 `reporter_selected`, `final_selected`, `selection_stage`, `final_selection_eligibility`, `final_exclusion_reasons`를 추가합니다.
- `shortlisted-candidates.json`에서는 `selected`를 deterministic final alias로 유지하고 `final_selected`, `reporter_selected`, `selection_stage`, `selected_for_editor`를 추가합니다.
- 기존 count field를 보존하면서 final-prefixed count alias를 추가합니다.
- 내부 final-selection reader는 `final_selected` / `selected_for_editor`를 우선 읽도록 바꿔 reporter `selected`가 reporter-stage 용어가 되어도 editor behavior가 바뀌지 않게 합니다.

## Diagnostics 출력 계획

- 공통 candidate-selection diagnostics helper를 `scripts/lib/selection-diagnostics.js`에 추가합니다.
- reporter와 shortlist artifact에 reporter/final count metadata를 추가합니다.
- recovery prompt, retry history, editor-in-chief brief, generation status, generated PR body에 `Candidate Selection Diagnostics` Markdown block을 추가합니다.
- reporter-selected candidate가 반드시 publishable candidate는 아니며, publication readiness는 deterministic final selection과 quality validation으로 결정된다는 note를 포함합니다.

## 테스트 계획

- final-selected RSS item 1개, final-excluded watch page 1개, final-excluded reference page 1개, reporter-selected가 아닌 excluded candidate 1개를 다루는 fixture로 `scripts/test-selection-diagnostics.js`를 추가합니다.
- `npm.cmd run test:selection-diagnostics`를 추가합니다.
- 수정한 JavaScript 파일에 `node --check`, `npm.cmd run test:selection-diagnostics`, `npm.cmd run validate`를 실행합니다.
