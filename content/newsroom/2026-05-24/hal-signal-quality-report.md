# HAL Signal Quality Report - 2026-05-24

## Gate Boundary

- status: NEEDS_FIX
- input_completeness: complete
- quality validation records HAL signal deductions: true
- publish gate blocks HAL signal hard blockers through quality status: true
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
- hal_impact_axis_counts: {"framework_hal_contract":2,"driver_image_pipeline":2,"stream_buffer_metadata":2,"cts_vts_its_cdd":2,"camerax_app_compatibility":2,"native_tooling_workflow":1}
- actionability_level_counts: {"owner_metric_log":1,"measurable_test":1}
- effective_actionability_level_counts: {"owner_metric_log":1,"measurable_test":1}
- signal_quality_status_counts: {"strong_signal":2}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | CameraX Release Notes - CameraX 1.6.1 | strong_signal | owner_metric_log | owner_metric_log | framework_hal_contract, driver_image_pipeline, stream_buffer_metadata, cts_vts_its_cdd, camerax_app_compatibility | yes | none |
| 2 | Android Native Tooling: Build native Android apps in Google AI Studio | strong_signal | measurable_test | measurable_test | native_tooling_workflow, framework_hal_contract, driver_image_pipeline, stream_buffer_metadata, cts_vts_its_cdd, camerax_app_compatibility | yes | none |
