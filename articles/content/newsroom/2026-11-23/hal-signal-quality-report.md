# HAL Signal Quality Report - 2026-11-23

## Gate Boundary

- status: PASS
- input_completeness: complete
- HAL signal checks are observability only; quality status does not gate on them: true
- hal_signal_capsule enforced by the editor output contract (validateHalSignalCapsules): true
- review artifacts preserved: true

## Inputs

- missing required: none
- optional input_unavailable: none

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
- hal_impact_axis_counts: {"framework_hal_contract":4,"stream_buffer_metadata":5,"camerax_app_compatibility":4}
- actionability_level_counts: {"owner_metric_log":2,"measurable_test":3}
- effective_actionability_level_counts: {"owner_metric_log":2,"measurable_test":3}
- signal_quality_status_counts: {"strong_signal":5}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | CameraX 1.7.0에서 물리 카메라를 직접 고른다 | strong_signal | owner_metric_log | owner_metric_log | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | yes | none |
| 2 | 3A 요청이 곧바로 실패하면 카메라 ID부터 확인하세요 | strong_signal | owner_metric_log | owner_metric_log | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | yes | none |
| 3 | SM-F971에서 두 번째 렌즈 전환이 멈춘 이유 | strong_signal | measurable_test | measurable_test | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | yes | none |
| 4 | OPPO Find N3 Flip에서 물리 카메라 두 개가 목록에서 빠진 까닭 | strong_signal | measurable_test | measurable_test | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | yes | none |
| 5 | 녹화 첫 프레임은 언제 들어왔을까? CameraX가 인코더 입력을 여는 시점 | strong_signal | measurable_test | measurable_test | stream_buffer_metadata | yes | none |
