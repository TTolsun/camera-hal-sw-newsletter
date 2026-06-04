# HAL Signal Quality Report - 2026-06-04

## Gate Boundary

- status: NEEDS_FIX
- input_completeness: partial
- quality validation records HAL signal deductions: true
- publish gate blocks HAL signal hard blockers through quality status: true
- review artifacts preserved: true

## Inputs

- missing required: none
- optional input_unavailable: source_effectiveness_report, evidence_pack_summary

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
- hal_impact_axis_counts: {"framework_hal_contract":2,"camerax_app_compatibility":1,"stream_buffer_metadata":2,"driver_image_pipeline":1}
- actionability_level_counts: {"owner_metric_log":1,"concrete_check":1,"measurable_test":1}
- effective_actionability_level_counts: {"owner_metric_log":1,"concrete_check":1,"measurable_test":1}
- signal_quality_status_counts: {"strong_signal":2,"usable_signal":1}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Google I/O '26: CameraX 및 Media3 기반의 프리미엄 미디어 파이프라인 구축 도구 공개 | strong_signal | owner_metric_log | owner_metric_log | framework_hal_contract, camerax_app_compatibility | yes | none |
| 2 | CameraX 1.7.0-alpha01 출시: 커스텀 SessionConfig 노출 및 ImageAnalysis 회전 버그 수정 | usable_signal | concrete_check | concrete_check | framework_hal_contract, stream_buffer_metadata | yes | none |
| 3 | 지난 소식: CameraX 1.6.0 정식 출시 및 특정 기기 YUV 왜곡·플래시 오동작 우회 패치 반영 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, stream_buffer_metadata | yes | none |
