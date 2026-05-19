# 기존 뉴스레터 품질 Cleanup Report

Issue #108은 unsupported seed evidence provenance를 사후 보강하지 않고 historical public archive cleanup 상태만 추적합니다.

## Final Archive Trust Summary

### Date-level status

- reviewed archive dates: 13
- removed archive dates: 1
- historical unreviewed dates: 0
- deprecated archive dates: 0
- data/newsletters.json에 없는 public artifact 날짜: 3
- content/newsroom 전용 날짜: 2

### Article-level status

- reviewed article rows: 40
- removed article rows: 1
- accepted limitation rows: 40
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

- Pre-#185 generation: source provenance was not backfilled.
- Partial source-backed coverage rows retained as accepted limitations: 40
- Generic actionability rows retained as accepted limitations: 25
- Medium overclaim rows retained as accepted limitations: 3
- Weak historical format rows retained as accepted limitations: 37

### Unlisted reviewed archives

These remain unlisted because they are absent from `data/newsletters.json`. This final trust report reviews their artifact quality but does not change public index visibility.

- 2026-05-17
- 2026-05-18
- 2026-05-19

## Issue-level Normalizations

- 2026-05-11 received issue-level global action item normalization. No article-level material rewrite diff was added because article body meaning did not change; the change is recorded in the final archive trust report.

## Material Rewrite Traceability

| Date | Rewrite count | Diff artifacts |
| --- | ---: | --- |
| 2026-05-05 | 4 | `content/audit/historical-rewrite-diff/2026-05-05-firebase-ai-logic-camera-hal-npu-gpu.md`<br>`content/audit/historical-rewrite-diff/2026-05-05-claude-code-2-1-128-camera-hal-workflow-review.md`<br>`content/audit/historical-rewrite-diff/2026-05-05-c-26-assert-camera-hal-debug-build.md`<br>`content/audit/historical-rewrite-diff/2026-05-05-2026-5-android-camera-related-cve.md` |
| 2026-05-07 | 4 | `content/audit/historical-rewrite-diff/2026-05-07-glaze-7-2-native-tooling-serialization.md`<br>`content/audit/historical-rewrite-diff/2026-05-07-libcamera-v0-7-1-raspberry-pi-atomic-control-lists-simple-pipeline-agc-awb.md`<br>`content/audit/historical-rewrite-diff/2026-05-07-libcamera-v0-7-1.md`<br>`content/audit/historical-rewrite-diff/2026-05-07-libcamera-v0-7-1-softisp.md` |
| 2026-05-09 | 2 | `content/audit/historical-rewrite-diff/2026-05-09-camerax-1-4-0-alpha07-viewfinder-video.md`<br>`content/audit/historical-rewrite-diff/2026-05-09-libcamera-v0-7-1-softisp.md` |
| 2026-05-11 | 2 | `content/audit/historical-rewrite-diff/2026-05-11-camerax-1-4-0-alpha07-1-7-0-alpha01.md`<br>`content/audit/historical-rewrite-diff/2026-05-11-camerax-1-6-1-android-camera.md` |

## Validation Status

- validation errors: 0
- validation warnings: 0

## Final Decision

#108 can be closed because no unresolved S0/S1 rows remain, all material rewrites have diff artifacts, pre-#185 provenance was not backfilled, and final validation passed.

## Archive Entries

| Date | Artifact scope | Archive status | Public visibility | Data index | Public artifact | Known limitations | Issue |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05-19 | public_archive | reviewed_archive | unlisted | no | yes | not_listed_in_data_newsletters | #108 |
| 2026-05-18 | public_archive | reviewed_archive | unlisted | no | yes | not_listed_in_data_newsletters | #108 |
| 2026-05-17 | public_archive | reviewed_archive | unlisted | no | yes | not_listed_in_data_newsletters | #108 |
| 2026-05-16 | public_archive | reviewed_archive | listed | yes | yes | pre_185_generation, source_provenance_not_backfilled | #108 |
| 2026-05-15 | public_archive | reviewed_archive | listed | yes | yes | pre_185_generation, source_provenance_not_backfilled | #108 |
| 2026-05-14 | non_public_newsroom_artifact | none | not_public | no | no | none | #108 |
| 2026-05-13 | public_archive | reviewed_archive | listed | yes | yes | pre_185_generation, source_provenance_not_backfilled | #108 |
| 2026-05-12 | public_archive | reviewed_archive | listed | yes | yes | pre_185_generation, source_provenance_not_backfilled | #108 |
| 2026-05-11 | public_archive | reviewed_archive | listed | yes | yes | pre_185_generation, source_provenance_not_backfilled | #108 |
| 2026-05-10 | public_archive | reviewed_archive | listed | yes | yes | pre_185_generation, source_provenance_not_backfilled | #108 |
| 2026-05-09 | public_archive | reviewed_archive | listed | yes | yes | pre_185_generation, source_provenance_not_backfilled | #108 |
| 2026-05-08 | public_archive | reviewed_archive | listed | yes | yes | pre_185_generation, source_provenance_not_backfilled | #108 |
| 2026-05-07 | public_archive | reviewed_archive | listed | yes | yes | pre_185_generation, source_provenance_not_backfilled | #108 |
| 2026-05-06 | non_public_newsroom_artifact | none | not_public | no | no | none | #108 |
| 2026-05-05 | public_archive | reviewed_archive | listed | yes | yes | pre_185_generation, source_provenance_not_backfilled | #108 |
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
