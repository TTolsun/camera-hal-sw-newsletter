# 뉴스레터 품질 리포트 - 2026-05-22

## Gate Result

- Quality score: 80
- Quality threshold: 85
- Max score: 100
- Result: NEEDS_FIX
- Summary: Quality score 80, threshold 85, max score 100. Resolve source gaps, fact-check items, composition issues, and deductions before publishing.

## Publication Mode

- publication_mode: n/a
- homepage_visibility: n/a
- content_quality_score: 80
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
- AI article count: 0
- Underfilled/composition failure: none

## HAL Signal Quality

- strong_signal_count: 0
- usable_signal_count: 0
- weak_signal_count: 1
- watchlist_only_count: 0
- blocked_source_gap_count: 0
- article_count_with_hal_signal_capsule: 1
- article_count_without_hal_signal_capsule: 0
- generic_signal_hard_blocker_count: 1
- hal_signal_hard_blocker_count: 1
- hard_blocker_reason_code_counts: {"hal_actionability_none":1}
- hal_impact_axis_counts: {"camerax_app_compatibility":1}
- actionability_level_counts: {"none":1}
- effective_actionability_level_counts: {"none":1}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | Google I/O 2026: Jetpack Compose 멀티 디바이스 전환에 따른 CameraX 미리보기 호환성 검증 | weak_signal | none | none | camerax_app_compatibility | complete | hal_actionability_none |

## Fact Check And Source Integrity

- Fact-check status: NEEDS_FIX
- Must-fix count: 2
- Source-gap count: 0
- Stale claim status: UNKNOWN
- Stale claim removals: 0
- Stale claim hard failures: 0
- Source integrity violation count: 0
- Blocking deduction count: 2
- Blocking deduction categories: hal-signal, source-integrity
- Hard fail count: 2
- Soft deduction count: 4

## Claim Binding

- Claim validation status: available
- Claim coverage: bound_claims=4; total_claims=4
- Derived evidence mapping count: 4
- Overclaim risk: low
- Uncovered fact count: 0

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Google I/O 2026: Jetpack Compose 멀티 디바이스 전환에 따른 CameraX 미리보기 호환성 검증 | compose_io26_camerax_preview: Google I/O 2026에서 Jetpack Compose 및 Jetpack Navigation 3와 함께 다양한 창 크기에서 올바른 카메라 미리보기를 제공하기 위해 Cam... | fact | soft_warning | app_api_or_framework_adjacent | low | source_url_derived_evidence_mapping | none | https://goo.gle/AdaptiveApps_IO26 |
| Google I/O 2026: Jetpack Compose 멀티 디바이스 전환에 따른 CameraX 미리보기 호환성 검증 | compose_io26_release_date: 발표 날짜는 2026년 5월 19일입니다. | fact | soft_warning | app_api_or_framework_adjacent | low | source_url_derived_evidence_mapping | none | https://goo.gle/AdaptiveApps_IO26 |
| Google I/O 2026: Jetpack Compose 멀티 디바이스 전환에 따른 CameraX 미리보기 호환성 검증 | compose_io26_navigation_3_release: Jetpack Compose 기반의 멀티 디바이스 화면 전환을 지원하기 위한 핵심 도구로 Jetpack Navigation 3가 릴리스되었습니다. | fact | soft_warning | app_api_or_framework_adjacent | low | source_url_derived_evidence_mapping | none | https://goo.gle/AdaptiveApps_IO26 |
| Google I/O 2026: Jetpack Compose 멀티 디바이스 전환에 따른 CameraX 미리보기 호환성 검증 | compose_io26_evidence_summary_claim: Google I/O 2026의 'Building seamless Android experiences across devices with Jetpack Compose' 세션을 ... | fact | soft_warning | app_api_or_framework_adjacent | low | source_url_derived_evidence_mapping | none | https://goo.gle/AdaptiveApps_IO26 |

### Uncovered Facts

- none

## Article Structure Contract

- Complete article sections: 1
- Incomplete article sections: 0

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Google I/O 2026: Jetpack Compose 멀티 디바이스 전환에 따른 CameraX 미리보기 호환성 검증 | pass | present | camerax_app_compatibility | none | none |

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | FAIL | repair-section | Google I/O 2026: Jetpack Compose 멀티 디바이스 전환에 따른 CameraX 미리보기 호환성 검증 | android_platform_camera_adjacent | 3 | true | false | false | false | true | bound | shortlist_selected | merged | none | android_platform_camera_adjacent counts toward primary_camera_stack_count. | none | Main article has actionability_level=none and cannot be publish-ready.; Fact-check must_fix item mentions this section. | claim-binding: Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence.; claim-binding: Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence.; claim-binding: Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence.; claim-binding: Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence. |

## Hard Fails

- 6 pt [hal-signal] Google I/O 2026: Jetpack Compose 멀티 디바이스 전환에 따른 CameraX 미리보기 호환성 검증: Main article has actionability_level=none and cannot be publish-ready.
- 10 pt [source-integrity] Fact checker returned 2 must_fix item(s).

## Soft Deductions

- 1 pt [claim-binding] Google I/O 2026: Jetpack Compose 멀티 디바이스 전환에 따른 CameraX 미리보기 호환성 검증: Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence. (source_url_derived_evidence_mapping)
- 1 pt [claim-binding] Google I/O 2026: Jetpack Compose 멀티 디바이스 전환에 따른 CameraX 미리보기 호환성 검증: Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence. (source_url_derived_evidence_mapping)
- 1 pt [claim-binding] Google I/O 2026: Jetpack Compose 멀티 디바이스 전환에 따른 CameraX 미리보기 호환성 검증: Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence. (source_url_derived_evidence_mapping)
- 1 pt [claim-binding] Google I/O 2026: Jetpack Compose 멀티 디바이스 전환에 따른 CameraX 미리보기 호환성 검증: Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence. (source_url_derived_evidence_mapping)

## Top Deduction Categories

- claim-binding (4)
- hal-signal (1)
- source-integrity (1)

## Candidate Exclusion Summary

- none

## Deductions

- 1 pt [claim-binding] Google I/O 2026: Jetpack Compose 멀티 디바이스 전환에 따른 CameraX 미리보기 호환성 검증: Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence.
- 1 pt [claim-binding] Google I/O 2026: Jetpack Compose 멀티 디바이스 전환에 따른 CameraX 미리보기 호환성 검증: Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence.
- 1 pt [claim-binding] Google I/O 2026: Jetpack Compose 멀티 디바이스 전환에 따른 CameraX 미리보기 호환성 검증: Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence.
- 1 pt [claim-binding] Google I/O 2026: Jetpack Compose 멀티 디바이스 전환에 따른 CameraX 미리보기 호환성 검증: Claim omitted evidence_ids; source_urls were mapped to source-derived candidate evidence.
- 6 pt [hal-signal] Google I/O 2026: Jetpack Compose 멀티 디바이스 전환에 따른 CameraX 미리보기 호환성 검증: Main article has actionability_level=none and cannot be publish-ready.
- 10 pt [source-integrity] Fact checker returned 2 must_fix item(s).
