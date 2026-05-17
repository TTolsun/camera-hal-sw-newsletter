# HAL Signal Quality Report - 2026-05-18

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

- main_article_count: 3
- strong_signal_count: 3
- usable_signal_count: 0
- weak_signal_count: 0
- watchlist_only_count: 0
- blocked_source_gap_count: 0
- article_count_with_hal_signal_capsule: 3
- article_count_without_hal_signal_capsule: 0
- generic_signal_hard_blocker_count: 0
- hal_signal_hard_blocker_count: 0
- hard_blocker_reason_code_counts: {}
- hal_impact_axis_counts: {"driver_image_pipeline":3,"framework_hal_contract":3,"stream_buffer_metadata":3,"cts_vts_its_cdd":3,"performance_latency_frame_drop":1,"soc_resource_contention":1,"camerax_app_compatibility":3,"native_tooling_workflow":2}
- actionability_level_counts: {"owner_metric_log":1,"measurable_test":2}
- effective_actionability_level_counts: {"owner_metric_log":1,"measurable_test":2}
- signal_quality_status_counts: {"strong_signal":3}

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | libcamera Release Announcements - libcamera v0.7.1 | strong_signal | owner_metric_log | owner_metric_log | driver_image_pipeline, framework_hal_contract, stream_buffer_metadata, cts_vts_its_cdd, performance_latency_frame_drop, soc_resource_contention, camerax_app_compatibility | yes | none |
| 2 | Tooling Watch / Fallback: GCC 16.1 released: C++26 reflection / contracts / safety hardening, C++20 by default, and more! | strong_signal | measurable_test | measurable_test | native_tooling_workflow, framework_hal_contract, driver_image_pipeline, stream_buffer_metadata, cts_vts_its_cdd, camerax_app_compatibility | yes | none |
| 3 | Tooling Watch / Fallback: Glaze 7.2 - C++26 Reflection \| YAML, CBOR, MessagePack, TOML and more | strong_signal | measurable_test | measurable_test | native_tooling_workflow, framework_hal_contract, driver_image_pipeline, stream_buffer_metadata, cts_vts_its_cdd, camerax_app_compatibility | yes | none |
