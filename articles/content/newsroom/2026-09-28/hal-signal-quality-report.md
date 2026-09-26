# HAL Signal Quality Report - 2026-09-28

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
- strong_signal_count: 1
- usable_signal_count: 4
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
- hal_impact_axis_counts: {"framework_hal_contract":1,"stream_buffer_metadata":1,"camerax_app_compatibility":1,"driver_image_pipeline":3,"soc_resource_contention":1,"security_vendor_component":1,"native_tooling_workflow":1}
- actionability_level_counts: {"owner_metric_log":1,"concrete_check":4}
- effective_actionability_level_counts: {"owner_metric_log":1,"concrete_check":4}
- signal_quality_status_counts: {"strong_signal":1,"usable_signal":4}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | CameraX 1.6.2 릴리스, Android 17 동적 범위 충돌 및 주요 기기별 호환성 버그 해결 | strong_signal | owner_metric_log | owner_metric_log | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | yes | none |
| 2 | Renesas RZ/V2H EVK 보드, Arm Mali-C55 ISP 및 IVC 하드웨어 활성화 패치 제안 | usable_signal | concrete_check | concrete_check | driver_image_pipeline, soc_resource_contention | yes | none |
| 3 | Samsung S5K3T2 20메가픽셀 이미지 센서, 리눅스 커널 드라이버 추가 패치 제안 | usable_signal | concrete_check | concrete_check | driver_image_pipeline | yes | none |
| 4 | Intel IPU7 드라이버, 디바이스 제거 시 ISYS 펌웨어 리소스 누수 수정 패치 제안 | usable_signal | concrete_check | concrete_check | driver_image_pipeline, security_vendor_component | yes | none |
| 5 | Android Studio, 개발자 선택에 따른 다양한 AI 코딩 에이전트 통합 기능 발표 | usable_signal | concrete_check | concrete_check | native_tooling_workflow | yes | none |
