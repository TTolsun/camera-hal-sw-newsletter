# 뉴스레터 품질 리포트 - 2026-08-10

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

- Main article count: 2
- Briefing count: 3
- Structured camera article count: 2
- Legacy regex camera article count: 2
- Expanded-scope article count: 2
- direct_aosp_camera count: 0
- camera_driver_image_pipeline count: 2
- android_platform_camera_adjacent count: 0
- android_multimedia_camera_output count: 0
- soc_platform_signal count: 0
- cpp_ai_tooling_fallback count: 0
- generic_tech_watchlist count: 0
- primary_camera_stack_count: 2
- supporting_main_article_count: 0
- forbidden_main_article_count: 0
- fallback_relevance_count: 0
- publishable_scope_count: 2
- composition_mode: NORMAL
- Newsletter Policy gate: main articles: 1-5; review gate primary camera stack articles: disabled; Publish-ready gate primary camera stack articles: disabled; Publish-ready gate direct AOSP Camera or driver/image pipeline articles: disabled; Publish-ready gate supporting main articles max: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 60
- Relevance bucket counts: {"direct_aosp_camera":0,"camera_driver_image_pipeline":2,"android_platform_camera_adjacent":0,"android_multimedia_camera_output":0,"soc_platform_signal":0,"cpp_ai_tooling_fallback":0,"generic_tech_watchlist":0}
- Topic tier distribution (relevance_bucket): {"direct_camera":2,"multimedia":0,"platform":0,"fallback":0,"watchlist":0}
- AI article count: 0
- Underfilled/composition failure: none

## HAL Signal Quality

- strong_signal_count: 1
- usable_signal_count: 1
- weak_signal_count: 0
- watchlist_only_count: 0
- blocked_source_gap_count: 0
- article_count_with_hal_signal_capsule: 2
- article_count_without_hal_signal_capsule: 0
- generic_signal_hard_blocker_count: 0
- hal_signal_hard_blocker_count: 0
- hard_blocker_reason_code_counts: {}
- hal_impact_axis_counts: {"driver_image_pipeline":2,"performance_latency_frame_drop":1}
- actionability_level_counts: {"measurable_test":1,"concrete_check":1}
- effective_actionability_level_counts: {"measurable_test":1,"concrete_check":1}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | 글로벌 셔터를 지원하는 onsemi AR0234 CMOS 이미지 센서 드라이버 추가 제안 (PATCH v2) | strong_signal | measurable_test | measurable_test | driver_image_pipeline, performance_latency_frame_drop | complete | none |
| 2 | Sony IMX908 8.39MP 센서 지원을 위한 디바이스 트리 바인딩 추가 (PATCH v2) | usable_signal | concrete_check | concrete_check | driver_image_pipeline | complete | none |

## Fact Check And Source Integrity

- Fact-check status: PASS
- Must-fix count: 0
- Source-gap count: 0
- Stale claim status: PASS
- Stale claim removals: 3
- Stale claim hard failures: 0
- Source integrity violation count: 0
- Blocking deduction count: 0
- Blocking deduction categories: none
- Hard fail count: 0
- Soft deduction count: 4

## Claim Binding

- Claim validation status: available
- Claim coverage: bound_claims=6; total_claims=6
- Derived evidence mapping count: 0
- Overclaim risk: low
- Uncovered fact count: 0

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 글로벌 셔터를 지원하는 onsemi AR0234 CMOS 이미지 센서 드라이버 추가 제안 (PATCH v2) | claim:07aea4ea6876bf6b:1: onsemi AR0234 CMOS 이미지 센서 드라이버가 추가되었습니다. 이 센서는 1/2.6인치 글로벌 셔터 센서로, 1940x1220 픽셀 배열을 가지며 최대 120fps... | fact | bound | driver_image_pipeline | low | none | candidate:07aea4ea6876bf6b:source-summary | https://lore.kernel.org/linux-media/20260807102847.1813059-1-eagle.alexander923@gmail.com/ |
| 글로벌 셔터를 지원하는 onsemi AR0234 CMOS 이미지 센서 드라이버 추가 제안 (PATCH v2) | claim:07aea4ea6876bf6b:2: MIPI CSI-2 출력(1~4 데이터 레인), RAW Bayer (8/10비트) 및 흑백 형식, DPCM 10->8 압축을 지원합니다. | fact | bound | driver_image_pipeline | low | none | candidate:07aea4ea6876bf6b:source-summary | https://lore.kernel.org/linux-media/20260807102847.1813059-1-eagle.alexander923@gmail.com/ |
| 글로벌 셔터를 지원하는 onsemi AR0234 CMOS 이미지 센서 드라이버 추가 제안 (PATCH v2) | claim:07aea4ea6876bf6b:3: 이 변경사항은 Linux media mailing list에 제출된 패치로, 현재 검토 중인 제안입니다. | fact | bound | driver_image_pipeline | low | none | candidate:07aea4ea6876bf6b:source-summary | https://lore.kernel.org/linux-media/20260807102847.1813059-1-eagle.alexander923@gmail.com/ |
| Sony IMX908 8.39MP 센서 지원을 위한 디바이스 트리 바인딩 추가 (PATCH v2) | claim:38c9b3e220f93b37:1: Sony IMX908 센서에 대한 디바이스 트리 바인딩이 추가되었습니다. IMX908은 8.39 메가픽셀(3856x2176) CMOS 이미지 센서로, MIPI CSI-2 출력... | fact | bound | driver_image_pipeline | low | none | candidate:38c9b3e220f93b37:source-summary | https://lore.kernel.org/linux-media/20260806070934.21764-2-lachlan.michael@sony.com/ |
| Sony IMX908 8.39MP 센서 지원을 위한 디바이스 트리 바인딩 추가 (PATCH v2) | claim:38c9b3e220f93b37:2: 이 변경사항은 Linux media mailing list에 제출된 패치로, 현재 검토 중인 제안입니다. | fact | bound | driver_image_pipeline | low | none | candidate:38c9b3e220f93b37:source-summary | https://lore.kernel.org/linux-media/20260806070934.21764-2-lachlan.michael@sony.com/ |
| Sony IMX908 8.39MP 센서 지원을 위한 디바이스 트리 바인딩 추가 (PATCH v2) | article-3-fact-1: 2개 또는 4개 데이터 레인을 지원합니다. | fact | bound | no_hal_runtime_impact | low | none | candidate:38c9b3e220f93b37:source-summary | https://lore.kernel.org/linux-media/20260806070934.21764-2-lachlan.michael@sony.com/ |

### Uncovered Facts

- none

## Article Structure Contract

- Complete article sections: 2
- Incomplete article sections: 0

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | 글로벌 셔터를 지원하는 onsemi AR0234 CMOS 이미지 센서 드라이버 추가 제안 (PATCH v2) | pass | present | driver_image_pipeline, performance_latency_frame_drop | present | none |
| 2 | Sony IMX908 8.39MP 센서 지원을 위한 디바이스 트리 바인딩 추가 (PATCH v2) | pass | present | driver_image_pipeline | present | none |

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | PASS | preserve | 글로벌 셔터를 지원하는 onsemi AR0234 CMOS 이미지 센서 드라이버 추가 제안 (PATCH v2) | camera_driver_image_pipeline | 2 | true | true | false | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | image-fallback: Article image uses a local fallback visual. |
| 2 | PASS | preserve | Sony IMX908 8.39MP 센서 지원을 위한 디바이스 트리 바인딩 추가 (PATCH v2) | camera_driver_image_pipeline | 2 | true | true | false | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | image-fallback: Article image uses a local fallback visual. |

## Hard Fails

- none

## Soft Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.
- 1 pt [image-fallback] 글로벌 셔터를 지원하는 onsemi AR0234 CMOS 이미지 센서 드라이버 추가 제안 (PATCH v2): Article image uses a local fallback visual.
- 1 pt [image-fallback] Sony IMX908 8.39MP 센서 지원을 위한 디바이스 트리 바인딩 추가 (PATCH v2): Article image uses a local fallback visual.

## Unpublishable Articles

- none

## Top Deduction Categories

- editorial-story (2)
- image-fallback (2)

## Candidate Exclusion Summary

- none

## Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.
- 1 pt [image-fallback] 글로벌 셔터를 지원하는 onsemi AR0234 CMOS 이미지 센서 드라이버 추가 제안 (PATCH v2): Article image uses a local fallback visual.
- 1 pt [image-fallback] Sony IMX908 8.39MP 센서 지원을 위한 디바이스 트리 바인딩 추가 (PATCH v2): Article image uses a local fallback visual.
