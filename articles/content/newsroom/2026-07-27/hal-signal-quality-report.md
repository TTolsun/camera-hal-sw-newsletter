# HAL Signal Quality Report - 2026-07-27

## Gate Boundary

- status: WARN
- input_completeness: partial
- HAL signal checks are observability only; quality status does not gate on them: true
- hal_signal_capsule enforced by the editor output contract (validateHalSignalCapsules): true
- review artifacts preserved: true

## Inputs

- missing required: none
- optional input_unavailable: source_effectiveness_report, evidence_pack_summary

## Summary

- main_article_count: 5
- strong_signal_count: 3
- usable_signal_count: 2
- weak_signal_count: 0
- watchlist_only_count: 0
- blocked_source_gap_count: 0
- article_count_with_hal_signal_capsule: 5
- article_count_without_hal_signal_capsule: 0
- android_multimedia_camera_output_count: 0
- soc_platform_signal_count: 0
- generic_signal_hard_blocker_count: 0
- hal_signal_hard_blocker_count: 0
- hard_blocker_reason_code_counts: {}
- hal_impact_axis_counts: {"driver_image_pipeline":5,"thermal_power_memory_pressure":2,"soc_resource_contention":1,"stream_buffer_metadata":2,"cts_vts_its_cdd":1}
- actionability_level_counts: {"concrete_check":2,"measurable_test":3}
- effective_actionability_level_counts: {"concrete_check":2,"measurable_test":3}
- signal_quality_status_counts: {"usable_signal":2,"strong_signal":3}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Qualcomm CAMSS, raw Bayer를 YUV로 변환하는 OPE(Offline Processing Engine) 드라이버 추가 패치 제안 | usable_signal | concrete_check | concrete_check | driver_image_pipeline, thermal_power_memory_pressure, soc_resource_contention | yes | none |
| 2 | Himax HM1092 단색 적외선(IR) 센서 지원을 위한 신규 V4L2 드라이버 패치 공개 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, stream_buffer_metadata, cts_vts_its_cdd | yes | none |
| 3 | libcamera, 제어 직렬화기(Control Serializer) 크기 및 입력 유효성 검사 강화 패치 제안 | usable_signal | concrete_check | concrete_check | driver_image_pipeline | yes | none |
| 4 | libcamera, 불필요한 초기화 방지를 위한 EGLDisplay 캐싱 최적화 패치 제안 | strong_signal | measurable_test | measurable_test | driver_image_pipeline | yes | none |
| 5 | Samsung S5KJN5 50MP 이미지 센서 지원을 위한 독립형 V4L2 드라이버 패치 제안 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, stream_buffer_metadata, thermal_power_memory_pressure | yes | none |
