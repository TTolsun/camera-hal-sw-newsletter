# 뉴스레터 품질 리포트 - 2026-07-20

## Gate Result

- Quality score: 97
- Quality threshold: 60
- Max score: 100
- Result: PASS
- Summary: Safety checks passed and the fact-checker found every article useful to a Camera HAL SW engineer. Editor review is ready.

## Publication Mode

- publication_mode: n/a
- homepage_visibility: n/a
- content_quality_score: 97
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
- camera_driver_image_pipeline count: 1
- android_platform_camera_adjacent count: 0
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
- Relevance bucket counts: {"direct_aosp_camera":0,"camera_driver_image_pipeline":1,"android_platform_camera_adjacent":0,"android_multimedia_camera_output":0,"soc_platform_signal":0,"cpp_ai_tooling_fallback":0,"generic_tech_watchlist":0}
- Topic tier distribution (relevance_bucket): {"direct_camera":1,"multimedia":0,"platform":0,"fallback":0,"watchlist":0}
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
- hal_impact_axis_counts: {"driver_image_pipeline":1}
- actionability_level_counts: {"measurable_test":1}
- effective_actionability_level_counts: {"measurable_test":1}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | libcamera: IMX335 이미지 센서 테스트 패턴 속성 추가 패치 제안 | strong_signal | measurable_test | measurable_test | driver_image_pipeline | complete | none |

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
- Soft deduction count: 3

## Claim Binding

- Claim validation status: available
- Claim coverage: bound_claims=2; total_claims=2
- Derived evidence mapping count: 0
- Overclaim risk: low
- Uncovered fact count: 0

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| libcamera: IMX335 이미지 센서 테스트 패턴 속성 추가 패치 제안 | claim_imx335_patch_proposed: 2026년 7월 14일, libcamera 패치워크에 IMX335 이미지 센서의 테스트 패턴 속성을 추가하는 패치(Patch 27362)가 제출되어 검토 중입니다. | fact | bound | driver_image_pipeline | low | none | candidate:a9a3506a5274fbba:source-summary | https://patchwork.libcamera.org/patch/27362/ |
| libcamera: IMX335 이미지 센서 테스트 패턴 속성 추가 패치 제안 | claim_imx335_sensor_properties: 해당 패치는 libcamera의 camera_sensor 컴포넌트 내에 IMX335 센서 전용 테스트 패턴 속성을 정의하는 것을 목표로 합니다. | fact | bound | driver_image_pipeline | low | none | candidate:a9a3506a5274fbba:source-summary | https://patchwork.libcamera.org/patch/27362/ |

### Uncovered Facts

- none

## Article Structure Contract

- Complete article sections: 1
- Incomplete article sections: 0

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | libcamera: IMX335 이미지 센서 테스트 패턴 속성 추가 패치 제안 | pass | present+guarded | driver_image_pipeline | present | guardrail-only |

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | PASS | preserve | libcamera: IMX335 이미지 센서 테스트 패턴 속성 추가 패치 제안 | camera_driver_image_pipeline | 2 | true | true | false | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | image-fallback: Article image uses a local fallback visual. |

## Hard Fails

- none

## Soft Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: reader_perspective.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: what_happened.
- 1 pt [image-fallback] libcamera: IMX335 이미지 센서 테스트 패턴 속성 추가 패치 제안: Article image uses a local fallback visual.

## Unpublishable Articles

- none

## Top Deduction Categories

- editorial-story (2)
- image-fallback (1)

## Candidate Exclusion Summary

- none

## Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: reader_perspective.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: what_happened.
- 1 pt [image-fallback] libcamera: IMX335 이미지 센서 테스트 패턴 속성 추가 패치 제안: Article image uses a local fallback visual.
