# Current Plan

## Newsroom Repair Pipeline 리팩터링

- `config/newsletter-policy.json`을 단일 source of truth로 사용해 editor contract, quality gate, repair merge가 같은 article policy를 적용한다.
- `lastKnownValidEditor`는 schema와 Newsletter Policy article contract를 모두 통과한 editor draft만 저장한다.
- targeted repair 실패는 `publish-ready` 실패로 다루고, 마지막 valid draft를 삭제하거나 교체하지 않는다.
- `FAILED_REPAIR_REVIEWABLE`은 review artifact 보존 상태이며 항상 `final_publish_ready=false`, `publish_gate_passed=false`, `needs-fix` 흐름으로 처리한다.
- editor draft가 한 번도 schema + article policy를 통과하지 못한 pre-editor failure는 terminal failure로 유지한다.

## Implementation Scope

- `scripts/newsroom/validate/editor-output-contract.js`
  - hard-coded section minimum 제거.
  - `articlePolicy.mainArticleCount.min/max` 기반 section count 검증.
  - Primary Camera Stack 최소 수와 forbidden main bucket 검증 추가.
- `scripts/newsroom/cli/gemini-newsroom-newsletter.js`
  - `lastKnownValidEditor` fallback과 repair failure diagnostics 추가.
  - targeted repair output의 locked section order/source URL/source candidate hash drift reject.
  - invalid repair output이 canonical review artifact 생성을 막지 않도록 fallback artifact 작성.
- tests
  - editor contract policy count/Primary/forbidden regression.
  - targeted repair shrink/source drift/fallback regression.
  - `FAILED_REPAIR_REVIEWABLE` workflow/status regression.

## Validation

- `npm.cmd run test`
- `npm.cmd run validate:policy`
- `npm.cmd run check:policy-docs`
- 가능한 경우 fixture 또는 수동 date 기반 generation 확인. 실제 Gemini/API 의존으로 실행하지 못하면 대체 검증 결과를 보고한다.
