# Android/AOSP HAL Candidate Collection Plan

## Goal

- Keep `MIN_FINAL_ARTICLES`, `ABSOLUTE_MIN_REVIEWABLE_ARTICLES`, and `QUALITY_THRESHOLD` unchanged.
- Keep `cpp_ai_tooling_fallback` excluded from review-gate non-fallback counts.
- Improve official Android/AOSP dated child-item collection for Camera HAL / Android Camera candidates.
- Preserve deterministic selection diagnostics even when generation fails before LLM calls.

## Scope

- PR0-style diagnostics: write date/status/selection report artifacts before fatal deterministic failures.
- PR1-style parser work: improve only official Android/AOSP source parsing for `Android latest updates`, `CameraX Release Notes`, and `AOSP Site Updates`.
- Exclude Linux driver, vendor security, and SoC/media source expansion.
- Keep static reference pages such as `aosp-camera-documentation` out of final article selection.

## Implementation

- Add `selection-report.json` and `selection-report.md` alongside existing `shortlisted-candidates.json` and `selection-diagnostics.md`.
- Ensure artifact snapshots copy the current date-scoped newsroom directory and manifest treats `selection-report.*` as critical diagnostics.
- Extend `parseAospSiteUpdates` to extract month-scoped paragraph/list/table/definition child rows with strict camera evidence.
- Extend `parseCameraXReleaseNotes` to normalize `Version 1.6.0` to `CameraX 1.6.0` and inherit nearby release dates.
- Add targeted CameraX/Android Camera evidence terms to `aosp-camera-scope.js` without broad HAL or generic word matching.

## Validation

- `npm.cmd test`
- `npm.cmd run validate:config`
- `npm.cmd run collect`
- `npm.cmd run validate`
- `git diff --check`
