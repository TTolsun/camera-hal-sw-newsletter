# Selection Report - 2026-05-19

- status: UNDERFILLED_NEEDS_FIX
- failure_stage: candidate_pool_preflight
- failure_reason: publishable_candidate_shortage; reserve_candidate_shortage; camera_stack_candidate_shortage
- review_gate_passed: true
- publish_gate_passed: false

## Selection Errors

- none

## Shortage Hints

- Repair official AOSP Camera / CameraX row parsers so direct_aosp_camera candidates have dated release/API/behavior evidence.
- Check Android Developers Latest Updates locale/table parsing for Camera Maven Group versions and androidx.camera rows.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

## Candidate Pool Preflight

- candidate_shortage_reviewable: true
- candidate_pool_preflight_passed: false
- shortage_reason_codes: publishable_candidate_shortage; reserve_candidate_shortage; camera_stack_candidate_shortage
- publishable_candidate_count: 3
- required_publishable_candidate_count: 5
- reserve_candidate_count: 0
- required_reserve_candidate_count: 2

## Source Parser Hints

- OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR: Repair official AOSP Camera / CameraX row parsers so direct_aosp_camera candidates have dated release/API/behavior evidence.
- OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR: Check Android Developers Latest Updates locale/table parsing for Camera Maven Group versions and androidx.camera rows.
- CAMERA_DRIVER_SOURCE_SHORTAGE: Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.
- RESERVE_POOL_SHORTAGE: Only 0 reserve candidate(s) are available; candidatePoolPreflight.reserveMin requires 2.

## Gate Summary

- non_fallback_reviewable_article_count: 1
- primary_camera_stack_topic_count: 1
- supporting_main_article_count: 2
- forbidden_main_article_count: 0
- absolute_min_reviewable_articles: 1
- min_non_fallback_publish_ready_articles: 2
- min_final_articles: 3
- max_final_articles: 5
