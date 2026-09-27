# HAL Signal Quality Report - 2026-09-28

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
- strong_signal_count: 2
- usable_signal_count: 2
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
- hal_impact_axis_counts: {"driver_image_pipeline":3,"soc_resource_contention":1,"security_vendor_component":1,"native_tooling_workflow":1}
- actionability_level_counts: {"measurable_test":2,"concrete_check":2}
- effective_actionability_level_counts: {"measurable_test":2,"concrete_check":2}
- signal_quality_status_counts: {"strong_signal":2,"usable_signal":2}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Renesas RZ/V2H EVK 보드를 위한 Arm Mali-C55 ISP 및 IVC 하드웨어 가속 활성화 패치 제안 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, soc_resource_contention | yes | none |
| 2 | Samsung S5K3T2 20메가픽셀 이미지 센서용 리눅스 커널 드라이버 패치 제안 | usable_signal | concrete_check | concrete_check | driver_image_pipeline | yes | none |
| 3 | Intel IPU7 드라이버의 장치 제거 시 ISYS 펌웨어 리소스 누수 방지 패치 제안 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, security_vendor_component | yes | none |
| 4 | Android Studio에서 개발자 선택에 따른 다양한 AI 에이전트 통합 지원 발표 | usable_signal | concrete_check | concrete_check | native_tooling_workflow | yes | none |
