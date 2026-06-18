# HAL Signal Quality Report - 2026-06-18

## Gate Boundary

- status: WARN
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
- hal_impact_axis_counts: {"framework_hal_contract":1,"stream_buffer_metadata":2,"camerax_app_compatibility":1,"driver_image_pipeline":1,"native_tooling_workflow":1}
- actionability_level_counts: {"owner_metric_log":1,"measurable_test":2}
- effective_actionability_level_counts: {"owner_metric_log":1,"measurable_test":2}
- signal_quality_status_counts: {"strong_signal":3}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 지난 3월 출시된 CameraX 1.6.0: 사전 유스케이스 조합 쿼리 API 도입 및 삼성 기기 호환성 패치 대거 반영 | strong_signal | owner_metric_log | owner_metric_log | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | yes | none |
| 2 | 최근 공개된 NXP i.MX8/i.MX9 SoC용 CPI 병렬 카메라 인터페이스 V4L2 서브디바이스 드라이버 v5 패치 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, stream_buffer_metadata | yes | none |
| 3 | 최근 공개된 GCC 16: 오류 메시지 개선 및 SARIF 정적 분석 출력 지원으로 네이티브 개발 생산성 향상 | strong_signal | measurable_test | measurable_test | native_tooling_workflow | yes | none |
