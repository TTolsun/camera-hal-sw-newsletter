# 뉴스레터 품질 리포트 - 2026-05-31

## Gate Result

- Quality score: 82
- Quality threshold: 85
- Max score: 100
- Result: NEEDS_FIX
- Summary: Quality score 82, threshold 85, max score 100. Resolve source gaps, fact-check items, composition issues, and deductions before publishing.

## Publication Mode

- publication_mode: n/a
- homepage_visibility: n/a
- content_quality_score: 82
- camera_relevance_score: n/a
- publication_mode_decision: n/a
- fallback_only: false
- camera_anchor_count: n/a
- fallback_public_ready: false

## Composition

- Main article count: 1
- Briefing count: 3
- Structured camera article count: 1
- Legacy regex camera article count: 1
- Expanded-scope article count: 1
- direct_aosp_camera count: 0
- camera_driver_image_pipeline count: 0
- android_platform_camera_adjacent count: 1
- android_multimedia_camera_output count: 0
- soc_platform_signal count: 0
- cpp_ai_tooling_fallback count: 0
- generic_tech_watchlist count: 0
- primary_camera_stack_count: 1
- supporting_main_article_count: 0
- forbidden_main_article_count: 0
- fallback_relevance_count: 0
- publishable_scope_count: 1
- composition_mode: NORMAL
- Newsletter Policy gate: main articles: 1-5; review gate primary camera stack articles: disabled; Publish-ready gate primary camera stack articles: disabled; Publish-ready gate direct AOSP Camera or driver/image pipeline articles: disabled; Publish-ready gate supporting main articles max: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 85
- Relevance bucket counts: {"direct_aosp_camera":0,"camera_driver_image_pipeline":0,"android_platform_camera_adjacent":1,"android_multimedia_camera_output":0,"soc_platform_signal":0,"cpp_ai_tooling_fallback":0,"generic_tech_watchlist":0}
- Topic tier distribution (relevance_bucket): {"direct_camera":1,"multimedia":0,"platform":0,"fallback":0,"watchlist":0}
- AI article count: 0
- Underfilled/composition failure: none

## HAL Signal Quality

- strong_signal_count: 1
- usable_signal_count: 0
- weak_signal_count: 0
- watchlist_only_count: 0
- blocked_source_gap_count: 0
- article_count_with_hal_signal_capsule: 1
- article_count_without_hal_signal_capsule: 0
- generic_signal_hard_blocker_count: 0
- hal_signal_hard_blocker_count: 0
- hard_blocker_reason_code_counts: {}
- hal_impact_axis_counts: {"camerax_app_compatibility":1}
- actionability_level_counts: {"measurable_test":1}
- effective_actionability_level_counts: {"measurable_test":1}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | Google I/O 2026: Jetpack Compose와 CameraX 통합으로 다중 폼 팩터 카메라 미리보기 호환성 강화 | strong_signal | measurable_test | measurable_test | camerax_app_compatibility | complete | none |

## Fact Check And Source Integrity

- Fact-check status: NEEDS_FIX
- Must-fix count: 4
- Source-gap count: 0
- Stale claim status: UNKNOWN
- Stale claim removals: 0
- Stale claim hard failures: 0
- Source integrity violation count: 0
- Blocking deduction count: 1
- Blocking deduction categories: source-integrity
- Hard fail count: 1
- Soft deduction count: 3

## Claim Binding

- Claim validation status: available
- Claim coverage: bound_claims=2; total_claims=3
- Derived evidence mapping count: 0
- Overclaim risk: low
- Uncovered fact count: 0

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Google I/O 2026: Jetpack Compose와 CameraX 통합으로 다중 폼 팩터 카메라 미리보기 호환성 강화 | claim:adaptive_compose_camerax_integration: Jetpack Compose 업데이트는 Jetpack Navigation 3와 함께 모든 창 크기에서 올바른 카메라 미리보기를 지원하기 위한 CameraX 도구를 포함합니다. | fact | bound | app_api_or_framework_adjacent | low | none | sx:bdcf8a4c506e5257a7343e41dd383c5b6ac40d8cafce7140a53fb0aa953a5fb3:evidence_blocks:2b41feb08ba22d15 | https://goo.gle/AdaptiveApps_IO26 |
| Google I/O 2026: Jetpack Compose와 CameraX 통합으로 다중 폼 팩터 카메라 미리보기 호환성 강화 | claim:android_adaptive_by_default_ecosystem: Android 생태계는 폴더블, 태블릿, XR 등 다양한 대화면 및 이종 디바이스 환경을 지향하고 있습니다. | fact | bound | app_api_or_framework_adjacent | low | none | sx:bdcf8a4c506e5257a7343e41dd383c5b6ac40d8cafce7140a53fb0aa953a5fb3:evidence_blocks:2b41feb08ba22d15 | https://goo.gle/AdaptiveApps_IO26 |
| Google I/O 2026: Jetpack Compose와 CameraX 통합으로 다중 폼 팩터 카메라 미리보기 호환성 강화 | claim:hal_dynamic_stream_reconfig_risk: 다양한 화면 크기 및 폼 팩터 전환이 빈번해짐에 따라 하부 HAL의 동적 스트림 재구성 및 버퍼 할당 성능 검증이 중요해집니다. | inference | bound | camera_framework_behavior | medium | none | candidate:bdcf8a4c506e5257a7343e41dd383c5b6ac40d8cafce7140a53fb0aa953a5fb3:source-summary | https://goo.gle/AdaptiveApps_IO26 |

### Uncovered Facts

- none

## Article Structure Contract

- Complete article sections: 1
- Incomplete article sections: 0

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Google I/O 2026: Jetpack Compose와 CameraX 통합으로 다중 폼 팩터 카메라 미리보기 호환성 강화 | pass | present | camerax_app_compatibility | present | none |

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | PASS | preserve | Google I/O 2026: Jetpack Compose와 CameraX 통합으로 다중 폼 팩터 카메라 미리보기 호환성 강화 | android_platform_camera_adjacent | 3 | true | false | false | false | true | bound | shortlist_selected | merged | none | android_platform_camera_adjacent counts toward primary_camera_stack_count. | none | none | none |

## Hard Fails

- 15 pt [source-integrity] Fact checker returned 4 must_fix item(s).

## Soft Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: reader_perspective, action_hint.
- 1 pt [editorial-story] briefing 3: Briefing bullet misses story structure elements: what_happened.

## Top Deduction Categories

- editorial-story (3)
- source-integrity (1)

## Candidate Exclusion Summary

- none

## Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: reader_perspective, action_hint.
- 1 pt [editorial-story] briefing 3: Briefing bullet misses story structure elements: what_happened.
- 15 pt [source-integrity] Fact checker returned 4 must_fix item(s).
