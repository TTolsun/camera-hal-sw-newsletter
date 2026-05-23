# Candidate Selection Diagnostics - 2026-05-24

## 후보 선택 진단

- Reporter candidates: 2
- Reporter-selected candidates: 0
- Final input candidates: 42
- Final eligible candidates: 3
- Final selected articles: 2
- Deterministic primary articles: 2
- Selected representative groups: 2
- Rendered groups: unknown
- Explicitly demoted groups: 0
- Reserve candidates: 1
- Demoted candidates: unknown
- Composition mode: FALLBACK_COMPOSITION
- Editor review required: false
- Reporter-selected but final-excluded: 0
- direct_aosp_camera: 0
- android_platform_camera_adjacent: 1
- camera_driver_image_pipeline: 0
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 1
- Primary Camera Stack: 1
- Supporting main articles: 1
- Forbidden main articles: 0
- Non-fallback reviewable: 1

Source/parser recovery hint:
- Add or repair Linux camera driver, V4L2, libcamera, image sensor, or ISP release sources with dated item evidence.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- final_selection_blocked=true (38)
- main_eligible=false (38)
- source_gap_risk=true (38)
- reference_only=true (34)
- briefing_only=true (29)

Homepage Headline:
- decision: retained_current_above_margin
- current_headline_key: url:https://goo.gle/AdaptiveApps_IO26
- replacement_headline_key: unknown
- public_render_reconciled: true
- public_rendered_headline_key: url:https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html
- public_render_reconciliation_reason: selected_headline_not_rendered_in_public_issue
- runtime_decayed_score: 98
- previous_stored_current_score: 100
- last_scored_at: 2026-05-22
- scored_at: 2026-05-24
- included_as_latest: true
- latest_inclusion_mode: selected_normally
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## Gate Summary

- Review Gate: PASS (Newsletter Policy selection checks)
- Publish Gate: PASS (main articles: 1-5; review gate primary camera stack articles: disabled; Publish-ready gate primary camera stack articles: disabled; Publish-ready gate direct AOSP Camera or driver/image pipeline articles: disabled; Publish-ready gate supporting main articles max: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 85)
- selection_publish_ready: true
- final_publish_ready: null
- selection_errors: 0
- selection_shortage_hints: 2

