# Candidate Selection Diagnostics - 2026-09-28

## 후보 선택 진단

- Reporter candidates: 12
- Reporter-selected candidates: 12
- Final input candidates: 81
- Final eligible candidates: 12
- Final selected articles: 5
- Deterministic primary articles: 5
- Selected representative groups: 5
- Rendered groups: unknown
- Explicitly demoted groups (editor): 0
- Reconciliation-demoted groups: 0
- Reserve candidates: 7
- Demoted candidates: unknown
- Composition mode: FALLBACK_COMPOSITION
- Editor review required: false
- Reporter-selected but final-excluded: 7
- direct_aosp_camera: 1
- android: 0
- camera_driver_image_pipeline: 2
- android_multimedia_camera_output: 0
- soc_platform_signal: 1
- cpp_ai_tooling_fallback: 1
- Primary Camera Stack: 3
- Supporting main articles: 1
- Forbidden main articles: 0
- Non-fallback reviewable: 5
- release_class_pool_size: 1
- release_class_admitted: 1
- release_class_blocked_reason: none
- release_class_evidence_unchecked_skips: 0
- release_class_after_reconciliation_pool_size: unknown
- release_class_after_reconciliation_admitted: unknown
- release_class_after_reconciliation_blocked_reason: unknown
- republication_history_loaded: true
- republication_history_main_articles: 32
- republication_cooldown_blocked: 2
- evidence_unchecked_main_blocked: 0

Source/parser recovery hint:
- No eligible Android candidate is available in this pool. Check collection results and selection exclusions; an empty bucket alone does not establish a parser defect.
- Keep forbidden buckets out of main article selection: generic_tech_watchlist.

주요 final exclusion reason:
- missing dated evidence (30)
- selection_window=unknown_not_main (28)
- finalSelectionEligibility=unknown (25)
- final_selection_blocked=true (23)
- main_eligible=false (23)

Homepage Headline:
- decision: latest_camera_hal_article
- current_headline_key: url:https://github.com/openai/codex/releases/tag/rust-v0.155.1
- replacement_headline_key: url:https://android-developers.googleblog.com/2026/09/build-your-way-use-any-ai-agent-in-android-studio.html
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-09-28
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
- selection_shortage_hints: 2

