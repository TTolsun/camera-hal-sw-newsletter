# 뉴스레터 품질 리포트 - 2026-05-07

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

- Main article count: 2
- Briefing count: 3
- Structured camera article count: 2
- Legacy regex camera article count: 1
- Expanded-scope article count: 2
- direct_aosp_camera count: 0
- camera_driver_image_pipeline count: 2
- android_platform_camera_adjacent count: 0
- android_multimedia_camera_output count: 0
- soc_platform_signal count: 0
- cpp_ai_tooling_fallback count: 0
- generic_tech_watchlist count: 0
- primary_camera_stack_count: 2
- supporting_main_article_count: 0
- forbidden_main_article_count: 0
- fallback_relevance_count: 0
- publishable_scope_count: 2
- composition_mode: NORMAL
- Newsletter Policy gate: main articles: 1-5; review gate primary camera stack articles: disabled; Publish-ready gate primary camera stack articles: disabled; Publish-ready gate direct AOSP Camera or driver/image pipeline articles: disabled; Publish-ready gate supporting main articles max: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 85
- Relevance bucket counts: {"direct_aosp_camera":0,"camera_driver_image_pipeline":2,"android_platform_camera_adjacent":0,"android_multimedia_camera_output":0,"soc_platform_signal":0,"cpp_ai_tooling_fallback":0,"generic_tech_watchlist":0}
- AI article count: 0
- Underfilled/composition failure: none

## HAL Signal Quality

- strong_signal_count: 2
- usable_signal_count: 0
- weak_signal_count: 0
- watchlist_only_count: 0
- blocked_source_gap_count: 0
- article_count_with_hal_signal_capsule: 2
- article_count_without_hal_signal_capsule: 0
- generic_signal_hard_blocker_count: 0
- hal_signal_hard_blocker_count: 0
- hard_blocker_reason_code_counts: {}
- hal_impact_axis_counts: {"driver_image_pipeline":2,"stream_buffer_metadata":1,"cts_vts_its_cdd":1}
- actionability_level_counts: {"owner_metric_log":2}
- effective_actionability_level_counts: {"owner_metric_log":2}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | libcamera v0.7.1: 파이프라인 핸들러 및 센서 구성 업데이트 | strong_signal | owner_metric_log | owner_metric_log | driver_image_pipeline, stream_buffer_metadata, cts_vts_its_cdd | complete | none |
| 2 | libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선 | strong_signal | owner_metric_log | owner_metric_log | driver_image_pipeline | complete | none |

## Fact Check And Source Integrity

- Fact-check status: PASS
- Must-fix count: 0
- Source-gap count: 0
- Stale claim status: PASS
- Stale claim removals: 0
- Stale claim hard failures: 0
- Source integrity violation count: 0
- Blocking deduction count: 0
- Blocking deduction categories: none
- Hard fail count: 0
- Soft deduction count: 0

## Claim Binding

- Claim validation status: available
- Claim coverage: bound_claims=8; total_claims=8
- Derived evidence mapping count: 0
- Overclaim risk: low
- Uncovered fact count: 0

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| libcamera v0.7.1: 파이프라인 핸들러 및 센서 구성 업데이트 | libcamera-v0-7-1-pipeline-sensor-fact-1: libcamera v0.7.1은 2026년 4월 28일에 릴리스되었습니다. | fact | bound | stream_buffer_metadata | low | none | hist:2026-05-07:libcamera-v0-7-1-pipeline-sensor:fact-1 | https://gitlab.freedesktop.org/camera/libcamera/-/issues/300 |
| libcamera v0.7.1: 파이프라인 핸들러 및 센서 구성 업데이트 | libcamera-v0-7-1-pipeline-sensor-fact-2: 카메라 지원을 위한 파이프라인 핸들러 동작이 업데이트되었습니다. | fact | bound | stream_buffer_metadata | low | none | hist:2026-05-07:libcamera-v0-7-1-pipeline-sensor:fact-2 | https://gitlab.freedesktop.org/camera/libcamera/-/issues/300 |
| libcamera v0.7.1: 파이프라인 핸들러 및 센서 구성 업데이트 | libcamera-v0-7-1-pipeline-sensor-fact-3: 센서 구성 동작이 업데이트되었습니다. | fact | bound | stream_buffer_metadata | low | none | hist:2026-05-07:libcamera-v0-7-1-pipeline-sensor:fact-3 | https://gitlab.freedesktop.org/camera/libcamera/-/issues/300 |
| libcamera v0.7.1: 파이프라인 핸들러 및 센서 구성 업데이트 | libcamera-v0-7-1-pipeline-sensor-fact-4: libcamera v0.7.1 릴리스는 2026년 4월 28일에 발표되었으며, 파이프라인 핸들러 및 센서 구성 동작 업데이트를 포함합니다. 이는 libcamera GitLab... | fact | bound | stream_buffer_metadata | low | none | hist:2026-05-07:libcamera-v0-7-1-pipeline-sensor:fact-4 | https://gitlab.freedesktop.org/camera/libcamera/-/issues/300 |
| libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선 | libcamera-v0-7-1-softisp-fact-1: libcamera v0.7.1은 2026년 4월 28일에 릴리스되었습니다. | fact | bound | performance_latency_thermal | low | none | hist:2026-05-07:libcamera-v0-7-1-softisp:fact-1 | https://gitlab.freedesktop.org/camera/libcamera/-/issues/311 |
| libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선 | libcamera-v0-7-1-softisp-fact-2: SoftISP 디베이어링 동작이 업데이트되었습니다. | fact | bound | performance_latency_thermal | low | none | hist:2026-05-07:libcamera-v0-7-1-softisp:fact-2 | https://gitlab.freedesktop.org/camera/libcamera/-/issues/311 |
| libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선 | libcamera-v0-7-1-softisp-fact-3: SoftISP 처리량 동작이 업데이트되었습니다. | fact | bound | performance_latency_thermal | low | none | hist:2026-05-07:libcamera-v0-7-1-softisp:fact-3 | https://gitlab.freedesktop.org/camera/libcamera/-/issues/311 |
| libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선 | libcamera-v0-7-1-softisp-fact-4: libcamera v0.7.1 릴리스는 2026년 4월 28일에 발표되었으며, SoftISP 디베이어링 및 처리량 동작 업데이트를 포함합니다. 이는 libcamera GitL... | fact | bound | performance_latency_thermal | low | none | hist:2026-05-07:libcamera-v0-7-1-softisp:fact-4 | https://gitlab.freedesktop.org/camera/libcamera/-/issues/311 |

### Uncovered Facts

- none

## Article Structure Contract

- Complete article sections: 2
- Incomplete article sections: 0

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | libcamera v0.7.1: 파이프라인 핸들러 및 센서 구성 업데이트 | pass | present+guarded | driver_image_pipeline, stream_buffer_metadata, cts_vts_its_cdd | owner_metric_log | guardrail-only |
| 2 | libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선 | pass | present+guarded | driver_image_pipeline, performance_latency_thermal | owner_metric_log | guardrail-only |

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | PASS | preserve | libcamera v0.7.1: 파이프라인 핸들러 및 센서 구성 업데이트 | camera_driver_image_pipeline | 2 | true | true | false | false | true | bound | reporter_candidate | merged | multimedia_camera_output_relevance | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | none |
| 2 | PASS | preserve | libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선 | camera_driver_image_pipeline | 2 | true | true | false | false | true | bound | reporter_candidate | merged | multimedia_camera_output_relevance | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | none |

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
