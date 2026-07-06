# HAL Signal Quality Report - 2026-07-06

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
- strong_signal_count: 1
- usable_signal_count: 2
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
- hal_impact_axis_counts: {"framework_hal_contract":1,"stream_buffer_metadata":2,"camerax_app_compatibility":1,"driver_image_pipeline":1,"native_tooling_workflow":1,"security_vendor_component":1}
- actionability_level_counts: {"owner_metric_log":1,"concrete_check":2}
- effective_actionability_level_counts: {"owner_metric_log":1,"concrete_check":2}
- signal_quality_status_counts: {"strong_signal":1,"usable_signal":2}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | CameraX 1.7.0-alpha02 공개: GPU 기반 이미지 분석 및 야간 모드 상태 모니터링 API 도입 | strong_signal | owner_metric_log | owner_metric_log | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | yes | none |
| 2 | libcamera 패치 제안: 센서 시퀀스 제어를 위한 SensorSequence 메타데이터 컨트롤 추가 | usable_signal | concrete_check | concrete_check | driver_image_pipeline, stream_buffer_metadata | yes | none |
| 3 | LLVM/Clang 빌드 환경에서 발생하는 dw2102 미디어 드라이버 버퍼 오버플로우 수정 패치 | usable_signal | concrete_check | concrete_check | native_tooling_workflow, security_vendor_component | yes | none |
