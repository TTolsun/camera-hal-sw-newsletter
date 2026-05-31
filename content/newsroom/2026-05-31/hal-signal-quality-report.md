# HAL Signal Quality Report - 2026-05-31

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

- main_article_count: 2
- strong_signal_count: 1
- usable_signal_count: 1
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
- hal_impact_axis_counts: {"camerax_app_compatibility":1,"native_tooling_workflow":1}
- actionability_level_counts: {"measurable_test":1,"concrete_check":1}
- effective_actionability_level_counts: {"measurable_test":1,"concrete_check":1}
- signal_quality_status_counts: {"strong_signal":1,"usable_signal":1}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Google I/O 2026: Jetpack Compose와 CameraX 통합을 통한 반응형 카메라 미리보기 구현 | strong_signal | measurable_test | measurable_test | camerax_app_compatibility | yes | none |
| 2 | Google AI Studio: 프롬프트 기반 네이티브 Android 앱 빌드 지원 | usable_signal | concrete_check | concrete_check | native_tooling_workflow | yes | none |
