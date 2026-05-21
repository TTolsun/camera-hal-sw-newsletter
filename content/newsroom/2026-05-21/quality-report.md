# 뉴스레터 품질 리포트 - 2026-05-21

## Gate Result

- Quality score: 100
- Quality threshold: 85
- Max score: 100
- Result: PASS
- Summary: Quality score 100, threshold 85, max score 100. Editor review is ready.

## Publication Mode

- publication_mode: review_only
- homepage_visibility: normal
- content_quality_score: 100
- camera_relevance_score: 100
- publication_mode_decision: review_only: public files exist for editor-approved publication, but automatic normal publish gate remains closed.
- fallback_only: false
- camera_anchor_count: 3
- fallback_public_ready: false

## Composition

- Main article count: 3
- Briefing count: 3
- Structured camera article count: 3
- Legacy regex camera article count: 3
- Expanded-scope article count: 3
- direct_aosp_camera count: 1
- camera_driver_image_pipeline count: 1
- android_platform_camera_adjacent count: 1
- android_multimedia_camera_output count: 0
- soc_platform_signal count: 0
- cpp_ai_tooling_fallback count: 0
- generic_tech_watchlist count: 0
- primary_camera_stack_count: 3
- supporting_main_article_count: 0
- forbidden_main_article_count: 0
- fallback_relevance_count: 0
- publishable_scope_count: 3
- composition_mode: NORMAL
- Newsletter Policy gate: main articles: 3-5; review gate primary camera stack articles: 1; Publish-ready gate primary camera stack articles: 2; Publish-ready gate direct AOSP Camera or driver/image pipeline articles: 1; Publish-ready gate supporting main articles max: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 85
- Relevance bucket counts: {"direct_aosp_camera":1,"camera_driver_image_pipeline":1,"android_platform_camera_adjacent":1,"android_multimedia_camera_output":0,"soc_platform_signal":0,"cpp_ai_tooling_fallback":0,"generic_tech_watchlist":0}
- AI article count: 1
- Underfilled/composition failure: none

## HAL Signal Quality

- strong_signal_count: 3
- usable_signal_count: 0
- weak_signal_count: 0
- watchlist_only_count: 0
- blocked_source_gap_count: 0
- article_count_with_hal_signal_capsule: 3
- article_count_without_hal_signal_capsule: 0
- generic_signal_hard_blocker_count: 0
- hal_signal_hard_blocker_count: 0
- hard_blocker_reason_code_counts: {}
- hal_impact_axis_counts: {"framework_hal_contract":3,"driver_image_pipeline":3,"stream_buffer_metadata":3,"cts_vts_its_cdd":3,"camerax_app_compatibility":3,"performance_latency_frame_drop":1,"soc_resource_contention":1,"native_tooling_workflow":1}
- actionability_level_counts: {"measurable_test":1,"owner_metric_log":2}
- effective_actionability_level_counts: {"measurable_test":1,"owner_metric_log":2}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | 8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O | strong_signal | measurable_test | measurable_test | framework_hal_contract, driver_image_pipeline, stream_buffer_metadata, cts_vts_its_cdd, camerax_app_compatibility | complete | none |
| 2 | libcamera Release Announcements - libcamera v0.7.1 | strong_signal | owner_metric_log | owner_metric_log | driver_image_pipeline, framework_hal_contract, stream_buffer_metadata, cts_vts_its_cdd, performance_latency_frame_drop, soc_resource_contention, camerax_app_compatibility | complete | none |
| 3 | Start building today - Build native Android apps in Google AI Studio | strong_signal | owner_metric_log | owner_metric_log | camerax_app_compatibility, framework_hal_contract, driver_image_pipeline, stream_buffer_metadata, cts_vts_its_cdd, native_tooling_workflow | complete | none |

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

- Claim validation status: not_available
- Claim coverage: bound_claims=unknown; total_claims=unknown
- Derived evidence mapping count: 0
- Overclaim risk: unknown
- Uncovered fact count: 23

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| none | none | none | none | none | none | none | none | none |

### Uncovered Facts

- article=1; headline=8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O; field=article_sections.verified_facts[0]; reason=missing_matching_fact_claim; text=Android Developers Blog가 Tue, 19 May 2026 13:00:00 +0000에 게시 또는 업데이트한 항목입니다.
- article=1; headline=8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O; field=article_sections.verified_facts[1]; reason=missing_matching_fact_claim; text=관련 컴포넌트: CameraX / Android camera APIs.
- article=1; headline=8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O; field=article_sections.verified_facts[2]; reason=missing_matching_fact_claim; text=확인된 변경점: Jetpack Compose is the definitive engine for this transition, offering core tools like our latest Jetpack Navigation 3 release, new experimental Grid and FlexBox layouts, enhanced non-touch input support, and CameraX for correct camera previews across any window size.
- article=1; headline=8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O; field=confirmed_facts[0]; reason=missing_matching_fact_claim; text=Android Developers Blog가 Tue, 19 May 2026 13:00:00 +0000에 게시 또는 업데이트한 항목입니다.
- article=1; headline=8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O; field=confirmed_facts[1]; reason=missing_matching_fact_claim; text=관련 컴포넌트: CameraX / Android camera APIs.
- article=1; headline=8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O; field=confirmed_facts[2]; reason=missing_matching_fact_claim; text=확인된 변경점: Jetpack Compose is the definitive engine for this transition, offering core tools like our latest Jetpack Navigation 3 release, new experimental Grid and FlexBox layouts, enhanced non-touch input support, and CameraX for correct camera previews across any window size.
- article=1; headline=8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O; field=evidence_summary; reason=missing_matching_fact_claim; text=Android Developers Blog source metadata와 dated candidate evidence를 deterministic fallback builder가 사용했습니다.
- article=2; headline=libcamera Release Announcements - libcamera v0.7.1; field=article_sections.verified_facts[0]; reason=missing_matching_fact_claim; text=libcamera Release Announcements가 2026-04-28에 게시 또는 업데이트한 항목입니다.
- article=2; headline=libcamera Release Announcements - libcamera v0.7.1; field=article_sections.verified_facts[1]; reason=missing_matching_fact_claim; text=버전/릴리스: libcamera v0.7.1.
- article=2; headline=libcamera Release Announcements - libcamera v0.7.1; field=article_sections.verified_facts[2]; reason=missing_matching_fact_claim; text=관련 컴포넌트: libcamera / V4L2 camera pipeline.
- article=2; headline=libcamera Release Announcements - libcamera v0.7.1; field=article_sections.verified_facts[3]; reason=missing_matching_fact_claim; text=확인된 변경점: Released libcamera v0.7.1 with SoftISP debayering and image pipeline throughput, pipeline handler camera support, sensor mode configuration updates.
- article=2; headline=libcamera Release Announcements - libcamera v0.7.1; field=confirmed_facts[0]; reason=missing_matching_fact_claim; text=libcamera Release Announcements가 2026-04-28에 게시 또는 업데이트한 항목입니다.

## Article Structure Contract

- Complete article sections: 3
- Incomplete article sections: 0

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | 8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O | pass | present | framework_hal_contract, driver_image_pipeline, stream_buffer_metadata, cts_vts_its_cdd, camerax_app_compatibility | measurable_test | none |
| 2 | libcamera Release Announcements - libcamera v0.7.1 | pass | present | driver_image_pipeline, framework_hal_contract, stream_buffer_metadata, cts_vts_its_cdd, performance_latency_frame_drop, soc_resource_contention, camerax_app_compatibility | owner_metric_log | none |
| 3 | Start building today - Build native Android apps in Google AI Studio | pass | present | camerax_app_compatibility, framework_hal_contract, driver_image_pipeline, stream_buffer_metadata, cts_vts_its_cdd, native_tooling_workflow | owner_metric_log | none |

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | PASS | preserve | 8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O | direct_aosp_camera | 1 | true | false | false | false | true | bound | shortlist_selected | merged | none | direct_aosp_camera counts toward primary_camera_stack_count. | none | none | none |
| 2 | PASS | preserve | libcamera Release Announcements - libcamera v0.7.1 | camera_driver_image_pipeline | 2 | true | true | false | false | true | bound | shortlist_other | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | none |
| 3 | PASS | preserve | Start building today - Build native Android apps in Google AI Studio | android_platform_camera_adjacent | 3 | true | false | false | false | true | bound | shortlist_selected | merged | none | android_platform_camera_adjacent counts toward primary_camera_stack_count. | none | none | none |

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
