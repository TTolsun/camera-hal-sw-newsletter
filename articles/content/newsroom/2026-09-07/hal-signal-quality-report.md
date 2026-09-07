# HAL Signal Quality Report - 2026-09-07

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

- main_article_count: 5
- strong_signal_count: 3
- usable_signal_count: 2
- weak_signal_count: 0
- watchlist_only_count: 0
- blocked_source_gap_count: 0
- article_count_with_hal_signal_capsule: 5
- article_count_without_hal_signal_capsule: 0
- android_multimedia_camera_output_count: 0
- soc_platform_signal_count: 0
- generic_signal_hard_blocker_count: 0
- hal_signal_hard_blocker_count: 0
- hard_blocker_reason_code_counts: {}
- hal_impact_axis_counts: {"driver_image_pipeline":5,"soc_resource_contention":1}
- actionability_level_counts: {"concrete_check":2,"measurable_test":3}
- effective_actionability_level_counts: {"concrete_check":2,"measurable_test":3}
- signal_quality_status_counts: {"usable_signal":2,"strong_signal":3}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | OmniVision OG0VA1B 흑백 VGA 센서 드라이버 지원을 위한 Linux 커널 패치 v6 공개 | usable_signal | concrete_check | concrete_check | driver_image_pipeline | yes | none |
| 2 | Qualcomm x1e/Hamoa 플랫폼 카메라 DTS 지원 패치 v6 공개 | strong_signal | measurable_test | measurable_test | driver_image_pipeline | yes | none |
| 3 | Lenovo Yoga Book YB1-X91 카메라 지원을 위한 Linux 커널 패치 v7 공개 | strong_signal | measurable_test | measurable_test | driver_image_pipeline | yes | none |
| 4 | libcamera 컨트롤 스토리지 유니온 명명 패치 v3 승인 | usable_signal | concrete_check | concrete_check | driver_image_pipeline | yes | none |
| 5 | libcamera 소프트웨어 ISP 워커 시작 전 불필요한 stop 호출 생략 패치 공개 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, soc_resource_contention | yes | none |
