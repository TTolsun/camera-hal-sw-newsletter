# HAL Signal Quality Report - 2026-06-05

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
- strong_signal_count: 3
- usable_signal_count: 0
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
- hal_impact_axis_counts: {"framework_hal_contract":3,"camerax_app_compatibility":2,"driver_image_pipeline":1,"stream_buffer_metadata":1,"cts_vts_its_cdd":1}
- actionability_level_counts: {"owner_metric_log":1,"measurable_test":2}
- effective_actionability_level_counts: {"owner_metric_log":1,"measurable_test":2}
- signal_quality_status_counts: {"strong_signal":3}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Google I/O '26: Jetpack CameraX 및 Media3 기반의 통합 미디어 파이프라인 툴킷 발표 | strong_signal | owner_metric_log | owner_metric_log | framework_hal_contract, camerax_app_compatibility | yes | none |
| 2 | CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영 | strong_signal | measurable_test | measurable_test | framework_hal_contract, driver_image_pipeline, stream_buffer_metadata, camerax_app_compatibility | yes | none |
| 3 | AOSP Camera ITS 업데이트: Honor Pad 20 태블릿 허용 목록 추가 및 테스트 지침 재정렬 | strong_signal | measurable_test | measurable_test | framework_hal_contract, cts_vts_its_cdd | yes | none |
