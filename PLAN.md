# Current Plan

## Issue #49 Quality Gate Drift Guard

This change keeps the Quality Gate stable during future refactors. It is not a Quality Gate rewrite.

## Minimal Scope

- Treat `config/newsletter-policy.json` `qualityGatePolicy.hardFailConditions` as the source of truth.
- Do not hardcode the condition count in tests or docs.
- Require every configured hard fail condition string to appear in at least one regression test name.
- Verify that high quality scores do not override hard fail blockers or publish-ready blockers.
- Keep `qualityGatePolicy.threshold`, article count policy, source binding, fact-check blockers, and publish-ready logic unchanged.
- Do not move files, reorganize modules, or modify generated newsletter artifacts.

## Implementation Scope

- Add focused regression coverage in `tests/newsletter-quality.test.js`.
- Add focused publish-ready blocker coverage around `resolvePublishStatus()` in existing tests.
- Keep strict `quality-report.json` recompute drift coverage in `tests/validator-strictness.test.js`.
- Narrowly update `.github/PULL_REQUEST_TEMPLATE/code-docs.md` so reviewers can see Quality Gate policy changes.
- Update `tests/pr-template.test.js` for the PR template guardrail.
- Clarify the score-vs-hard-fail contract in `docs/newsroom-workflow.md`.

## Validation

- Baseline before code/doc edits:
  - `npm.cmd run test`
  - `npm.cmd run validate`
- Final verification:
  - `npm.cmd run test`
  - `npm.cmd run validate`
- If `npm.cmd` is unavailable, run `npm run test` and `npm run validate` and record that fallback.

## Self Review Focus

- P1 if a hard fail becomes warning-only for current or strict targets.
- P1 if `final_publish_ready` or `artifact_final_publish_ready` can become true with hard fail blockers.
- P2 if hard fail condition coverage depends on a hardcoded count instead of config.
- P2 if generated HTML or whole generated artifacts are used as golden fixtures.
- P2 if this change alters thresholds, source selection, article count policy, or publish-ready logic.
