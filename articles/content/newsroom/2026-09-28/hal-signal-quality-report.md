# HAL Signal Quality Report - 2026-09-28

## Gate Boundary

- status: PASS
- input_completeness: complete
- HAL signal checks are observability only; quality status does not gate on them: true
- hal_signal_capsule enforced by the editor output contract (validateHalSignalCapsules): true
- review artifacts preserved: true

## Inputs

- missing required: none
- optional input_unavailable: none

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
- hal_impact_axis_counts: {"driver_image_pipeline":3,"soc_resource_contention":1,"cts_vts_its_cdd":2,"native_tooling_workflow":2}
- actionability_level_counts: {"concrete_check":4,"measurable_test":1}
- effective_actionability_level_counts: {"concrete_check":4,"measurable_test":1}
- signal_quality_status_counts: {"usable_signal":4,"strong_signal":1}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 르네사스 RZ V2H EVK 플랫폼을 위한 ISP 및 IVC 활성화 패치 제안 | usable_signal | concrete_check | concrete_check | driver_image_pipeline, soc_resource_contention | yes | none |
| 2 | 삼성 S5K3T2 이미지 센서를 위한 Linux 커널 드라이버 패치 제안 | usable_signal | concrete_check | concrete_check | driver_image_pipeline | yes | none |
| 3 | 소니 IMX681 카메라 센서 지원 패치에 대한 테스트 보고서 공개 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, cts_vts_its_cdd | yes | none |
| 4 | Android Studio에서 서드파티 AI 에이전트 선택 및 통합 지원 발표 | usable_signal | concrete_check | concrete_check | native_tooling_workflow | yes | none |
| 5 | 앤트로픽, 성능과 안전성을 개선한 Claude Opus 5.5 모델 발표 | usable_signal | concrete_check | concrete_check | native_tooling_workflow, cts_vts_its_cdd | yes | none |
