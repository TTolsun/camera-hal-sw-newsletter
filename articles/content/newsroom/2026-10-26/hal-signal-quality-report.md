# HAL Signal Quality Report - 2026-10-26

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
- strong_signal_count: 5
- usable_signal_count: 0
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
- hal_impact_axis_counts: {"camerax_app_compatibility":4,"stream_buffer_metadata":3,"thermal_power_memory_pressure":1,"performance_latency_frame_drop":2,"driver_image_pipeline":1}
- actionability_level_counts: {"measurable_test":3,"owner_metric_log":2}
- effective_actionability_level_counts: {"measurable_test":3,"owner_metric_log":2}
- signal_quality_status_counts: {"strong_signal":5}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | CameraX SessionConfigAdapter, 동기화 없는 중복 읽기로 인한 표면 리셋 경쟁 조건 해결 | strong_signal | measurable_test | measurable_test | camerax_app_compatibility, stream_buffer_metadata | yes | none |
| 2 | CameraX ZSL 버퍼 및 ImageProxy 누수 해결로 54~108MB 상당의 그래픽 메모리 고정 방지 | strong_signal | measurable_test | measurable_test | stream_buffer_metadata, thermal_power_memory_pressure, camerax_app_compatibility | yes | none |
| 3 | 단일 프레임 드롭 시 UseCaseCameraState 신호를 유지하여 3A 및 유스케이스 전환 조기 실패 방지 | strong_signal | owner_metric_log | owner_metric_log | camerax_app_compatibility, performance_latency_frame_drop | yes | none |
| 4 | 미시작 상태의 MediaCodec 비디오 인코더 해제 시 발생하는 C2NodeImpl 네이티브 스레드 누수 우회책 적용 | strong_signal | owner_metric_log | owner_metric_log | camerax_app_compatibility, performance_latency_frame_drop | yes | none |
| 5 | Qualcomm SM8450 플랫폼, 업스트림 CAMSS 드라이버 및 독립 CSI2 PHY 지원 패치 제안 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, stream_buffer_metadata | yes | none |
