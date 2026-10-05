# HAL Signal Quality Report - 2026-10-05

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
- strong_signal_count: 3
- usable_signal_count: 1
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
- hal_impact_axis_counts: {"driver_image_pipeline":3,"performance_latency_frame_drop":1,"stream_buffer_metadata":2,"native_tooling_workflow":1}
- actionability_level_counts: {"measurable_test":3,"concrete_check":1}
- effective_actionability_level_counts: {"measurable_test":3,"concrete_check":1}
- signal_quality_status_counts: {"strong_signal":3,"usable_signal":1}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Mali-C55 ISP 드라이버의 전원 관리 개선: IRQ Wake 활성화 중 ISP 전원 유지 패치 제안 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, performance_latency_frame_drop | yes | none |
| 2 | ChromeOS 플랫폼의 카메라 스택 안정성 강화: APPn 파싱 및 BLOB 출력 버퍼 크기 경계 검사 추가 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, stream_buffer_metadata | yes | none |
| 3 | ChromeOS 카메라 어댑터의 버퍼 관리 강화: 독점적인 버퍼 ID 강제 적용 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, stream_buffer_metadata | yes | none |
| 4 | 개발 워크플로우에 AI 에이전트 통합: Barclays의 Claude Code 대규모 도입 사례 | usable_signal | concrete_check | concrete_check | native_tooling_workflow | yes | none |
