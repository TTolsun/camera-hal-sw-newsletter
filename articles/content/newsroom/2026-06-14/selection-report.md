# Selection Report - 2026-06-14

- status: OK
- failure_stage: n/a
- failure_reason: n/a
- review_gate_passed: true
- publish_gate_passed: true

## Selection Errors

- none

## Shortage Hints

- Repair official AOSP Camera / CameraX row parsers so direct_aosp_camera candidates have dated release/API/behavior evidence.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.
- Keep forbidden buckets out of main article selection: generic_tech_watchlist.

## Candidate Pool Preflight

- candidate_shortage_reviewable: false
- candidate_pool_preflight_passed: true
- shortage_reason_codes: none
- publishable_candidate_count: 6
- required_publishable_candidate_count: 1
- reserve_candidate_count: 2
- required_reserve_candidate_count: 0
- Reserve requirement: diagnostics only

## Homepage Headline

- decision: latest_camera_hal_article
- current_headline_key: url:https://developer.android.com/tools/agents/android-cli
- replacement_headline_key: url:https://developer.android.com/tools/agents/android-cli
- public_render_reconciled: false
- public_rendered_headline_key: unknown
- public_render_reconciliation_reason: unknown
- previous_stored_current_score: unknown
- runtime_decayed_score: unknown
- last_scored_at: unknown
- scored_at: 2026-06-14
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0
- exposure_history_coverage: unknown since unknown

## Source Parser Hints

- OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR: Repair official AOSP Camera / CameraX row parsers so direct_aosp_camera candidates have dated release/API/behavior evidence.
- CAMERA_DRIVER_SOURCE_SHORTAGE: Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.
- CANDIDATE_POOL_SHORTAGE: Keep forbidden buckets out of main article selection: generic_tech_watchlist.

## Gate Summary

- non_fallback_reviewable_article_count: 3
- primary_camera_stack_topic_count: 3
- supporting_main_article_count: 0
- forbidden_main_article_count: 0
- Minimum publishable article count: 1
- Primary camera stack requirement: disabled by one-article policy
- min_final_articles: 1
- max_final_articles: 5
