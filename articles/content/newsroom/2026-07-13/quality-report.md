# 뉴스레터 품질 리포트 - 2026-07-13

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

- Main article count: 3
- Briefing count: 3
- Structured camera article count: 3
- Legacy regex camera article count: 2
- Expanded-scope article count: 3
- direct_aosp_camera count: 0
- camera_driver_image_pipeline count: 3
- android_platform_camera_adjacent count: 0
- android_multimedia_camera_output count: 0
- soc_platform_signal count: 0
- cpp_ai_tooling_fallback count: 0
- generic_tech_watchlist count: 0
- primary_camera_stack_count: 3
- supporting_main_article_count: 0
- forbidden_main_article_count: 0
- fallback_relevance_count: 0
- publishable_scope_count: 3
- composition_mode: NORMAL
- Newsletter Policy gate: main articles: 1-5; review gate primary camera stack articles: disabled; Publish-ready gate primary camera stack articles: disabled; Publish-ready gate direct AOSP Camera or driver/image pipeline articles: disabled; Publish-ready gate supporting main articles max: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 60
- Relevance bucket counts: {"direct_aosp_camera":0,"camera_driver_image_pipeline":3,"android_platform_camera_adjacent":0,"android_multimedia_camera_output":0,"soc_platform_signal":0,"cpp_ai_tooling_fallback":0,"generic_tech_watchlist":0}
- Topic tier distribution (relevance_bucket): {"direct_camera":3,"multimedia":0,"platform":0,"fallback":0,"watchlist":0}
- AI article count: 1
- Underfilled/composition failure: none

## HAL Signal Quality

- strong_signal_count: 0
- usable_signal_count: 3
- weak_signal_count: 0
- watchlist_only_count: 0
- blocked_source_gap_count: 0
- article_count_with_hal_signal_capsule: 3
- article_count_without_hal_signal_capsule: 0
- generic_signal_hard_blocker_count: 0
- hal_signal_hard_blocker_count: 0
- hard_blocker_reason_code_counts: {}
- hal_impact_axis_counts: {"driver_image_pipeline":3,"thermal_power_memory_pressure":1}
- actionability_level_counts: {"concrete_check":3}
- effective_actionability_level_counts: {"concrete_check":3}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | Qualcomm CAMSS 오프라인 프로세싱 엔진(OPE) 드라이버 추가 제안 | usable_signal | concrete_check | concrete_check | driver_image_pipeline, thermal_power_memory_pressure | complete | none |
| 2 | libcamera 소프트웨어 ISP, 렌즈 쉐이딩 보정(LSC) 지원을 위한 EGL 텍스처 필터 파라미터 추가 | usable_signal | concrete_check | concrete_check | driver_image_pipeline | complete | none |
| 3 | Raspberry Pi libcamera v0.7.1+rpt20260609 다운스트림 릴리스 | usable_signal | concrete_check | concrete_check | driver_image_pipeline | complete | none |

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
- Claim coverage: bound_claims=6; total_claims=6
- Derived evidence mapping count: 0
- Overclaim risk: low
- Uncovered fact count: 0

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Qualcomm CAMSS 오프라인 프로세싱 엔진(OPE) 드라이버 추가 제안 | claim:qcom-ope-patch-v4: 2026년 7월 13일, Qualcomm CAMSS에 OPE(Offline Processing Engine) 드라이버를 추가하는 PATCH v4 6/7이 제안되었습니다. | fact | bound | driver_image_pipeline | low | none | candidate:2d07a630d036215b:source-summary | https://lore.kernel.org/linux-media/da70ed94-fd76-4105-8071-1ed8d8e41d84@linaro.org/ |
| Qualcomm CAMSS 오프라인 프로세싱 엔진(OPE) 드라이버 추가 제안 | claim:qcom-ope-m2m-isp-block: OPE는 raw Bayer 프레임을 YUV로 변환하는 메모리-투-메모리 ISP 블록으로 작동합니다. | fact | bound | driver_image_pipeline | low | none | candidate:2d07a630d036215b:source-summary | https://lore.kernel.org/linux-media/da70ed94-fd76-4105-8071-1ed8d8e41d84@linaro.org/ |
| Qualcomm CAMSS 오프라인 프로세싱 엔진(OPE) 드라이버 추가 제안 | claim:qcom-ope-driver-functions: 해당 드라이버는 화이트 밸런스, 디모자이크, 크로마 향상, 색 보정, 다운스케일링을 수행합니다. | fact | bound | driver_image_pipeline | low | none | candidate:2d07a630d036215b:source-summary | https://lore.kernel.org/linux-media/da70ed94-fd76-4105-8071-1ed8d8e41d84@linaro.org/ |
| libcamera 소프트웨어 ISP, 렌즈 쉐이딩 보정(LSC) 지원을 위한 EGL 텍스처 필터 파라미터 추가 | claim:libcamera-egl-filter-patch: 2026년 7월 8일, libcamera의 software_isp EGL 모듈 내 createTexture2D() 함수에 필터 파라미터를 추가하는 RFC v7 1/6 패치가 ... | fact | bound | driver_image_pipeline | low | none | candidate:19843ec1e8a8e2f7:source-summary | https://patchwork.libcamera.org/patch/27346/ |
| libcamera 소프트웨어 ISP, 렌즈 쉐이딩 보정(LSC) 지원을 위한 EGL 텍스처 필터 파라미터 추가 | claim:libcamera-lsc-texture-filter: 이 변경은 소프트웨어 ISP에서 렌즈 쉐이딩 보정(LSC)을 지원하기 위한 텍스처 필터링 제어와 연계됩니다. | fact | bound | driver_image_pipeline | low | none | candidate:19843ec1e8a8e2f7:source-summary | https://patchwork.libcamera.org/patch/27346/ |
| Raspberry Pi libcamera v0.7.1+rpt20260609 다운스트림 릴리스 | claim:rpi-libcamera-release-v071: 2026년 6월 9일, Raspberry Pi의 다운스트림 libcamera v0.7.1+rpt20260609 버전이 릴리스되었습니다. | fact | bound | driver_image_pipeline | low | none | candidate:9f52da38111ac9bf:source-summary | https://github.com/raspberrypi/libcamera/releases/tag/v0.7.1%2Brpt20260609 |

### Uncovered Facts

- none

## Article Structure Contract

- Complete article sections: 3
- Incomplete article sections: 0

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Qualcomm CAMSS 오프라인 프로세싱 엔진(OPE) 드라이버 추가 제안 | pass | present | driver_image_pipeline, thermal_power_memory_pressure | present | none |
| 2 | libcamera 소프트웨어 ISP, 렌즈 쉐이딩 보정(LSC) 지원을 위한 EGL 텍스처 필터 파라미터 추가 | pass | present | driver_image_pipeline | present | none |
| 3 | Raspberry Pi libcamera v0.7.1+rpt20260609 다운스트림 릴리스 | pass | present | driver_image_pipeline | present | none |

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | PASS | preserve | Qualcomm CAMSS 오프라인 프로세싱 엔진(OPE) 드라이버 추가 제안 | camera_driver_image_pipeline | 2 | true | true | false | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | image-fallback: Article image uses a local fallback visual. |
| 2 | PASS | preserve | libcamera 소프트웨어 ISP, 렌즈 쉐이딩 보정(LSC) 지원을 위한 EGL 텍스처 필터 파라미터 추가 | camera_driver_image_pipeline | 2 | true | true | false | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | image-fallback: Article image uses a local fallback visual. |
| 3 | PASS | preserve | Raspberry Pi libcamera v0.7.1+rpt20260609 다운스트림 릴리스 | camera_driver_image_pipeline | 2 | true | true | false | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | image-fallback: Article image uses a local fallback visual. |

## Hard Fails

- none

## Soft Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: reader_perspective, action_hint.
- 1 pt [editorial-story] briefing 3: Briefing bullet misses story structure elements: reader_perspective, action_hint.
- 1 pt [image-fallback] Qualcomm CAMSS 오프라인 프로세싱 엔진(OPE) 드라이버 추가 제안: Article image uses a local fallback visual.
- 1 pt [image-fallback] libcamera 소프트웨어 ISP, 렌즈 쉐이딩 보정(LSC) 지원을 위한 EGL 텍스처 필터 파라미터 추가: Article image uses a local fallback visual.
- 1 pt [image-fallback] Raspberry Pi libcamera v0.7.1+rpt20260609 다운스트림 릴리스: Article image uses a local fallback visual.

## Unpublishable Articles

- none

## Top Deduction Categories

- editorial-story (3)
- image-fallback (3)

## Candidate Exclusion Summary

- none

## Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: reader_perspective, action_hint.
- 1 pt [editorial-story] briefing 3: Briefing bullet misses story structure elements: reader_perspective, action_hint.
- 1 pt [image-fallback] Qualcomm CAMSS 오프라인 프로세싱 엔진(OPE) 드라이버 추가 제안: Article image uses a local fallback visual.
- 1 pt [image-fallback] libcamera 소프트웨어 ISP, 렌즈 쉐이딩 보정(LSC) 지원을 위한 EGL 텍스처 필터 파라미터 추가: Article image uses a local fallback visual.
- 1 pt [image-fallback] Raspberry Pi libcamera v0.7.1+rpt20260609 다운스트림 릴리스: Article image uses a local fallback visual.
