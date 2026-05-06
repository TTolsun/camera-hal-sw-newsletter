# Source Effectiveness Report

## Summary

- Add a deterministic Source Effectiveness Report without changing generation, selection, quality gate, image validation, or source registry behavior.
- Keep planning history under `docs/plans/`; do not leave a root `PLAN.md` in the final PR.
- Produce `source-effectiveness-report.json` and `source-effectiveness-report.md` from existing artifacts only.

## Implementation Notes

- Put implementation in `scripts/newsroom/metrics/source-effectiveness-report.js`.
- Keep root `scripts/build-source-effectiveness-report.js` as a wrapper only.
- Match candidate sources in this order: `source_id`, `sourceId`, `source.id`, `source_name`, `source`, `sourceUrl`, `rssUrl`, domain.
- Group unmatched candidates into deterministic synthetic sources and emit warnings.
- Keep all table sorting deterministic and omit run-time timestamps from output artifacts.

## Validation

- `npm.cmd run test:source-effectiveness`
- `npm.cmd run test`
- `npm.cmd run validate`
- `npm.cmd run ci`
