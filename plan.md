# Reporter vs Final Selection Diagnostics Plan

## Files inspected

- `scripts/gemini-newsroom-newsletter.js`
- `scripts/lib/newsroom-selection.js`
- `scripts/lib/newsletter-quality.js`
- `scripts/lib/newsletter-renderer.js`
- `.github/workflows/weekly-newsroom-pr.yml`
- `package.json`

## Current selected field writers/readers

- `scripts/lib/newsroom-selection.js` writes `selected` and `selected_for_editor` for deterministic final shortlist output.
- `scripts/gemini-newsroom-newsletter.js` validates Gemini reporter output where `candidate.selected` is reporter-stage intent, then currently enforces deterministic final selection before writing reporter artifacts and editor inputs.
- `scripts/gemini-newsroom-newsletter.js` reads `candidate.selected` for editor input, retry completion candidates, duplicate removal, and reporter eligibility checks.
- `scripts/lib/newsletter-quality.js` reads reporter `candidate.selected` for selected reporter candidate quality deductions.
- `.github/workflows/weekly-newsroom-pr.yml` reads generation status counts and prints deterministic diagnostics in the PR body.

## Schema compatibility plan

- In `reporter-candidates.json`, keep `selected` as a deprecated reporter-stage alias and add `reporter_selected`, `final_selected`, `selection_stage`, `final_selection_eligibility`, and `final_exclusion_reasons`.
- In `shortlisted-candidates.json`, keep `selected` as a deterministic final alias and add `final_selected`, `reporter_selected`, `selection_stage`, and `selected_for_editor`.
- Add final-prefixed count aliases while preserving existing count fields.
- Update internal final-selection readers to prefer `final_selected` / `selected_for_editor` so editor behavior does not change when reporter `selected` becomes reporter-stage terminology.

## Diagnostics output plan

- Add shared candidate-selection diagnostics helpers under `scripts/lib/selection-diagnostics.js`.
- Add reporter/final count metadata to reporter and shortlist artifacts.
- Add a `Candidate Selection Diagnostics` Markdown block to recovery prompts, retry history, editor-in-chief brief, generation status, and the generated PR body.
- Include the note that reporter-selected candidates are not necessarily publishable and publication readiness is determined by deterministic final selection and quality validation.

## Test plan

- Add `scripts/test-selection-diagnostics.js` with a small fixture covering one final-selected RSS item, one final-excluded watch page, one final-excluded reference page, and one non-reporter-selected excluded candidate.
- Add `npm.cmd run test:selection-diagnostics`.
- Run `node --check` on touched JavaScript files, `npm.cmd run test:selection-diagnostics`, and `npm.cmd run validate`.
