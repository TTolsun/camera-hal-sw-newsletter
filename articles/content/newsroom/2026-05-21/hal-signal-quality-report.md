# HAL Signal Quality Report - 2026-05-21

## Gate Boundary

- status: PASS
- input_completeness: complete
- quality validation records HAL signal deductions: true
- publish gate blocks HAL signal hard blockers through quality status: true
- review artifacts preserved: true

## Inputs

- missing required: none
- optional input_unavailable: none

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
- hal_impact_axis_counts: {"framework_hal_contract":3,"driver_image_pipeline":3,"stream_buffer_metadata":3,"cts_vts_its_cdd":3,"camerax_app_compatibility":3,"performance_latency_frame_drop":1,"soc_resource_contention":1,"native_tooling_workflow":1}
- actionability_level_counts: {"measurable_test":1,"owner_metric_log":2}
- effective_actionability_level_counts: {"measurable_test":1,"owner_metric_log":2}
- signal_quality_status_counts: {"strong_signal":3}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O | strong_signal | measurable_test | measurable_test | framework_hal_contract, driver_image_pipeline, stream_buffer_metadata, cts_vts_its_cdd, camerax_app_compatibility | yes | none |
| 2 | libcamera Release Announcements - libcamera v0.7.1 | strong_signal | owner_metric_log | owner_metric_log | driver_image_pipeline, framework_hal_contract, stream_buffer_metadata, cts_vts_its_cdd, performance_latency_frame_drop, soc_resource_contention, camerax_app_compatibility | yes | none |
| 3 | Start building today - Build native Android apps in Google AI Studio | strong_signal | owner_metric_log | owner_metric_log | camerax_app_compatibility, framework_hal_contract, driver_image_pipeline, stream_buffer_metadata, cts_vts_its_cdd, native_tooling_workflow | yes | none |
