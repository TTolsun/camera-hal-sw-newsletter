# Candidate Selection Diagnostics - 2026-06-06

## 후보 선택 진단

- Reporter candidates: 6
- Reporter-selected candidates: 6
- Final input candidates: 42
- Final eligible candidates: 6
- Final selected articles: 5
- Deterministic primary articles: 5
- Selected representative groups: 5
- Rendered groups: unknown
- Explicitly demoted groups: 0
- Reserve candidates: 1
- Demoted candidates: unknown
- Composition mode: FALLBACK_COMPOSITION
- Editor review required: false
- Reporter-selected but final-excluded: 1
- direct_aosp_camera: 1
- android_platform_camera_adjacent: 0
- camera_driver_image_pipeline: 3
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 1
- Primary Camera Stack: 4
- Supporting main articles: 1
- Forbidden main articles: 0
- Non-fallback reviewable: 4

Source/parser recovery hint:
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- final_selection_blocked=true (29)
- main_eligible=false (28)
- source_gap_risk=true (28)
- reference_only=true (19)
- selection_window=reference_not_main (16)

Homepage Headline:
- decision: replaced_by_new_candidate
- current_headline_key: url:https://developer.android.com/jetpack/androidx/releases/camera#1.6.0
- replacement_headline_key: url:https://youtube.com/playlist?list=PLWz5rJ2EKKc8lSdmWQ_fSpV9yEGRvEL6S&si=H6-8-AbtEyTqSxeY
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: 94
- previous_stored_current_score: 100
- last_scored_at: 2026-06-03
- scored_at: 2026-06-06
- included_as_latest: true
- latest_inclusion_mode: selected_normally
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## Gate Summary

- Review Gate: PASS (Newsletter Policy selection checks)
- Publish Gate: PASS (main articles: 1-5; review gate primary camera stack articles: disabled; Publish-ready gate primary camera stack articles: disabled; Publish-ready gate direct AOSP Camera or driver/image pipeline articles: disabled; Publish-ready gate supporting main articles max: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 60)
- selection_publish_ready: true
- final_publish_ready: null
- selection_errors: 0
- selection_shortage_hints: 1

