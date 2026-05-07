# PR Body / Publish Gate 상태 일관성 수정 계획

## Summary

- `final_publish_ready`는 `.tmp/newsletter-generation-status.json` 값만 믿지 않고 현재 review artifact 기준으로 재계산한다.
- PR body의 상태 section은 `build-newsroom-pr-body.js`가 resolver 결과 기준으로 한 번만 출력한다.
- 사람이 읽는 PR body heading과 설명 문장은 한국어 중심으로 바꾸되, enum, path, command, JSON key, artifact 이름은 원문을 유지한다.
- `publish_gate_passed` machine key는 deterministic/policy selection 조건으로 유지하고, 사람이 읽는 “발행 게이트”는 `final_publish_ready` 기준의 최종 발행 가능 여부로만 표현한다.

## PLAN.md 처리

- 기존 `PLAN.md`의 `Editor Output Semantic Repair Plan`은 `docs/refactoring/editor-output-semantic-repair-plan.md`로 원문 보존한다.
- `PLAN.md`에서는 기존 계획 본문을 제거하고 현재 작업 계획 링크만 남긴다.
- 제거 이유: `PLAN.md`를 현재 작업 포인터로 정리하기 위함이며, 기존 계획을 삭제하지 않고 별도 문서로 보존하기 위함이다.

## Implementation

- `scripts/newsroom/common/publish-status.js`를 추가해 `.tmp/newsletter-generation-status.json`, `quality-report.json`, `fact-check-report.json`, `stale-claim-report.json`, `shortlisted-candidates.json`, `VALIDATE_OUTCOME`을 읽는다.
- `final_publish_ready=true`는 `selection_publish_ready === true`, quality `PASS`, score >= threshold, fact-check `PASS`, `must_fix_count === 0`, `source_gap_count === 0`, stale claim `NEEDS_FIX` 아님, stale hard failure 0, site validation `success`를 모두 만족할 때만 계산한다.
- status JSON의 `final_publish_ready`와 재계산 값이 다르면 `consistency_errors`에 기록한다.
- `editor-in-chief-brief.md`는 PR body에 원문 전체를 붙이지 않고 허용 section만 추출한다: `이번 주 핵심 메시지`, `메인으로 봐야 할 기사`, `Camera HAL 업무 연결 포인트`, `편집장 확인 checklist`, `권장 판단`.
- PR body 전용 validator `scripts/newsroom/cli/validate-pr-body.js`와 wrapper `scripts/validate-pr-body.js`를 추가한다.
- `.github/workflows/01-weekly-newsroom-pr.yml`은 `.tmp/newsroom-pr-body.md`를 먼저 만들고 검증한 뒤 통과 시에만 `GITHUB_OUTPUT` body로 기록한다.

## Validation

- `node --check scripts/newsroom/common/publish-status.js`
- `node --check scripts/newsroom/cli/validate-pr-body.js`
- `node --check scripts/newsroom/cli/build-newsroom-pr-body.js`
- `npm run test`
- `npm run validate`

## Risks

- `publish_gate_passed`와 `final_publish_ready`를 혼동하면 PR label/body가 다시 어긋날 수 있다.
- 오래된 `editor-in-chief-brief.md`의 상태 section이 PR body에 섞이면 PASS/NEEDS_FIX 모순이 재발할 수 있다.
- validator가 legitimate mixed status, 예를 들어 quality `PASS`와 fact-check `NEEDS_FIX` 조합을 무조건 모순으로 오판하지 않도록 invariant 중심으로 검사해야 한다.
