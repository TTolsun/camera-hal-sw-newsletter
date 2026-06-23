# HAL Signal Quality Report - 2026-06-24

## Gate Boundary

- status: NEEDS_FIX
- input_completeness: partial
- quality validation records HAL signal deductions: true
- publish gate blocks HAL signal hard blockers through quality status: true
- review artifacts preserved: true

## Inputs

- missing required: none
- optional input_unavailable: source_effectiveness_report, evidence_pack_summary

## Summary

- main_article_count: 2
- strong_signal_count: 1
- usable_signal_count: 0
- weak_signal_count: 1
- watchlist_only_count: 0
- blocked_source_gap_count: 0
- article_count_with_hal_signal_capsule: 2
- article_count_without_hal_signal_capsule: 0
- android_multimedia_camera_output_count: 0
- soc_platform_signal_count: 0
- generic_signal_hard_blocker_count: 1
- hal_signal_hard_blocker_count: 1
- hard_blocker_reason_code_counts: {"hal_actionability_none":1,"fallback_promotion_not_allowed":1}
- hal_impact_axis_counts: {"camerax_app_compatibility":1,"native_tooling_workflow":1}
- actionability_level_counts: {"measurable_test":1,"none":1}
- effective_actionability_level_counts: {"measurable_test":1,"none":1}
- signal_quality_status_counts: {"strong_signal":1,"weak_signal":1}

## Count Semantics

- android_multimedia_camera_output_count: supporting camera output / multimedia lane; not a direct HAL bucket and not a fallback topic count.
- fallback_main_article_count: fallback/watchlist-oriented signal count for SoC, C++ tooling, and generic watchlist buckets.

## Main Article Signal Checks

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | capsule | hard_blocker_reason_codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Android CLI에 CameraX 마이그레이션 스킬 추가, 앱 호환성 검증 지원 | strong_signal | measurable_test | measurable_test | camerax_app_compatibility | yes | none |
| 2 | GCC 16 컴파일러 릴리스 임박, 개선된 오류 메시지 및 SARIF 정적 분석 도입 | weak_signal | none | none | native_tooling_workflow | yes | hal_actionability_none, fallback_promotion_not_allowed |
