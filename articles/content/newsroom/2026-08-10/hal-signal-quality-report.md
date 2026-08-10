# HAL Signal Quality Report - 2026-08-10

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
- hal_impact_axis_counts: {"driver_image_pipeline":2,"performance_latency_frame_drop":1}
- actionability_level_counts: {"measurable_test":1,"concrete_check":1}
- effective_actionability_level_counts: {"measurable_test":1,"concrete_check":1}
- signal_quality_status_counts: {"strong_signal":1,"usable_signal":1}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 글로벌 셔터를 지원하는 onsemi AR0234 CMOS 이미지 센서 드라이버 추가 제안 (PATCH v2) | strong_signal | measurable_test | measurable_test | driver_image_pipeline, performance_latency_frame_drop | yes | none |
| 2 | Sony IMX908 8.39MP 센서 지원을 위한 디바이스 트리 바인딩 추가 (PATCH v2) | usable_signal | concrete_check | concrete_check | driver_image_pipeline | yes | none |
