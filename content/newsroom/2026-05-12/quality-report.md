# 뉴스레터 품질 리포트 - 2026-05-12

## Gate Result

- Quality score: 92
- Quality threshold: 85
- Max score: 100
- Result: NEEDS_FIX
- Summary: Quality score 92, threshold 85, max score 100. Resolve source gaps, fact-check items, composition issues, and deductions before publishing.

## Publication Mode

- publication_mode: n/a
- homepage_visibility: n/a
- content_quality_score: 92
- camera_relevance_score: n/a
- publication_mode_decision: n/a
- fallback_only: false
- camera_anchor_count: n/a
- fallback_public_ready: false

## Composition

- Main article count: 1
- Briefing count: 3
- Structured camera article count: 1
- Legacy regex camera article count: 1
- Expanded-scope article count: 1
- direct_aosp_camera count: 0
- camera_driver_image_pipeline count: 0
- android_platform_camera_adjacent count: 1
- android_multimedia_camera_output count: 0
- soc_platform_signal count: 0
- cpp_ai_tooling_fallback count: 0
- generic_tech_watchlist count: 0
- primary_camera_stack_count: 1
- supporting_main_article_count: 0
- forbidden_main_article_count: 0
- fallback_relevance_count: 0
- publishable_scope_count: 1
- composition_mode: NORMAL
- Newsletter Policy gate: main articles: 1-5; review gate primary camera stack articles: disabled; Publish-ready gate primary camera stack articles: disabled; Publish-ready gate direct AOSP Camera or driver/image pipeline articles: disabled; Publish-ready gate supporting main articles max: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 85
- Relevance bucket counts: {"direct_aosp_camera":0,"camera_driver_image_pipeline":0,"android_platform_camera_adjacent":1,"android_multimedia_camera_output":0,"soc_platform_signal":0,"cpp_ai_tooling_fallback":0,"generic_tech_watchlist":0}
- AI article count: 0
- Underfilled/composition failure: none

## HAL Signal Quality

- strong_signal_count: 1
- usable_signal_count: 0
- weak_signal_count: 0
- watchlist_only_count: 0
- blocked_source_gap_count: 0
- article_count_with_hal_signal_capsule: 1
- article_count_without_hal_signal_capsule: 0
- generic_signal_hard_blocker_count: 0
- hal_signal_hard_blocker_count: 0
- hard_blocker_reason_code_counts: {}
- hal_impact_axis_counts: {"camerax_app_compatibility":1,"framework_hal_contract":1,"driver_image_pipeline":1,"stream_buffer_metadata":1,"cts_vts_its_cdd":1,"performance_latency_frame_drop":1}
- actionability_level_counts: {"owner_metric_log":1}
- effective_actionability_level_counts: {"owner_metric_log":1}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | CameraX 1.6.1 업데이트: Android Camera 호환성 관찰 | strong_signal | owner_metric_log | owner_metric_log | camerax_app_compatibility, framework_hal_contract, driver_image_pipeline, stream_buffer_metadata, cts_vts_its_cdd, performance_latency_frame_drop | complete | none |

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

## Claim Binding

- Claim validation status: not_available
- Claim coverage: bound_claims=unknown; total_claims=unknown
- Derived evidence mapping count: 0
- Overclaim risk: unknown
- Uncovered fact count: 33

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| none | none | none | none | none | none | none | none | none |

### Uncovered Facts

- article=1; headline=CameraX 1.6.1 업데이트: Android Camera 호환성 관찰; field=article_sections.verified_facts[0]; reason=missing_matching_fact_claim; text=Android Developers Latest Updates가 May 06, 2026에 게시 또는 업데이트한 항목입니다.
- article=1; headline=CameraX 1.6.1 업데이트: Android Camera 호환성 관찰; field=article_sections.verified_facts[1]; reason=missing_matching_fact_claim; text=버전/릴리스: CameraX 1.6.1.
- article=1; headline=CameraX 1.6.1 업데이트: Android Camera 호환성 관찰; field=article_sections.verified_facts[2]; reason=missing_matching_fact_claim; text=관련 컴포넌트: CameraX / androidx.camera.
- article=1; headline=CameraX 1.6.1 업데이트: Android Camera 호환성 관찰; field=article_sections.verified_facts[3]; reason=missing_matching_fact_claim; text=확인된 변경점: CameraX / androidx.camera CameraX 1.6.1 업데이트입니다. 대상: CameraX / androidx.camera.
- article=1; headline=CameraX 1.6.1 업데이트: Android Camera 호환성 관찰; field=article_sections.verified_facts[4]; reason=missing_matching_fact_claim; text=버전/릴리스: 1.4.0-alpha07.
- article=1; headline=CameraX 1.6.1 업데이트: Android Camera 호환성 관찰; field=article_sections.verified_facts[5]; reason=missing_matching_fact_claim; text=확인된 변경점: CameraX / androidx.camera 1.4.0-alpha07 업데이트입니다. 대상: CameraX / androidx.camera.
- article=1; headline=CameraX 1.6.1 업데이트: Android Camera 호환성 관찰; field=article_sections.verified_facts[6]; reason=missing_matching_fact_claim; text=CameraX 1.4.0-alpha07이 2026년 5월 6일에 출시되었습니다.
- article=1; headline=CameraX 1.6.1 업데이트: Android Camera 호환성 관찰; field=article_sections.verified_facts[7]; reason=missing_matching_fact_claim; text=`camera-viewfinder` 모듈이 1.4.0-alpha07로 업데이트되었습니다.
- article=1; headline=CameraX 1.6.1 업데이트: Android Camera 호환성 관찰; field=article_sections.verified_facts[8]; reason=missing_matching_fact_claim; text=`camera-video` 모듈이 1.6.1로 업데이트되었습니다.
- article=1; headline=CameraX 1.6.1 업데이트: Android Camera 호환성 관찰; field=article_sections.verified_facts[9]; reason=missing_matching_fact_claim; text=2026년 5월 6일, CameraX 라이브러리 1.4.0-alpha07이 릴리스되었습니다.
- article=1; headline=CameraX 1.6.1 업데이트: Android Camera 호환성 관찰; field=article_sections.verified_facts[10]; reason=missing_matching_fact_claim; text=viewfinder artifact가 1.4.0-alpha07 line으로 업데이트되었습니다.
- article=1; headline=CameraX 1.6.1 업데이트: Android Camera 호환성 관찰; field=article_sections.verified_facts[11]; reason=missing_matching_fact_claim; text=video artifact가 1.7.0-alpha01 line으로 업데이트되었습니다.

## Article Structure Contract

- Complete article sections: 1
- Incomplete article sections: 0

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | CameraX 1.6.1 업데이트: Android Camera 호환성 관찰 | pass | present+guarded | camerax_app_compatibility, framework_hal_contract, driver_image_pipeline, stream_buffer_metadata, cts_vts_its_cdd, performance_latency_frame_drop | present | guardrail-only |

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | FAIL | replace-or-demote | CameraX 1.6.1 업데이트: Android Camera 호환성 관찰 | android_platform_camera_adjacent | 3 | true | false | false | false | true | bound | shortlist_selected | merged | multimedia_camera_output_relevance | android_platform_camera_adjacent counts toward primary_camera_stack_count. | none | CameraX source extraction failure: behavior_fallback_from_metadata; source_extraction.release.sections has no concrete release-note bullet; CameraX HAL boundary is missing from the article; direct HAL contract/API claim lacks direct_hal_change source evidence. | none |

## Hard Fails

- 8 pt [source-integrity] CameraX 1.6.1 업데이트: Android Camera 호환성 관찰: CameraX source extraction failure: behavior_fallback_from_metadata; source_extraction.release.sections has no concrete release-note bullet; CameraX HAL boundary is missing from the article; direct HAL contract/API claim lacks direct_hal_change source evidence.

## Soft Deductions

- none

## Top Deduction Categories

- source-integrity (1)

## Candidate Exclusion Summary

- none

## Deductions

- 8 pt [source-integrity] CameraX 1.6.1 업데이트: Android Camera 호환성 관찰: CameraX source extraction failure: behavior_fallback_from_metadata; source_extraction.release.sections has no concrete release-note bullet; CameraX HAL boundary is missing from the article; direct HAL contract/API claim lacks direct_hal_change source evidence.
