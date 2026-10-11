# HAL Signal Quality Report - 2026-10-12

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

- main_article_count: 3
- strong_signal_count: 3
- usable_signal_count: 0
- weak_signal_count: 0
- watchlist_only_count: 0
- blocked_source_gap_count: 0
- article_count_with_hal_signal_capsule: 3
- article_count_without_hal_signal_capsule: 0
- android_multimedia_camera_output_count: 0
- soc_platform_signal_count: 0
- generic_signal_hard_blocker_count: 0
- hal_signal_hard_blocker_count: 0
- hard_blocker_reason_code_counts: {}
- hal_impact_axis_counts: {"framework_hal_contract":1,"driver_image_pipeline":3,"stream_buffer_metadata":1,"soc_resource_contention":1}
- actionability_level_counts: {"measurable_test":3}
- effective_actionability_level_counts: {"measurable_test":3}
- signal_quality_status_counts: {"strong_signal":3}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | cameraserver: 센서 프라이버시 활성화 시 무조건 차단 대신 카메라 음소거 동작 제안 | strong_signal | measurable_test | measurable_test | framework_hal_contract, driver_image_pipeline | yes | none |
| 2 | Qualcomm CAMSS ISP 파라미터 메타데이터 형식 v10 패치 및 uAPI 문서화 검토 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, stream_buffer_metadata | yes | none |
| 3 | ChromeOS platform2 카메라 모듈: legacy handle에서 mojom handle로 마이그레이션 머지 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, soc_resource_contention | yes | none |
