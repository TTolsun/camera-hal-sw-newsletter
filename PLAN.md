# Current Plan

## Newsroom Repair Pipeline follow-up

- Fix targeted repair validation so a middle replacement does not look like locked section drift.
- Keep locked section order/source URL/source candidate hash/headline/category stable at the original `beforeSections` index.
- Treat `FAILED_REPAIR_REVIEWABLE` as successful review artifact creation, but never as publish-ready.
- Keep Newsletter Policy values sourced from `config/newsletter-policy.json`.
- Reuse the newsroom selection URL normalization rule for editor output candidate matching.

## Implementation Scope

- `scripts/newsroom/cli/gemini-newsroom-newsletter.js`
  - Validate targeted repair section count before locked section checks.
  - Match locked sections back to their original `beforeSections` index by stable key.
  - Reject locked source/hash/headline/category drift.
  - Force fallback status booleans for `FAILED_REPAIR_REVIEWABLE`.
- `scripts/newsroom/common/publish-status.js`
  - Read `editor-draft.json` as a publish status input.
  - Recognize complete `FAILED_REPAIR_REVIEWABLE` artifacts as reviewable but not publishable.
  - Keep missing or invalid canonical artifacts as diagnostics/failure.
- `scripts/newsroom/validate/editor-output-contract.js`
  - Use `normalizeUrl` from `newsroom-selection.js` for reporter candidate URL matching.
- tests
  - Add middle replacement, locked reorder, failed repair status, and URL matching regressions.

## Validation

- `npm.cmd run test`
- `npm.cmd run validate:policy`
- `npm.cmd run check:policy-docs`
- `npm.cmd run validate`
- Run `npm.cmd run generate` only if a fixture/dry-run or non-live-API path is available.
