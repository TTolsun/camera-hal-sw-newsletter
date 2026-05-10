# 뉴스레터 품질 리포트 - 2026-05-10

## Gate Result

- Quality score: 92
- Quality threshold: 85
- Max score: 100
- Result: NEEDS_FIX
- Summary: Quality score 92, threshold 85, max score 100. Resolve source gaps, fact-check items, composition issues, and deductions before publishing.

## Composition

- Main article count: 3
- Briefing count: 3
- Structured camera article count: 3
- Legacy regex camera article count: 3
- Expanded-scope article count: 3
- direct_aosp_camera count: 0
- camera_driver_image_pipeline count: 1
- android_platform_camera_adjacent count: 2
- soc_platform_signal count: 0
- cpp_ai_tooling_fallback count: 0
- generic_tech_watchlist count: 0
- primary_camera_stack_count: 3
- supporting_main_article_count: 0
- forbidden_main_article_count: 0
- fallback_relevance_count: 0
- publishable_scope_count: 3
- composition_mode: NORMAL
- Newsletter Policy gate: main articles: 3-5; required primary camera stack articles: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 85
- Relevance bucket counts: {"direct_aosp_camera":0,"camera_driver_image_pipeline":1,"android_platform_camera_adjacent":2,"soc_platform_signal":0,"cpp_ai_tooling_fallback":0,"generic_tech_watchlist":0}
- AI article count: 3
- Underfilled/composition failure: none

## Fact Check And Source Integrity

- Fact-check status: PASS
- Must-fix count: 0
- Source-gap count: 0
- Stale claim status: UNKNOWN
- Stale claim removals: 0
- Stale claim hard failures: 0
- Source integrity violation count: 1
- Blocking deduction count: 1
- Blocking deduction categories: source-integrity
- Hard fail count: 1
- Soft deduction count: 0

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | PASS | preserve | CameraX 1.4.0-alpha07 업데이트: Android Camera 호환성 관찰 | android_platform_camera_adjacent | 3 | true | false | false | false | true | bound | shortlist_selected | merged | none | android_platform_camera_adjacent counts toward primary_camera_stack_count. | none | none | none |
| 2 | PASS | preserve | libcamera Release Announcements - libcamera v0.7.1 | camera_driver_image_pipeline | 2 | true | true | false | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | none |
| 3 | FAIL | replace-or-demote | CameraX 1.6.1 업데이트: Android Camera 호환성 관찰 | android_platform_camera_adjacent | 3 | true | false | false | false | true | bound | shortlist_selected | merged | none | android_platform_camera_adjacent counts toward primary_camera_stack_count. | none | Duplicate source URL is used across main sections: https://developer.android.com/jetpack/androidx/releases/camera#1.6.1. | none |

## Hard Fails

- 8 pt [source-integrity] CameraX 1.6.1 업데이트: Android Camera 호환성 관찰: Duplicate source URL is used across main sections: https://developer.android.com/jetpack/androidx/releases/camera#1.6.1.

## Soft Deductions

- none

## Top Deduction Categories

- source-integrity (1)

## Candidate Exclusion Summary

- none

## Deductions

- 8 pt [source-integrity] CameraX 1.6.1 업데이트: Android Camera 호환성 관찰: Duplicate source URL is used across main sections: https://developer.android.com/jetpack/androidx/releases/camera#1.6.1.
