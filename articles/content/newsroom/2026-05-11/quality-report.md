# 뉴스레터 품질 리포트 - 2026-05-11

## Gate Result

- Quality score: 100
- Quality threshold: 85
- Max score: 100
- Result: PASS
- Summary: Quality score 100, threshold 85, max score 100. Editor review is ready.

## Publication Mode

- publication_mode: n/a
- homepage_visibility: n/a
- content_quality_score: 100
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
- hal_impact_axis_counts: {"camerax_app_compatibility":1,"framework_hal_contract":1}
- actionability_level_counts: {"owner_metric_log":1}
- effective_actionability_level_counts: {"owner_metric_log":1}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | CameraX 1.6.1 업데이트: Android Camera 호환성 관찰 | strong_signal | owner_metric_log | owner_metric_log | camerax_app_compatibility, framework_hal_contract | complete | none |

## Fact Check And Source Integrity

- Fact-check status: PASS
- Must-fix count: 0
- Source-gap count: 0
- Stale claim status: UNKNOWN
- Stale claim removals: 0
- Stale claim hard failures: 0
- Source integrity violation count: 0
- Blocking deduction count: 0
- Blocking deduction categories: none
- Hard fail count: 0
- Soft deduction count: 0

## Claim Binding

- Claim validation status: available
- Claim coverage: bound_claims=5; total_claims=5
- Derived evidence mapping count: 0
- Overclaim risk: low
- Uncovered fact count: 0

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CameraX 1.6.1 업데이트: Android Camera 호환성 관찰 | camerax-1-6-1-android-camera-fact-1: Android Developers Latest Updates의 May 06, 2026 항목입니다. | fact | bound | app_api_or_framework_adjacent | low | none | hist:2026-05-11:camerax-1-6-1-android-camera:fact-1 | https://developer.android.com/latest-updates |
| CameraX 1.6.1 업데이트: Android Camera 호환성 관찰 | camerax-1-6-1-android-camera-fact-2: 관련 컴포넌트: CameraX / androidx.camera | fact | bound | app_api_or_framework_adjacent | low | none | hist:2026-05-11:camerax-1-6-1-android-camera:fact-2 | https://developer.android.com/latest-updates |
| CameraX 1.6.1 업데이트: Android Camera 호환성 관찰 | camerax-1-6-1-android-camera-fact-3: CameraX release note는 `camera-camera2`, `camera-core`, `camera-view`, `camera-viewfinder`, `camer... | fact | bound | app_api_or_framework_adjacent | low | none | hist:2026-05-11:camerax-1-6-1-android-camera:fact-3 | https://developer.android.com/latest-updates |
| CameraX 1.6.1 업데이트: Android Camera 호환성 관찰 | camerax-1-6-1-android-camera-fact-4: Android Developers CameraX release notes list AndroidX Camera artifact version updates for May 06... | fact | bound | app_api_or_framework_adjacent | low | none | hist:2026-05-11:camerax-1-6-1-android-camera:fact-4 | https://developer.android.com/latest-updates |
| CameraX 1.6.1 업데이트: Android Camera 호환성 관찰 | camerax-1-6-1-android-camera-fact-5: CameraX 1.6.1 / 1.7.0-alpha01 artifact rows were updated in the AndroidX Camera release notes dat... | fact | bound | app_api_or_framework_adjacent | low | none | hist:2026-05-11:camerax-1-6-1-android-camera:fact-5 | https://developer.android.com/latest-updates |

### Uncovered Facts

- none

## Article Structure Contract

- Complete article sections: 1
- Incomplete article sections: 0

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | CameraX 1.6.1 업데이트: Android Camera 호환성 관찰 | pass | present+guarded | camerax_app_compatibility, framework_hal_contract | present | guardrail-only |

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | PASS | preserve | CameraX 1.6.1 업데이트: Android Camera 호환성 관찰 | android_platform_camera_adjacent | 3 | true | false | false | false | true | bound | shortlist_selected | merged | multimedia_camera_output_relevance | android_platform_camera_adjacent counts toward primary_camera_stack_count. | none | none | none |

## Hard Fails

- none

## Soft Deductions

- none

## Top Deduction Categories

- none

## Candidate Exclusion Summary

- none

## Deductions

- none
