# 뉴스레터 품질 리포트 - 2026-05-07

## Gate Result

- Quality score: 83
- Quality threshold: 85
- Max score: 100
- Result: NEEDS_FIX
- Summary: Quality score 83, threshold 85, max score 100. Resolve source gaps, fact-check items, composition issues, and deductions before publishing.

## Composition

- Main article count: 4
- Briefing count: 3
- Structured camera article count: 3
- Legacy regex camera article count: 4
- Expanded-scope article count: 4
- direct_aosp_camera count: 0
- camera_driver_image_pipeline count: 3
- android_platform_camera_adjacent count: 0
- soc_platform_signal count: 0
- cpp_ai_tooling_fallback count: 1
- generic_tech_watchlist count: 0
- primary_camera_stack_count: 3
- fallback_relevance_count: 1
- publishable_scope_count: 4
- composition_mode: NORMAL
- Relevance bucket counts: {"direct_aosp_camera":0,"camera_driver_image_pipeline":3,"android_platform_camera_adjacent":0,"soc_platform_signal":0,"cpp_ai_tooling_fallback":1,"generic_tech_watchlist":0}
- AI article count: 0
- Underfilled/composition failure: none

## Fact Check And Source Integrity

- Fact-check status: NEEDS_FIX
- Must-fix count: 3
- Source-gap count: 0
- Stale claim status: PASS
- Stale claim removals: 0
- Stale claim hard failures: 0
- Source integrity violation count: 0
- Blocking deduction count: 1
- Blocking deduction categories: source-integrity
- Hard fail count: 1
- Soft deduction count: 2

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | FAIL | repair-section | libcamera v0.7.1 릴리스: Raspberry Pi Atomic control lists 및 Simple pipeline AGC/AWB 통계 개선 | camera_driver_image_pipeline | 2 | false | true | false | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | Fact-check must_fix item mentions this section. | image-fallback: Article image uses a local fallback visual. |
| 2 | FAIL | repair-section | libcamera v0.7.1: 파이프라인 핸들러 및 센서 구성 업데이트 | camera_driver_image_pipeline | 2 | false | true | false | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | Fact-check must_fix item mentions this section. | image-fallback: Article image uses a local fallback visual. |
| 3 | PASS | preserve | libcamera v0.7.1: SoftISP 디베이어링 및 처리량 개선 | camera_driver_image_pipeline | 2 | false | true | false | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | none |
| 4 | FAIL | repair-section | Glaze 7.2: C++26 Reflection 지원 및 YAML, CBOR, MessagePack, TOML 형식 지원 | cpp_ai_tooling_fallback | 5 | false | false | false | true | true | bound | shortlist_selected | merged | none | cpp_ai_tooling_fallback counts toward fallback_relevance_count, not direct camera count. | Fallback bucket is reviewable support material but not a primary camera stack topic. | Fact-check must_fix item mentions this section. | image-fallback: Article image uses a local fallback visual.; image-fallback: Article image uses a local fallback visual. |

## Hard Fails

- 15 pt [source-integrity] Fact checker returned 3 must_fix item(s).

## Soft Deductions

- 1 pt [image-fallback] libcamera v0.7.1 릴리스: Raspberry Pi Atomic control lists 및 Simple pipeline AGC/AWB 통계 개선: Article image uses a local fallback visual.
- 1 pt [image-fallback] Glaze 7.2: C++26 Reflection 지원 및 YAML, CBOR, MessagePack, TOML 형식 지원: Article image uses a local fallback visual.

## Top Deduction Categories

- image-fallback (2)
- source-integrity (1)

## Candidate Exclusion Summary

- none

## Deductions

- 1 pt [image-fallback] libcamera v0.7.1 릴리스: Raspberry Pi Atomic control lists 및 Simple pipeline AGC/AWB 통계 개선: Article image uses a local fallback visual.
- 1 pt [image-fallback] Glaze 7.2: C++26 Reflection 지원 및 YAML, CBOR, MessagePack, TOML 형식 지원: Article image uses a local fallback visual.
- 15 pt [source-integrity] Fact checker returned 3 must_fix item(s).
