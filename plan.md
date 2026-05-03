# Newsroom Debug Artifact Snapshot Plan

## Files inspected

- `.github/workflows/weekly-newsroom-pr.yml`
- `package.json`
- `scripts/gemini-newsroom-newsletter.js`
- `scripts/validate-quality.js`
- `newsroom/2026-05-03/`
- `collected-news/2026-05-03/`
- `newsletters/2026-05-03/`

## Current workflow artifact order

The current workflow runs generation, optional validation, metadata resolution, PR body preparation, label setup, `peter-evans/create-pull-request`, PR labeling, and then uploads debug artifacts. The upload step points at broad live checkout paths such as `collected-news/**`, `newsroom/**`, `newsletters/**`, and `data/newsletters.json`, so uploaded files can reflect a checkout state after PR creation rather than the exact state immediately after generation and validation.

## Proposed snapshot location

Use `.tmp/artifact-snapshot` as a frozen, ignored snapshot directory. Create it after generation/validation diagnostics are available and before `peter-evans/create-pull-request`. Copy only current-date artifacts into:

- `.tmp/artifact-snapshot/.tmp/`
- `.tmp/artifact-snapshot/collected-news/<DATE>/`
- `.tmp/artifact-snapshot/newsroom/<DATE>/`
- `.tmp/artifact-snapshot/newsletters/<DATE>/`
- `.tmp/artifact-snapshot/data/`

Then upload only `.tmp/artifact-snapshot` with `actions/upload-artifact`.

The snapshot also preserves failure-debugging context by copying `.tmp/gemini-raw/`, `cache/news-summary/`, and the full current-date `newsroom/<DATE>/` directory when present. This keeps raw Gemini responses, cache records, and attempt-level newsroom files inside the same frozen snapshot rather than uploading broad live checkout paths.

## Manifest schema

Add `scripts/write-artifact-manifest.js`, invoked as:

```powershell
node scripts/write-artifact-manifest.js <snapshot_dir> <date>
```

The script writes `<snapshot_dir>/artifact-manifest.json` with:

- `schema_version`
- `date`
- `generated_at`
- optional `git_sha`, `github_run_id`, and `github_job`
- `status_summary` from `.tmp/newsletter-generation-status.json`, when present
- `quality_summary` from `newsroom/<DATE>/quality-report.json`, when present
- `files` entries containing `path`, `size`, and `sha256`
- `missing_critical_files`
- `consistency_warnings`

Critical file misses are recorded in the manifest rather than failing artifact upload. Consistency diagnostics compare date, score, selected/article count, and status naming where both status and quality report data exist.

## Tests to add

Add `scripts/test-artifact-manifest.js` and `npm run test:artifact`. The test creates temporary fake snapshots and verifies manifest creation, SHA-256 hashes, missing critical file reporting, mismatch warnings, and the no-warning path when status and quality report data agree.
