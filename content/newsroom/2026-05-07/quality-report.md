# 뉴스레터 품질 리포트 - 2026-05-07

## Gate Result

- Quality score: 98
- Quality threshold: 85
- Max score: 100
- Result: PASS
- Summary: Quality score 98, threshold 85, max score 100. Editor review is ready.

## Composition

- Main article count: 4
- Briefing count: 3
- Structured camera article count: 3
- Legacy regex camera article count: 2
- Expanded-scope article count: 4
- direct_aosp_camera count: 0
- camera_driver_image_pipeline count: 3
- android_platform_camera_adjacent count: 0
- soc_platform_signal count: 0
- cpp_ai_tooling_fallback count: 1
- generic_tech_watchlist count: 0
- primary_camera_stack_count: 3
- supporting_main_article_count: 1
- forbidden_main_article_count: 0
- fallback_relevance_count: 1
- publishable_scope_count: 4
- composition_mode: FALLBACK_COMPOSITION
- Newsletter Policy gate: main articles: 3-5; review gate primary camera stack articles: 1; Publish-ready gate primary camera stack articles: 2; Publish-ready gate direct AOSP Camera or driver/image pipeline articles: 1; Publish-ready gate supporting main articles max: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 85
- Relevance bucket counts: {"direct_aosp_camera":0,"camera_driver_image_pipeline":3,"android_platform_camera_adjacent":0,"soc_platform_signal":0,"cpp_ai_tooling_fallback":1,"generic_tech_watchlist":0}
- AI article count: 0
- Underfilled/composition failure: none

## HAL Signal Quality

- strong_signal_count: 3
- usable_signal_count: 1
- weak_signal_count: 0
- watchlist_only_count: 0
- blocked_source_gap_count: 0
- article_count_with_hal_signal_capsule: 4
- article_count_without_hal_signal_capsule: 0
- generic_signal_hard_blocker_count: 0
- hal_signal_hard_blocker_count: 0
- hard_blocker_reason_code_counts: {}
- hal_impact_axis_counts: {"driver_image_pipeline":3,"stream_buffer_metadata":2,"cts_vts_its_cdd":1,"native_tooling_workflow":1}
- actionability_level_counts: {"owner_metric_log":3,"concrete_check":1}
- effective_actionability_level_counts: {"owner_metric_log":3,"concrete_check":1}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | libcamera v0.7.1 릴리스: Raspberry Pi Atomic control lists 및 Simple pipeline AGC/AWB 통계 개선 | strong_signal | owner_metric_log | owner_metric_log | driver_image_pipeline, stream_buffer_metadata | complete | none |
| 2 | libcamera v0.7.1: 파이프라인 핸들러 및 센서 구성 업데이트 | strong_signal | owner_metric_log | owner_metric_log | driver_image_pipeline, stream_buffer_metadata, cts_vts_its_cdd | complete | none |
| 3 | libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선 | strong_signal | owner_metric_log | owner_metric_log | driver_image_pipeline | complete | none |
| 4 | Glaze 7.2: native tooling serialization 검토 범위 | usable_signal | concrete_check | concrete_check | native_tooling_workflow | complete | none |

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
- Soft deduction count: 2

## Claim Binding

- Claim validation status: available
- Claim coverage: bound_claims=15; total_claims=15
- Derived evidence mapping count: 0
- Overclaim risk: low
- Uncovered fact count: 0

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| libcamera v0.7.1 릴리스: Raspberry Pi Atomic control lists 및 Simple pipeline AGC/AWB 통계 개선 | libcamera-v0-7-1-rpi-atomic-agc-awb-fact-1: libcamera v0.7.1은 2026년 4월 28일에 릴리스되었습니다. | fact | bound | driver_image_pipeline | low | none | hist:2026-05-07:libcamera-v0-7-1-rpi-atomic-agc-awb:fact-1 | https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html |
| libcamera v0.7.1 릴리스: Raspberry Pi Atomic control lists 및 Simple pipeline AGC/AWB 통계 개선 | libcamera-v0-7-1-rpi-atomic-agc-awb-fact-2: 이 릴리스에는 Raspberry Pi의 Atomic control lists에 대한 개선 사항이 포함되어 있습니다. | fact | bound | driver_image_pipeline | low | none | hist:2026-05-07:libcamera-v0-7-1-rpi-atomic-agc-awb:fact-2 | https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html |
| libcamera v0.7.1 릴리스: Raspberry Pi Atomic control lists 및 Simple pipeline AGC/AWB 통계 개선 | libcamera-v0-7-1-rpi-atomic-agc-awb-fact-3: Simple pipeline의 비례 AGC 및 AWB 통계가 수정되었습니다. | fact | bound | driver_image_pipeline | low | none | hist:2026-05-07:libcamera-v0-7-1-rpi-atomic-agc-awb:fact-3 | https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html |
| libcamera v0.7.1 릴리스: Raspberry Pi Atomic control lists 및 Simple pipeline AGC/AWB 통계 개선 | libcamera-v0-7-1-rpi-atomic-agc-awb-fact-4: libcamera v0.7.1 릴리스는 2026년 4월 28일에 발표되었으며, Raspberry Pi의 Atomic control lists 및 Simple pipeline의... | fact | bound | driver_image_pipeline | low | none | hist:2026-05-07:libcamera-v0-7-1-rpi-atomic-agc-awb:fact-4 | https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html |
| libcamera v0.7.1: 파이프라인 핸들러 및 센서 구성 업데이트 | libcamera-v0-7-1-pipeline-sensor-fact-1: libcamera v0.7.1은 2026년 4월 28일에 릴리스되었습니다. | fact | bound | stream_buffer_metadata | low | none | hist:2026-05-07:libcamera-v0-7-1-pipeline-sensor:fact-1 | https://gitlab.freedesktop.org/camera/libcamera/-/issues/300 |
| libcamera v0.7.1: 파이프라인 핸들러 및 센서 구성 업데이트 | libcamera-v0-7-1-pipeline-sensor-fact-2: 카메라 지원을 위한 파이프라인 핸들러 동작이 업데이트되었습니다. | fact | bound | stream_buffer_metadata | low | none | hist:2026-05-07:libcamera-v0-7-1-pipeline-sensor:fact-2 | https://gitlab.freedesktop.org/camera/libcamera/-/issues/300 |
| libcamera v0.7.1: 파이프라인 핸들러 및 센서 구성 업데이트 | libcamera-v0-7-1-pipeline-sensor-fact-3: 센서 구성 동작이 업데이트되었습니다. | fact | bound | stream_buffer_metadata | low | none | hist:2026-05-07:libcamera-v0-7-1-pipeline-sensor:fact-3 | https://gitlab.freedesktop.org/camera/libcamera/-/issues/300 |
| libcamera v0.7.1: 파이프라인 핸들러 및 센서 구성 업데이트 | libcamera-v0-7-1-pipeline-sensor-fact-4: libcamera v0.7.1 릴리스는 2026년 4월 28일에 발표되었으며, 파이프라인 핸들러 및 센서 구성 동작 업데이트를 포함합니다. 이는 libcamera GitLab... | fact | bound | stream_buffer_metadata | low | none | hist:2026-05-07:libcamera-v0-7-1-pipeline-sensor:fact-4 | https://gitlab.freedesktop.org/camera/libcamera/-/issues/300 |
| libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선 | libcamera-v0-7-1-softisp-fact-1: libcamera v0.7.1은 2026년 4월 28일에 릴리스되었습니다. | fact | bound | performance_latency_thermal | low | none | hist:2026-05-07:libcamera-v0-7-1-softisp:fact-1 | https://gitlab.freedesktop.org/camera/libcamera/-/issues/311 |
| libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선 | libcamera-v0-7-1-softisp-fact-2: SoftISP 디베이어링 동작이 업데이트되었습니다. | fact | bound | performance_latency_thermal | low | none | hist:2026-05-07:libcamera-v0-7-1-softisp:fact-2 | https://gitlab.freedesktop.org/camera/libcamera/-/issues/311 |
| libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선 | libcamera-v0-7-1-softisp-fact-3: SoftISP 처리량 동작이 업데이트되었습니다. | fact | bound | performance_latency_thermal | low | none | hist:2026-05-07:libcamera-v0-7-1-softisp:fact-3 | https://gitlab.freedesktop.org/camera/libcamera/-/issues/311 |
| libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선 | libcamera-v0-7-1-softisp-fact-4: libcamera v0.7.1 릴리스는 2026년 4월 28일에 발표되었으며, SoftISP 디베이어링 및 처리량 동작 업데이트를 포함합니다. 이는 libcamera GitL... | fact | bound | performance_latency_thermal | low | none | hist:2026-05-07:libcamera-v0-7-1-softisp:fact-4 | https://gitlab.freedesktop.org/camera/libcamera/-/issues/311 |
| Glaze 7.2: native tooling serialization 검토 범위 | glaze-7-2-native-tooling-fact-1: Glaze v7.2.0은 2026년 4월 28일에 릴리스되었습니다. | fact | bound | native_tooling_workflow | low | none | hist:2026-05-07:glaze-7-2-native-tooling:fact-1 | https://isocpp.org//blog/2026/04/glaze-7.2-cpp26-reflection-yaml-cbor-messagepack-toml-and-more |
| Glaze 7.2: native tooling serialization 검토 범위 | glaze-7-2-native-tooling-fact-2: Glaze 7.2는 C++26 Reflection 지원과 YAML, CBOR, MessagePack, TOML 형식 지원을 포함합니다. | fact | bound | native_tooling_workflow | low | none | hist:2026-05-07:glaze-7-2-native-tooling:fact-2 | https://isocpp.org//blog/2026/04/glaze-7.2-cpp26-reflection-yaml-cbor-messagepack-toml-and-more |
| Glaze 7.2: native tooling serialization 검토 범위 | glaze-7-2-native-tooling-fact-3: ISO C++ Blog의 2026년 4월 28일 Glaze v7.2.0 릴리스 글은 C++26 Reflection 지원과 여러 직렬화 형식 지원을 설명합니다. | fact | bound | native_tooling_workflow | low | none | hist:2026-05-07:glaze-7-2-native-tooling:fact-3 | https://isocpp.org//blog/2026/04/glaze-7.2-cpp26-reflection-yaml-cbor-messagepack-toml-and-more |

### Uncovered Facts

- none

## Article Structure Contract

- Complete article sections: 4
- Incomplete article sections: 0

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | libcamera v0.7.1 릴리스: Raspberry Pi Atomic control lists 및 Simple pipeline AGC/AWB 통계 개선 | pass | present+guarded | driver_image_pipeline, stream_buffer_metadata | owner_metric_log | guardrail-only |
| 2 | libcamera v0.7.1: 파이프라인 핸들러 및 센서 구성 업데이트 | pass | present+guarded | driver_image_pipeline, stream_buffer_metadata, cts_vts_its_cdd | owner_metric_log | guardrail-only |
| 3 | libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선 | pass | present+guarded | driver_image_pipeline, performance_latency_thermal | owner_metric_log | guardrail-only |
| 4 | Glaze 7.2: native tooling serialization 검토 범위 | pass | present+guarded | native_tooling_workflow | concrete_check | guardrail-only |

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | PASS | preserve | libcamera v0.7.1 릴리스: Raspberry Pi Atomic control lists 및 Simple pipeline AGC/AWB 통계 개선 | camera_driver_image_pipeline | 2 | true | true | false | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | image-fallback: Article image uses a local fallback visual. |
| 2 | PASS | preserve | libcamera v0.7.1: 파이프라인 핸들러 및 센서 구성 업데이트 | camera_driver_image_pipeline | 2 | true | true | false | false | true | bound | reporter_candidate | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | image-fallback: Article image uses a local fallback visual. |
| 3 | PASS | preserve | libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선 | camera_driver_image_pipeline | 2 | true | true | false | false | true | bound | reporter_candidate | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | none |
| 4 | PASS | preserve | Glaze 7.2: native tooling serialization 검토 범위 | cpp_ai_tooling_fallback | 5 | false | false | false | true | true | bound | shortlist_other | merged | none | cpp_ai_tooling_fallback counts toward supporting_main_article_count, not primary_camera_stack_count. | Supporting bucket is allowed by Newsletter Policy but is not a Primary Camera Stack topic. | none | image-fallback: Article image uses a local fallback visual.; image-fallback: Article image uses a local fallback visual. |

## Hard Fails

- none

## Soft Deductions

- 1 pt [image-fallback] libcamera v0.7.1 릴리스: Raspberry Pi Atomic control lists 및 Simple pipeline AGC/AWB 통계 개선: Article image uses a local fallback visual.
- 1 pt [image-fallback] Glaze 7.2: native tooling serialization 검토 범위: Article image uses a local fallback visual.

## Top Deduction Categories

- image-fallback (2)

## Candidate Exclusion Summary

- none

## Deductions

- 1 pt [image-fallback] libcamera v0.7.1 릴리스: Raspberry Pi Atomic control lists 및 Simple pipeline AGC/AWB 통계 개선: Article image uses a local fallback visual.
- 1 pt [image-fallback] Glaze 7.2: native tooling serialization 검토 범위: Article image uses a local fallback visual.
