# Selection Report - 2026-09-21

- status: OK
- failure_stage: n/a
- failure_reason: n/a
- review_gate_passed: true
- publish_gate_passed: true

## Selection Errors

- none

## Shortage Hints

- No eligible direct_aosp_camera candidate is available in this pool. Check collection failures, candidate dates and source-policy blockers before attributing the gap to a parser defect.
- No eligible Android candidate is available in this pool. Check collection results and selection exclusions; an empty bucket alone does not establish a parser defect.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

## Candidate Pool Preflight

- candidate_shortage_reviewable: false
- candidate_pool_preflight_passed: true
- shortage_reason_codes: none
- publishable_candidate_count: 12
- required_publishable_candidate_count: 1
- reserve_candidate_count: 7
- required_reserve_candidate_count: 0
- Reserve requirement: diagnostics only

## Homepage Headline

- decision: retained_current_newer
- current_headline_key: url:https://github.com/openai/codex/releases/tag/rust-v0.155.1
- replacement_headline_key: url:https://github.com/openai/codex/releases/tag/rust-v0.155.1
- public_render_reconciled: true
- public_rendered_headline_key: url:https://github.com/anthropics/claude-code/releases/tag/v2.1.271
- public_render_reconciliation_reason: selected_headline_not_rendered_in_public_issue
- previous_stored_current_score: unknown
- runtime_decayed_score: unknown
- last_scored_at: unknown
- scored_at: 2026-09-21
- latest_inclusion_mode: none
- injected_from_snapshot: false
- removed_due_to_headline_inclusion_count: 0
- exposure_history_coverage: forward_only since 2026-07-27

## Source Parser Hints

- SOURCE_COVERAGE_REVIEW: No eligible direct_aosp_camera candidate is available in this pool. Check collection failures, candidate dates and source-policy blockers before attributing the gap to a parser defect.
- SOURCE_COVERAGE_REVIEW: No eligible Android candidate is available in this pool. Check collection results and selection exclusions; an empty bucket alone does not establish a parser defect.
- CAMERA_DRIVER_SOURCE_SHORTAGE: Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

## Gate Summary

- non_fallback_reviewable_article_count: 4
- primary_camera_stack_topic_count: 2
- supporting_main_article_count: 0
- forbidden_main_article_count: 0
- Minimum publishable article count: 1
- Primary camera stack requirement: disabled by one-article policy
- min_final_articles: 1
- max_final_articles: 5
