# Selection Report - 2026-05-22

- status: OK
- failure_stage: n/a
- failure_reason: n/a
- review_gate_passed: true
- publish_gate_passed: true

## Selection Errors

- none

## Shortage Hints

- Repair official AOSP Camera / CameraX row parsers so direct_aosp_camera candidates have dated release/API/behavior evidence.
- Add or repair Linux camera driver, V4L2, libcamera, image sensor, or ISP release sources with dated item evidence.
- Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

## Candidate Pool Preflight

- candidate_shortage_reviewable: false
- candidate_pool_preflight_passed: true
- shortage_reason_codes: none
- publishable_candidate_count: 2
- required_publishable_candidate_count: 1
- reserve_candidate_count: 0
- required_reserve_candidate_count: 0
- Reserve requirement: diagnostics only

## Source Parser Hints

- OFFICIAL_SOURCE_NEEDS_PARSER_REPAIR: Repair official AOSP Camera / CameraX row parsers so direct_aosp_camera candidates have dated release/API/behavior evidence.
- CAMERA_DRIVER_SOURCE_SHORTAGE: Add or repair Linux camera driver, V4L2, libcamera, image sensor, or ISP release sources with dated item evidence.
- CAMERA_DRIVER_SOURCE_SHORTAGE: Add public SoC ISP/GPU/NPU/power/thermal/performance sources only when article-level camera or image pipeline impact is present.

## Gate Summary

- non_fallback_reviewable_article_count: 1
- primary_camera_stack_topic_count: 1
- supporting_main_article_count: 1
- forbidden_main_article_count: 0
- Minimum publishable article count: 1
- Primary camera stack requirement: disabled by one-article policy
- min_final_articles: 1
- max_final_articles: 5
