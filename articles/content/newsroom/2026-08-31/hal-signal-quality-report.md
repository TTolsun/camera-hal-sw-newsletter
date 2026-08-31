# HAL Signal Quality Report - 2026-08-31

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
- strong_signal_count: 4
- usable_signal_count: 1
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
- hal_impact_axis_counts: {"driver_image_pipeline":5,"cts_vts_its_cdd":2}
- actionability_level_counts: {"measurable_test":4,"concrete_check":1}
- effective_actionability_level_counts: {"measurable_test":4,"concrete_check":1}
- signal_quality_status_counts: {"strong_signal":4,"usable_signal":1}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | AtomISP 드라이버, Lenovo Yoga Book OV2740 센서 링크 및 D-PHY 타이밍 파생 지원 추가 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, cts_vts_its_cdd | yes | none |
| 2 | libcamera, 고해상도 센서 처리를 위한 쿼드-베이어(Quad-Bayer) CFA 레이아웃 지원 패치 검토 | usable_signal | concrete_check | concrete_check | driver_image_pipeline | yes | none |
| 3 | Linux 커널, Lenovo Yoga Book YB1-X91 카메라 드라이버 및 센서 통합 패치 시리즈 공개 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, cts_vts_its_cdd | yes | none |
| 4 | Sony IMX908 이미지 센서, Linux Device Tree 바인딩 추가로 공식 지원 기반 마련 | strong_signal | measurable_test | measurable_test | driver_image_pipeline | yes | none |
| 5 | libcamera, 소프트웨어 ISP EGL 모듈의 createTexture2D()에 필터 파라미터 추가 | strong_signal | measurable_test | measurable_test | driver_image_pipeline | yes | none |
