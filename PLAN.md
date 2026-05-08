# Current Plan

## PR #37 Publication Stability Follow-up

- Branch: `followup/pr37-publication-stability`.
- Commit 1 is the default scope: core #37 follow-up for accuracy, test stability, explicit annotation targeting, and publication policy drift prevention.
- Commit 2 is allowed only if validation cleanup is proven equivalent or stronger with focused tests. Do not include validation cleanup by default.

## Commit 1 Scope

- Fix `debaying` to `debayering` in public/canonical artifacts and parser/script/test text:
  - `newsletters/2026-05-08/**`
  - canonical/review `content/newsroom/2026-05-08/**` artifacts that feed review/public text
  - `scripts/newsroom/collect/source-item-parsers.js`
  - related tests
- Do not mass-edit raw LLM attempt/history files such as `*attempt*.json`, `*completion*.json`, or `*repair*.json`; list remaining matches in PR notes.
- Update `annotate-publication-quality.js` target precedence:
  - `--date YYYY-MM-DD` inspects only explicit dates.
  - `--all` inspects all public issues.
  - changed public issue dates are selected whenever detected.
  - `--latest` only permits fallback to latest when no changed public issue date exists.
  - changed dates win even when `--latest` is present.
  - no args plus no changed public issue date fails explicitly.
  - `.github/workflows/02-validate-site.yml` passes `--latest` explicitly.
- Add `scripts/newsroom/common/editor-publication-policy.js` as the single source for the editor-approved publication policy section.
- Update `build-newsroom-pr-body.js` and tests to render/verify the helper output.
- Improve `tests/workflow-scripts.test.js` ordering checks with a shared `assertTextInOrder` helper and workflow step names or semantic markers.

## Validation

- Run `node --test tests/workflow-scripts.test.js`.
- Run `npm.cmd run test`.
- Run `npm.cmd run validate`.
- Run `rg -n "debaying" content/newsroom/2026-05-08 newsletters/2026-05-08 scripts tests`.
- Self-review for P1/P2 risks: validation weakening, silent latest fallback, changed-date precedence regression, publication policy wording drift, quality threshold drift, and unintended public artifact edits.
