# Candidate Selection Diagnostics - 2026-10-19

## 후보 선택 진단

- Reporter candidates: 12
- Reporter-selected candidates: 12
- Final input candidates: 54
- Final eligible candidates: 12
- Final selected articles: 4
- Deterministic primary articles: 4
- Selected representative groups: 4
- Rendered groups: unknown
- Explicitly demoted groups (editor): 0
- Reconciliation-demoted groups: 0
- Reserve candidates: 7
- Demoted candidates: unknown
- Composition mode: FALLBACK_COMPOSITION
- Editor review required: false
- Reporter-selected but final-excluded: 8
- direct_aosp_camera: 0
- android: 0
- camera_driver_image_pipeline: 2
- android_multimedia_camera_output: 1
- soc_platform_signal: 0
- cpp_ai_tooling_fallback: 1
- Primary Camera Stack: 2
- Supporting main articles: 1
- Forbidden main articles: 0
- Non-fallback reviewable: 4
- release_class_pool_size: 0
- release_class_admitted: 0
- release_class_blocked_reason: no_eligible_candidate
- release_class_evidence_unchecked_skips: 0
- release_class_after_reconciliation_pool_size: 0
- release_class_after_reconciliation_admitted: 0
- release_class_after_reconciliation_blocked_reason: no_eligible_candidate
- republication_history_loaded: true
- republication_history_main_articles: 47
- republication_cooldown_blocked: 1
- evidence_unchecked_main_blocked: 0

Source/parser recovery hint:
- No eligible direct_aosp_camera candidate is available in this pool. Check collection failures, candidate dates and source-policy blockers before attributing the gap to a parser defect.
- No eligible Android candidate is available in this pool. Check collection results and selection exclusions; an empty bucket alone does not establish a parser defect.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

주요 final exclusion reason:
- final_selection_blocked=true (22)
- main_eligible=false (22)
- source_gap_risk=true (22)
- reference_only=true (14)
- briefing_only=true (13)

Homepage Headline:
- decision: retained_current_newer
- current_headline_key: url:https://android-review.googlesource.com/c/platform/frameworks/support/+/4337073
- replacement_headline_key: url:https://android-review.googlesource.com/c/platform/frameworks/support/+/4337073
- public_render_reconciled: true
- public_rendered_headline_key: url:https://developer.android.com/blog/posts/build-your-way-use-any-ai-agent-of-your-choice-in-android-studio
- public_render_reconciliation_reason: selected_headline_not_rendered_in_public_issue
- runtime_decayed_score: unknown
- previous_stored_current_score: unknown
- last_scored_at: unknown
- scored_at: 2026-10-19
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

