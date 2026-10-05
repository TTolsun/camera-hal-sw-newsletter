# 뉴스레터 품질 리포트 - 2026-10-05

## Gate Result

- Quality score: 98
- Quality threshold: 60
- Max score: 100
- Result: PASS
- Summary: Safety checks passed and the fact-checker found every article useful to a Camera HAL SW engineer. Editor review is ready.

## Publication Mode

- publication_mode: n/a
- homepage_visibility: n/a
- content_quality_score: 98
- camera_relevance_score: n/a
- publication_mode_decision: n/a
- fallback_only: false
- camera_anchor_count: n/a
- fallback_public_ready: false

## Composition

- Main article count: 2
- Briefing count: 3
- Structured camera article count: 2
- Legacy regex camera article count: 1
- Expanded-scope article count: 2
- direct_aosp_camera count: 1
- camera_driver_image_pipeline count: 1
- android count: 0
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
- Relevance bucket counts: {"direct_aosp_camera":1,"camera_driver_image_pipeline":1,"android":0,"android_supporting":0,"cpp_ai_tooling_fallback":0,"generic_tech_watchlist":0}
- Topic tier distribution (relevance_bucket): {"direct_camera":2,"supporting":0,"fallback":0,"watchlist":0}
- AI article count: 0
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
- hal_impact_axis_counts: {"cts_vts_its_cdd":1,"driver_image_pipeline":1,"stream_buffer_metadata":1}
- actionability_level_counts: {"owner_metric_log":2}
- effective_actionability_level_counts: {"owner_metric_log":2}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | Android 17 Camera ITS: 실행 환경 버전과 달라진 검증 항목 | strong_signal | owner_metric_log | owner_metric_log | cts_vts_its_cdd | complete | none |
| 2 | libcamera AWB 제안: 자동 게인을 고정하고 필요할 때 다시 수렴시키기 | strong_signal | owner_metric_log | owner_metric_log | driver_image_pipeline, stream_buffer_metadata | complete | none |

## Fact Check And Source Integrity

- Fact-check status: PASS
- Must-fix count: 0
- Source-gap count: 0
- Stale claim status: UNKNOWN
- Stale claim removals: 0
- Stale claim hard failures: 0
- Source integrity violation count: 0
- Blocking deduction count: 0
- Blocking deduction categories: none
- Hard fail count: 0
- Soft deduction count: 2

## Claim Binding

- Claim validation status: available
- Claim coverage: bound_claims=9; total_claims=9
- Derived evidence mapping count: 0
- Overclaim risk: low
- Uncovered fact count: 0

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Android 17 Camera ITS: 실행 환경 버전과 달라진 검증 항목 | reviewed-0-0: Android 17 Camera ITS 릴리스 노트는 Python 3.14와 FFmpeg 7.0.2를 사용하는 환경 구성 절차를 안내합니다. | fact | bound | cts_vts_its_cdd | low | none | source-body:a62a16468cac6cfc54e7 | https://source.android.com/docs/compatibility/cts/its-release-notes-17 |
| Android 17 Camera ITS: 실행 환경 버전과 달라진 검증 항목 | reviewed-0-1: gen2_chart는 종이 차트를 사용하며 scene3는 ArUco 마커 검출을 사용합니다. | fact | bound | cts_vts_its_cdd | low | none | source-body:a62a16468cac6cfc54e7 | https://source.android.com/docs/compatibility/cts/its-release-notes-17 |
| Android 17 Camera ITS: 실행 환경 버전과 달라진 검증 항목 | reviewed-0-2: test_display_p3는 P3 JPEG의 ICC 프로파일과 sRGB 색역 밖 색상 비율이 1%를 넘는지 검사합니다. | fact | bound | cts_vts_its_cdd | low | none | source-body:a62a16468cac6cfc54e7 | https://source.android.com/docs/compatibility/cts/its-release-notes-17 |
| Android 17 Camera ITS: 실행 환경 버전과 달라진 검증 항목 | reviewed-0-3: test_yuv_jpeg_capture_sameness의 RMS 차이 임계값이 낮아졌습니다. | fact | bound | cts_vts_its_cdd | low | none | source-body:a62a16468cac6cfc54e7 | https://source.android.com/docs/compatibility/cts/its-release-notes-17 |
| Android 17 Camera ITS: 실행 환경 버전과 달라진 검증 항목 | reviewed-0-4: CTS Verifier에서 Camera ITS Test와 Camera ITS Sensor Fusion Rig Test가 분리되며, 후자는 feature_combination과... | fact | bound | cts_vts_its_cdd | low | none | source-body:a62a16468cac6cfc54e7 | https://source.android.com/docs/compatibility/cts/its-release-notes-17 |
| libcamera AWB 제안: 자동 게인을 고정하고 필요할 때 다시 수렴시키기 | reviewed-1-0: 제안은 자동 AWB 동작 중 수동 게인을 자동 게인으로 갱신하여 AwbEnable=false 전환 시 마지막 자동 게인을 유지합니다. | fact | bound | driver_image_pipeline | low | none | source-body:c5ad18d2c606c6a587e9 | https://patchwork.libcamera.org/patch/28390/ |
| libcamera AWB 제안: 자동 게인을 고정하고 필요할 때 다시 수렴시키기 | reviewed-1-1: AwbTrigger=true는 AwbEnable=false일 때 재탐색하고, 수렴한 게인을 수동 게인에 반영한 뒤 Locked로 돌아갑니다. | fact | bound | driver_image_pipeline | low | none | source-body:55d262d61f6e7782c3f7 | https://patchwork.libcamera.org/patch/28391/ |
| libcamera AWB 제안: 자동 게인을 고정하고 필요할 때 다시 수렴시키기 | reviewed-1-2: 실제 API diff는 AwbLocked 출력 메타데이터를 제거하고 AwbState 출력과 AwbTrigger 입력을 정의합니다. | fact | bound | driver_image_pipeline | low | none | source-body:461567ea2d0941649500 | https://patchwork.libcamera.org/patch/28387/ |
| libcamera AWB 제안: 자동 게인을 고정하고 필요할 때 다시 수렴시키기 | reviewed-1-3: API 설명의 5% 수렴 기준과 구현 패치의 10% 범위·5회 누적 기준은 일치하지 않습니다. | fact | bound | driver_image_pipeline | low | none | source-body:461567ea2d0941649500, source-body:00ba400e4795be8af0d9 | https://patchwork.libcamera.org/patch/28387/, https://patchwork.libcamera.org/patch/28389/ |

### Uncovered Facts

- none

## Article Structure Contract

- Complete article sections: 2
- Incomplete article sections: 0

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Android 17 Camera ITS: 실행 환경 버전과 달라진 검증 항목 | pass | present | cts_vts_its_cdd | present | none |
| 2 | libcamera AWB 제안: 자동 게인을 고정하고 필요할 때 다시 수렴시키기 | pass | present | driver_image_pipeline, stream_buffer_metadata | present | none |

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | PASS | preserve | Android 17 Camera ITS: 실행 환경 버전과 달라진 검증 항목 | direct_aosp_camera | 1 | true | false | false | true | bound | shortlist_selected | merged | none | direct_aosp_camera counts toward primary_camera_stack_count. | none | none | none |
| 2 | PASS | preserve | libcamera AWB 제안: 자동 게인을 고정하고 필요할 때 다시 수렴시키기 | camera_driver_image_pipeline | 5 | true | true | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | image-fallback: Article image uses a local fallback visual. |

## Hard Fails

- none

## Soft Deductions

- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: reader_perspective, action_hint.
- 1 pt [image-fallback] libcamera AWB 제안: 자동 게인을 고정하고 필요할 때 다시 수렴시키기: Article image uses a local fallback visual.

## Unpublishable Articles

- none

## Top Deduction Categories

- editorial-story (1)
- image-fallback (1)

## Candidate Exclusion Summary

- none

## Deductions

- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: reader_perspective, action_hint.
- 1 pt [image-fallback] libcamera AWB 제안: 자동 게인을 고정하고 필요할 때 다시 수렴시키기: Article image uses a local fallback visual.
