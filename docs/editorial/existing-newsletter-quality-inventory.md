# Existing Newsletter Quality Inventory

이 inventory는 historical archive cleanup 우선순위를 정합니다. 이 문서는 historical article을 source-backed article로 바꾸지 않으며, 현재 review 상태와 권장 cleanup 방향만 기록합니다.

## Inventory Scope

- Includes article-level rows for public artifact dates retained after source dedup cleanup.
- Includes one removed archive summary row for `2026-04-30` because delete-only cleanup is complete.
- Excludes newsroom-only dates `2026-05-06` and `2026-05-14` because they are not public archive entries.
- Article heading count is maintained by cleanup scripts; removed duplicate-source dates are represented by summary rows.
- Article rows include main/brief article title headings only; references, action items, briefing, source list, and editorial/meta headings are excluded.
- `Article slug` is unique within the same date. Historical rewrite diff paths use `<date>-<article_slug>.md`, so cross-date slug duplication is allowed.

## Allowed Values

- `Source URL present`: `yes` / `no` / `unknown`
- `Source-backed fact present`: `yes` / `partial` / `no` / `unknown`
- `HAL relevance`: `high` / `medium` / `low` / `none` / `unknown`
- `Action item specificity`: `specific` / `generic` / `none` / `unknown`
- `Overclaim risk`: `high` / `medium` / `low` / `unknown`
- `Format consistency`: `good` / `weak` / `inconsistent` / `unknown`
- `Current quality status`: `historical_unreviewed` / `reviewed_archive` / `removed`
- `Recommended decision`: `keep_candidate` / `audit_first` / `keep` / `downgrade_review` / `rewrite_review` / `archive_note_review` / `delete_completed`
- `Severity`: `S0` / `S1` / `S2` / `S3` / `pending` / `none`

## Source Review Rules

- `source_url_present=yes` means the article section itself, or its immediately adjacent `Sources` / `출처` block, contains a URL.
- A URL that appears only in the global `참고자료` section does not by itself prove article-level source coverage.
- `source_backed_fact_present` is separate from `source_url_present`; use `partial` or `unknown` when claim-level source coverage has not been fully verified.
- `partial` means source links exist or appear related, but claim-level source coverage has not been fully verified. Rows marked `partial` are final-reviewed only when the final report records them as accepted historical limitations.

## Final Review Transition Rule

- A retained article row can move to final-reviewed only when no `rewrite_review`, `downgrade_review`, or `archive_note_review` decision remains.
- `overclaim_risk=low` can be final-reviewed directly; `medium` is allowed only when recorded as an accepted historical limitation.
- `source_backed_fact_present=partial` and `action_item_specificity=generic` are allowed only as accepted historical retention limitations.
- A date can become `reviewed_archive` only when every retained article row for that date is final-reviewed or covered by accepted limitations.

## Final Metric Policy

- `remaining_source_gap_count` counts rows with `source_url_present=no` or `source_backed_fact_present=no`.
- `partial` source-backed rows are not counted as source gaps when final report records them as accepted historical limitations.
- `remaining_overclaim_risk_count` counts unresolved `high` or unresolved `medium` overclaim risk.
- `remaining_weak_actionability_count` counts unresolved `none` or unresolved `generic` actionability.

## Severity

| Severity | Meaning | Required action |
| --- | --- | --- |
| S0 | source missing, fabricated claim risk, broken route, duplicate public corruption | delete, archive note, or rewrite mandatory |
| S1 | HAL overclaim, generic AI article promoted as HAL main, no actionable validation item | rewrite or downgrade mandatory |
| S2 | weak readability, weak section structure, weak team-share summary | optional rewrite or minor edit |
| S3 | cosmetic or format inconsistency | low-priority cleanup |

## Inventory

| Date | Article title | Article slug | Source URL present | Source-backed fact present | HAL relevance | Action item specificity | Overclaim risk | Format consistency | Current quality status | Recommended decision | Severity | Review note |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05-19 | Removed archive summary | removed-archive-summary | no | no | unknown | none | unknown | inconsistent | removed | delete_completed | S3 | Source dedup cleanup removed duplicate public route; content was merged into the survivor indexed issue. |
| 2026-05-18 | Removed archive summary | removed-archive-summary | no | no | unknown | none | unknown | inconsistent | removed | delete_completed | S3 | Source dedup cleanup removed duplicate public route; content was merged into the survivor indexed issue. |
| 2026-05-17 | Removed archive summary | removed-archive-summary | no | no | unknown | none | unknown | inconsistent | removed | delete_completed | S3 | Source dedup cleanup removed duplicate public route; content was merged into the survivor indexed issue. |
| 2026-05-16 | Removed archive summary | removed-archive-summary | no | no | unknown | none | unknown | inconsistent | removed | delete_completed | S3 | Source dedup cleanup removed duplicate public route; content was merged into the survivor indexed issue. |
| 2026-05-15 | libcamera Release Announcements - libcamera v0.7.1 | libcamera-release-announcements-libcamera-v0-7-1 | yes | partial | high | specific | low | weak | reviewed_archive | keep | none | Final-reviewed; accepted historical limitation: partial source-backed coverage, weak historical format retained without further rewrite. |
| 2026-05-15 | Tooling Watch / Fallback: GCC 16.1 released: C++26 reflection / contracts / safety hardening, C++20 by default, and more! | tooling-watch-fallback-gcc-16-1-released-c-26-reflection-contracts-safety-hardening-c-20-by-default-and-more | yes | partial | low | generic | low | weak | reviewed_archive | keep | none | Final-reviewed; accepted historical limitation: partial source-backed coverage, generic historical actionability, weak historical format retained without further rewrite. |
| 2026-05-15 | Tooling Watch / Fallback: GCC 16 Produces Faster Binaries Than GCC 15, Competitive Race With LLVM Clang 22 | tooling-watch-fallback-gcc-16-produces-faster-binaries-than-gcc-15-competitive-race-with-llvm-clang-22 | yes | partial | low | generic | low | weak | reviewed_archive | keep | none | Final-reviewed; accepted historical limitation: partial source-backed coverage, generic historical actionability, weak historical format retained without further rewrite. |
| 2026-05-13 | Removed archive summary | removed-archive-summary | no | no | unknown | none | unknown | inconsistent | removed | delete_completed | S3 | Source dedup cleanup removed duplicate public route; content was merged into the survivor indexed issue. |
| 2026-05-12 | libcamera Release Announcements - libcamera v0.7.1 | libcamera-release-announcements-libcamera-v0-7-1 | yes | partial | high | specific | low | weak | reviewed_archive | keep | none | Final-reviewed; accepted historical limitation: partial source-backed coverage, weak historical format retained without further rewrite. |
| 2026-05-12 | CameraX 1.6.1 업데이트: Android Camera 호환성 관찰 | camerax-1-6-1-android-camera | yes | partial | medium | generic | low | weak | reviewed_archive | keep | none | Final-reviewed; accepted historical limitation: partial source-backed coverage, generic historical actionability, weak historical format retained without further rewrite. |
| 2026-05-12 | CameraX 1.4.0-alpha07 업데이트: Android Camera 호환성 관찰 | camerax-1-4-0-alpha07-android-camera | yes | partial | medium | generic | low | weak | reviewed_archive | keep | none | Final-reviewed; accepted historical limitation: partial source-backed coverage, generic historical actionability, weak historical format retained without further rewrite. |
| 2026-05-11 | CameraX 1.4.0-alpha07 및 1.7.0-alpha01 업데이트: 뷰파인더 및 비디오 모듈 변경 | camerax-1-4-0-alpha07-1-7-0-alpha01 | yes | partial | medium | generic | low | weak | reviewed_archive | keep | none | Final-reviewed; accepted historical limitation: partial source-backed coverage, generic historical actionability, weak historical format retained without further rewrite. |
| 2026-05-11 | libcamera Release Announcements - libcamera v0.7.1 | libcamera-release-announcements-libcamera-v0-7-1 | yes | partial | high | specific | low | weak | reviewed_archive | keep | none | Final-reviewed; accepted historical limitation: partial source-backed coverage, weak historical format retained without further rewrite. |
| 2026-05-11 | CameraX 1.6.1 업데이트: Android Camera 호환성 관찰 | camerax-1-6-1-android-camera | yes | partial | medium | generic | low | weak | reviewed_archive | keep | none | Final-reviewed; accepted historical limitation: partial source-backed coverage, generic historical actionability, weak historical format retained without further rewrite. |
| 2026-05-10 | Removed archive summary | removed-archive-summary | no | no | unknown | none | unknown | inconsistent | removed | delete_completed | S3 | Source dedup cleanup removed duplicate public route; content was merged into the survivor indexed issue. |
| 2026-05-09 | Removed archive summary | removed-archive-summary | no | no | unknown | none | unknown | inconsistent | removed | delete_completed | S3 | Source dedup cleanup removed duplicate public route; content was merged into the survivor indexed issue. |
| 2026-05-08 | Removed archive summary | removed-archive-summary | no | no | unknown | none | unknown | inconsistent | removed | delete_completed | S3 | Source dedup cleanup removed duplicate public route; content was merged into the survivor indexed issue. |
| 2026-05-07 | libcamera v0.7.1 릴리스: Raspberry Pi Atomic control lists 및 Simple pipeline AGC/AWB 통계 개선 | libcamera-v0-7-1-raspberry-pi-atomic-control-lists-simple-pipeline-agc-awb | yes | partial | high | specific | low | weak | reviewed_archive | keep | none | Final-reviewed; accepted historical limitation: partial source-backed coverage, weak historical format retained without further rewrite. |
| 2026-05-07 | libcamera v0.7.1: 파이프라인 핸들러 및 센서 구성 업데이트 | libcamera-v0-7-1 | yes | partial | high | specific | low | weak | reviewed_archive | keep | none | Final-reviewed; accepted historical limitation: partial source-backed coverage, weak historical format retained without further rewrite. |
| 2026-05-07 | libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선 | libcamera-v0-7-1-softisp | yes | partial | high | specific | low | weak | reviewed_archive | keep | none | Final-reviewed; accepted historical limitation: partial source-backed coverage, weak historical format retained without further rewrite. |
| 2026-05-07 | Glaze 7.2: native tooling serialization 검토 범위 | glaze-7-2-native-tooling-serialization | yes | partial | low | generic | low | weak | reviewed_archive | keep | none | Final-reviewed; accepted historical limitation: partial source-backed coverage, generic historical actionability, weak historical format retained without further rewrite. |
| 2026-05-05 | Claude Code 2.1.128: Camera HAL workflow review 범위 | claude-code-2-1-128-camera-hal-workflow-review | yes | partial | low | generic | medium | weak | reviewed_archive | keep | none | Final-reviewed; accepted historical limitation: partial source-backed coverage, generic historical actionability, medium overclaim risk already bounded by prior cleanup, weak historical format retained without further rewrite. |
| 2026-05-05 | 2026년 5월 Android 보안 게시판: camera-related CVE 확인 범위 | 2026-5-android-camera-related-cve | yes | partial | medium | specific | low | weak | reviewed_archive | keep | none | Final-reviewed; accepted historical limitation: partial source-backed coverage, weak historical format retained without further rewrite. |
| 2026-05-05 | Firebase AI Logic 하이브리드 추론: Camera HAL 통합 시 NPU/GPU 검토 범위 | firebase-ai-logic-camera-hal-npu-gpu | yes | partial | low | generic | medium | weak | reviewed_archive | keep | none | Final-reviewed; accepted historical limitation: partial source-backed coverage, generic historical actionability, medium overclaim risk already bounded by prior cleanup, weak historical format retained without further rewrite. |
| 2026-05-05 | C++26 assert(): Camera HAL debug-build 검토 범위 | c-26-assert-camera-hal-debug-build | yes | partial | low | generic | medium | weak | reviewed_archive | keep | none | Final-reviewed; accepted historical limitation: partial source-backed coverage, generic historical actionability, medium overclaim risk already bounded by prior cleanup, weak historical format retained without further rewrite. |
| 2026-04-30 | Removed archive summary | removed-archive-summary | no | no | unknown | none | unknown | inconsistent | removed | delete_completed | S3 | Delete-only cleanup completed; no public/newsroom artifact remains |
