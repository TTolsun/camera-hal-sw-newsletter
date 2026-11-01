# HAL Signal Quality Report - 2026-11-02

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
- hal_impact_axis_counts: {"framework_hal_contract":2,"stream_buffer_metadata":4,"camerax_app_compatibility":1,"driver_image_pipeline":2}
- actionability_level_counts: {"measurable_test":4}
- effective_actionability_level_counts: {"measurable_test":4}
- signal_quality_status_counts: {"strong_signal":4}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Sony Xperia 1 V의 4개 유스케이스 스트림 공유 시 비디오 스냅샷 중단 우회 | strong_signal | measurable_test | measurable_test | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | yes | none |
| 2 | Camera2 Pipe FrameBuffer의 스트림 세트 포함 여부 검증 로직 추가 | strong_signal | measurable_test | measurable_test | framework_hal_contract, stream_buffer_metadata | yes | none |
| 3 | CameraX Recorder의 Surface 해제 시 잔류 포인터 정리로 녹화 멈춤 방지 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, stream_buffer_metadata | yes | none |
| 4 | Camera2 Extensions의 Ultra HDR(JPEG_R) 해상도 쿼리를 API 35 이상으로 제한 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, stream_buffer_metadata | yes | none |
