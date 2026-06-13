# 뉴스레터 품질 리포트 - 2026-06-11

## Gate Result

- Quality score: 96
- Quality threshold: 60
- Max score: 100
- Result: PASS
- Summary: Safety checks passed and the fact-checker found every article useful to a Camera HAL SW engineer. Editor review is ready.

## Publication Mode

- publication_mode: n/a
- homepage_visibility: n/a
- content_quality_score: 96
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
- Newsletter Policy gate: main articles: 1-5; review gate primary camera stack articles: disabled; Publish-ready gate primary camera stack articles: disabled; Publish-ready gate direct AOSP Camera or driver/image pipeline articles: disabled; Publish-ready gate supporting main articles max: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 60
- Relevance bucket counts: {"direct_aosp_camera":0,"camera_driver_image_pipeline":0,"android_platform_camera_adjacent":1,"android_multimedia_camera_output":0,"soc_platform_signal":0,"cpp_ai_tooling_fallback":0,"generic_tech_watchlist":0}
- Topic tier distribution (relevance_bucket): {"direct_camera":1,"multimedia":0,"platform":0,"fallback":0,"watchlist":0}
- AI article count: 1
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
- hal_impact_axis_counts: {"camerax_app_compatibility":1}
- actionability_level_counts: {"measurable_test":1}
- effective_actionability_level_counts: {"measurable_test":1}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | Android CLI 및 GitHub Skills 저장소에 'Migration to CameraX' 신규 스킬 추가 | strong_signal | measurable_test | measurable_test | camerax_app_compatibility | complete | none |

## Fact Check And Source Integrity

- Fact-check status: PASS
- Must-fix count: 0
- Source-gap count: 0
- Stale claim status: PASS
- Stale claim removals: 0
- Stale claim hard failures: 0
- Source integrity violation count: 0
- Blocking deduction count: 0
- Blocking deduction categories: none
- Hard fail count: 0
- Soft deduction count: 4

## Claim Binding

- Claim validation status: available
- Claim coverage: bound_claims=2; total_claims=2
- Derived evidence mapping count: 0
- Overclaim risk: low
- Uncovered fact count: 0

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Android CLI 및 GitHub Skills 저장소에 'Migration to CameraX' 신규 스킬 추가 | claim:ab2b8e420e165e841a8448556c2b636ccb0b611a38490d2f796bdd384b5fa6ee:1: Android CLI 및 GitHub의 Android skills 저장소에 새로운 개발 패턴 스킬들이 추가되었습니다. | fact | bound | app_api_or_framework_adjacent | low | none | sx:ab2b8e420e165e841a8448556c2b636ccb0b611a38490d2f796bdd384b5fa6ee:evidence_blocks:c66a79cc346be0d0 | https://developer.android.com/tools/agents/android-cli#skills-add |
| Android CLI 및 GitHub Skills 저장소에 'Migration to CameraX' 신규 스킬 추가 | claim:ab2b8e420e165e841a8448556c2b636ccb0b611a38490d2f796bdd384b5fa6ee:2: 추가된 스킬 중에는 'Migration to CameraX' 관련 전문 워크플로우가 포함되어 있습니다. | fact | bound | app_api_or_framework_adjacent | low | none | sx:ab2b8e420e165e841a8448556c2b636ccb0b611a38490d2f796bdd384b5fa6ee:evidence_blocks:c66a79cc346be0d0 | https://developer.android.com/tools/agents/android-cli#skills-add |

### Uncovered Facts

- none

## Article Structure Contract

- Complete article sections: 1
- Incomplete article sections: 0

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Android CLI 및 GitHub Skills 저장소에 'Migration to CameraX' 신규 스킬 추가 | pass | present | camerax_app_compatibility | present | none |

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | PASS | preserve | Android CLI 및 GitHub Skills 저장소에 'Migration to CameraX' 신규 스킬 추가 | android_platform_camera_adjacent | 3 | true | false | false | false | true | bound | shortlist_selected | merged | none | android_platform_camera_adjacent counts toward primary_camera_stack_count. | none | none | image-fallback: Article image uses a local fallback visual. |

## Hard Fails

- none

## Soft Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: reader_perspective, action_hint.
- 1 pt [editorial-story] briefing 3: Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.
- 1 pt [image-fallback] Android CLI 및 GitHub Skills 저장소에 'Migration to CameraX' 신규 스킬 추가: Article image uses a local fallback visual.

## Top Deduction Categories

- editorial-story (3)
- image-fallback (1)

## Candidate Exclusion Summary

- none

## Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: reader_perspective, action_hint.
- 1 pt [editorial-story] briefing 3: Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.
- 1 pt [image-fallback] Android CLI 및 GitHub Skills 저장소에 'Migration to CameraX' 신규 스킬 추가: Article image uses a local fallback visual.
