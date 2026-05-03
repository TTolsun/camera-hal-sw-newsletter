# Handoff

## Changed files

- `.github/workflows/weekly-newsroom-pr.yml`
  - Adds `Snapshot newsroom debug artifacts` before `peter-evans/create-pull-request`.
  - Uploads only `.tmp/artifact-snapshot`.
  - Copies `.tmp/gemini-raw/`, `cache/news-summary/`, and the full current-date `newsroom/<DATE>/` directory into the snapshot when present.
  - Keeps `if: always()` and `retention-days: 14`.
- `scripts/write-artifact-manifest.js`
  - Writes `artifact-manifest.json` with file hashes, run metadata, missing critical files, and consistency warnings.
- `scripts/test-artifact-manifest.js`
  - Adds Node-based manifest behavior tests.
- `package.json`
  - Adds `test:artifact`.
- `plan.md`
  - Records the pre-edit inspection and implementation plan.

## Commands run

- `node --check scripts\write-artifact-manifest.js`
- `node --check scripts\test-artifact-manifest.js`
- `npm.cmd run test:artifact`
- `npm.cmd run validate`

## Test results

- `node --check scripts\write-artifact-manifest.js`: passed.
- `node --check scripts\test-artifact-manifest.js`: passed.
- `npm.cmd run test:artifact`: passed.
- `npm.cmd run validate`: passed.

Validation emitted existing review-quality warnings for generated newsletter artifacts, including non-publishable historical/review quality reports. The quality gate behavior was not changed.

## Remaining risks

- The snapshot step is a shell workflow step and has not been exercised inside GitHub Actions in this local run.
- If generation fails before writing `.tmp/newsletter-date.txt`, the workflow derives a date from `NEWSLETTER_DATE` or KST current date so the manifest can still be written; date-scoped files are not copied, avoiding stale base-branch artifacts, and missing critical files are recorded.
- Review feedback about omitted Gemini raw output, summary cache, and attempt-level newsroom files was addressed by adding those paths to the frozen snapshot instead of widening the upload path.
- The manifest intentionally records consistency warnings instead of failing artifact upload, so reviewers must inspect `artifact-manifest.json` when diagnosing mismatched files.

## Next suggested PR

Reporter/final candidate terminology and diagnostics: align artifact field names and PR/status wording so `reporter-candidates`, shortlisted candidates, final selected inputs, and generated article counts are easier to compare without cross-reading multiple JSON files.
