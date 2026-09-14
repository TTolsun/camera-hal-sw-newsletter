# HAL Signal Quality Report - 2026-09-14

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
- strong_signal_count: 3
- usable_signal_count: 1
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
- hal_impact_axis_counts: {"driver_image_pipeline":4,"soc_resource_contention":1,"performance_latency_frame_drop":1,"stream_buffer_metadata":1}
- actionability_level_counts: {"concrete_check":1,"measurable_test":3}
- effective_actionability_level_counts: {"concrete_check":1,"measurable_test":3}
- signal_quality_status_counts: {"usable_signal":1,"strong_signal":3}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Rockchip RKISP1 ISP 드라이버의 Bayer Demosaicing 바이패스 로직 오류 수정 패치 제안 | usable_signal | concrete_check | concrete_check | driver_image_pipeline, soc_resource_contention | yes | none |
| 2 | OmniVision os02g10 이미지 센서용 신규 리눅스 드라이버 패치 시리즈 제안 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, performance_latency_frame_drop | yes | none |
| 3 | libcamera, Sony IMX355 센서의 테스트 패턴 모드 매핑 오류 수정 패치 제안 | strong_signal | measurable_test | measurable_test | driver_image_pipeline | yes | none |
| 4 | libcamera, 컨트롤 메타데이터에 LensShadingCorrection 및 ToneCurve 추가 패치 제안 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, stream_buffer_metadata | yes | none |
