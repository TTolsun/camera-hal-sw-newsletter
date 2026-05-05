# Weekly Newsroom Preflight Test와 Workflow Numbering 정리

## Summary

- `.github/workflows/weekly-newsroom-pr.yml`을 `.github/workflows/01-weekly-newsroom-pr.yml`로 rename합니다.
- workflow 표시 이름을 `01 - Weekly Gemini Newsroom PR`로 맞춥니다.
- `Doctor runtime config` 뒤, `Jitter scheduled run` 앞에 preflight `npm run test` step을 추가합니다.
- `tests/workflow-scripts.test.js`에서 renamed workflow path와 preflight 순서를 최소 regression assertion으로 보호합니다.
- collect/generate, Gemini, quality gate, validator, source scoring 로직은 변경하지 않습니다.

## Implementation Scope

- `Run unit and regression tests` step은 `run: npm run test`를 실행하고 `continue-on-error`를 두지 않습니다.
- preflight test 뒤에 `.tmp/gemini-raw` 같은 test scratch artifact를 정리하는 step을 둡니다.
- README와 운영 문서의 active workflow path 참조를 갱신합니다.
- historical handoff 또는 generated artifact 참조는 변경하지 않습니다.

## Verification

- `rg -n "\\.github/workflows/weekly-newsroom-pr\\.yml|(^|[[:space:]])weekly-newsroom-pr\\.yml" README.md AGENTS.md docs .github`
- `npm.cmd run test`
- `npm.cmd run validate`
- `git diff --check`
