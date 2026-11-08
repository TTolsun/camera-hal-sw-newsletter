# HAL Signal Quality Report - 2026-11-09

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
- hal_impact_axis_counts: {"framework_hal_contract":5,"stream_buffer_metadata":4,"camerax_app_compatibility":3,"native_tooling_workflow":2,"performance_latency_frame_drop":1}
- actionability_level_counts: {"owner_metric_log":3,"measurable_test":2}
- effective_actionability_level_counts: {"owner_metric_log":3,"measurable_test":2}
- signal_quality_status_counts: {"strong_signal":5}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | CameraX 1.7.0-rc02 릴리스, API 30 바인딩 예외 및 VideoCapture 네이티브 스레드 누수 수정 | strong_signal | owner_metric_log | owner_metric_log | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility, native_tooling_workflow | yes | none |
| 2 | Tecno BF6 기기, VideoCapture 바인딩 시 스틸 캡처 타임아웃 회피 쿼크 추가 | strong_signal | measurable_test | measurable_test | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | yes | none |
| 3 | CameraX 개발 환경에 5-Gate 심층 근본 원인 분석 프로토콜 적용 | strong_signal | owner_metric_log | owner_metric_log | framework_hal_contract, native_tooling_workflow | yes | none |
| 4 | redfin 64비트 전용 랩 환경의 특정 카메라 HAL 네이티브 충돌 테스트 예외 처리 | strong_signal | owner_metric_log | owner_metric_log | framework_hal_contract, stream_buffer_metadata, performance_latency_frame_drop | yes | none |
| 5 | 갤럭시 노트 10+ 스냅드래곤, 전면 줌 촬영 시 HAL 멈춤 회피 패치 병합 | strong_signal | measurable_test | measurable_test | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | yes | none |
