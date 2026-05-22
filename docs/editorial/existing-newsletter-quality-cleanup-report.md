# 기존 뉴스레터 품질 Cleanup Report

이 문서는 unsupported seed evidence provenance를 사후 보강하지 않고 historical public archive cleanup 상태만 추적합니다.

## Final Archive Trust Summary

### Date-level status

- reviewed archive dates: 8
- removed archive dates: 9
- historical unreviewed dates: 0
- deprecated archive dates: 0
- data/newsletters.json에 없는 public artifact 날짜: 0
- content/newsroom 전용 날짜: 0

### Article-level status

- reviewed article rows: 17
- removed article rows: 9
- accepted limitation rows: 17
- remaining S0/S1 rows: 0
- remaining rewrite/downgrade/archive-note rows: 0
- remaining source gap rows: 0
- remaining overclaim risk rows: 0
- remaining weak actionability rows: 0

## Final Review Transition Rule

- A retained article row is final-reviewed only when no rewrite/downgrade/archive-note decision remains.
- `medium` overclaim, `partial` source-backed coverage, `generic` actionability, and weak historical format are allowed only as accepted historical limitations recorded in this report.
- A retained date becomes `reviewed_archive` only when every retained article row for that date is final-reviewed or explicitly covered by accepted limitations.

## Final Metric Policy

- `remaining_source_gap_count` counts rows with `source_url_present=no` or `source_backed_fact_present=no`.
- `source_backed_fact_present=partial` is not counted as a remaining source gap when recorded as an accepted historical limitation.
- `remaining_overclaim_risk_count` counts unresolved `high` or unresolved `medium` overclaim risk.
- `remaining_weak_actionability_count` counts unresolved `none` or unresolved `generic` actionability.

## Remaining Accepted Limitations

- Pre-seed-evidence generation: source provenance was not backfilled.
- Partial source-backed coverage rows retained as accepted limitations: 17
- Generic actionability rows retained as accepted limitations: 10
- Medium overclaim rows retained as accepted limitations: 3
- Weak historical format rows retained as accepted limitations: 17

### Unlisted reviewed archives

These remain unlisted because they are absent from `data/newsletters.json`. This final trust report reviews their artifact quality but does not change public index visibility.

- none

## Historical Content Normalizations

- 2026-05-11 received date-level global action item normalization. No article-level material rewrite diff was added because article body meaning did not change; the change is recorded in the final archive trust report.

## Material Rewrite Traceability

| Date | Rewrite count | Diff artifacts |
| --- | ---: | --- |
| 2026-05-05 | 4 | `content/audit/historical-rewrite-diff/2026-05-05-firebase-ai-logic-camera-hal-npu-gpu.md`<br>`content/audit/historical-rewrite-diff/2026-05-05-claude-code-2-1-128-camera-hal-workflow-review.md`<br>`content/audit/historical-rewrite-diff/2026-05-05-c-26-assert-camera-hal-debug-build.md`<br>`content/audit/historical-rewrite-diff/2026-05-05-2026-5-android-camera-related-cve.md` |
| 2026-05-07 | 2 | `content/audit/historical-rewrite-diff/2026-05-07-libcamera-v0-7-1.md`<br>`content/audit/historical-rewrite-diff/2026-05-07-libcamera-v0-7-1-softisp.md` |
| 2026-05-11 | 1 | `content/audit/historical-rewrite-diff/2026-05-11-camerax-1-6-1-android-camera.md` |

## Validation Status

- validation errors: 0
- validation warnings: 0

## Final Decision

Archive trust cleanup is complete because no unresolved S0/S1 rows remain, all material rewrites have diff artifacts, pre-seed-evidence provenance was not backfilled, and final validation passed.

## Archive Entries

| Date | Artifact scope | Archive status | Public visibility | Data index | Public artifact | Known limitations | Cleanup context |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05-22 | public_archive | stable_archive | listed | yes | yes | review_only_publication | review_only_publication |
| 2026-05-21 | public_archive | stable_archive | listed | yes | yes | review_only_publication | review_only_publication |
| 2026-05-20 | public_archive | stable_archive | listed | yes | yes | none | current_generation_archive_review |
| 2026-05-19 | public_archive | removed | removed | no | no | not_listed_in_data_newsletters, duplicate_news_source_cleanup, removed_archive_entry, public_route_intentionally_removed | source_dedup_cleanup |
| 2026-05-18 | public_archive | removed | removed | no | no | not_listed_in_data_newsletters, duplicate_news_source_cleanup, removed_archive_entry, public_route_intentionally_removed | source_dedup_cleanup |
| 2026-05-17 | public_archive | removed | removed | no | no | not_listed_in_data_newsletters, duplicate_news_source_cleanup, removed_archive_entry, public_route_intentionally_removed | source_dedup_cleanup |
| 2026-05-16 | public_archive | removed | removed | no | no | pre_185_generation, source_provenance_not_backfilled, duplicate_news_source_cleanup, removed_archive_entry, public_route_intentionally_removed | source_dedup_cleanup |
| 2026-05-15 | public_archive | reviewed_archive | listed | yes | yes | pre_185_generation, source_provenance_not_backfilled | historical_archive_cleanup |
| 2026-05-13 | public_archive | removed | removed | no | no | pre_185_generation, source_provenance_not_backfilled, duplicate_news_source_cleanup, removed_archive_entry, public_route_intentionally_removed | source_dedup_cleanup |
| 2026-05-12 | public_archive | reviewed_archive | listed | yes | yes | pre_185_generation, source_provenance_not_backfilled | historical_archive_cleanup |
| 2026-05-11 | public_archive | reviewed_archive | listed | yes | yes | pre_185_generation, source_provenance_not_backfilled | historical_archive_cleanup |
| 2026-05-10 | public_archive | removed | removed | no | no | pre_185_generation, source_provenance_not_backfilled, duplicate_news_source_cleanup, removed_archive_entry, public_route_intentionally_removed | source_dedup_cleanup |
| 2026-05-09 | public_archive | removed | removed | no | no | pre_185_generation, source_provenance_not_backfilled, duplicate_news_source_cleanup, removed_archive_entry, public_route_intentionally_removed | source_dedup_cleanup |
| 2026-05-08 | public_archive | removed | removed | no | no | pre_185_generation, source_provenance_not_backfilled, duplicate_news_source_cleanup, removed_archive_entry, public_route_intentionally_removed | source_dedup_cleanup |
| 2026-05-07 | public_archive | reviewed_archive | listed | yes | yes | pre_185_generation, source_provenance_not_backfilled | historical_archive_cleanup |
| 2026-05-05 | public_archive | reviewed_archive | listed | yes | yes | pre_185_generation, source_provenance_not_backfilled | historical_archive_cleanup |
| 2026-04-30 | public_archive | removed | removed | no | no | format_inconsistency, delete_only_slice, removed_archive_entry, excluded_from_rewrite_path | removed_archive_cleanup |

## data/newsletters.json에 없는 Public Dates

- none

## Non-public newsroom artifacts

`not_public` is an audit report classification, not a `content/audit/historical-archive-status.json` sidecar enum value.

These dates have `content/newsroom/YYYY-MM-DD/` artifacts but no public newsletter artifact. They are not public archive entries and are not subject to public archive cleanup.

- none
