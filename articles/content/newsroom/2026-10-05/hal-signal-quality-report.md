# HAL Signal Quality Report - 2026-10-05

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

- main_article_count: 2
- strong_signal_count: 2
- usable_signal_count: 0
- weak_signal_count: 0
- watchlist_only_count: 0
- blocked_source_gap_count: 0
- article_count_with_hal_signal_capsule: 2
- article_count_without_hal_signal_capsule: 0
- android_multimedia_camera_output_count: 0
- soc_platform_signal_count: 0
- generic_signal_hard_blocker_count: 0
- hal_signal_hard_blocker_count: 0
- hard_blocker_reason_code_counts: {}
- hal_impact_axis_counts: {"cts_vts_its_cdd":1,"driver_image_pipeline":1,"stream_buffer_metadata":1}
- actionability_level_counts: {"owner_metric_log":2}
- effective_actionability_level_counts: {"owner_metric_log":2}
- signal_quality_status_counts: {"strong_signal":2}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Android 17 Camera ITS: 실행 환경 버전과 달라진 검증 항목 | strong_signal | owner_metric_log | owner_metric_log | cts_vts_its_cdd | yes | none |
| 2 | libcamera AWB 제안: 자동 게인을 고정하고 필요할 때 다시 수렴시키기 | strong_signal | owner_metric_log | owner_metric_log | driver_image_pipeline, stream_buffer_metadata | yes | none |
