# 뉴스레터 품질 리포트 - 2026-05-08

## Gate Result

- Quality score: 59
- Quality threshold: 85
- Max score: 100
- Result: NEEDS_FIX
- Summary: Quality score 59, threshold 85, max score 100. Resolve source gaps, fact-check items, composition issues, and deductions before publishing.

## Composition

- Main article count: 3
- Briefing count: 3
- Structured camera article count: 2
- Legacy regex camera article count: 2
- Expanded-scope article count: 2
- direct_aosp_camera count: 0
- camera_driver_image_pipeline count: 1
- android_platform_camera_adjacent count: 1
- soc_platform_signal count: 0
- cpp_ai_tooling_fallback count: 0
- generic_tech_watchlist count: 0
- primary_camera_stack_count: 2
- supporting_main_article_count: 0
- forbidden_main_article_count: 0
- fallback_relevance_count: 0
- publishable_scope_count: 2
- composition_mode: NORMAL
- Newsletter Policy gate: main articles: 3-5; required primary camera stack articles: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 85
- Relevance bucket counts: {"direct_aosp_camera":0,"camera_driver_image_pipeline":1,"android_platform_camera_adjacent":1,"soc_platform_signal":0,"cpp_ai_tooling_fallback":0,"generic_tech_watchlist":0}
- AI article count: 1
- Underfilled/composition failure: none

## Fact Check And Source Integrity

- Fact-check status: NEEDS_FIX
- Must-fix count: 12
- Source-gap count: 0
- Stale claim status: UNKNOWN
- Stale claim removals: 0
- Stale claim hard failures: 0
- Source integrity violation count: 1
- Blocking deduction count: 4
- Blocking deduction categories: source-integrity, scope-relevance, hal-relevance
- Hard fail count: 4
- Soft deduction count: 2

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | FAIL | repair-section | CameraX 1.4.0-alpha07 업데이트: 뷰파인더 및 비디오 모듈 변경 | android_platform_camera_adjacent | 3 | true | false | false | false | true | bound | shortlist_selected | merged | none | android_platform_camera_adjacent counts toward primary_camera_stack_count. | none | Fact-check must_fix item mentions this section. | none |
| 2 | FAIL | repair-section | libcamera v0.7.1 출시: SoftISP 및 이미지 파이프라인 개선 | camera_driver_image_pipeline | 2 | true | true | false | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | Fact-check must_fix item mentions this section. | image-fallback: Article image uses a local fallback visual. |
| 3 | FAIL | replace-or-demote | GCC 16.1 출시: C++26 리플렉션 및 계약, C++20 기본 설정 | direct_aosp_camera | 1 | true | false | false | false | false | evidence_mismatch | shortlist_selected | section_text_fallback | none | section_text_fallback classified this section as direct_aosp_camera for diagnostics only. | Scope is diagnostic-only because no publishable source candidate binding and relevance metadata were available. | Shared watch/release-note URL requires matching version_or_release or published_date evidence.; Main article lacks article-level AOSP Camera, camera driver/image pipeline, SoC platform, or native tooling relevance.; Generic AI article lacks a concrete Camera HAL / Android Camera connection and must not stay as a main article.; Fact-check must_fix item mentions this section. | image-fallback: Article image uses a local fallback visual. |

## Hard Fails

- 8 pt [source-integrity] GCC 16.1 출시: C++26 리플렉션 및 계약, C++20 기본 설정: Shared watch/release-note URL requires matching version_or_release or published_date evidence.
- 8 pt [scope-relevance] GCC 16.1 출시: C++26 리플렉션 및 계약, C++20 기본 설정: Main article lacks article-level AOSP Camera, camera driver/image pipeline, SoC platform, or native tooling relevance.
- 8 pt [hal-relevance] GCC 16.1 출시: C++26 리플렉션 및 계약, C++20 기본 설정: Generic AI article lacks a concrete Camera HAL / Android Camera connection and must not stay as a main article.
- 15 pt [source-integrity] Fact checker returned 12 must_fix item(s).

## Soft Deductions

- 1 pt [image-fallback] libcamera v0.7.1 출시: SoftISP 및 이미지 파이프라인 개선: Article image uses a local fallback visual.
- 1 pt [image-fallback] GCC 16.1 출시: C++26 리플렉션 및 계약, C++20 기본 설정: Article image uses a local fallback visual.

## Top Deduction Categories

- image-fallback (2)
- source-integrity (2)
- hal-relevance (1)
- scope-relevance (1)

## Candidate Exclusion Summary

- none

## Deductions

- 1 pt [image-fallback] libcamera v0.7.1 출시: SoftISP 및 이미지 파이프라인 개선: Article image uses a local fallback visual.
- 8 pt [source-integrity] GCC 16.1 출시: C++26 리플렉션 및 계약, C++20 기본 설정: Shared watch/release-note URL requires matching version_or_release or published_date evidence.
- 8 pt [scope-relevance] GCC 16.1 출시: C++26 리플렉션 및 계약, C++20 기본 설정: Main article lacks article-level AOSP Camera, camera driver/image pipeline, SoC platform, or native tooling relevance.
- 8 pt [hal-relevance] GCC 16.1 출시: C++26 리플렉션 및 계약, C++20 기본 설정: Generic AI article lacks a concrete Camera HAL / Android Camera connection and must not stay as a main article.
- 1 pt [image-fallback] GCC 16.1 출시: C++26 리플렉션 및 계약, C++20 기본 설정: Article image uses a local fallback visual.
- 15 pt [source-integrity] Fact checker returned 12 must_fix item(s).
