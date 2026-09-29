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
- hal_impact_axis_counts: {"native_tooling_workflow":2,"driver_image_pipeline":2,"soc_resource_contention":1,"cts_vts_its_cdd":1}
- actionability_level_counts: {"measurable_test":2,"concrete_check":2}
- effective_actionability_level_counts: {"measurable_test":2,"concrete_check":2}
- signal_quality_status_counts: {"strong_signal":2,"usable_signal":2}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Android Studio, 개발자 맞춤형 AI 에이전트 연동 지원으로 네이티브 개발 유연성 확장 | strong_signal | measurable_test | measurable_test | native_tooling_workflow | yes | none |
| 2 | 앤트로픽, 정렬 테스트를 통과한 고성능 AI 모델 Claude Opus 5.5 공개 | usable_signal | concrete_check | concrete_check | native_tooling_workflow | yes | none |
| 3 | 르네사스 RZ/V2H EVK, 리눅스 커널 패치로 Mali-C55 ISP 및 IVC 하드웨어 활성화 추진 | usable_signal | concrete_check | concrete_check | driver_image_pipeline, soc_resource_contention | yes | none |
| 4 | 소니 IMX681 카메라 센서 지원 패치 및 최신 libcamera 기반 통합 테스트 보고 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, cts_vts_its_cdd | yes | none |
