# Current Plan

## PR #40 Annotation Target Follow-up

- Work directly on `main`; do not create a new branch.
- Keep the patch narrow: annotation target resolution, regression tests, and libcamera parser spelling input matching only.
- Do not change workflow structure, quality thresholds, hard-fail policy, PR body wording, or generated newsletter content.

## Implementation Scope

- Update `scripts/newsroom/cli/annotate-publication-quality.js`.
  - Preserve `--all` and explicit `--date` behavior.
  - Treat detected `targetDates` from `strictTargetDates()` or `options.targetDates` as authoritative.
  - If detected target dates are non-empty, all dates must exist in `data/newsletters.json`.
  - If any detected date is missing, fail with an error that lists all missing dates.
  - Do not partially annotate matching dates and do not fallback to latest when any detected date is missing, even with `--latest`.
  - Use latest fallback only when detected target dates are empty and `--latest` is present.
- Update `scripts/newsroom/collect/source-item-parsers.js`.
  - Accept `debaying`, `de-bayering`, and `debayering` as input evidence.
  - Keep output normalized to `debayering`.
- Update tests.
  - Add `resolveTargetItems()` regression coverage for missing detected dates with `--latest`.
  - Add libcamera parser spelling variant coverage with normalized output.

## Validation

- Run `node --test tests/workflow-scripts.test.js`.
- Run `node --test tests/source-item-parsers.test.js`.
- Run `npm.cmd run test`.
- Run `npm.cmd run validate`.
- Self-review for P1/P2 risks: silent latest fallback, partial annotation of detected dates, missing-date diagnostics, workflow or generated-content drift, and quality/hard-fail policy drift.
