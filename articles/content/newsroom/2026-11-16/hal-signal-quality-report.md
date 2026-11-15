# HAL Signal Quality Report - 2026-11-16

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
- strong_signal_count: 5
- usable_signal_count: 0
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
- hal_impact_axis_counts: {"framework_hal_contract":4,"stream_buffer_metadata":5,"camerax_app_compatibility":2}
- actionability_level_counts: {"measurable_test":5}
- effective_actionability_level_counts: {"measurable_test":5}
- signal_quality_status_counts: {"strong_signal":5}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Galaxy A54 5G 세션 중지 시 Camera HAL SIGSEGV 방지를 위한 abortCaptures 우회 쿼크 병합 | strong_signal | measurable_test | measurable_test | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | yes | none |
| 2 | Camera2-pipe CameraMetadata에 3A 모드 및 플래시 지원 여부 조회 확장 함수 추가 | strong_signal | measurable_test | measurable_test | framework_hal_contract, stream_buffer_metadata | yes | none |
| 3 | CameraX SessionConfig 빠른 세션 전환 1단계: 세션 재구성 없는 UseCase 서브셋 동적 전환 병합 | strong_signal | measurable_test | measurable_test | framework_hal_contract, stream_buffer_metadata | yes | none |
| 4 | Camera2-pipe FrameGraph 버퍼 프레임 필터링 개편: TagBundle 기반 정밀 라우팅 지원 | strong_signal | measurable_test | measurable_test | stream_buffer_metadata, framework_hal_contract | yes | none |
| 5 | PreviewView PERFORMANCE 모드 회전 왜곡 수정: CameraEffect 적용 시 SurfaceControl 및 TextureView 폴백 | strong_signal | measurable_test | measurable_test | stream_buffer_metadata, camerax_app_compatibility | yes | none |
