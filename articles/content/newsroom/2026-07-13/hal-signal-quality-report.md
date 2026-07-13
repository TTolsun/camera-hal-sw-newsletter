# HAL Signal Quality Report - 2026-07-13

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
- strong_signal_count: 0
- usable_signal_count: 3
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
- hal_impact_axis_counts: {"driver_image_pipeline":3,"thermal_power_memory_pressure":1}
- actionability_level_counts: {"concrete_check":3}
- effective_actionability_level_counts: {"concrete_check":3}
- signal_quality_status_counts: {"usable_signal":3}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Qualcomm CAMSS 오프라인 프로세싱 엔진(OPE) 드라이버 추가 제안 | usable_signal | concrete_check | concrete_check | driver_image_pipeline, thermal_power_memory_pressure | yes | none |
| 2 | libcamera 소프트웨어 ISP, 렌즈 쉐이딩 보정(LSC) 지원을 위한 EGL 텍스처 필터 파라미터 추가 | usable_signal | concrete_check | concrete_check | driver_image_pipeline | yes | none |
| 3 | Raspberry Pi libcamera v0.7.1+rpt20260609 다운스트림 릴리스 | usable_signal | concrete_check | concrete_check | driver_image_pipeline | yes | none |
