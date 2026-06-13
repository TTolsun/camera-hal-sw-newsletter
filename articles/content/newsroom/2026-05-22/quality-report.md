# 뉴스레터 품질 리포트 - 2026-05-22

## Gate Result

- Quality score: 89
- Quality threshold: 85
- Max score: 100
- Result: NEEDS_FIX
- Summary: Quality score 89, threshold 85, max score 100. Resolve source gaps, fact-check items, composition issues, and deductions before publishing.

## Publication Mode

- publication_mode: review_only
- homepage_visibility: normal
- content_quality_score: 89
- camera_relevance_score: 89
- publication_mode_decision: review_only: public files exist for editor-approved publication, but automatic normal publish gate remains closed.
- fallback_only: false
- camera_anchor_count: 1
- fallback_public_ready: false

## Composition

- Main article count: 2
- Briefing count: 3
- Structured camera article count: 1
- Legacy regex camera article count: 2
- Expanded-scope article count: 2
- direct_aosp_camera count: 0
- camera_driver_image_pipeline count: 0
- android_platform_camera_adjacent count: 1
- android_multimedia_camera_output count: 0
- soc_platform_signal count: 0
- cpp_ai_tooling_fallback count: 1
- generic_tech_watchlist count: 0
- primary_camera_stack_count: 1
- supporting_main_article_count: 1
- forbidden_main_article_count: 0
- fallback_relevance_count: 1
- publishable_scope_count: 2
- composition_mode: FALLBACK_COMPOSITION
- Newsletter Policy gate: main articles: 1-5; review gate primary camera stack articles: disabled; Publish-ready gate primary camera stack articles: disabled; Publish-ready gate direct AOSP Camera or driver/image pipeline articles: disabled; Publish-ready gate supporting main articles max: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 85
- Relevance bucket counts: {"direct_aosp_camera":0,"camera_driver_image_pipeline":0,"android_platform_camera_adjacent":1,"android_multimedia_camera_output":0,"soc_platform_signal":0,"cpp_ai_tooling_fallback":1,"generic_tech_watchlist":0}
- AI article count: 1
- Underfilled/composition failure: none

## HAL Signal Quality

- strong_signal_count: 2
- usable_signal_count: 0
- weak_signal_count: 0
- watchlist_only_count: 0
- blocked_source_gap_count: 0
- article_count_with_hal_signal_capsule: 2
- article_count_without_hal_signal_capsule: 0
- generic_signal_hard_blocker_count: 0
- hal_signal_hard_blocker_count: 0
- hard_blocker_reason_code_counts: {}
- hal_impact_axis_counts: {"camerax_app_compatibility":2,"framework_hal_contract":2,"driver_image_pipeline":1,"stream_buffer_metadata":2,"cts_vts_its_cdd":2,"native_tooling_workflow":1}
- actionability_level_counts: {"measurable_test":2}
- effective_actionability_level_counts: {"measurable_test":2}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | 8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O | strong_signal | measurable_test | measurable_test | camerax_app_compatibility, framework_hal_contract, driver_image_pipeline, stream_buffer_metadata, cts_vts_its_cdd | complete | none |
| 2 | Android Native Tooling: Build native Android apps in Google AI Studio | strong_signal | measurable_test | measurable_test | native_tooling_workflow, framework_hal_contract, stream_buffer_metadata, cts_vts_its_cdd, camerax_app_compatibility | complete | none |

## Fact Check And Source Integrity

- Fact-check status: PASS
- Must-fix count: 0
- Source-gap count: 0
- Stale claim status: UNKNOWN
- Stale claim removals: 0
- Stale claim hard failures: 0
- Source integrity violation count: 0
- Blocking deduction count: 1
- Blocking deduction categories: field-hygiene
- Hard fail count: 1
- Soft deduction count: 3

## Claim Binding

- Claim validation status: not_available
- Claim coverage: bound_claims=unknown; total_claims=unknown
- Derived evidence mapping count: 0
- Overclaim risk: unknown
- Uncovered fact count: 14

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| none | none | none | none | none | none | none | none | none |

### Uncovered Facts

- article=1; headline=8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O; field=article_sections.verified_facts[0]; reason=missing_matching_fact_claim; text=Android Developers Blog가 Tue, 19 May 2026 13:00:00 +0000에 게시 또는 업데이트한 항목입니다.
- article=1; headline=8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O; field=article_sections.verified_facts[1]; reason=missing_matching_fact_claim; text=관련 컴포넌트: CameraX / Android camera APIs.
- article=1; headline=8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O; field=article_sections.verified_facts[2]; reason=missing_matching_fact_claim; text=확인된 변경점: Jetpack Compose is the definitive engine for this transition, offering core tools like our latest Jetpack Navigation 3 release, new experimental Grid and FlexBox layouts, enhanced non-touch input support, and CameraX for correct camera previews across any window size.
- article=1; headline=8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O; field=confirmed_facts[0]; reason=missing_matching_fact_claim; text=Android Developers Blog가 Tue, 19 May 2026 13:00:00 +0000에 게시 또는 업데이트한 항목입니다.
- article=1; headline=8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O; field=confirmed_facts[1]; reason=missing_matching_fact_claim; text=관련 컴포넌트: CameraX / Android camera APIs.
- article=1; headline=8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O; field=confirmed_facts[2]; reason=missing_matching_fact_claim; text=확인된 변경점: Jetpack Compose is the definitive engine for this transition, offering core tools like our latest Jetpack Navigation 3 release, new experimental Grid and FlexBox layouts, enhanced non-touch input support, and CameraX for correct camera previews across any window size.
- article=1; headline=8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O; field=evidence_summary; reason=missing_matching_fact_claim; text=Android Developers Blog source metadata와 날짜가 확인된 candidate evidence를 deterministic fallback builder가 사용했습니다.
- article=2; headline=Android Native Tooling: Build native Android apps in Google AI Studio; field=article_sections.verified_facts[0]; reason=missing_matching_fact_claim; text=Android Developers Blog가 Tue, 19 May 2026 12:45:00 +0000에 게시 또는 업데이트한 항목입니다.
- article=2; headline=Android Native Tooling: Build native Android apps in Google AI Studio; field=article_sections.verified_facts[1]; reason=missing_matching_fact_claim; text=관련 컴포넌트: Google AI Studio.
- article=2; headline=Android Native Tooling: Build native Android apps in Google AI Studio; field=article_sections.verified_facts[2]; reason=missing_matching_fact_claim; text=확인된 변경점: Posted by Emma-Louise Leavey, Group Product Manager and Mike Taylor-Cai, Product Manager Starting today Google AI Studio can build entire Android apps for you in minutes from just a prompt.
- article=2; headline=Android Native Tooling: Build native Android apps in Google AI Studio; field=confirmed_facts[0]; reason=missing_matching_fact_claim; text=Android Developers Blog가 Tue, 19 May 2026 12:45:00 +0000에 게시 또는 업데이트한 항목입니다.
- article=2; headline=Android Native Tooling: Build native Android apps in Google AI Studio; field=confirmed_facts[1]; reason=missing_matching_fact_claim; text=관련 컴포넌트: Google AI Studio.

## Article Structure Contract

- Complete article sections: 2
- Incomplete article sections: 0

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | 8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O | pass | present | camerax_app_compatibility, framework_hal_contract, driver_image_pipeline, stream_buffer_metadata, cts_vts_its_cdd | measurable_test | none |
| 2 | Android Native Tooling: Build native Android apps in Google AI Studio | pass | present | native_tooling_workflow, framework_hal_contract, stream_buffer_metadata, cts_vts_its_cdd, camerax_app_compatibility | measurable_test | none |

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | FAIL | repair-section | 8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O | android_platform_camera_adjacent | 3 | true | false | false | false | true | bound | shortlist_selected | merged | none | android_platform_camera_adjacent counts toward primary_camera_stack_count. | none | Article claims direct HAL API or contract impact without direct_hal_change impact_claim_level. | none |
| 2 | PASS | preserve | Android Native Tooling: Build native Android apps in Google AI Studio | cpp_ai_tooling_fallback | 6 | false | false | false | true | true | bound | shortlist_selected | merged | none | cpp_ai_tooling_fallback counts toward supporting_main_article_count, not primary_camera_stack_count. | Supporting bucket is allowed by Newsletter Policy but is not a Primary Camera Stack topic. | none | none |

## Hard Fails

- 8 pt [field-hygiene] 8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O: Article claims direct HAL API or contract impact without direct_hal_change impact_claim_level.

## Soft Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: action_hint.
- 1 pt [editorial-story] briefing 3: Briefing bullet misses story structure elements: action_hint.

## Top Deduction Categories

- editorial-story (3)
- field-hygiene (1)

## Candidate Exclusion Summary

- none

## Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: action_hint.
- 1 pt [editorial-story] briefing 3: Briefing bullet misses story structure elements: action_hint.
- 8 pt [field-hygiene] 8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O: Article claims direct HAL API or contract impact without direct_hal_change impact_claim_level.
