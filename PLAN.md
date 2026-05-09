# Current Plan

## Sourcery Follow-Up Hardening

- Keep the follow-up narrow: runtime and test robustness only.
- Do not weaken `quality threshold`, `public_newsletter_ready`, fallback trigger semantics, source policy, or fact-check policy.
- Harden `scripts/newsroom/cli/validate-pr-body.js` so all text parsing helpers coerce input once and never slice or match against a raw non-string value.
- Preserve existing libcamera output normalization as `SoftISP debayering and image pipeline throughput` while keeping parser input compatibility for `debayering`, `debaying`, `Debayer`, `SoftISP`, and `software_isp`.
- Add focused regressions for `validate-pr-body` non-string inputs, annotation CLI `--latest` help/workflow usage, `public_newsletter_ready` `data/newsletters.json` path integrity, fallback skip behavior, missing fallback inputs, and fallback structural diagnostics.
- Confirm `renderFallbackPublicIssueNotes` already uses the `ensureArray` import from `../common/publish-status`; do not change that code unless the import is missing.

## Validation

- `node --test tests/workflow-scripts.test.js`
- `node --test tests/source-item-parsers.test.js`
- `npm.cmd run test`
- `npm.cmd run validate`
- `git diff --check`

## Self Review Focus

- P1 if a PR path can claim `public_newsletter_ready=true` without valid public markdown, HTML, and `data/newsletters.json` paths.
- P1 if fallback generation is skipped for true hard failure inputs or runs when a valid PASS public issue already exists.
- P1 if parser input compatibility changes emitted libcamera wording away from normalized `debayering`.
- P2 if `validate-pr-body` can throw on null, undefined, or non-string input instead of returning validation errors.
