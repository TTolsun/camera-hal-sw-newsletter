# 뉴스레터 품질 리포트 - 2026-09-14

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
- android count: 0
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
- Relevance bucket counts: {"direct_aosp_camera":0,"camera_driver_image_pipeline":4,"android":0,"android_supporting":0,"cpp_ai_tooling_fallback":0,"generic_tech_watchlist":0}
- Topic tier distribution (relevance_bucket): {"direct_camera":4,"supporting":0,"fallback":0,"watchlist":0}
- AI article count: 1
- Underfilled/composition failure: none

## HAL Signal Quality

- strong_signal_count: 3
- usable_signal_count: 1
- weak_signal_count: 0
- watchlist_only_count: 0
- blocked_source_gap_count: 0
- article_count_with_hal_signal_capsule: 4
- article_count_without_hal_signal_capsule: 0
- generic_signal_hard_blocker_count: 0
- hal_signal_hard_blocker_count: 0
- hard_blocker_reason_code_counts: {}
- hal_impact_axis_counts: {"driver_image_pipeline":4,"soc_resource_contention":1,"performance_latency_frame_drop":1,"stream_buffer_metadata":1}
- actionability_level_counts: {"concrete_check":1,"measurable_test":3}
- effective_actionability_level_counts: {"concrete_check":1,"measurable_test":3}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | Rockchip RKISP1 ISP 드라이버의 Bayer Demosaicing 바이패스 로직 오류 수정 패치 제안 | usable_signal | concrete_check | concrete_check | driver_image_pipeline, soc_resource_contention | complete | none |
| 2 | OmniVision os02g10 이미지 센서용 신규 리눅스 드라이버 패치 시리즈 제안 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, performance_latency_frame_drop | complete | none |
| 3 | libcamera, Sony IMX355 센서의 테스트 패턴 모드 매핑 오류 수정 패치 제안 | strong_signal | measurable_test | measurable_test | driver_image_pipeline | complete | none |
| 4 | libcamera, 컨트롤 메타데이터에 LensShadingCorrection 및 ToneCurve 추가 패치 제안 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, stream_buffer_metadata | complete | none |

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
- Claim coverage: bound_claims=13; total_claims=13
- Derived evidence mapping count: 0
- Overclaim risk: low
- Uncovered fact count: 0

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rockchip RKISP1 ISP 드라이버의 Bayer Demosaicing 바이패스 로직 오류 수정 패치 제안 | claim_rkisp1_1: RKISP1 ISP의 Bayer demosaicing 바이패스 로직을 수정하는 패치(v1)가 2026년 9월 11일 lore.kernel.org linux-media 메일링 ... | fact | bound | driver_image_pipeline | low | none | candidate:c2a8a42b938dda17:source-summary | https://lore.kernel.org/linux-media/20260911-imx8mp-demosaicing-bypass-v1-1-5568a7a560a6@ideasonboard.com/ |
| Rockchip RKISP1 ISP 드라이버의 Bayer Demosaicing 바이패스 로직 오류 수정 패치 제안 | claim_rkisp1_2: 기존 구현은 demosaicing을 우회해야 할 때 바이패스 비트를 해제하고, 활성화해야 할 때 설정하여 로직이 반대로 동작하고 있었습니다. | fact | bound | driver_image_pipeline | low | none | candidate:c2a8a42b938dda17:source-summary | https://lore.kernel.org/linux-media/20260911-imx8mp-demosaicing-bypass-v1-1-5568a7a560a6@ideasonboard.com/ |
| Rockchip RKISP1 ISP 드라이버의 Bayer Demosaicing 바이패스 로직 오류 수정 패치 제안 | claim_rkisp1_3: 이 패치는 demosaicing 블록을 비활성화할 때 바이패스 비트를 설정하고, 활성화할 때 비트를 해제하도록 수정합니다. | fact | bound | driver_image_pipeline | low | none | candidate:c2a8a42b938dda17:source-summary | https://lore.kernel.org/linux-media/20260911-imx8mp-demosaicing-bypass-v1-1-5568a7a560a6@ideasonboard.com/ |
| OmniVision os02g10 이미지 센서용 신규 리눅스 드라이버 패치 시리즈 제안 | claim_os02g10_1: OmniVision os02g10 카메라 센서 드라이버를 추가하는 패치 시리즈(v5)가 2026년 9월 8일 lore.kernel.org linux-media 메일링 리스트에... | fact | bound | driver_image_pipeline | low | none | candidate:e917fa25eb344f22:source-summary | https://lore.kernel.org/linux-media/20260908114235.86568-1-elgin.perumbilly@siliconsignals.io/ |
| OmniVision os02g10 이미지 센서용 신규 리눅스 드라이버 패치 시리즈 제안 | claim_os02g10_2: 이 드라이버는 수동 노출 및 게인 제어, vblank/hblank 제어, vflip/hflip 제어, 테스트 패턴 제어 기능을 지원합니다. | fact | bound | driver_image_pipeline | low | none | candidate:e917fa25eb344f22:source-summary | https://lore.kernel.org/linux-media/20260908114235.86568-1-elgin.perumbilly@siliconsignals.io/ |
| OmniVision os02g10 이미지 센서용 신규 리눅스 드라이버 패치 시리즈 제안 | claim_os02g10_3: 드라이버는 1920x1080 @ 30fps 해상도의 SBGGR10(10비트 Bayer) 모드를 지원합니다. | fact | bound | driver_image_pipeline | low | none | candidate:e917fa25eb344f22:source-summary | https://lore.kernel.org/linux-media/20260908114235.86568-1-elgin.perumbilly@siliconsignals.io/ |
| OmniVision os02g10 이미지 센서용 신규 리눅스 드라이버 패치 시리즈 제안 | claim_os02g10_4: 드라이버는 IMX8MP Debix Model A 보드에서 mainline v7.0-rc2 커널 및 v4l2-compliance 1.31.0-5387 도구를 사용하여 검증되었습니다. | fact | bound | driver_image_pipeline | low | none | candidate:e917fa25eb344f22:source-summary | https://lore.kernel.org/linux-media/20260908114235.86568-1-elgin.perumbilly@siliconsignals.io/ |
| libcamera, Sony IMX355 센서의 테스트 패턴 모드 매핑 오류 수정 패치 제안 | claim_imx355_1: libcamera의 IMX355 카메라 센서 드라이버에서 테스트 패턴 모드 매핑 문제를 해결하는 패치가 2026년 9월 8일 libcamera Patchwork에 제안되었습니다. | fact | bound | driver_image_pipeline | low | none | candidate:4eddf3c31724f248:source-summary | https://patchwork.libcamera.org/patch/28200/ |
| libcamera, Sony IMX355 센서의 테스트 패턴 모드 매핑 오류 수정 패치 제안 | claim_imx355_2: 이 패치는 Sam Gnu가 제출한 2개짜리 패치 시리즈 중 첫 번째 조각([1/2])입니다. | fact | bound | driver_image_pipeline | low | none | candidate:4eddf3c31724f248:source-summary | https://patchwork.libcamera.org/patch/28200/ |
| libcamera, Sony IMX355 센서의 테스트 패턴 모드 매핑 오류 수정 패치 제안 | claim_imx355_3: 이 패치는 현재 'new' 상태로 프로젝트 패치 트래커에서 검토 중인 제안 단계의 변경 사항입니다. | fact | bound | driver_image_pipeline | low | none | candidate:4eddf3c31724f248:source-summary | https://patchwork.libcamera.org/patch/28200/ |
| libcamera, 컨트롤 메타데이터에 LensShadingCorrection 및 ToneCurve 추가 패치 제안 | claim_lsc_tonecurve_1: libcamera의 컨트롤 메타데이터에 LensShadingCorrection 맵과 ToneCurve를 추가하는 패치가 2026년 9월 10일 libcamera Patchwo... | fact | bound | driver_image_pipeline | low | none | candidate:1c3d9ee9c3e53cdb:source-summary | https://patchwork.libcamera.org/patch/28219/ |
| libcamera, 컨트롤 메타데이터에 LensShadingCorrection 및 ToneCurve 추가 패치 제안 | claim_lsc_tonecurve_2: 이 패치는 Kieran Bingham이 제출했으며, 현재 'new' 상태로 프로젝트 패치 트래커에서 검토 중인 제안된 변경 사항입니다. | fact | bound | driver_image_pipeline | low | none | candidate:1c3d9ee9c3e53cdb:source-summary | https://patchwork.libcamera.org/patch/28219/ |
| libcamera, 컨트롤 메타데이터에 LensShadingCorrection 및 ToneCurve 추가 패치 제안 | claim_lsc_tonecurve_3: 이 변경 사항은 하위 이미지 처리 제어 기능을 확장하여 메타데이터를 통해 렌즈 음영 보정 맵과 톤 곡선을 제어할 수 있도록 합니다. | fact | bound | driver_image_pipeline | low | none | candidate:1c3d9ee9c3e53cdb:source-summary | https://patchwork.libcamera.org/patch/28219/ |

### Uncovered Facts

- none

## Article Structure Contract

- Complete article sections: 4
- Incomplete article sections: 0

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Rockchip RKISP1 ISP 드라이버의 Bayer Demosaicing 바이패스 로직 오류 수정 패치 제안 | pass | present+guarded | driver_image_pipeline, soc_resource_contention | present | guardrail-only |
| 2 | OmniVision os02g10 이미지 센서용 신규 리눅스 드라이버 패치 시리즈 제안 | pass | present+guarded | driver_image_pipeline, performance_latency_frame_drop | present | guardrail-only |
| 3 | libcamera, Sony IMX355 센서의 테스트 패턴 모드 매핑 오류 수정 패치 제안 | pass | present+guarded | driver_image_pipeline | present | guardrail-only |
| 4 | libcamera, 컨트롤 메타데이터에 LensShadingCorrection 및 ToneCurve 추가 패치 제안 | pass | present+guarded | driver_image_pipeline, stream_buffer_metadata | present | guardrail-only |

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | PASS | preserve | Rockchip RKISP1 ISP 드라이버의 Bayer Demosaicing 바이패스 로직 오류 수정 패치 제안 | camera_driver_image_pipeline | 5 | true | true | false | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | image-fallback: Article image uses a local fallback visual. |
| 2 | PASS | preserve | OmniVision os02g10 이미지 센서용 신규 리눅스 드라이버 패치 시리즈 제안 | camera_driver_image_pipeline | 5 | true | true | false | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | image-fallback: Article image uses a local fallback visual. |
| 3 | PASS | preserve | libcamera, Sony IMX355 센서의 테스트 패턴 모드 매핑 오류 수정 패치 제안 | camera_driver_image_pipeline | 5 | true | true | false | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | image-fallback: Article image uses a local fallback visual. |
| 4 | PASS | preserve | libcamera, 컨트롤 메타데이터에 LensShadingCorrection 및 ToneCurve 추가 패치 제안 | camera_driver_image_pipeline | 5 | true | true | false | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | image-fallback: Article image uses a local fallback visual. |

## Hard Fails

- none

## Soft Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: reader_perspective, action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.
- 1 pt [image-fallback] Rockchip RKISP1 ISP 드라이버의 Bayer Demosaicing 바이패스 로직 오류 수정 패치 제안: Article image uses a local fallback visual.
- 1 pt [image-fallback] OmniVision os02g10 이미지 센서용 신규 리눅스 드라이버 패치 시리즈 제안: Article image uses a local fallback visual.
- 1 pt [image-fallback] libcamera, Sony IMX355 센서의 테스트 패턴 모드 매핑 오류 수정 패치 제안: Article image uses a local fallback visual.
- 1 pt [image-fallback] libcamera, 컨트롤 메타데이터에 LensShadingCorrection 및 ToneCurve 추가 패치 제안: Article image uses a local fallback visual.

## Unpublishable Articles

- none

## Top Deduction Categories

- image-fallback (4)
- editorial-story (2)

## Candidate Exclusion Summary

- none

## Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: reader_perspective, action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.
- 1 pt [image-fallback] Rockchip RKISP1 ISP 드라이버의 Bayer Demosaicing 바이패스 로직 오류 수정 패치 제안: Article image uses a local fallback visual.
- 1 pt [image-fallback] OmniVision os02g10 이미지 센서용 신규 리눅스 드라이버 패치 시리즈 제안: Article image uses a local fallback visual.
- 1 pt [image-fallback] libcamera, Sony IMX355 센서의 테스트 패턴 모드 매핑 오류 수정 패치 제안: Article image uses a local fallback visual.
- 1 pt [image-fallback] libcamera, 컨트롤 메타데이터에 LensShadingCorrection 및 ToneCurve 추가 패치 제안: Article image uses a local fallback visual.
