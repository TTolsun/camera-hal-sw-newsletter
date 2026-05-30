# Existing Newsletter Quality Inventory

이 inventory는 historical archive cleanup 우선순위를 정합니다. 이 문서는 historical article을 source-backed article로 바꾸지 않으며, 현재 review 상태와 권장 cleanup 방향만 기록합니다.

## Inventory 범위

- source dedup cleanup 후 보존된 public artifact 날짜의 기사 단위 행을 포함합니다.
- `2026-04-30`의 delete-only cleanup이 완료되었으므로 삭제된 archive 요약 행을 하나 포함합니다.
- `2026-05-06`과 `2026-05-14`는 public archive 항목이 아니므로 제외합니다.
- 기사 heading count는 cleanup script가 관리합니다. 삭제된 중복 source 날짜는 요약 행으로 표시합니다.
- 기사 행에는 main/brief article title heading만 포함합니다. 참고자료, action item, briefing, source list, editorial/meta heading은 제외합니다.
- `Article slug`는 같은 날짜 안에서 고유합니다. historical rewrite diff 경로는 `<date>-<article_slug>.md`를 사용하므로 날짜 간 slug 중복은 허용됩니다.

## 허용 값

- `Source URL present`: `yes` / `no` / `unknown`
- `Source-backed fact present`: `yes` / `partial` / `no` / `unknown`
- `HAL relevance`: `high` / `medium` / `low` / `none` / `unknown`
- `Action item specificity`: `specific` / `generic` / `none` / `unknown`
- `Overclaim risk`: `high` / `medium` / `low` / `unknown`
- `Format consistency`: `good` / `weak` / `inconsistent` / `unknown`
- `Current quality status`: `historical_unreviewed` / `reviewed_archive` / `removed`
- `Recommended decision`: `keep_candidate` / `audit_first` / `keep` / `downgrade_review` / `rewrite_review` / `archive_note_review` / `delete_completed`
- `Severity`: `S0` / `S1` / `S2` / `S3` / `pending` / `none`

## Source 검토 규칙

- `source_url_present=yes`는 기사 섹션 자체 또는 바로 인접한 `Sources` / `출처` 블록에 URL이 있음을 의미합니다.
- 전역 `참고자료` 섹션에만 있는 URL은 기사 단위 source coverage를 증명하지 않습니다.
- `source_backed_fact_present`는 `source_url_present`와 별개입니다. claim 단위 source coverage가 완전히 검증되지 않았으면 `partial` 또는 `unknown`을 사용합니다.
- `partial`은 source 링크가 존재하거나 관련성이 있어 보이지만 claim 단위 source coverage가 완전히 검증되지 않은 상태입니다. `partial`로 표시된 행은 최종 report에 accepted historical limitations로 기록될 때만 final-reviewed가 됩니다.

## 최종 리뷰 전환 규칙

- 보존된 기사 행은 `rewrite_review`, `downgrade_review`, `archive_note_review` 결정이 없을 때만 final-reviewed로 이동할 수 있습니다.
- `overclaim_risk=low`는 바로 final-reviewed가 될 수 있습니다. `medium`은 accepted historical limitation으로 기록된 경우에만 허용됩니다.
- `source_backed_fact_present=partial`과 `action_item_specificity=generic`은 accepted historical retention limitations로만 허용됩니다.
- 날짜는 해당 날짜의 모든 보존 기사 행이 final-reviewed이거나 accepted limitations로 커버될 때만 `reviewed_archive`가 됩니다.

## 최종 지표 정책

- `remaining_source_gap_count`는 `source_url_present=no` 또는 `source_backed_fact_present=no` 행을 셉니다.
- `partial` source-backed 행은 최종 report에 accepted historical limitations로 기록된 경우 source gap으로 집계하지 않습니다.
- `remaining_overclaim_risk_count`는 미해결 `high` 또는 미해결 `medium` overclaim risk를 셉니다.
- `remaining_weak_actionability_count`는 미해결 `none` 또는 미해결 `generic` actionability를 셉니다.

## Severity

| Severity | 의미 | 필요 조치 |
| --- | --- | --- |
| S0 | source 누락, 허위 claim 위험, 경로 파손, 중복 public 오염 | 삭제, archive note, 또는 재작성 필수 |
| S1 | HAL overclaim, generic AI 기사를 HAL main으로 승격, actionable validation item 없음 | 재작성 또는 downgrade 필수 |
| S2 | 약한 가독성, 약한 섹션 구조, 약한 팀 공유 요약 | 선택적 재작성 또는 소규모 편집 |
| S3 | 외형 또는 포맷 불일치 | 낮은 우선순위 cleanup |

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
