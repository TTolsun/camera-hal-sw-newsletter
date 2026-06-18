# Candidate Selection Diagnostics - 2026-06-16

## 후보 선택 진단

- Reporter candidates: 5
- Reporter-selected candidates: 4
- Final input candidates: 54
- Final eligible candidates: 5
- Final selected articles: 3
- Deterministic primary articles: 3
- Selected representative groups: 3
- Rendered groups: unknown
- Explicitly demoted groups: 0
- Reserve candidates: 1
- Demoted candidates: unknown
- Composition mode: FALLBACK_COMPOSITION
- Editor review required: false
- Reporter-selected but final-excluded: 1
- direct_aosp_camera: 0
- android_platform_camera_adjacent: 1
- camera_driver_image_pipeline: 1
- android_multimedia_camera_output: 0
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 1
- Primary Camera Stack: 2
- Supporting main articles: 1
- Forbidden main articles: 0
- Non-fallback reviewable: 2

Source/parser recovery hint:
- Repair official AOSP Camera / CameraX row parsers so direct_aosp_camera candidates have dated release/API/behavior evidence.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.
- Keep forbidden buckets out of main article selection: generic_tech_watchlist.

주요 final exclusion reason:
- final_selection_blocked=true (31)
- main_eligible=false (30)
- source_gap_risk=true (30)
- reference_only=true (24)
- briefing_only=true (19)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://lore.kernel.org/linux-media/20260616-mali-c55-ccm-gamma-v1-1-174fe4fedea3@ideasonboard.com
- replacement_headline_key: url:https://lore.kernel.org/linux-media/20260616-mali-c55-ccm-gamma-v1-1-174fe4fedea3@ideasonboard.com
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-06-16
- included_as_latest: false
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0

Reporter-selected candidates are not necessarily publishable. Publication readiness is determined by deterministic final selection and quality validation.

## Gate Summary

- Review Gate: PASS (Newsletter Policy selection checks)
- Publish Gate: PASS (main articles: 1-5; review gate primary camera stack articles: disabled; Publish-ready gate primary camera stack articles: disabled; Publish-ready gate direct AOSP Camera or driver/image pipeline articles: disabled; Publish-ready gate supporting main articles max: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 60)
- selection_publish_ready: true
- final_publish_ready: null
- selection_errors: 0
- selection_shortage_hints: 3

