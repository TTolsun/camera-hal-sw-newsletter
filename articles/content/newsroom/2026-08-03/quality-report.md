# 뉴스레터 품질 리포트 - 2026-08-03

## Gate Result

- Quality score: 94
- Quality threshold: 60
- Max score: 100
- Result: PASS
- Summary: Safety checks passed and the fact-checker found every article useful to a Camera HAL SW engineer. Editor review is ready.

## Publication Mode

- publication_mode: n/a
- homepage_visibility: n/a
- content_quality_score: 94
- camera_relevance_score: n/a
- publication_mode_decision: n/a
- fallback_only: false
- camera_anchor_count: n/a
- fallback_public_ready: false

## Composition

- Main article count: 4
- Briefing count: 3
- Structured camera article count: 4
- Legacy regex camera article count: 4
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
- hal_impact_axis_counts: {"driver_image_pipeline":4,"performance_latency_frame_drop":2,"stream_buffer_metadata":1}
- actionability_level_counts: {"measurable_test":3,"owner_metric_log":1}
- effective_actionability_level_counts: {"measurable_test":3,"owner_metric_log":1}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | Himax HM1092 흑백 근적외선(NIR) 센서용 V4L2 드라이버 패치 v6 공개 | strong_signal | measurable_test | measurable_test | driver_image_pipeline | complete | none |
| 2 | onsemi AR0234 글로벌 셔터 CMOS 센서용 신규 V4L2 드라이버 패치 제출 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, performance_latency_frame_drop | complete | none |
| 3 | OmniVision OG0VA1B 흑백 VGA 센서용 V4L2 드라이버 패치 v5 제출 | strong_signal | measurable_test | measurable_test | driver_image_pipeline | complete | none |
| 4 | Qualcomm CAMSS 카메라 서브시스템 MIPI C-PHY 구성 지원 패치 v9 공개 | strong_signal | owner_metric_log | owner_metric_log | driver_image_pipeline, stream_buffer_metadata, performance_latency_frame_drop | complete | none |

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
- Soft deduction count: 6

## Claim Binding

- Claim validation status: available
- Claim coverage: bound_claims=12; total_claims=12
- Derived evidence mapping count: 0
- Overclaim risk: low
- Uncovered fact count: 0

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Himax HM1092 흑백 근적외선(NIR) 센서용 V4L2 드라이버 패치 v6 공개 | claim_73bc_1: 2026년 8월 1일 Linux media 메일링 리스트에 Himax HM1092 센서 드라이버 패치 v6가 제출되었습니다. | fact | bound | driver_image_pipeline | low | none | candidate:73bc8fbc8075cab3:source-summary | https://lore.kernel.org/linux-media/20260801-hm1092-driver-v6-0-5979f223748a@gmail.com/ |
| Himax HM1092 흑백 근적외선(NIR) 센서용 V4L2 드라이버 패치 v6 공개 | claim_73bc_2: 이 센서는 단일 MIPI CSI-2 데이터 레인을 사용하며, 560x360 해상도의 10비트 RAW 출력을 지원합니다. | fact | bound | driver_image_pipeline | low | none | candidate:73bc8fbc8075cab3:source-summary | https://lore.kernel.org/linux-media/20260801-hm1092-driver-v6-0-5979f223748a@gmail.com/ |
| Himax HM1092 흑백 근적외선(NIR) 센서용 V4L2 드라이버 패치 v6 공개 | claim_73bc_3: 제공되는 드라이버는 고정 모드, 테스트 패턴, 노출 제어, 아날로그 및 디지털 게인 컨트롤을 노출합니다. | fact | bound | driver_image_pipeline | low | none | candidate:73bc8fbc8075cab3:source-summary | https://lore.kernel.org/linux-media/20260801-hm1092-driver-v6-0-5979f223748a@gmail.com/ |
| onsemi AR0234 글로벌 셔터 CMOS 센서용 신규 V4L2 드라이버 패치 제출 | claim_c1f5_1: 2026년 7월 31일 Linux media 메일링 리스트에 onsemi AR0234 이미지 센서 드라이버 패치가 제출되었습니다. | fact | bound | driver_image_pipeline | low | none | candidate:c1f5a10780dc7d00:source-summary | https://lore.kernel.org/linux-media/20260731073505.2278769-1-eagle.alexander923@gmail.com/ |
| onsemi AR0234 글로벌 셔터 CMOS 센서용 신규 V4L2 드라이버 패치 제출 | claim_c1f5_2: AR0234는 1/2.6인치 글로벌 셔터 센서로, 1940x1220 픽셀 배열을 가지며 최대 120fps로 1920x1200 해상도를 지원합니다. | fact | bound | driver_image_pipeline | low | none | candidate:c1f5a10780dc7d00:source-summary | https://lore.kernel.org/linux-media/20260731073505.2278769-1-eagle.alexander923@gmail.com/ |
| onsemi AR0234 글로벌 셔터 CMOS 센서용 신규 V4L2 드라이버 패치 제출 | claim_c1f5_3: MIPI CSI-2 출력(1~4개 데이터 레인), raw Bayer (8/10비트) 및 흑백 형식, DPCM 10->8 압축을 지원합니다. | fact | bound | driver_image_pipeline | low | none | candidate:c1f5a10780dc7d00:source-summary | https://lore.kernel.org/linux-media/20260731073505.2278769-1-eagle.alexander923@gmail.com/ |
| OmniVision OG0VA1B 흑백 VGA 센서용 V4L2 드라이버 패치 v5 제출 | claim_ccc5_1: 2026년 7월 31일 Linux media 메일링 리스트에 OmniVision OG0VA1B 이미지 센서 드라이버 패치 v5가 제출되었습니다. | fact | bound | driver_image_pipeline | low | none | candidate:ccc5f04628a7d84f:source-summary | https://lore.kernel.org/linux-media/20260731-og0va1b-v5-0-c2b90b601241@oss.qualcomm.com/ |
| OmniVision OG0VA1B 흑백 VGA 센서용 V4L2 드라이버 패치 v5 제출 | claim_ccc5_2: OG0VA1B는 1/10인치 흑백 CMOS VGA 이미지 센서로, 단일 레인 MIPI CSI-2 인터페이스를 통해 최대 640x480 해상도로 10비트 RAW (Y10) 프레... | fact | bound | driver_image_pipeline | low | none | candidate:ccc5f04628a7d84f:source-summary | https://lore.kernel.org/linux-media/20260731-og0va1b-v5-0-c2b90b601241@oss.qualcomm.com/ |
| OmniVision OG0VA1B 흑백 VGA 센서용 V4L2 드라이버 패치 v5 제출 | claim_ccc5_3: I2C 호환 SCCB 버스를 통해 제어되며, Purwa EVK 보드에서 테스트 패턴 제너레이터(TPG)를 포함하여 검증되었습니다. | fact | bound | driver_image_pipeline | low | none | candidate:ccc5f04628a7d84f:source-summary | https://lore.kernel.org/linux-media/20260731-og0va1b-v5-0-c2b90b601241@oss.qualcomm.com/ |
| Qualcomm CAMSS 카메라 서브시스템 MIPI C-PHY 구성 지원 패치 v9 공개 | claim_7dc5_1: 2026년 7월 29일 Linux media 메일링 리스트에 Qualcomm CAMSS C-PHY 지원 패치 v9가 제출되었습니다. | fact | bound | driver_image_pipeline | low | none | candidate:7dc57c68dd701d6d:source-summary | https://lore.kernel.org/linux-media/20260729-qcom-cphy-v9-0-1f8d9fdab037@ixit.cz/ |
| Qualcomm CAMSS 카메라 서브시스템 MIPI C-PHY 구성 지원 패치 v9 공개 | claim_7dc5_2: 이 패치 시리즈는 CSID 및 CSIPHY 구성 요소를 포함하여 Qualcomm CAMSS가 C-PHY 모드 구성을 지원하도록 확장합니다. | fact | bound | driver_image_pipeline | low | none | candidate:7dc57c68dd701d6d:source-summary | https://lore.kernel.org/linux-media/20260729-qcom-cphy-v9-0-1f8d9fdab037@ixit.cz/ |
| Qualcomm CAMSS 카메라 서브시스템 MIPI C-PHY 구성 지원 패치 v9 공개 | claim_7dc5_3: 이전 검토 라운드의 모든 사항이 반영되지 않아 'WIP' (작업 중) 태그가 추가된 상태입니다. | fact | bound | driver_image_pipeline | low | none | candidate:7dc57c68dd701d6d:source-summary | https://lore.kernel.org/linux-media/20260729-qcom-cphy-v9-0-1f8d9fdab037@ixit.cz/ |

### Uncovered Facts

- none

## Article Structure Contract

- Complete article sections: 4
- Incomplete article sections: 0

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Himax HM1092 흑백 근적외선(NIR) 센서용 V4L2 드라이버 패치 v6 공개 | pass | present | driver_image_pipeline | present | none |
| 2 | onsemi AR0234 글로벌 셔터 CMOS 센서용 신규 V4L2 드라이버 패치 제출 | pass | present | driver_image_pipeline, performance_latency_frame_drop | present | none |
| 3 | OmniVision OG0VA1B 흑백 VGA 센서용 V4L2 드라이버 패치 v5 제출 | pass | present | driver_image_pipeline | present | none |
| 4 | Qualcomm CAMSS 카메라 서브시스템 MIPI C-PHY 구성 지원 패치 v9 공개 | pass | present | driver_image_pipeline, stream_buffer_metadata, performance_latency_frame_drop | present | none |

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | PASS | preserve | Himax HM1092 흑백 근적외선(NIR) 센서용 V4L2 드라이버 패치 v6 공개 | camera_driver_image_pipeline | 2 | true | true | false | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | image-fallback: Article image uses a local fallback visual. |
| 2 | PASS | preserve | onsemi AR0234 글로벌 셔터 CMOS 센서용 신규 V4L2 드라이버 패치 제출 | camera_driver_image_pipeline | 2 | true | true | false | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | image-fallback: Article image uses a local fallback visual. |
| 3 | PASS | preserve | OmniVision OG0VA1B 흑백 VGA 센서용 V4L2 드라이버 패치 v5 제출 | camera_driver_image_pipeline | 2 | true | true | false | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | image-fallback: Article image uses a local fallback visual. |
| 4 | PASS | preserve | Qualcomm CAMSS 카메라 서브시스템 MIPI C-PHY 구성 지원 패치 v9 공개 | camera_driver_image_pipeline | 2 | true | true | false | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | image-fallback: Article image uses a local fallback visual. |

## Hard Fails

- none

## Soft Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: what_happened, action_hint.
- 1 pt [image-fallback] Himax HM1092 흑백 근적외선(NIR) 센서용 V4L2 드라이버 패치 v6 공개: Article image uses a local fallback visual.
- 1 pt [image-fallback] onsemi AR0234 글로벌 셔터 CMOS 센서용 신규 V4L2 드라이버 패치 제출: Article image uses a local fallback visual.
- 1 pt [image-fallback] OmniVision OG0VA1B 흑백 VGA 센서용 V4L2 드라이버 패치 v5 제출: Article image uses a local fallback visual.
- 1 pt [image-fallback] Qualcomm CAMSS 카메라 서브시스템 MIPI C-PHY 구성 지원 패치 v9 공개: Article image uses a local fallback visual.

## Unpublishable Articles

- none

## Top Deduction Categories

- image-fallback (4)
- editorial-story (2)

## Candidate Exclusion Summary

- none

## Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: what_happened, action_hint.
- 1 pt [image-fallback] Himax HM1092 흑백 근적외선(NIR) 센서용 V4L2 드라이버 패치 v6 공개: Article image uses a local fallback visual.
- 1 pt [image-fallback] onsemi AR0234 글로벌 셔터 CMOS 센서용 신규 V4L2 드라이버 패치 제출: Article image uses a local fallback visual.
- 1 pt [image-fallback] OmniVision OG0VA1B 흑백 VGA 센서용 V4L2 드라이버 패치 v5 제출: Article image uses a local fallback visual.
- 1 pt [image-fallback] Qualcomm CAMSS 카메라 서브시스템 MIPI C-PHY 구성 지원 패치 v9 공개: Article image uses a local fallback visual.
