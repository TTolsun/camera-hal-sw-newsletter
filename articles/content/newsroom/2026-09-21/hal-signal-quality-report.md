# HAL Signal Quality Report - 2026-09-21

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
- strong_signal_count: 3
- usable_signal_count: 2
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
- hal_impact_axis_counts: {"driver_image_pipeline":2,"stream_buffer_metadata":3,"cts_vts_its_cdd":2,"native_tooling_workflow":3,"performance_latency_frame_drop":1}
- actionability_level_counts: {"measurable_test":3,"concrete_check":2}
- effective_actionability_level_counts: {"measurable_test":3,"concrete_check":2}
- signal_quality_status_counts: {"strong_signal":3,"usable_signal":2}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Intel IPU6 드라이버 멀티 스트림 및 메타데이터 지원 준비를 위한 v2 패치 시리즈 제안 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, stream_buffer_metadata | yes | none |
| 2 | Microsoft Surface Pro 11 (Intel) 카메라 거꾸로 출력되는 문제 해결을 위한 퀵 패치 제안 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, stream_buffer_metadata, cts_vts_its_cdd | yes | none |
| 3 | Claude Code 프로젝트 기능 재설계: 대화형 프로파일링 및 병렬 PR 지원 | strong_signal | measurable_test | measurable_test | native_tooling_workflow, performance_latency_frame_drop | yes | none |
| 4 | Claude Code v2.1.271 출시: 원격 세션 빠른 모드 및 설정 패널 마우스 지원 추가 | usable_signal | concrete_check | concrete_check | native_tooling_workflow, cts_vts_its_cdd | yes | none |
| 5 | Codex rust-v0.155.1 출시: 로컬 TUI 세션 추론 요약 기본 비활성화로 요청 거부 해결 | usable_signal | concrete_check | concrete_check | native_tooling_workflow, stream_buffer_metadata | yes | none |
