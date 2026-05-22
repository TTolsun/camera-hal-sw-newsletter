# 뉴스레터 품질 리포트 - 2026-05-21

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
- camera_driver_image_pipeline count: 1
- android_platform_camera_adjacent count: 0
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
- Relevance bucket counts: {"direct_aosp_camera":0,"camera_driver_image_pipeline":1,"android_platform_camera_adjacent":0,"android_multimedia_camera_output":0,"soc_platform_signal":0,"cpp_ai_tooling_fallback":0,"generic_tech_watchlist":0}
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
- hal_impact_axis_counts: {"driver_image_pipeline":1,"framework_hal_contract":1,"stream_buffer_metadata":1,"cts_vts_its_cdd":1,"performance_latency_frame_drop":1,"soc_resource_contention":1,"camerax_app_compatibility":1}
- actionability_level_counts: {"owner_metric_log":1}
- effective_actionability_level_counts: {"owner_metric_log":1}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | libcamera Release Announcements - libcamera v0.7.1 | strong_signal | owner_metric_log | owner_metric_log | driver_image_pipeline, framework_hal_contract, stream_buffer_metadata, cts_vts_its_cdd, performance_latency_frame_drop, soc_resource_contention, camerax_app_compatibility | complete | none |

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
- Uncovered fact count: 34

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| none | none | none | none | none | none | none | none | none |

### Uncovered Facts

- article=1; headline=libcamera Release Announcements - libcamera v0.7.1; field=article_sections.verified_facts[0]; reason=missing_matching_fact_claim; text=libcamera Release Announcements가 2026-04-28에 게시 또는 업데이트한 항목입니다.
- article=1; headline=libcamera Release Announcements - libcamera v0.7.1; field=article_sections.verified_facts[1]; reason=missing_matching_fact_claim; text=버전/릴리스: libcamera v0.7.1.
- article=1; headline=libcamera Release Announcements - libcamera v0.7.1; field=article_sections.verified_facts[2]; reason=missing_matching_fact_claim; text=관련 컴포넌트: libcamera / V4L2 camera pipeline.
- article=1; headline=libcamera Release Announcements - libcamera v0.7.1; field=article_sections.verified_facts[3]; reason=missing_matching_fact_claim; text=확인된 변경점: Released libcamera v0.7.1 with SoftISP debayering and image pipeline throughput, pipeline handler camera support, sensor mode configuration updates.
- article=1; headline=libcamera Release Announcements - libcamera v0.7.1; field=article_sections.verified_facts[4]; reason=missing_matching_fact_claim; text=libcamera v0.7.1은 2026년 4월 28일에 릴리스되었습니다.
- article=1; headline=libcamera Release Announcements - libcamera v0.7.1; field=article_sections.verified_facts[5]; reason=missing_matching_fact_claim; text=이 릴리스에는 Raspberry Pi의 Atomic control lists에 대한 개선 사항이 포함되어 있습니다.
- article=1; headline=libcamera Release Announcements - libcamera v0.7.1; field=article_sections.verified_facts[6]; reason=missing_matching_fact_claim; text=Simple pipeline의 비례 AGC 및 AWB 통계가 수정되었습니다.
- article=1; headline=libcamera Release Announcements - libcamera v0.7.1; field=article_sections.verified_facts[7]; reason=missing_matching_fact_claim; text=libcamera v0.7.1이 2026년 4월 28일에 출시되었습니다.
- article=1; headline=libcamera Release Announcements - libcamera v0.7.1; field=article_sections.verified_facts[8]; reason=missing_matching_fact_claim; text=주요 변경 사항은 SoftISP debaying 및 이미지 파이프라인 처리량 개선입니다.
- article=1; headline=libcamera Release Announcements - libcamera v0.7.1; field=article_sections.verified_facts[9]; reason=missing_matching_fact_claim; text=파이프라인 핸들러 카메라 지원이 추가되었습니다.
- article=1; headline=libcamera Release Announcements - libcamera v0.7.1; field=article_sections.verified_facts[10]; reason=missing_matching_fact_claim; text=센서 모드 구성이 업데이트되었습니다.
- article=1; headline=libcamera Release Announcements - libcamera v0.7.1; field=article_sections.verified_facts[11]; reason=missing_matching_fact_claim; text=libcamera Release Announcements의 2026-04-28 항목입니다.

## Article Structure Contract

- Complete article sections: 1
- Incomplete article sections: 0

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | libcamera Release Announcements - libcamera v0.7.1 | pass | present+guarded | driver_image_pipeline, framework_hal_contract, stream_buffer_metadata, cts_vts_its_cdd, performance_latency_frame_drop, soc_resource_contention, camerax_app_compatibility | owner_metric_log | guardrail-only |

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | PASS | preserve | libcamera Release Announcements - libcamera v0.7.1 | camera_driver_image_pipeline | 2 | true | true | false | false | true | bound | shortlist_other | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | none |

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
