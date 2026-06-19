# HAL Signal Quality Report - 2026-06-19

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
- usable_signal_count: 0
- weak_signal_count: 1
- watchlist_only_count: 0
- blocked_source_gap_count: 0
- article_count_with_hal_signal_capsule: 3
- article_count_without_hal_signal_capsule: 0
- android_multimedia_camera_output_count: 0
- soc_platform_signal_count: 0
- generic_signal_hard_blocker_count: 1
- hal_signal_hard_blocker_count: 1
- hard_blocker_reason_code_counts: {"hal_actionability_none":1,"fallback_promotion_not_allowed":1}
- hal_impact_axis_counts: {"framework_hal_contract":1,"stream_buffer_metadata":1,"camerax_app_compatibility":1,"driver_image_pipeline":1,"native_tooling_workflow":1}
- actionability_level_counts: {"owner_metric_log":1,"measurable_test":1,"none":1}
- effective_actionability_level_counts: {"owner_metric_log":1,"measurable_test":1,"none":1}
- signal_quality_status_counts: {"strong_signal":2,"weak_signal":1}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | CameraX 1.6.0 릴리스: 기능 조합 사전 쿼리 API 도입 및 기기별 호환성 이슈 해결 | strong_signal | owner_metric_log | owner_metric_log | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | yes | none |
| 2 | Linux v7.2 미디어 서브시스템 업데이트 제안: V4L2 Core 및 subdev 센서 소유권 수정 포함 | strong_signal | measurable_test | measurable_test | driver_image_pipeline | yes | none |
| 3 | GCC 16 신규 기능 공개: 오류 메시지 개선 및 SARIF 정적 분석 출력 지원 | weak_signal | none | none | native_tooling_workflow | yes | hal_actionability_none, fallback_promotion_not_allowed |
