# HAL Signal Quality Report - 2026-06-26

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
- hal_impact_axis_counts: {"driver_image_pipeline":4,"soc_resource_contention":2}
- actionability_level_counts: {"measurable_test":4}
- effective_actionability_level_counts: {"measurable_test":4}
- signal_quality_status_counts: {"strong_signal":4}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | IMX219 센서 드라이버 테스트 패턴 정합성 개선 및 신규 패턴 추가 패치 제안 | strong_signal | measurable_test | measurable_test | driver_image_pipeline | yes | none |
| 2 | Qualcomm SM8250 SoC 하드웨어 JPEG 인코더를 위한 Device Tree 바인딩 추가 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, soc_resource_contention | yes | none |
| 3 | Qualcomm SM8250 SoC 대상 V4L2 mem2mem JPEG 인코더 드라이버 패치 제안 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, soc_resource_contention | yes | none |
| 4 | V4L2 UAPI 내 카메라 센서 CFA 패턴 묘사를 위한 V4L2_CID_CFA_PATTERN 컨트롤 추가 | strong_signal | measurable_test | measurable_test | driver_image_pipeline | yes | none |
