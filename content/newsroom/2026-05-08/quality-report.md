# 뉴스레터 품질 리포트 - 2026-05-08

## Gate Result

- Quality score: 97
- Quality threshold: 85
- Max score: 100
- Result: PASS
- Summary: Quality score 97, threshold 85, max score 100. Editor review is ready.

## Composition

- Main article count: 3
- Briefing count: 3
- Structured camera article count: 2
- Legacy regex camera article count: 2
- Expanded-scope article count: 3
- direct_aosp_camera count: 0
- camera_driver_image_pipeline count: 1
- android_platform_camera_adjacent count: 1
- soc_platform_signal count: 0
- cpp_ai_tooling_fallback count: 1
- generic_tech_watchlist count: 0
- primary_camera_stack_count: 2
- supporting_main_article_count: 1
- forbidden_main_article_count: 0
- fallback_relevance_count: 1
- publishable_scope_count: 3
- composition_mode: FALLBACK_COMPOSITION
- Newsletter Policy gate: main articles: 3-5; required primary camera stack articles: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 85
- Relevance bucket counts: {"direct_aosp_camera":0,"camera_driver_image_pipeline":1,"android_platform_camera_adjacent":1,"soc_platform_signal":0,"cpp_ai_tooling_fallback":1,"generic_tech_watchlist":0}
- AI article count: 1
- Underfilled/composition failure: none

## Fact Check And Source Integrity

- Fact-check status: PASS
- Must-fix count: 0
- Source-gap count: 0
- Stale claim status: UNKNOWN
- Stale claim removals: 0
- Stale claim hard failures: 0
- Source integrity violation count: 0
- Blocking deduction count: 0
- Blocking deduction categories: none
- Hard fail count: 0
- Soft deduction count: 3

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | PASS | preserve | CameraX 1.6.1 릴리스: Camera Maven Group 버전 갱신 확인 | android_platform_camera_adjacent | 3 | true | false | false | false | true | bound | shortlist_selected | merged | none | android_platform_camera_adjacent counts toward primary_camera_stack_count. | none | none | image-fallback: Article image uses a local fallback visual. |
| 2 | PASS | preserve | libcamera v0.7.1: SoftISP와 image pipeline 릴리스 | camera_driver_image_pipeline | 2 | true | true | false | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | image-fallback: Article image uses a local fallback visual. |
| 3 | PASS | preserve | GCC 16.1: C++26 reflection / contracts 지원 동향 | cpp_ai_tooling_fallback | 5 | false | false | false | true | true | bound | shortlist_selected | merged | none | cpp_ai_tooling_fallback counts toward supporting_main_article_count, not primary_camera_stack_count. | Supporting bucket is allowed by Newsletter Policy but is not a Primary Camera Stack topic. | none | image-fallback: Article image uses a local fallback visual. |

## Hard Fails

- none

## Soft Deductions

- 1 pt [image-fallback] CameraX 1.6.1 릴리스: Camera Maven Group 버전 갱신 확인: Article image uses a local fallback visual.
- 1 pt [image-fallback] libcamera v0.7.1: SoftISP와 image pipeline 릴리스: Article image uses a local fallback visual.
- 1 pt [image-fallback] GCC 16.1: C++26 reflection / contracts 지원 동향: Article image uses a local fallback visual.

## Top Deduction Categories

- image-fallback (3)

## Candidate Exclusion Summary

- none

## Deductions

- 1 pt [image-fallback] CameraX 1.6.1 릴리스: Camera Maven Group 버전 갱신 확인: Article image uses a local fallback visual.
- 1 pt [image-fallback] libcamera v0.7.1: SoftISP와 image pipeline 릴리스: Article image uses a local fallback visual.
- 1 pt [image-fallback] GCC 16.1: C++26 reflection / contracts 지원 동향: Article image uses a local fallback visual.
