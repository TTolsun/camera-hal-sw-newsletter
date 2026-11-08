# HAL Signal Quality Report - 2026-11-09

## Gate Boundary

- status: WARN
- input_completeness: partial
- HAL signal checks are observability only; quality status does not gate on them: true
- hal_signal_capsule enforced by the editor output contract (validateHalSignalCapsules): true
- review artifacts preserved: true

## Inputs

- missing required: none
- optional input_unavailable: source_effectiveness_report

## Summary

- main_article_count: 3
- strong_signal_count: 2
- usable_signal_count: 1
- weak_signal_count: 0
- watchlist_only_count: 0
- blocked_source_gap_count: 0
- article_count_with_hal_signal_capsule: 3
- article_count_without_hal_signal_capsule: 0
- android_multimedia_camera_output_count: 0
- soc_platform_signal_count: 0
- generic_signal_hard_blocker_count: 0
- hal_signal_hard_blocker_count: 0
- hard_blocker_reason_code_counts: {}
- hal_impact_axis_counts: {"framework_hal_contract":3,"camerax_app_compatibility":1,"stream_buffer_metadata":2}
- actionability_level_counts: {"measurable_test":1,"owner_metric_log":1,"concrete_check":1}
- effective_actionability_level_counts: {"measurable_test":1,"owner_metric_log":1,"concrete_check":1}
- signal_quality_status_counts: {"strong_signal":2,"usable_signal":1}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | CameraX CapturePipeline과 3A 제어 대기에 절대 시간 타임아웃 추가 | strong_signal | measurable_test | measurable_test | framework_hal_contract, camerax_app_compatibility | yes | none |
| 2 | CameraPipe, compileSdk 37 승격 대응 Api37Compat 전환 병합 | strong_signal | owner_metric_log | owner_metric_log | framework_hal_contract, stream_buffer_metadata | yes | none |
| 3 | CameraX LowLightBoostEffect 및 세션 관리자 신규 병합 | usable_signal | concrete_check | concrete_check | framework_hal_contract, stream_buffer_metadata | yes | none |
