# 뉴스레터 품질 리포트 - 2026-05-17

## Gate Result

- Quality score: 84
- Quality threshold: 85
- Max score: 100
- Result: NEEDS_FIX
- Summary: Quality score 84, threshold 85, max score 100. Resolve source gaps, fact-check items, composition issues, and deductions before publishing.

## Composition

- Main article count: 3
- Briefing count: 3
- Structured camera article count: 1
- Legacy regex camera article count: 3
- Expanded-scope article count: 2
- direct_aosp_camera count: 0
- camera_driver_image_pipeline count: 1
- android_platform_camera_adjacent count: 0
- soc_platform_signal count: 0
- cpp_ai_tooling_fallback count: 1
- generic_tech_watchlist count: 0
- primary_camera_stack_count: 1
- supporting_main_article_count: 1
- forbidden_main_article_count: 0
- fallback_relevance_count: 1
- publishable_scope_count: 2
- composition_mode: FALLBACK_COMPOSITION
- Newsletter Policy gate: main articles: 3-5; review gate primary camera stack articles: 1; Publish-ready gate primary camera stack articles: 2; Publish-ready gate direct AOSP Camera or driver/image pipeline articles: 1; Publish-ready gate supporting main articles max: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 85
- Relevance bucket counts: {"direct_aosp_camera":0,"camera_driver_image_pipeline":1,"android_platform_camera_adjacent":0,"soc_platform_signal":0,"cpp_ai_tooling_fallback":1,"generic_tech_watchlist":0}
- AI article count: 0
- Underfilled/composition failure: none

## Fact Check And Source Integrity

- Fact-check status: PASS
- Must-fix count: 0
- Source-gap count: 0
- Stale claim status: UNKNOWN
- Stale claim removals: 0
- Stale claim hard failures: 0
- Source integrity violation count: 1
- Blocking deduction count: 2
- Blocking deduction categories: source-integrity, scope-relevance
- Hard fail count: 2
- Soft deduction count: 0

## Article Structure Contract

- Complete article sections: 3
- Incomplete article sections: 0

| # | Article | 5-section | HAL impact | Action item |
| ---: | --- | --- | --- | --- |
| 1 | libcamera Release Announcements - libcamera v0.7.1 | pass | present | present |
| 2 | Tooling Watch / Fallback: GCC 16.1 released: C++26 reflection / contracts / safety hardening, C++20 by default, and more! | pass | present | present |
| 3 | Tooling Watch / Fallback: Glaze 7.2 - C++26 Reflection \| YAML, CBOR, MessagePack, TOML and more | pass | present | present |

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | PASS | preserve | libcamera Release Announcements - libcamera v0.7.1 | camera_driver_image_pipeline | 2 | true | true | false | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | none |
| 2 | FAIL | replace-or-demote | Tooling Watch / Fallback: GCC 16.1 released: C++26 reflection / contracts / safety hardening, C++20 by default, and more! | direct_aosp_camera | 1 | true | false | false | false | false | evidence_mismatch | shortlist_selected | section_text_fallback | none | section_text_fallback classified this section as direct_aosp_camera for diagnostics only. | Scope is diagnostic-only because no publishable source candidate binding and relevance metadata were available. | Shared watch/release-note URL requires matching version_or_release or published_date evidence.; Main article lacks article-level AOSP Camera, camera driver/image pipeline, SoC platform, or native tooling relevance. | none |
| 3 | FAIL | replace-or-demote | Tooling Watch / Fallback: Glaze 7.2 - C++26 Reflection | YAML, CBOR, MessagePack, TOML and more | cpp_ai_tooling_fallback | 5 | false | false | false | true | true | bound | shortlist_selected | merged | none | cpp_ai_tooling_fallback counts toward supporting_main_article_count, not primary_camera_stack_count. | Supporting bucket is allowed by Newsletter Policy but is not a Primary Camera Stack topic. | Shared watch/release-note URL requires matching version_or_release or published_date evidence.; Main article lacks article-level AOSP Camera, camera driver/image pipeline, SoC platform, or native tooling relevance. | none |

## Hard Fails

- 8 pt [source-integrity] Tooling Watch / Fallback: GCC 16.1 released: C++26 reflection / contracts / safety hardening, C++20 by default, and more!: Shared watch/release-note URL requires matching version_or_release or published_date evidence.
- 8 pt [scope-relevance] Tooling Watch / Fallback: GCC 16.1 released: C++26 reflection / contracts / safety hardening, C++20 by default, and more!: Main article lacks article-level AOSP Camera, camera driver/image pipeline, SoC platform, or native tooling relevance.

## Soft Deductions

- none

## Top Deduction Categories

- scope-relevance (1)
- source-integrity (1)

## Candidate Exclusion Summary

- none

## Deductions

- 8 pt [source-integrity] Tooling Watch / Fallback: GCC 16.1 released: C++26 reflection / contracts / safety hardening, C++20 by default, and more!: Shared watch/release-note URL requires matching version_or_release or published_date evidence.
- 8 pt [scope-relevance] Tooling Watch / Fallback: GCC 16.1 released: C++26 reflection / contracts / safety hardening, C++20 by default, and more!: Main article lacks article-level AOSP Camera, camera driver/image pipeline, SoC platform, or native tooling relevance.
