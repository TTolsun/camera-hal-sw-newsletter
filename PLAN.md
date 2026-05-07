# Policy Follow-Up Review Fix Plan

## Goal

Address the policy review follow-up without rewriting pushed `main` history. Keep the final diff focused on config-based Newsletter Policy behavior and validation strictness.

## Scope

- Add shared strict target date helpers for `validate-site` and `validate-quality`.
- Split current/changed/generated artifact strictness from historical artifact policy drift.
- Keep historical structural/publication errors as hard failures.
- Refactor `newsletter-policy.js` so pure read/validate/normalize/load helpers are separate from lazy default policy access.
- Strengthen policy docs marker validation and weekly preflight order.
- Clean policy tests so expectations read from `articlePolicy` instead of fixed article-count literals.
- Do not include unrelated `content/newsroom/**`, `content/collected-news/**`, or source-effectiveness changes.

## Validation

- `node --check scripts/newsroom/common/newsletter-policy.js`
- `node --check scripts/newsroom/common/validation-targets.js`
- `node --check scripts/newsroom/cli/validate-newsletter-policy.js`
- `node --check scripts/newsroom/cli/sync-policy-docs.js`
- `npm.cmd run validate:policy`
- `npm.cmd run check:policy-docs`
- `npm.cmd run test`
- `npm.cmd run validate`
- `npm.cmd run ci`
- `git diff --check`

## Risks

- Historical artifact policy drift must not mask structural publication errors such as invalid JSON, missing files, broken paths, TODO leaks, missing References/source blocks, or anchor mismatches.
- `sync-policy-docs --check` must fail loudly on malformed markers, but normal sync may insert a missing block when both markers are absent.
- Workflow preflight ordering needs test coverage so policy checks fail before LLM generation.
