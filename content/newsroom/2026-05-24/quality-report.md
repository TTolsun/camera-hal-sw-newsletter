# 뉴스레터 품질 리포트 - 2026-05-24

## Gate Result

- Quality score: 88
- Quality threshold: 85
- Max score: 100
- Result: NEEDS_FIX
- Summary: Quality score 88, threshold 85, max score 100. Resolve source gaps, fact-check items, composition issues, and deductions before publishing.

## Publication Mode

- publication_mode: review_only
- homepage_visibility: normal
- content_quality_score: 88
- camera_relevance_score: 88
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
- direct_aosp_camera count: 1
- camera_driver_image_pipeline count: 0
- android_platform_camera_adjacent count: 0
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
- Relevance bucket counts: {"direct_aosp_camera":1,"camera_driver_image_pipeline":0,"android_platform_camera_adjacent":0,"android_multimedia_camera_output":0,"soc_platform_signal":0,"cpp_ai_tooling_fallback":1,"generic_tech_watchlist":0}
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
- hal_impact_axis_counts: {"framework_hal_contract":2,"driver_image_pipeline":2,"stream_buffer_metadata":2,"cts_vts_its_cdd":2,"camerax_app_compatibility":2,"native_tooling_workflow":1}
- actionability_level_counts: {"owner_metric_log":1,"measurable_test":1}
- effective_actionability_level_counts: {"owner_metric_log":1,"measurable_test":1}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | CameraX Release Notes - CameraX 1.6.1 | strong_signal | owner_metric_log | owner_metric_log | framework_hal_contract, driver_image_pipeline, stream_buffer_metadata, cts_vts_its_cdd, camerax_app_compatibility | complete | none |
| 2 | Android Native Tooling: Build native Android apps in Google AI Studio | strong_signal | measurable_test | measurable_test | native_tooling_workflow, framework_hal_contract, driver_image_pipeline, stream_buffer_metadata, cts_vts_its_cdd, camerax_app_compatibility | complete | none |

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
- Soft deduction count: 3

## Claim Binding

- Claim validation status: not_available
- Claim coverage: bound_claims=unknown; total_claims=unknown
- Derived evidence mapping count: 0
- Overclaim risk: unknown
- Uncovered fact count: 16

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| none | none | none | none | none | none | none | none | none |

### Uncovered Facts

- article=1; headline=CameraX Release Notes - CameraX 1.6.1; field=article_sections.verified_facts[0]; reason=missing_matching_fact_claim; text=Android Developers Latest Updates가 May 06, 2026에 게시 또는 업데이트한 항목입니다.
- article=1; headline=CameraX Release Notes - CameraX 1.6.1; field=article_sections.verified_facts[1]; reason=missing_matching_fact_claim; text=버전/릴리스: CameraX 1.6.1.
- article=1; headline=CameraX Release Notes - CameraX 1.6.1; field=article_sections.verified_facts[2]; reason=missing_matching_fact_claim; text=관련 컴포넌트: CameraX / androidx.camera.
- article=1; headline=CameraX Release Notes - CameraX 1.6.1; field=article_sections.verified_facts[3]; reason=missing_matching_fact_claim; text=확인된 변경점: Fixed a compilation error "Cannot access class ListenableFuture " when using CameraX 1.6.0. ( Ic8cba , b/497571473 )
- article=1; headline=CameraX Release Notes - CameraX 1.6.1; field=confirmed_facts[0]; reason=missing_matching_fact_claim; text=Android Developers Latest Updates가 May 06, 2026에 게시 또는 업데이트한 항목입니다.
- article=1; headline=CameraX Release Notes - CameraX 1.6.1; field=confirmed_facts[1]; reason=missing_matching_fact_claim; text=버전/릴리스: CameraX 1.6.1.
- article=1; headline=CameraX Release Notes - CameraX 1.6.1; field=confirmed_facts[2]; reason=missing_matching_fact_claim; text=관련 컴포넌트: CameraX / androidx.camera.
- article=1; headline=CameraX Release Notes - CameraX 1.6.1; field=confirmed_facts[3]; reason=missing_matching_fact_claim; text=확인된 변경점: Fixed a compilation error "Cannot access class ListenableFuture " when using CameraX 1.6.0. ( Ic8cba , b/497571473 )
- article=1; headline=CameraX Release Notes - CameraX 1.6.1; field=evidence_summary; reason=missing_matching_fact_claim; text=Android Developers Latest Updates source metadata와 날짜가 확인된 candidate evidence를 deterministic fallback builder가 사용했습니다.
- article=2; headline=Android Native Tooling: Build native Android apps in Google AI Studio; field=article_sections.verified_facts[0]; reason=missing_matching_fact_claim; text=Android Developers Blog가 Tue, 19 May 2026 12:45:00 +0000에 게시 또는 업데이트한 항목입니다.
- article=2; headline=Android Native Tooling: Build native Android apps in Google AI Studio; field=article_sections.verified_facts[1]; reason=missing_matching_fact_claim; text=관련 컴포넌트: Google AI Studio.
- article=2; headline=Android Native Tooling: Build native Android apps in Google AI Studio; field=article_sections.verified_facts[2]; reason=missing_matching_fact_claim; text=확인된 변경점: Posted by Emma-Louise Leavey, Group Product Manager and Mike Taylor-Cai, Product Manager Starting today Google AI Studio can build entire Android apps for you in minutes from just a prompt.

## Article Structure Contract

- Complete article sections: 2
- Incomplete article sections: 0

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | CameraX Release Notes - CameraX 1.6.1 | pass | present | framework_hal_contract, driver_image_pipeline, stream_buffer_metadata, cts_vts_its_cdd, camerax_app_compatibility | owner_metric_log | none |
| 2 | Android Native Tooling: Build native Android apps in Google AI Studio | pass | present | native_tooling_workflow, framework_hal_contract, driver_image_pipeline, stream_buffer_metadata, cts_vts_its_cdd, camerax_app_compatibility | measurable_test | none |

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | FAIL | replace-or-demote | CameraX Release Notes - CameraX 1.6.1 | direct_aosp_camera | 1 | true | false | false | false | true | bound | shortlist_other | merged | none | direct_aosp_camera counts toward primary_camera_stack_count. | none | CameraX source extraction failure: CameraX HAL boundary is missing from the article. | linked-evidence-limitation: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics. |
| 2 | PASS | preserve | Android Native Tooling: Build native Android apps in Google AI Studio | cpp_ai_tooling_fallback | 6 | false | false | false | true | true | bound | shortlist_selected | merged | none | cpp_ai_tooling_fallback counts toward supporting_main_article_count, not primary_camera_stack_count. | Supporting bucket is allowed by Newsletter Policy but is not a Primary Camera Stack topic. | none | none |

## Hard Fails

- 8 pt [source-integrity] CameraX Release Notes - CameraX 1.6.1: CameraX source extraction failure: CameraX HAL boundary is missing from the article.

## Soft Deductions

- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: action_hint.
- 1 pt [editorial-story] briefing 3: Briefing bullet misses story structure elements: action_hint.
- 2 pt [linked-evidence-limitation] CameraX Release Notes - CameraX 1.6.1: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.

## Top Deduction Categories

- editorial-story (2)
- linked-evidence-limitation (1)
- source-integrity (1)

## Candidate Exclusion Summary

- none

## Deductions

- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: action_hint.
- 1 pt [editorial-story] briefing 3: Briefing bullet misses story structure elements: action_hint.
- 2 pt [linked-evidence-limitation] CameraX Release Notes - CameraX 1.6.1: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.
- 8 pt [source-integrity] CameraX Release Notes - CameraX 1.6.1: CameraX source extraction failure: CameraX HAL boundary is missing from the article.
