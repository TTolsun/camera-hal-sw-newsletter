# HAL Signal Quality Report - 2026-09-21

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
- hal_impact_axis_counts: {"native_tooling_workflow":2,"driver_image_pipeline":2,"stream_buffer_metadata":1}
- actionability_level_counts: {"measurable_test":2,"concrete_check":2}
- effective_actionability_level_counts: {"measurable_test":2,"concrete_check":2}
- signal_quality_status_counts: {"strong_signal":2,"usable_signal":2}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Claude Code 프로젝트 기능 재설계: AI 기반 C++ 네이티브 최적화 및 병렬 개발 워크플로우 지원 | strong_signal | measurable_test | measurable_test | native_tooling_workflow | yes | none |
| 2 | Claude Code v2.1.271 릴리스: 원격 세션 빠른 모드(/fast) 및 설정 패널 마우스 지원 추가 | usable_signal | concrete_check | concrete_check | native_tooling_workflow | yes | none |
| 3 | Samsung S5K3T2 20MP 이미지 센서용 신규 Linux 커널 드라이버 제안 | usable_signal | concrete_check | concrete_check | driver_image_pipeline | yes | none |
| 4 | Intel IPU6 드라이버 멀티 스트림 및 메타데이터 지원 준비 패치 시리즈(v2) 공개 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, stream_buffer_metadata | yes | none |
