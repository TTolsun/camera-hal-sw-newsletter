# Current Plan

## editorial_reviewable Failure Guard

- `NEEDS_FIX` and `QUALITY_NEEDS_FIX` are not terminal failures, but they are reviewable only when canonical review artifacts are complete and `failure_kind="editorial_reviewable"` is recorded.
- In `editorial_reviewable` mode, do not write public issue files:
  - `newsletters/<date>/newsletter.md`
  - `newsletters/<date>/index.html`
  - `data/newsletters.json`
- Keep terminal validation failures terminal:
  - TODO content
  - missing source heading or source URL
  - Markdown/HTML structural errors
  - image contract violations
  - `data/newsletters.json` JSON/schema errors
  - artifact file write/read errors

## Implementation Scope

- `scripts/newsroom/cli/gemini-newsroom-newsletter.js`
  - Classify fact-check/quality-only failures as `failure_kind="editorial_reviewable"`.
  - Write canonical review artifacts and status with `final_publish_ready=false`, `validate_ok=false`, and `editor_review_required=true`.
  - Skip public issue writes and `data/newsletters.json` updates for editorial-reviewable failures.
- `scripts/newsroom/cli/resolve-reviewable-artifacts.js`
  - Require valid JSON for `editor-draft.json`, `fact-check-report.json`, `quality-report.json`, and `generation-status.json`.
  - Reject editorial-reviewable handoff when public newsletter files exist or are changed, `data/newsletters.json` changed, same-date public entry exists, `generation-status.json` is invalid, or `failure_kind` is not `editorial_reviewable`.
- `scripts/newsroom/cli/build-newsroom-pr-body.js` and `scripts/newsroom/cli/validate-pr-body.js`
  - Show a non-publish warning for `failure_kind=editorial_reviewable`.
  - Require `final_publish_ready=false`, `validate_ok=false`, `editor_review_required=true`, and `failure_kind=editorial_reviewable` in reviewable failure PR bodies.
- Tests
  - Add resolver regressions for valid and invalid editorial-reviewable handoffs.
  - Add PR body validation regressions for the non-publish warning and required status fields.

## Validation

- Run `npm.cmd run test`.
- Run `npm.cmd run validate`.
- Self-review the diff for P1/P2 risks, especially accidental public publication, label drift, weakened validation, and stale artifact acceptance.
