# 기존 뉴스레터 품질 Cleanup Report

Issue #108은 unsupported seed evidence provenance를 사후 보강하지 않고 historical public archive cleanup 상태만 추적합니다.

## Historical Archive Trust Summary

- reviewed archive: 0
- deprecated archive: 0
- removed archive: 1
- known unreviewed archive: 13
- data/newsletters.json에 없는 public artifact 날짜: 3
- content/newsroom 전용 날짜: 2

## Validation Status

- validation errors: 0
- validation warnings: 0

## Archive Entries

| Date | Artifact scope | Archive status | Public visibility | Data index | Public artifact | Known limitations | Issue |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05-19 | public_archive | historical_unreviewed | unlisted | no | yes | not_listed_in_data_newsletters, historical_cleanup_pending | #108 |
| 2026-05-18 | public_archive | historical_unreviewed | unlisted | no | yes | not_listed_in_data_newsletters, historical_cleanup_pending | #108 |
| 2026-05-17 | public_archive | historical_unreviewed | unlisted | no | yes | not_listed_in_data_newsletters, historical_cleanup_pending | #108 |
| 2026-05-16 | public_archive | historical_unreviewed | listed | yes | yes | pre_185_generation, source_provenance_not_backfilled, historical_cleanup_pending | #108 |
| 2026-05-15 | public_archive | historical_unreviewed | listed | yes | yes | pre_185_generation, source_provenance_not_backfilled, historical_cleanup_pending | #108 |
| 2026-05-14 | non_public_newsroom_artifact | none | not_public | no | no | none | #108 |
| 2026-05-13 | public_archive | historical_unreviewed | listed | yes | yes | pre_185_generation, source_provenance_not_backfilled, historical_cleanup_pending | #108 |
| 2026-05-12 | public_archive | historical_unreviewed | listed | yes | yes | pre_185_generation, source_provenance_not_backfilled, historical_cleanup_pending | #108 |
| 2026-05-11 | public_archive | historical_unreviewed | listed | yes | yes | pre_185_generation, source_provenance_not_backfilled, historical_cleanup_pending | #108 |
| 2026-05-10 | public_archive | historical_unreviewed | listed | yes | yes | pre_185_generation, source_provenance_not_backfilled, historical_cleanup_pending | #108 |
| 2026-05-09 | public_archive | historical_unreviewed | listed | yes | yes | pre_185_generation, source_provenance_not_backfilled, historical_cleanup_pending | #108 |
| 2026-05-08 | public_archive | historical_unreviewed | listed | yes | yes | pre_185_generation, source_provenance_not_backfilled, historical_cleanup_pending | #108 |
| 2026-05-07 | public_archive | historical_unreviewed | listed | yes | yes | pre_185_generation, source_provenance_not_backfilled, historical_cleanup_pending | #108 |
| 2026-05-06 | non_public_newsroom_artifact | none | not_public | no | no | none | #108 |
| 2026-05-05 | public_archive | historical_unreviewed | listed | yes | yes | pre_185_generation, source_provenance_not_backfilled, historical_cleanup_pending | #108 |
| 2026-04-30 | public_archive | removed | removed | no | no | format_inconsistency, delete_only_slice, removed_via_73, excluded_from_rewrite_path | #73 |

## data/newsletters.json에 없는 Public Dates

- 2026-05-17
- 2026-05-18
- 2026-05-19

## Non-public newsroom artifacts

`not_public` is an audit report classification, not a `content/audit/historical-archive-status.json` sidecar enum value.

These dates have `content/newsroom/YYYY-MM-DD/` artifacts but no public newsletter artifact. They are not public archive entries and are not subject to #108 public archive cleanup.

- 2026-05-06
- 2026-05-14
