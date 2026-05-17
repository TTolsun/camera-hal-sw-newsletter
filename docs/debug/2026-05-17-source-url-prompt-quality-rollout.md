# Source URL / Prompt Quality Rollout Baseline

Date: `2026-05-17`

This note records the rollout contract for issue `#46`. It is intentionally read-only for existing generated public archive files.

## Baseline

- Use the latest Stage 1/2/3 artifacts to inspect `source_quality` coverage.
- Do not mass-edit generated public archive files under `content/newsroom/**`, `content/collected-news/**`, or `newsletters/**`.
- Treat legacy artifacts without `source_quality` as compatibility warnings during rollout.
- Treat new Stage 3 main articles without canonical `source_quality` as hard failures.

## Required Metrics

The source effectiveness report and PR body should expose:

- `source_url_quality_distribution`
- `source_quality_status_summary`
- `source_quality_blocker_summary`
- `selected_main_source_quality_coverage`
- `conditional_source_promoted_count`
- `conditional_source_blocked_count`
- `unknown_source_quality_count`
- `source_quality_field_drift_count`
- `legacy_source_quality_warning_count`

## Rollout Exit Criteria

- Latest 2 generated issues include `source_quality` for all Stage 3 main articles.
- `legacy_source_quality_warning_count=0` for new artifacts.
- `source_quality_field_drift_count=0`.
- After exit, missing `source_quality` in regenerated Stage 3 artifacts becomes a hard fail for all regenerated artifacts.

## Validation

Run:

```powershell
node --test tests/unit/collect/source-quality-classifier.test.js tests/unit/config/validate-config.test.js tests/unit/generate/article-capsules.test.js tests/contract/newsletter-quality.test.js tests/workflow/source-effectiveness-report.test.js
npm.cmd run validate:config
npm.cmd run test
npm.cmd run validate
```

