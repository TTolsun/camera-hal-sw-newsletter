# Reporter vs Final Selection Diagnostics Handoff

## Changed files

- `plan.md`
- `scripts/lib/selection-diagnostics.js`
- `scripts/lib/newsroom-selection.js`
- `scripts/gemini-newsroom-newsletter.js`
- `scripts/lib/newsletter-quality.js`
- `scripts/lib/newsletter-renderer.js`
- `.github/workflows/weekly-newsroom-pr.yml`
- `scripts/test-selection-diagnostics.js`
- `package.json`

## Commands run

- `node --check scripts/lib/selection-diagnostics.js`
- `node --check scripts/lib/newsroom-selection.js`
- `node --check scripts/gemini-newsroom-newsletter.js`
- `node --check scripts/test-selection-diagnostics.js`
- `node --check scripts/lib/newsletter-renderer.js`
- `node --check scripts/lib/newsletter-quality.js`
- `git diff --check`
- `npm.cmd run test:selection-diagnostics`
- `npm.cmd test`
- `npm.cmd run validate`

## Test results

- Selection diagnostics fixture passed.
- Full `node --test` suite passed: 33 tests passed.
- `npm.cmd run validate` passed.
- Existing validation warnings remain for review-only/generated artifacts, including the 2026-05-03 underfilled/non-publishable review quality report. This PR does not try to make that issue pass.

## Compatibility notes

- `reporter-candidates.json` keeps `selected` as a deprecated alias for reporter-stage `reporter_selected`.
- `shortlisted-candidates.json` keeps `selected` as a deterministic final-selection alias for `final_selected`.
- Editor input, retry completion, and quality weak-score deductions now use `final_selected` / `selected_for_editor`, preserving deterministic final-selection behavior while clarifying reporter artifact terminology.
- Existing count fields are preserved; final-prefixed aliases and reporter/final comparison counts were added.
- Quality thresholds, final article minimums, slot classifier logic, source extraction, and watch-page parsing were not changed.

## Remaining risks

- Reporter data is only available after the reporter stage runs, so early deterministic-selection failure artifacts can still show reporter counts as `unknown`.
- Retry duplicate suppression can mark a reporter candidate as no longer editor-usable after deterministic final selection; this preserves existing behavior but can make retry-attempt reporter flags differ from the original deterministic shortlist.
- Generated historical artifacts are not rewritten by this PR; new schema fields appear on newly generated newsroom artifacts.

## Next suggested PR

Slot classifier false-positive cleanup.
