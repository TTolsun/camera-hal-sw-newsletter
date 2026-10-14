# HAL Signal Quality Report - 2026-10-15

## Gate Boundary

- status: WARN
- input_completeness: partial
- HAL signal checks are observability only; quality status does not gate on them: true
- hal_signal_capsule enforced by the editor output contract (validateHalSignalCapsules): true
- review artifacts preserved: true

## Inputs

- missing required: none
- optional input_unavailable: source_effectiveness_report, source_quality_report, evidence_pack_summary, merged_candidate_manifest

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
- hal_impact_axis_counts: {"framework_hal_contract":3,"stream_buffer_metadata":3,"camerax_app_compatibility":3}
- actionability_level_counts: {"measurable_test":1,"owner_metric_log":2}
- effective_actionability_level_counts: {"measurable_test":1,"owner_metric_log":2}
- signal_quality_status_counts: {"strong_signal":3}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Android 16 특정 기기의 세션 재구성 중단을 막기 위한 CameraDevice 종료 쿼크 활성화 | strong_signal | measurable_test | measurable_test | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | yes | none |
| 2 | 10비트 역량 선언이 누락된 기기에서 다이내믹 레인지 프로필을 SDR로 제한 | strong_signal | owner_metric_log | owner_metric_log | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | yes | none |
| 3 | CameraPipe CaptureSessionState 개편으로 지연 서피스 요청 누락 방지 | strong_signal | owner_metric_log | owner_metric_log | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | yes | none |
