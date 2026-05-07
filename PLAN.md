# Config-Based Newsletter Policy Implementation Plan

## Goal

Move article composition and quality threshold settings into `config/newsletter-policy.json` so selection, quality validation, tests, and current operating docs use one configurable Newsletter Policy.

## Scope

- Add policy config, loader, validator, and docs sync/check scripts.
- Update deterministic selection and quality gate logic to read policy values.
- Preserve hard fail behavior and legacy diagnostic artifact fields.
- Replace current operating guidance magic article-count text with generated policy blocks or config references.
- Do not edit historical `newsletters/YYYY-MM-DD/**` outputs or generated/debug artifacts unless explicitly required by validation.

## Validation

- `node --check scripts/newsroom/common/newsletter-policy.js`
- `node --check scripts/newsroom/cli/validate-newsletter-policy.js`
- `node --check scripts/newsroom/cli/sync-policy-docs.js`
- `node --check scripts/newsroom/generate/newsroom-selection.js`
- `node --check scripts/newsroom/validate/newsletter-quality.js`
- `npm.cmd run validate:policy`
- `npm.cmd run check:policy-docs`
- `npm.cmd run test`
- `npm.cmd run validate`
- `npm.cmd run ci`

## Risks

- Existing workflow/status artifacts still consume legacy fields; keep them as diagnostics while moving publish gate logic to the policy fields.
- Existing docs and tests include historical fixed-count wording; update current guidance only and leave historical/debug artifacts alone.
