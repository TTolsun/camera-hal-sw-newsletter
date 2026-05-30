# 기존 뉴스레터 품질 Cleanup Report

이 문서는 unsupported seed evidence provenance를 사후 보강하지 않고 historical public archive cleanup 상태만 추적합니다.

## 최종 아카이브 신뢰 요약

### 날짜 단위 현황

- reviewed archive dates: 9
- removed archive dates: 9
- historical unreviewed dates: 0
- deprecated archive dates: 0
- data/newsletters.json에 없는 public artifact 날짜: 0
- content/newsroom 전용 날짜: 0

### 기사 단위 현황

- reviewed article rows: 17
- removed article rows: 9
- accepted limitation rows: 17
- remaining S0/S1 rows: 0
- remaining rewrite/downgrade/archive-note rows: 0
- remaining source gap rows: 0
- remaining overclaim risk rows: 0
- remaining weak actionability rows: 0

## 최종 리뷰 전환 규칙

- 보존된 기사 행은 rewrite/downgrade/archive-note 결정이 없을 때만 final-reviewed 상태가 됩니다.
- `medium` overclaim, `partial` source-backed coverage, `generic` actionability, 약한 historical format은 이 report에 기록된 accepted historical limitations로만 허용됩니다.
- 보존된 날짜는 해당 날짜의 모든 보존 기사 행이 final-reviewed이거나 accepted limitations로 명시적으로 커버될 때만 `reviewed_archive`가 됩니다.

## 최종 지표 정책

- `remaining_source_gap_count`는 `source_url_present=no` 또는 `source_backed_fact_present=no` 행을 셉니다.
- `source_backed_fact_present=partial`은 accepted historical limitation으로 기록된 경우 remaining source gap으로 집계하지 않습니다.
- `remaining_overclaim_risk_count`는 미해결 `high` 또는 미해결 `medium` overclaim risk를 셉니다.
- `remaining_weak_actionability_count`는 미해결 `none` 또는 미해결 `generic` actionability를 셉니다.

## 남은 Accepted Limitations

- Seed evidence workflow 이전 생성: source provenance를 사후 보강하지 않음.
- Accepted limitations로 보존한 partial source-backed coverage 행: 17
- Accepted limitations로 보존한 generic actionability 행: 10
- Accepted limitations로 보존한 medium overclaim 행: 3
- Accepted limitations로 보존한 약한 historical format 행: 17

### 목록에 없는 reviewed archives

`data/newsletters.json`에 없어 목록에 등재되지 않은 날짜입니다. 이 최종 신뢰 report는 artifact 품질을 검토하지만 public index 표시를 변경하지 않습니다.

- none

## Historical Content 정규화

- 2026-05-11은 날짜 단위 전역 action item 정규화를 받았습니다. article body 의미가 바뀌지 않아 article 단위 material rewrite diff는 추가하지 않았습니다. 변경은 최종 archive 신뢰 report에 기록됩니다.

## Material Rewrite 추적

| Date | Rewrite count | Diff artifacts |
| --- | ---: | --- |
| 2026-05-05 | 4 | `content/audit/historical-rewrite-diff/2026-05-05-firebase-ai-logic-camera-hal-npu-gpu.md`<br>`content/audit/historical-rewrite-diff/2026-05-05-claude-code-2-1-128-camera-hal-workflow-review.md`<br>`content/audit/historical-rewrite-diff/2026-05-05-c-26-assert-camera-hal-debug-build.md`<br>`content/audit/historical-rewrite-diff/2026-05-05-2026-5-android-camera-related-cve.md` |
| 2026-05-07 | 2 | `content/audit/historical-rewrite-diff/2026-05-07-libcamera-v0-7-1.md`<br>`content/audit/historical-rewrite-diff/2026-05-07-libcamera-v0-7-1-softisp.md` |
| 2026-05-11 | 1 | `content/audit/historical-rewrite-diff/2026-05-11-camerax-1-6-1-android-camera.md` |

## 검증 현황

- validation errors: 0
- validation warnings: 0

## 최종 결정

미해결 S0/S1 행이 없고, 모든 material rewrite에 diff artifact가 있으며, seed evidence 이전 provenance를 사후 보강하지 않았고, 최종 검증이 통과되었으므로 archive 신뢰 cleanup은 완료되었습니다.

## 아카이브 항목

| Date | Artifact scope | Archive status | Public visibility | Data index | Public artifact | Known limitations | Cleanup context |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05-23 | public_archive | stable_archive | listed | yes | yes | review_only_publication | review_only_publication |
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

## 비공개 newsroom artifacts

`not_public`은 audit report 분류값이며 `content/audit/historical-archive-status.json` sidecar enum 값이 아닙니다.

아래 날짜는 `content/newsroom/YYYY-MM-DD/` artifact는 있으나 public newsletter artifact가 없습니다. public archive 항목이 아니며 public archive cleanup 대상이 아닙니다.

- none
