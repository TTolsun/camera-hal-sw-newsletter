# HAL Signal Quality Report - 2026-08-03

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

- main_article_count: 4
- strong_signal_count: 4
- usable_signal_count: 0
- weak_signal_count: 0
- watchlist_only_count: 0
- blocked_source_gap_count: 0
- article_count_with_hal_signal_capsule: 4
- article_count_without_hal_signal_capsule: 0
- android_multimedia_camera_output_count: 0
- soc_platform_signal_count: 0
- generic_signal_hard_blocker_count: 0
- hal_signal_hard_blocker_count: 0
- hard_blocker_reason_code_counts: {}
- hal_impact_axis_counts: {"driver_image_pipeline":4,"performance_latency_frame_drop":2,"stream_buffer_metadata":1}
- actionability_level_counts: {"measurable_test":3,"owner_metric_log":1}
- effective_actionability_level_counts: {"measurable_test":3,"owner_metric_log":1}
- signal_quality_status_counts: {"strong_signal":4}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Himax HM1092 흑백 근적외선(NIR) 센서용 V4L2 드라이버 패치 v6 공개 | strong_signal | measurable_test | measurable_test | driver_image_pipeline | yes | none |
| 2 | onsemi AR0234 글로벌 셔터 CMOS 센서용 신규 V4L2 드라이버 패치 제출 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, performance_latency_frame_drop | yes | none |
| 3 | OmniVision OG0VA1B 흑백 VGA 센서용 V4L2 드라이버 패치 v5 제출 | strong_signal | measurable_test | measurable_test | driver_image_pipeline | yes | none |
| 4 | Qualcomm CAMSS 카메라 서브시스템 MIPI C-PHY 구성 지원 패치 v9 공개 | strong_signal | owner_metric_log | owner_metric_log | driver_image_pipeline, stream_buffer_metadata, performance_latency_frame_drop | yes | none |
