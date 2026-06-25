# 뉴스레터 품질 리포트 - 2026-06-26

## Gate Result

- Quality score: 93
- Quality threshold: 60
- Max score: 100
- Result: PASS
- Summary: Safety checks passed and the fact-checker found every article useful to a Camera HAL SW engineer. Editor review is ready.

## Publication Mode

- publication_mode: n/a
- homepage_visibility: n/a
- content_quality_score: 93
- camera_relevance_score: n/a
- publication_mode_decision: n/a
- fallback_only: false
- camera_anchor_count: n/a
- fallback_public_ready: false

## Composition

- Main article count: 4
- Briefing count: 3
- Structured camera article count: 4
- Legacy regex camera article count: 0
- Expanded-scope article count: 4
- direct_aosp_camera count: 0
- camera_driver_image_pipeline count: 4
- android_platform_camera_adjacent count: 0
- android_multimedia_camera_output count: 0
- soc_platform_signal count: 0
- cpp_ai_tooling_fallback count: 0
- generic_tech_watchlist count: 0
- primary_camera_stack_count: 4
- supporting_main_article_count: 0
- forbidden_main_article_count: 0
- fallback_relevance_count: 0
- publishable_scope_count: 4
- composition_mode: NORMAL
- Newsletter Policy gate: main articles: 1-5; review gate primary camera stack articles: disabled; Publish-ready gate primary camera stack articles: disabled; Publish-ready gate direct AOSP Camera or driver/image pipeline articles: disabled; Publish-ready gate supporting main articles max: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 60
- Relevance bucket counts: {"direct_aosp_camera":0,"camera_driver_image_pipeline":4,"android_platform_camera_adjacent":0,"android_multimedia_camera_output":0,"soc_platform_signal":0,"cpp_ai_tooling_fallback":0,"generic_tech_watchlist":0}
- Topic tier distribution (relevance_bucket): {"direct_camera":4,"multimedia":0,"platform":0,"fallback":0,"watchlist":0}
- AI article count: 0
- Underfilled/composition failure: none

## HAL Signal Quality

- strong_signal_count: 4
- usable_signal_count: 0
- weak_signal_count: 0
- watchlist_only_count: 0
- blocked_source_gap_count: 0
- article_count_with_hal_signal_capsule: 4
- article_count_without_hal_signal_capsule: 0
- generic_signal_hard_blocker_count: 0
- hal_signal_hard_blocker_count: 0
- hard_blocker_reason_code_counts: {}
- hal_impact_axis_counts: {"driver_image_pipeline":4,"soc_resource_contention":2}
- actionability_level_counts: {"measurable_test":4}
- effective_actionability_level_counts: {"measurable_test":4}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | IMX219 센서 드라이버 테스트 패턴 정합성 개선 및 신규 패턴 추가 패치 제안 | strong_signal | measurable_test | measurable_test | driver_image_pipeline | complete | none |
| 2 | Qualcomm SM8250 SoC 하드웨어 JPEG 인코더를 위한 Device Tree 바인딩 추가 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, soc_resource_contention | complete | none |
| 3 | Qualcomm SM8250 SoC 대상 V4L2 mem2mem JPEG 인코더 드라이버 패치 제안 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, soc_resource_contention | complete | none |
| 4 | V4L2 UAPI 내 카메라 센서 CFA 패턴 묘사를 위한 V4L2_CID_CFA_PATTERN 컨트롤 추가 | strong_signal | measurable_test | measurable_test | driver_image_pipeline | complete | none |

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
- Soft deduction count: 7

## Claim Binding

- Claim validation status: available
- Claim coverage: bound_claims=4; total_claims=4
- Derived evidence mapping count: 0
- Overclaim risk: low
- Uncovered fact count: 0

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| IMX219 센서 드라이버 테스트 패턴 정합성 개선 및 신규 패턴 추가 패치 제안 | claim_imx219_1: IMX219 센서 드라이버의 테스트 패턴 메뉴 순서가 데이터시트와 일치하도록 수정되고, 누락된 5개의 테스트 패턴이 추가됩니다. | fact | bound | driver_image_pipeline | low | none | candidate:a4f38b10cb61d4b7:source-summary | https://lore.kernel.org/linux-media/20260625160228.59672-1-tharitt97@gmail.com/ |
| Qualcomm SM8250 SoC 하드웨어 JPEG 인코더를 위한 Device Tree 바인딩 추가 | claim_qcom_dt_1: Qualcomm SM8250 (Kona) SoC에 있는 JPEG 인코더 하드웨어 블록에 대한 Device Tree 바인딩이 추가됩니다. | fact | bound | driver_image_pipeline | low | none | candidate:2f45e42ce070b38f:source-summary | https://lore.kernel.org/linux-media/560888a5-fc36-4495-b8c3-66edc3f126f2@oss.qualcomm.com/ |
| Qualcomm SM8250 SoC 대상 V4L2 mem2mem JPEG 인코더 드라이버 패치 제안 | claim_qcom_m2m_1: Qualcomm SM8250 SoC에 JPEG V4L2 mem2mem 인코더 지원을 추가하는 패치 시리즈가 제안되었습니다. | fact | bound | driver_image_pipeline | low | none | candidate:53d0f3ea349cc742:source-summary | https://lore.kernel.org/linux-media/20260625133828.3221781-1-atanas.filipov@oss.qualcomm.com/ |
| V4L2 UAPI 내 카메라 센서 CFA 패턴 묘사를 위한 V4L2_CID_CFA_PATTERN 컨트롤 추가 | claim_cfa_pattern_1: 카메라 센서의 고유 Color Filter Array (CFA) 패턴을 설명하기 위한 V4L2_CID_CFA_PATTERN이 V4L2 UAPI에 추가됩니다. | fact | bound | driver_image_pipeline | low | none | candidate:7163e2a29b7eda2e:source-summary | https://lore.kernel.org/linux-media/178240963924.1799417.13645477490024464265@freya/ |

### Uncovered Facts

- none

## Article Structure Contract

- Complete article sections: 4
- Incomplete article sections: 0

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | IMX219 센서 드라이버 테스트 패턴 정합성 개선 및 신규 패턴 추가 패치 제안 | pass | present | driver_image_pipeline | present | none |
| 2 | Qualcomm SM8250 SoC 하드웨어 JPEG 인코더를 위한 Device Tree 바인딩 추가 | pass | present | driver_image_pipeline, soc_resource_contention | present | none |
| 3 | Qualcomm SM8250 SoC 대상 V4L2 mem2mem JPEG 인코더 드라이버 패치 제안 | pass | present | driver_image_pipeline, soc_resource_contention | present | none |
| 4 | V4L2 UAPI 내 카메라 센서 CFA 패턴 묘사를 위한 V4L2_CID_CFA_PATTERN 컨트롤 추가 | pass | present | driver_image_pipeline | present | none |

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | PASS | preserve | IMX219 센서 드라이버 테스트 패턴 정합성 개선 및 신규 패턴 추가 패치 제안 | camera_driver_image_pipeline | 2 | true | true | false | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | image-fallback: Article image uses a local fallback visual. |
| 2 | PASS | preserve | Qualcomm SM8250 SoC 하드웨어 JPEG 인코더를 위한 Device Tree 바인딩 추가 | camera_driver_image_pipeline | 2 | true | true | false | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | image-fallback: Article image uses a local fallback visual. |
| 3 | PASS | preserve | Qualcomm SM8250 SoC 대상 V4L2 mem2mem JPEG 인코더 드라이버 패치 제안 | camera_driver_image_pipeline | 2 | true | true | false | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | image-fallback: Article image uses a local fallback visual. |
| 4 | PASS | preserve | V4L2 UAPI 내 카메라 센서 CFA 패턴 묘사를 위한 V4L2_CID_CFA_PATTERN 컨트롤 추가 | camera_driver_image_pipeline | 2 | true | true | false | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | image-fallback: Article image uses a local fallback visual. |

## Hard Fails

- none

## Soft Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: reader_perspective, action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: action_hint.
- 1 pt [editorial-story] briefing 3: Briefing bullet misses story structure elements: what_happened.
- 1 pt [image-fallback] IMX219 센서 드라이버 테스트 패턴 정합성 개선 및 신규 패턴 추가 패치 제안: Article image uses a local fallback visual.
- 1 pt [image-fallback] Qualcomm SM8250 SoC 하드웨어 JPEG 인코더를 위한 Device Tree 바인딩 추가: Article image uses a local fallback visual.
- 1 pt [image-fallback] Qualcomm SM8250 SoC 대상 V4L2 mem2mem JPEG 인코더 드라이버 패치 제안: Article image uses a local fallback visual.
- 1 pt [image-fallback] V4L2 UAPI 내 카메라 센서 CFA 패턴 묘사를 위한 V4L2_CID_CFA_PATTERN 컨트롤 추가: Article image uses a local fallback visual.

## Top Deduction Categories

- image-fallback (4)
- editorial-story (3)

## Candidate Exclusion Summary

- none

## Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: reader_perspective, action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: action_hint.
- 1 pt [editorial-story] briefing 3: Briefing bullet misses story structure elements: what_happened.
- 1 pt [image-fallback] IMX219 센서 드라이버 테스트 패턴 정합성 개선 및 신규 패턴 추가 패치 제안: Article image uses a local fallback visual.
- 1 pt [image-fallback] Qualcomm SM8250 SoC 하드웨어 JPEG 인코더를 위한 Device Tree 바인딩 추가: Article image uses a local fallback visual.
- 1 pt [image-fallback] Qualcomm SM8250 SoC 대상 V4L2 mem2mem JPEG 인코더 드라이버 패치 제안: Article image uses a local fallback visual.
- 1 pt [image-fallback] V4L2 UAPI 내 카메라 센서 CFA 패턴 묘사를 위한 V4L2_CID_CFA_PATTERN 컨트롤 추가: Article image uses a local fallback visual.
