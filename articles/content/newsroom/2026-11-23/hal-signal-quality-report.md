# HAL Signal Quality Report - 2026-11-23

## Gate Boundary

- status: NEEDS_FIX
- input_completeness: partial
- HAL signal checks are observability only; quality status does not gate on them: true
- hal_signal_capsule enforced by the editor output contract (validateHalSignalCapsules): true
- review artifacts preserved: true

## Inputs

- missing required: none
- optional input_unavailable: source_effectiveness_report, evidence_pack_summary

## Summary

- main_article_count: 5
- strong_signal_count: 5
- usable_signal_count: 0
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
- hal_impact_axis_counts: {"framework_hal_contract":5,"stream_buffer_metadata":5,"camerax_app_compatibility":5,"driver_image_pipeline":1}
- actionability_level_counts: {"owner_metric_log":1,"measurable_test":4}
- effective_actionability_level_counts: {"owner_metric_log":1,"measurable_test":4}
- signal_quality_status_counts: {"strong_signal":5}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | CameraX 1.7.0 릴리스: Camera2Interop V2 안정화 및 물리 카메라 직접 바인딩 지원 | strong_signal | owner_metric_log | owner_metric_log | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | yes | none |
| 2 | Samsung SM-F971 ZSL 비활성화: 물리 렌즈 줌 전환 시 CamX SAT 파이프라인 멈춤 대응 | strong_signal | measurable_test | measurable_test | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | yes | none |
| 3 | OPPO Find N3 Flip 물리 카메라 제외: ID 2·3 스트림 구성 시 발생하는 HAL 비정상 종료 수정 | strong_signal | measurable_test | measurable_test | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | yes | none |
| 4 | Samsung Extensions 카메라 장치 닫기 쿼크 API 35 이상 확장: 세션 재바인딩 후 캡처 타임아웃 방지 | strong_signal | measurable_test | measurable_test | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | yes | none |
| 5 | HLG10 크기 확인 지연 로딩: Android 15 이상 Pixel 기기의 Ultra HDR 충돌 해결 | strong_signal | measurable_test | measurable_test | framework_hal_contract, driver_image_pipeline, stream_buffer_metadata, camerax_app_compatibility | yes | none |
