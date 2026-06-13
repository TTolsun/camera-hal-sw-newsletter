# Candidate Selection Diagnostics - 2026-05-23

## 후보 선택 진단

- Reporter candidates: 3
- Reporter-selected candidates: 0
- Final input candidates: 42
- Final eligible candidates: 3
- Final selected articles: 3
- Deterministic primary articles: 3
- Selected representative groups: 3
- Rendered groups: unknown
- Explicitly demoted groups: 0
- Reserve candidates: 1
- Demoted candidates: unknown
- Composition mode: FALLBACK_COMPOSITION
- Editor review required: false
- Reporter-selected but final-excluded: 0
- direct_aosp_camera: 1
- android_platform_camera_adjacent: 1
- camera_driver_image_pipeline: 0
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 1
- Primary Camera Stack: 2
- Supporting main articles: 1
- Forbidden main articles: 0
- Non-fallback reviewable: 2

Source/parser recovery hint:
- Add or repair Linux camera driver, V4L2, libcamera, image sensor, or ISP release sources with dated item evidence.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- final_selection_blocked=true (37)
- main_eligible=false (37)
- source_gap_risk=true (37)
- reference_only=true (33)
- briefing_only=true (28)

Homepage Headline:
- decision: seeded_from_current_issue
- current_headline_key: unknown
- replacement_headline_key: url:https://developer.android.com/jetpack/androidx/releases/camera#1.6.1
- public_render_reconciled: true
- public_rendered_headline_key: url:https://goo.gle/AdaptiveApps_IO26
- public_render_reconciliation_reason: selected_headline_not_rendered_in_public_issue
- runtime_decayed_score: 100
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-05-23
- included_as_latest: true
- latest_inclusion_mode: injected_from_headline_snapshot
- injected_from_snapshot: true
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## Gate Summary

- Review Gate: PASS (Newsletter Policy selection checks)
- Publish Gate: PASS (main articles: 1-5; review gate primary camera stack articles: disabled; Publish-ready gate primary camera stack articles: disabled; Publish-ready gate direct AOSP Camera or driver/image pipeline articles: disabled; Publish-ready gate supporting main articles max: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 85)
- selection_publish_ready: true
- final_publish_ready: null
- selection_errors: 0
- selection_shortage_hints: 2
