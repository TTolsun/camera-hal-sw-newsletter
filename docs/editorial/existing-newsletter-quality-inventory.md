# Existing Newsletter Quality Inventory

Issue #108은 이 inventory를 사용해 historical archive cleanup 우선순위를 정합니다. 이 문서는 historical article을 source-backed article로 바꾸지 않으며, 현재 review 상태와 권장 cleanup 방향만 기록합니다.

## Inventory Scope

- Includes article-level rows for the 13 current public artifact dates in `newsletters/YYYY-MM-DD/newsletter.md`.
- Includes one removed archive summary row for `2026-04-30` because #73 completed the delete-only slice.
- Excludes newsroom-only dates `2026-05-06` and `2026-05-14` because they are not public archive entries.
- Article heading count was recalculated from public `newsletter.md` files during this expansion: 40 article rows plus 1 removed summary row.
- Article rows include main/brief article title headings only; references, action items, briefing, source list, and editorial/meta headings are excluded.
- `Article slug` is unique within the same date. Historical rewrite diff paths use `<date>-<article_slug>.md`, so cross-date slug duplication is allowed.

## Allowed Values

- `Source URL present`: `yes` / `no` / `unknown`
- `Source-backed fact present`: `yes` / `partial` / `no` / `unknown`
- `HAL relevance`: `high` / `medium` / `low` / `none` / `unknown`
- `Action item specificity`: `specific` / `generic` / `none` / `unknown`
- `Overclaim risk`: `high` / `medium` / `low` / `unknown`
- `Format consistency`: `good` / `weak` / `inconsistent` / `unknown`
- `Current quality status`: `historical_unreviewed` / `removed` / `review_pending`
- `Recommended decision`: `keep_candidate` / `audit_first` / `downgrade_review` / `rewrite_review` / `archive_note_review` / `delete_completed_via_73`
- `Severity`: `S0` / `S1` / `S2` / `S3` / `pending`

## Source Review Rules

- `source_url_present=yes` means the article section itself, or its immediately adjacent `Sources` / `출처` block, contains a URL.
- A URL that appears only in the global `참고자료` section does not by itself prove article-level source coverage.
- `source_backed_fact_present` is separate from `source_url_present`; use `partial` or `unknown` when claim-level source coverage has not been fully verified.
- `partial` means source links exist or appear related, but claim-level source coverage has not been fully verified. Rows marked `yes` / `partial` are not considered reviewed.

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
| 2026-05-19 | libcamera v0.7.1 릴리스: SoftISP와 센서 모드 설정 업데이트 | libcamera-v0-7-1-softisp | yes | partial | high | specific | low | good | historical_unreviewed | keep_candidate | pending | direct camera driver source; verify claim coverage before marking reviewed |
| 2026-05-19 | GCC 16.1 릴리스: C++20 기본값 전환과 C++26 기능 확장 | gcc-16-1-c-20-c-26 | yes | partial | low | generic | medium | good | historical_unreviewed | downgrade_review | S1 | tooling/fallback item; HAL runtime impact must stay bounded |
| 2026-05-19 | Glaze 7.2: C++26 Reflection 기반 직렬화 지원 확대 | glaze-7-2-c-26-reflection | yes | partial | low | generic | medium | good | historical_unreviewed | downgrade_review | S1 | tooling/fallback item; HAL runtime impact must stay bounded |
| 2026-05-18 | libcamera Release Announcements - libcamera v0.7.1 | libcamera-release-announcements-libcamera-v0-7-1 | yes | partial | high | specific | low | weak | historical_unreviewed | keep_candidate | pending | direct camera driver source; verify claim coverage before marking reviewed |
| 2026-05-18 | Tooling Watch / Fallback: GCC 16.1 released: C++26 reflection / contracts / safety hardening, C++20 by default, and more! | tooling-watch-fallback-gcc-16-1-released-c-26-reflection-contracts-safety-hardening-c-20-by-default-and-more | yes | partial | low | generic | medium | weak | historical_unreviewed | downgrade_review | S1 | tooling/fallback item; HAL runtime impact must stay bounded |
| 2026-05-18 | Tooling Watch / Fallback: Glaze 7.2 - C++26 Reflection \| YAML, CBOR, MessagePack, TOML and more | tooling-watch-fallback-glaze-7-2-c-26-reflection-yaml-cbor-messagepack-toml-and-more | yes | partial | low | generic | medium | weak | historical_unreviewed | downgrade_review | S1 | tooling/fallback item; HAL runtime impact must stay bounded |
| 2026-05-17 | libcamera Release Announcements - libcamera v0.7.1 | libcamera-release-announcements-libcamera-v0-7-1 | yes | partial | high | specific | low | weak | historical_unreviewed | keep_candidate | pending | direct camera driver source; verify claim coverage before marking reviewed |
| 2026-05-17 | Tooling Watch / Fallback: GCC 16.1 released: C++26 reflection / contracts / safety hardening, C++20 by default, and more! | tooling-watch-fallback-gcc-16-1-released-c-26-reflection-contracts-safety-hardening-c-20-by-default-and-more | yes | partial | low | generic | medium | weak | historical_unreviewed | downgrade_review | S1 | tooling/fallback item; HAL runtime impact must stay bounded |
| 2026-05-17 | Tooling Watch / Fallback: Glaze 7.2 - C++26 Reflection \| YAML, CBOR, MessagePack, TOML and more | tooling-watch-fallback-glaze-7-2-c-26-reflection-yaml-cbor-messagepack-toml-and-more | yes | partial | low | generic | medium | weak | historical_unreviewed | downgrade_review | S1 | tooling/fallback item; HAL runtime impact must stay bounded |
| 2026-05-16 | libcamera Release Announcements - libcamera v0.7.1 | libcamera-release-announcements-libcamera-v0-7-1 | yes | partial | high | specific | low | weak | historical_unreviewed | keep_candidate | pending | direct camera driver source; verify claim coverage before marking reviewed |
| 2026-05-16 | Tooling Watch / Fallback: GCC 16.1 released: C++26 reflection / contracts / safety hardening, C++20 by default, and more! | tooling-watch-fallback-gcc-16-1-released-c-26-reflection-contracts-safety-hardening-c-20-by-default-and-more | yes | partial | low | generic | medium | weak | historical_unreviewed | downgrade_review | S1 | tooling/fallback item; HAL runtime impact must stay bounded |
| 2026-05-16 | Tooling Watch / Fallback: Glaze 7.2 - C++26 Reflection \| YAML, CBOR, MessagePack, TOML and more | tooling-watch-fallback-glaze-7-2-c-26-reflection-yaml-cbor-messagepack-toml-and-more | yes | partial | low | generic | medium | weak | historical_unreviewed | downgrade_review | S1 | tooling/fallback item; HAL runtime impact must stay bounded |
| 2026-05-15 | libcamera Release Announcements - libcamera v0.7.1 | libcamera-release-announcements-libcamera-v0-7-1 | yes | partial | high | specific | low | weak | historical_unreviewed | keep_candidate | pending | direct camera driver source; verify claim coverage before marking reviewed |
| 2026-05-15 | Tooling Watch / Fallback: GCC 16.1 released: C++26 reflection / contracts / safety hardening, C++20 by default, and more! | tooling-watch-fallback-gcc-16-1-released-c-26-reflection-contracts-safety-hardening-c-20-by-default-and-more | yes | partial | low | generic | medium | weak | historical_unreviewed | downgrade_review | S1 | tooling/fallback item; HAL runtime impact must stay bounded |
| 2026-05-15 | Tooling Watch / Fallback: GCC 16 Produces Faster Binaries Than GCC 15, Competitive Race With LLVM Clang 22 | tooling-watch-fallback-gcc-16-produces-faster-binaries-than-gcc-15-competitive-race-with-llvm-clang-22 | yes | partial | low | generic | medium | weak | historical_unreviewed | downgrade_review | S1 | tooling/fallback item; HAL runtime impact must stay bounded |
| 2026-05-13 | libcamera Release Announcements - libcamera v0.7.1 | libcamera-release-announcements-libcamera-v0-7-1 | yes | partial | high | specific | low | weak | historical_unreviewed | keep_candidate | pending | direct camera driver source; verify claim coverage before marking reviewed |
| 2026-05-13 | Tooling Watch / Fallback: GCC 16.1 released: C++26 reflection / contracts / safety hardening, C++20 by default, and more! | tooling-watch-fallback-gcc-16-1-released-c-26-reflection-contracts-safety-hardening-c-20-by-default-and-more | yes | partial | low | generic | medium | weak | historical_unreviewed | downgrade_review | S1 | tooling/fallback item; HAL runtime impact must stay bounded |
| 2026-05-13 | Tooling Watch / Fallback: Glaze 7.2 - C++26 Reflection \| YAML, CBOR, MessagePack, TOML and more | tooling-watch-fallback-glaze-7-2-c-26-reflection-yaml-cbor-messagepack-toml-and-more | yes | partial | low | generic | medium | weak | historical_unreviewed | downgrade_review | S1 | tooling/fallback item; HAL runtime impact must stay bounded |
| 2026-05-12 | libcamera Release Announcements - libcamera v0.7.1 | libcamera-release-announcements-libcamera-v0-7-1 | yes | partial | high | specific | low | weak | historical_unreviewed | keep_candidate | pending | direct camera driver source; verify claim coverage before marking reviewed |
| 2026-05-12 | CameraX 1.6.1 업데이트: Android Camera 호환성 관찰 | camerax-1-6-1-android-camera | yes | partial | medium | generic | medium | weak | historical_unreviewed | audit_first | pending | Android Camera adjacent source; direct HAL impact needs review |
| 2026-05-12 | CameraX 1.4.0-alpha07 업데이트: Android Camera 호환성 관찰 | camerax-1-4-0-alpha07-android-camera | yes | partial | medium | generic | medium | weak | historical_unreviewed | audit_first | pending | Android Camera adjacent source; direct HAL impact needs review |
| 2026-05-11 | CameraX 1.4.0-alpha07 및 1.7.0-alpha01 업데이트: 뷰파인더 및 비디오 모듈 변경 | camerax-1-4-0-alpha07-1-7-0-alpha01 | yes | partial | medium | generic | medium | weak | historical_unreviewed | audit_first | pending | Android Camera adjacent source; direct HAL impact needs review |
| 2026-05-11 | libcamera Release Announcements - libcamera v0.7.1 | libcamera-release-announcements-libcamera-v0-7-1 | yes | partial | high | specific | low | weak | historical_unreviewed | keep_candidate | pending | direct camera driver source; verify claim coverage before marking reviewed |
| 2026-05-11 | CameraX 1.6.1 업데이트: Android Camera 호환성 관찰 | camerax-1-6-1-android-camera | yes | partial | medium | generic | medium | weak | historical_unreviewed | audit_first | pending | Android Camera adjacent source; direct HAL impact needs review |
| 2026-05-10 | CameraX 1.6.1 / 1.4.0-alpha07 업데이트: Android Camera 호환성 관찰 | camerax-1-6-1-1-4-0-alpha07-android-camera | yes | partial | medium | generic | medium | weak | historical_unreviewed | audit_first | pending | Android Camera adjacent source; direct HAL impact needs review |
| 2026-05-10 | libcamera v0.7.1: SoftISP 및 camera pipeline 관찰 | libcamera-v0-7-1-softisp-camera-pipeline | yes | partial | high | specific | low | weak | historical_unreviewed | keep_candidate | pending | direct camera driver source; verify claim coverage before marking reviewed |
| 2026-05-09 | libcamera v0.7.1 출시: SoftISP 및 파이프라인 처리량 개선 | libcamera-v0-7-1-softisp | yes | partial | high | specific | low | weak | historical_unreviewed | keep_candidate | pending | direct camera driver source; verify claim coverage before marking reviewed |
| 2026-05-09 | CameraX 1.4.0-alpha07 출시: viewfinder 및 video 모듈 업데이트 | camerax-1-4-0-alpha07-viewfinder-video | yes | partial | medium | generic | medium | weak | historical_unreviewed | audit_first | pending | Android Camera adjacent source; direct HAL impact needs review |
| 2026-05-09 | Tooling Watch / Fallback: Glaze 7.2 - C++26 Reflection \| YAML, CBOR, MessagePack, TOML and more | tooling-watch-fallback-glaze-7-2-c-26-reflection-yaml-cbor-messagepack-toml-and-more | yes | partial | low | generic | medium | weak | historical_unreviewed | downgrade_review | S1 | tooling/fallback item; HAL runtime impact must stay bounded |
| 2026-05-08 | CameraX 1.6.1 릴리스: Camera Maven Group 버전 갱신 확인 | camerax-1-6-1-camera-maven-group | yes | partial | medium | generic | medium | weak | historical_unreviewed | audit_first | pending | Android Camera adjacent source; direct HAL impact needs review |
| 2026-05-08 | libcamera v0.7.1: SoftISP와 image pipeline 릴리스 | libcamera-v0-7-1-softisp-image-pipeline | yes | partial | high | specific | low | weak | historical_unreviewed | keep_candidate | pending | direct camera driver source; verify claim coverage before marking reviewed |
| 2026-05-08 | GCC 16.1: C++26 reflection / contracts 지원 동향 | gcc-16-1-c-26-reflection-contracts | yes | partial | low | generic | medium | weak | historical_unreviewed | downgrade_review | S1 | tooling/fallback item; HAL runtime impact must stay bounded |
| 2026-05-07 | libcamera v0.7.1 릴리스: Raspberry Pi Atomic control lists 및 Simple pipeline AGC/AWB 통계 개선 | libcamera-v0-7-1-raspberry-pi-atomic-control-lists-simple-pipeline-agc-awb | yes | partial | high | specific | low | weak | historical_unreviewed | keep_candidate | pending | direct camera driver source; verify claim coverage before marking reviewed |
| 2026-05-07 | libcamera v0.7.1: 파이프라인 핸들러 및 센서 구성 업데이트 | libcamera-v0-7-1 | yes | partial | high | specific | low | weak | historical_unreviewed | keep_candidate | pending | direct camera driver source; verify claim coverage before marking reviewed |
| 2026-05-07 | libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선 | libcamera-v0-7-1-softisp | yes | partial | high | specific | low | weak | historical_unreviewed | keep_candidate | pending | direct camera driver source; verify claim coverage before marking reviewed |
| 2026-05-07 | Glaze 7.2: Android native HAL 메타데이터 직렬화 PoC 후보 | glaze-7-2-android-native-hal-poc | yes | partial | low | generic | medium | weak | historical_unreviewed | downgrade_review | S1 | tooling/fallback item; HAL runtime impact must stay bounded |
| 2026-05-05 | Claude Code 2.1.128 출시: agent-assisted Camera HAL 개발 워크플로우 영향 | claude-code-2-1-128-agent-assisted-camera-hal | yes | partial | low | generic | high | weak | historical_unreviewed | downgrade_review | S1 | developer tooling item; avoid promoting workflow impact as HAL signal |
| 2026-05-05 | 2026년 5월 Android 보안 게시판 발행: HAL 취약점 점검 필수 | 2026-5-android-hal | yes | partial | medium | specific | medium | weak | historical_unreviewed | audit_first | pending | platform security source present; HAL-specific exposure requires review |
| 2026-05-05 | Firebase AI Logic 하이브리드 추론: Camera HAL 통합 시 NPU/GPU 검토 범위 | firebase-ai-logic-camera-hal-npu-gpu | yes | partial | low | generic | medium | weak | review_pending | audit_first | pending | Firebase overclaim reduced; claim-level source review/final trust review pending |
| 2026-05-05 | C++26 assert() 개선: 네이티브 Camera HAL 코드 안정성 디버깅 신호 | c-26-assert-camera-hal | yes | partial | low | generic | medium | weak | historical_unreviewed | downgrade_review | S1 | tooling/fallback item; HAL runtime impact must stay bounded |
| 2026-04-30 | Removed archive summary | removed-archive-summary | no | no | unknown | none | unknown | inconsistent | removed | delete_completed_via_73 | S3 | #73 delete-only slice completed; no public/newsroom artifact remains |
