# HAL Signal Quality Report - 2026-10-19

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

- main_article_count: 4
- strong_signal_count: 3
- usable_signal_count: 0
- weak_signal_count: 1
- watchlist_only_count: 0
- blocked_source_gap_count: 0
- article_count_with_hal_signal_capsule: 4
- article_count_without_hal_signal_capsule: 0
- android_multimedia_camera_output_count: 0
- soc_platform_signal_count: 0
- generic_signal_hard_blocker_count: 1
- hal_signal_hard_blocker_count: 1
- hard_blocker_reason_code_counts: {"hal_actionability_none":1,"fallback_promotion_not_allowed":1}
- hal_impact_axis_counts: {"native_tooling_workflow":1,"stream_buffer_metadata":1,"camerax_app_compatibility":1,"driver_image_pipeline":2}
- actionability_level_counts: {"none":1,"measurable_test":3}
- effective_actionability_level_counts: {"none":1,"measurable_test":3}
- signal_quality_status_counts: {"weak_signal":1,"strong_signal":3}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Android Studio Canary, 외부 코딩 에이전트 연동 위한 BYOA 지원 도입 | weak_signal | none | none | native_tooling_workflow | yes | hal_actionability_none, fallback_promotion_not_allowed |
| 2 | AndroidX HeifWriter, 8비트 서피스 입력의 색상 범위 강제 설정 해제 | strong_signal | measurable_test | measurable_test | stream_buffer_metadata, camerax_app_compatibility | yes | none |
| 3 | Linux media 서브시스템, Himax HM1092 흑백 NIR 센서 드라이버 패치 시리즈 v7 제출 | strong_signal | measurable_test | measurable_test | driver_image_pipeline | yes | none |
| 4 | Linux atomisp 드라이버, 스트림 생성 내부의 무효 오류 검사 제거 제안 | strong_signal | measurable_test | measurable_test | driver_image_pipeline | yes | none |
