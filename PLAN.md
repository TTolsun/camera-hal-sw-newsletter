# Current Plan

## Reviewable Handoff Hardening

- Keep quality and publish gates strict. A 2-section editor retry output remains invalid and must never become publish-ready.
- Do not treat stale base-branch artifacts as current run output. Reviewable PR handoff requires repo-visible changed artifacts.
- Require a complete `FAILED_REPAIR_REVIEWABLE` canonical artifact set before opening the review PR path.
- Keep `FAILED_REPAIR_REVIEWABLE` out of the publish/site validation path.

## Implementation Scope

- `scripts/newsroom/cli/resolve-reviewable-artifacts.js`
  - Add `git status --porcelain` based changed artifact detection for `content/newsroom/<date>`, `newsletters/<date>`, and `data/newsletters.json`.
  - Support `options.changedArtifacts` for tests.
  - Require changed repo-visible artifacts for `has_reviewable_artifacts=true`.
  - Require `editor-draft.json`, `quality-report.json`, `fact-check-report.json`, `repair-failure.json`, and `generation-status.json` for `FAILED_REPAIR_REVIEWABLE`.
- `scripts/newsroom/cli/gemini-newsroom-newsletter.js`
  - Write canonical `content/newsroom/<date>/generation-status.json` from the same status object as `.tmp/newsletter-generation-status.json`.
  - Add `run_context` with GitHub run metadata when available.
- Workflow and tests
  - Keep site/final publish status gated by `has_publish_candidate`.
  - Narrow source effectiveness reporting to publish candidates.
  - Add stale artifact, missing required artifact, and canonical status consistency regressions.

## Validation

- `node --test tests/targeted-retry.test.js`
- `node --test tests/workflow-scripts.test.js`
- `npm.cmd run test`
- `npm.cmd run validate`
