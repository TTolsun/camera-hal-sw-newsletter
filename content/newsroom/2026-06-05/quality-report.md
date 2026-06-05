# 뉴스레터 품질 리포트 - 2026-06-05

## Gate Result

- Quality score: 0
- Quality threshold: 60
- Max score: 100
- Result: NEEDS_FIX
- Summary: Resolve source gaps, fact-check must-fix items, composition blockers, and any article the fact-checker marked not useful to a Camera HAL SW engineer before publishing.

## Publication Mode

- publication_mode: n/a
- homepage_visibility: n/a
- content_quality_score: 0
- camera_relevance_score: n/a
- publication_mode_decision: n/a
- fallback_only: false
- camera_anchor_count: n/a
- fallback_public_ready: false

## Composition

- Main article count: 3
- Briefing count: 3
- Structured camera article count: 0
- Legacy regex camera article count: 3
- Expanded-scope article count: 0
- direct_aosp_camera count: 0
- camera_driver_image_pipeline count: 0
- android_platform_camera_adjacent count: 0
- android_multimedia_camera_output count: 0
- soc_platform_signal count: 0
- cpp_ai_tooling_fallback count: 0
- generic_tech_watchlist count: 0
- primary_camera_stack_count: 0
- supporting_main_article_count: 0
- forbidden_main_article_count: 0
- fallback_relevance_count: 0
- publishable_scope_count: 0
- composition_mode: NEEDS_FIX
- Newsletter Policy gate: main articles: 1-5; review gate primary camera stack articles: disabled; Publish-ready gate primary camera stack articles: disabled; Publish-ready gate direct AOSP Camera or driver/image pipeline articles: disabled; Publish-ready gate supporting main articles max: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 60
- Relevance bucket counts: {"direct_aosp_camera":0,"camera_driver_image_pipeline":0,"android_platform_camera_adjacent":0,"android_multimedia_camera_output":0,"soc_platform_signal":0,"cpp_ai_tooling_fallback":0,"generic_tech_watchlist":0}
- Topic tier distribution (relevance_bucket): {"direct_camera":0,"multimedia":0,"platform":0,"fallback":0,"watchlist":0}
- AI article count: 0
- Underfilled/composition failure: none

## HAL Signal Quality

- strong_signal_count: 3
- usable_signal_count: 0
- weak_signal_count: 0
- watchlist_only_count: 0
- blocked_source_gap_count: 0
- article_count_with_hal_signal_capsule: 3
- article_count_without_hal_signal_capsule: 0
- generic_signal_hard_blocker_count: 0
- hal_signal_hard_blocker_count: 0
- hard_blocker_reason_code_counts: {}
- hal_impact_axis_counts: {"framework_hal_contract":3,"camerax_app_compatibility":2,"driver_image_pipeline":1,"stream_buffer_metadata":1,"cts_vts_its_cdd":1}
- actionability_level_counts: {"measurable_test":3}
- effective_actionability_level_counts: {"measurable_test":3}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | Google I/O '26: Jetpack CameraX 및 Media3 기반의 통합 미디어 파이프라인 툴킷 발표 | strong_signal | measurable_test | measurable_test | framework_hal_contract, camerax_app_compatibility | complete | none |
| 2 | CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영 | strong_signal | measurable_test | measurable_test | framework_hal_contract, driver_image_pipeline, stream_buffer_metadata, camerax_app_compatibility | complete | none |
| 3 | AOSP Camera ITS 업데이트: Honor Pad 20 태블릿 허용 목록 추가 및 테스트 지침 재정렬 | strong_signal | measurable_test | measurable_test | framework_hal_contract, cts_vts_its_cdd | complete | none |

## Fact Check And Source Integrity

- Fact-check status: NEEDS_FIX
- Must-fix count: 0
- Source-gap count: 1
- Stale claim status: PASS
- Stale claim removals: 0
- Stale claim hard failures: 0
- Source integrity violation count: 4
- Blocking deduction count: 16
- Blocking deduction categories: source-integrity, claim-evidence
- Hard fail count: 16
- Soft deduction count: 4

## Claim Binding

- Claim validation status: needs_fix
- Claim coverage: bound_claims=0; total_claims=11
- Derived evidence mapping count: 0
- Overclaim risk: medium
- Uncovered fact count: 0

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Google I/O '26: Jetpack CameraX 및 Media3 기반의 통합 미디어 파이프라인 툴킷 발표 | claim:io26_media_toolkit_announcement: Google I/O '26에서 Jetpack CameraX 및 Media3를 활용한 미디어 파이프라인 개선 툴킷이 발표되었습니다. | fact | needs_fix | app_api_or_framework_adjacent | low | unknown_evidence_id | sx:43d1b942a84263ab2c88b894f619a244ae8cf13262b41eb4c1427e73e73e3a35:evidence_blocks:97f7fd6266fe4407 | https://youtube.com/playlist?list=PLWz5rJ2EKKc8lSdmWQ_fSpV9yEGRvEL6S&si=H6-8-AbtEyTqSxeY |
| Google I/O '26: Jetpack CameraX 및 Media3 기반의 통합 미디어 파이프라인 툴킷 발표 | claim:camerax_viewfinder_composable: 폴더블 및 태블릿을 포함한 모든 폼 팩터에서 미리보기가 완벽하게 확장되고 반응하도록 보장하는 CameraXViewfinder Composable이 도입되었습니다. | fact | needs_fix | app_api_or_framework_adjacent | low | unknown_evidence_id | sx:43d1b942a84263ab2c88b894f619a244ae8cf13262b41eb4c1427e73e73e3a35:evidence_blocks:97f7fd6266fe4407 | https://youtube.com/playlist?list=PLWz5rJ2EKKc8lSdmWQ_fSpV9yEGRvEL6S&si=H6-8-AbtEyTqSxeY |
| CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영 | claim:camerax_1_6_0_release_date: CameraX 1.6.0 정식 버전이 2026년 3월 25일에 출시되었습니다. | fact | needs_fix | app_api_or_framework_adjacent | low | unknown_evidence_id | sx:545c1667e2f958629af66480105e1554b1726272a4979f69145d1b61229f62e7:release-camerax-1-6-0-march-25-2026-camerax-androidx-camera-bug-fixes-bug-fixes:0aecc02c99ec7a81 | https://developer.android.com/jetpack/androidx/releases/camera#1.6.0 |
| CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영 | claim:camerax_query_api: 앱이 라이프사이클에 바인딩하기 전에 HDR, 안정화, 특정 해상도, 확장 기능 등의 지원 여부를 미리 쿼리할 수 있는 API가 도입되었습니다. | fact | needs_fix | app_api_or_framework_adjacent | low | unknown_evidence_id | sx:545c1667e2f958629af66480105e1554b1726272a4979f69145d1b61229f62e7:release-camerax-1-6-0-march-25-2026-camerax-androidx-camera-bug-fixes-bug-fixes:0aecc02c99ec7a81 | https://developer.android.com/jetpack/androidx/releases/camera#1.6.0 |
| CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영 | claim:android_17_crash_fix: 다가오는 Android 17 기기에서 알 수 없는 다이내믹 레인지 모드로 인해 발생할 수 있는 크래시를 방지하는 패치가 적용되었습니다. | fact | needs_fix | camera_framework_behavior | low | unknown_evidence_id | sx:545c1667e2f958629af66480105e1554b1726272a4979f69145d1b61229f62e7:release-camerax-1-6-0-march-25-2026-camerax-androidx-camera-bug-fixes-bug-fixes:0aecc02c99ec7a81 | https://developer.android.com/jetpack/androidx/releases/camera#1.6.0 |
| CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영 | claim:z_fold_4_yuv_fix: Samsung Z Fold 4 기기에서 왜곡 문제가 발생하는 특정 YUV 포맷 출력 크기를 제외하는 호환성 패치가 적용되었습니다. | fact | needs_fix | camera_framework_behavior | low | unknown_evidence_id | sx:545c1667e2f958629af66480105e1554b1726272a4979f69145d1b61229f62e7:release-camerax-1-6-0-march-25-2026-camerax-androidx-camera-bug-fixes-bug-fixes:0aecc02c99ec7a81 | https://developer.android.com/jetpack/androidx/releases/camera#1.6.0 |
| CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영 | claim:a53_torch_fix: Samsung A53 기기에서 VideoCapture 유스케이스가 바인딩된 상태에서 토치 활성화 시 이미지 캡처가 실패하는 문제를 수정했습니다. | fact | needs_fix | camera_framework_behavior | low | unknown_evidence_id | sx:545c1667e2f958629af66480105e1554b1726272a4979f69145d1b61229f62e7:release-camerax-1-6-0-march-25-2026-camerax-androidx-camera-bug-fixes-bug-fixes:1973794d82e9b63d | https://developer.android.com/jetpack/androidx/releases/camera#1.6.0 |
| CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영 | claim:ultrawide_flash_fix: 일부 기기에서 초광각 카메라 사용 시 플래시 연동으로 인해 이미지가 어둡게 나오는 문제를 수정했습니다. | fact | needs_fix | camera_framework_behavior | low | unknown_evidence_id | sx:545c1667e2f958629af66480105e1554b1726272a4979f69145d1b61229f62e7:release-camerax-1-6-0-march-25-2026-camerax-androidx-camera-bug-fixes-bug-fixes:0aecc02c99ec7a81 | https://developer.android.com/jetpack/androidx/releases/camera#1.6.0 |
| CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영 | claim:exif_padding_fix: ExifInterface 의존성을 업데이트하여 JPEG 인코더가 마커 앞에 채움 바이트를 추가하는 기기에서의 이미지 캡처 실패 문제를 해결했습니다. | fact | needs_fix | camera_framework_behavior | low | unknown_evidence_id | sx:545c1667e2f958629af66480105e1554b1726272a4979f69145d1b61229f62e7:release-camerax-1-6-0-march-25-2026-camerax-androidx-camera-bug-fixes-bug-fixes:0aecc02c99ec7a81 | https://developer.android.com/jetpack/androidx/releases/camera#1.6.0 |
| AOSP Camera ITS 업데이트: Honor Pad 20 태블릿 허용 목록 추가 및 테스트 지침 재정렬 | claim:its_honor_pad_20_whitelist: AOSP Camera ITS 문서가 업데이트되어 Honor Pad 20이 태블릿 허용 목록에 추가되었습니다. | fact | needs_fix | cts_vts_its_cdd | low | unknown_evidence_id | candidate:bb0e15b6742fce012e2e0220ecfba35983722daa6e6c21581c9c5d661584a54d:source-summary | https://source.android.com/docs/compatibility/cts/camera-its-box |
| AOSP Camera ITS 업데이트: Honor Pad 20 태블릿 허용 목록 추가 및 테스트 지침 재정렬 | claim:its_scene_instructions_reordered: 개별 ITS 장면 실행 지침이 재정렬 및 업데이트되었습니다. | fact | needs_fix | cts_vts_its_cdd | low | unknown_evidence_id | candidate:bb0e15b6742fce012e2e0220ecfba35983722daa6e6c21581c9c5d661584a54d:source-summary | https://source.android.com/docs/compatibility/cts/camera-its-box |

### Uncovered Facts

- none

## Article Structure Contract

- Complete article sections: 3
- Incomplete article sections: 0

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Google I/O '26: Jetpack CameraX 및 Media3 기반의 통합 미디어 파이프라인 툴킷 발표 | pass | present | framework_hal_contract, camerax_app_compatibility | present | none |
| 2 | CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영 | pass | present | framework_hal_contract, driver_image_pipeline, stream_buffer_metadata, camerax_app_compatibility | present | none |
| 3 | AOSP Camera ITS 업데이트: Honor Pad 20 태블릿 허용 목록 추가 및 테스트 지침 재정렬 | pass | present | framework_hal_contract, cts_vts_its_cdd | present | none |

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | fallback | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | FAIL | replace-or-demote | Google I/O '26: Jetpack CameraX 및 Media3 기반의 통합 미디어 파이프라인 툴킷 발표 | direct_aosp_camera | 1 | true | false | false | false | false | evidence_mismatch | shortlist_selected | section_text_fallback | none | section_text_fallback classified this section as direct_aosp_camera for diagnostics only. | Scope is diagnostic-only because no publishable source candidate binding and relevance metadata were available. | Shared watch/release-note URL requires matching version_or_release or published_date evidence.; Claim references unresolved evidence_id: sx:43d1b942a84263ab2c88b894f619a244ae8cf13262b41eb4c1427e73e73e3a35:evidence_blocks:97f7fd6266fe4407. | image-fallback: Article image uses a local fallback visual. |
| 2 | FAIL | replace-or-demote | CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영 | direct_aosp_camera | 1 | true | false | false | false | false | evidence_mismatch | shortlist_selected | section_text_fallback | none | section_text_fallback classified this section as direct_aosp_camera for diagnostics only. | Scope is diagnostic-only because no publishable source candidate binding and relevance metadata were available. | Shared watch/release-note URL requires matching version_or_release or published_date evidence.; Claim references unresolved evidence_id: sx:545c1667e2f958629af66480105e1554b1726272a4979f69145d1b61229f62e7:release-camerax-1-6-0-march-25-2026-camerax-androidx-camera-bug-fixes-bug-fixes:0aecc02c99ec7a81.; Claim references unresolved evidence_id: sx:545c1667e2f958629af66480105e1554b1726272a4979f69145d1b61229f62e7:release-camerax-1-6-0-march-25-2026-camerax-androidx-camera-bug-fixes-bug-fixes:1973794d82e9b63d.; CameraX source extraction failure: source_extraction.release.sections has no concrete release-note bullet.; Source gap or ineligible source evidence mentions this section. | image-fallback: Article image uses a local fallback visual. |
| 3 | FAIL | replace-or-demote | AOSP Camera ITS 업데이트: Honor Pad 20 태블릿 허용 목록 추가 및 테스트 지침 재정렬 | direct_aosp_camera | 1 | true | false | false | false | false | evidence_mismatch | shortlist_selected | section_text_fallback | none | section_text_fallback classified this section as direct_aosp_camera for diagnostics only. | Scope is diagnostic-only because no publishable source candidate binding and relevance metadata were available. | Shared watch/release-note URL requires matching version_or_release or published_date evidence.; Claim references unresolved evidence_id: candidate:bb0e15b6742fce012e2e0220ecfba35983722daa6e6c21581c9c5d661584a54d:source-summary. | image-fallback: Article image uses a local fallback visual. |

## Hard Fails

- 8 pt [source-integrity] Google I/O '26: Jetpack CameraX 및 Media3 기반의 통합 미디어 파이프라인 툴킷 발표: Shared watch/release-note URL requires matching version_or_release or published_date evidence.
- 8 pt [claim-evidence] Google I/O '26: Jetpack CameraX 및 Media3 기반의 통합 미디어 파이프라인 툴킷 발표: Claim references unresolved evidence_id: sx:43d1b942a84263ab2c88b894f619a244ae8cf13262b41eb4c1427e73e73e3a35:evidence_blocks:97f7fd6266fe4407. (unknown_evidence_id)
- 8 pt [claim-evidence] Google I/O '26: Jetpack CameraX 및 Media3 기반의 통합 미디어 파이프라인 툴킷 발표: Claim references unresolved evidence_id: sx:43d1b942a84263ab2c88b894f619a244ae8cf13262b41eb4c1427e73e73e3a35:evidence_blocks:97f7fd6266fe4407. (unknown_evidence_id)
- 8 pt [source-integrity] CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영: Shared watch/release-note URL requires matching version_or_release or published_date evidence.
- 8 pt [claim-evidence] CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영: Claim references unresolved evidence_id: sx:545c1667e2f958629af66480105e1554b1726272a4979f69145d1b61229f62e7:release-camerax-1-6-0-march-25-2026-camerax-androidx-camera-bug-fixes-bug-fixes:0aecc02c99ec7a81. (unknown_evidence_id)
- 8 pt [claim-evidence] CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영: Claim references unresolved evidence_id: sx:545c1667e2f958629af66480105e1554b1726272a4979f69145d1b61229f62e7:release-camerax-1-6-0-march-25-2026-camerax-androidx-camera-bug-fixes-bug-fixes:0aecc02c99ec7a81. (unknown_evidence_id)
- 8 pt [claim-evidence] CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영: Claim references unresolved evidence_id: sx:545c1667e2f958629af66480105e1554b1726272a4979f69145d1b61229f62e7:release-camerax-1-6-0-march-25-2026-camerax-androidx-camera-bug-fixes-bug-fixes:0aecc02c99ec7a81. (unknown_evidence_id)
- 8 pt [claim-evidence] CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영: Claim references unresolved evidence_id: sx:545c1667e2f958629af66480105e1554b1726272a4979f69145d1b61229f62e7:release-camerax-1-6-0-march-25-2026-camerax-androidx-camera-bug-fixes-bug-fixes:0aecc02c99ec7a81. (unknown_evidence_id)
- 8 pt [claim-evidence] CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영: Claim references unresolved evidence_id: sx:545c1667e2f958629af66480105e1554b1726272a4979f69145d1b61229f62e7:release-camerax-1-6-0-march-25-2026-camerax-androidx-camera-bug-fixes-bug-fixes:1973794d82e9b63d. (unknown_evidence_id)
- 8 pt [claim-evidence] CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영: Claim references unresolved evidence_id: sx:545c1667e2f958629af66480105e1554b1726272a4979f69145d1b61229f62e7:release-camerax-1-6-0-march-25-2026-camerax-androidx-camera-bug-fixes-bug-fixes:0aecc02c99ec7a81. (unknown_evidence_id)
- 8 pt [claim-evidence] CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영: Claim references unresolved evidence_id: sx:545c1667e2f958629af66480105e1554b1726272a4979f69145d1b61229f62e7:release-camerax-1-6-0-march-25-2026-camerax-androidx-camera-bug-fixes-bug-fixes:0aecc02c99ec7a81. (unknown_evidence_id)
- 8 pt [source-integrity] CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영: CameraX source extraction failure: source_extraction.release.sections has no concrete release-note bullet.
- 8 pt [source-integrity] AOSP Camera ITS 업데이트: Honor Pad 20 태블릿 허용 목록 추가 및 테스트 지침 재정렬: Shared watch/release-note URL requires matching version_or_release or published_date evidence.
- 8 pt [claim-evidence] AOSP Camera ITS 업데이트: Honor Pad 20 태블릿 허용 목록 추가 및 테스트 지침 재정렬: Claim references unresolved evidence_id: candidate:bb0e15b6742fce012e2e0220ecfba35983722daa6e6c21581c9c5d661584a54d:source-summary. (unknown_evidence_id)
- 8 pt [claim-evidence] AOSP Camera ITS 업데이트: Honor Pad 20 태블릿 허용 목록 추가 및 테스트 지침 재정렬: Claim references unresolved evidence_id: candidate:bb0e15b6742fce012e2e0220ecfba35983722daa6e6c21581c9c5d661584a54d:source-summary. (unknown_evidence_id)
- 3 pt [source-integrity] Fact checker reported 1 source gap(s).

## Soft Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: action_hint.
- 1 pt [image-fallback] Google I/O '26: Jetpack CameraX 및 Media3 기반의 통합 미디어 파이프라인 툴킷 발표: Article image uses a local fallback visual.
- 1 pt [image-fallback] CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영: Article image uses a local fallback visual.
- 1 pt [image-fallback] AOSP Camera ITS 업데이트: Honor Pad 20 태블릿 허용 목록 추가 및 테스트 지침 재정렬: Article image uses a local fallback visual.

## Top Deduction Categories

- claim-evidence (11)
- source-integrity (5)
- image-fallback (3)
- editorial-story (1)

## Candidate Exclusion Summary

- none

## Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: action_hint.
- 8 pt [source-integrity] Google I/O '26: Jetpack CameraX 및 Media3 기반의 통합 미디어 파이프라인 툴킷 발표: Shared watch/release-note URL requires matching version_or_release or published_date evidence.
- 8 pt [claim-evidence] Google I/O '26: Jetpack CameraX 및 Media3 기반의 통합 미디어 파이프라인 툴킷 발표: Claim references unresolved evidence_id: sx:43d1b942a84263ab2c88b894f619a244ae8cf13262b41eb4c1427e73e73e3a35:evidence_blocks:97f7fd6266fe4407.
- 8 pt [claim-evidence] Google I/O '26: Jetpack CameraX 및 Media3 기반의 통합 미디어 파이프라인 툴킷 발표: Claim references unresolved evidence_id: sx:43d1b942a84263ab2c88b894f619a244ae8cf13262b41eb4c1427e73e73e3a35:evidence_blocks:97f7fd6266fe4407.
- 1 pt [image-fallback] Google I/O '26: Jetpack CameraX 및 Media3 기반의 통합 미디어 파이프라인 툴킷 발표: Article image uses a local fallback visual.
- 8 pt [source-integrity] CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영: Shared watch/release-note URL requires matching version_or_release or published_date evidence.
- 8 pt [claim-evidence] CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영: Claim references unresolved evidence_id: sx:545c1667e2f958629af66480105e1554b1726272a4979f69145d1b61229f62e7:release-camerax-1-6-0-march-25-2026-camerax-androidx-camera-bug-fixes-bug-fixes:0aecc02c99ec7a81.
- 8 pt [claim-evidence] CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영: Claim references unresolved evidence_id: sx:545c1667e2f958629af66480105e1554b1726272a4979f69145d1b61229f62e7:release-camerax-1-6-0-march-25-2026-camerax-androidx-camera-bug-fixes-bug-fixes:0aecc02c99ec7a81.
- 8 pt [claim-evidence] CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영: Claim references unresolved evidence_id: sx:545c1667e2f958629af66480105e1554b1726272a4979f69145d1b61229f62e7:release-camerax-1-6-0-march-25-2026-camerax-androidx-camera-bug-fixes-bug-fixes:0aecc02c99ec7a81.
- 8 pt [claim-evidence] CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영: Claim references unresolved evidence_id: sx:545c1667e2f958629af66480105e1554b1726272a4979f69145d1b61229f62e7:release-camerax-1-6-0-march-25-2026-camerax-androidx-camera-bug-fixes-bug-fixes:0aecc02c99ec7a81.
- 8 pt [claim-evidence] CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영: Claim references unresolved evidence_id: sx:545c1667e2f958629af66480105e1554b1726272a4979f69145d1b61229f62e7:release-camerax-1-6-0-march-25-2026-camerax-androidx-camera-bug-fixes-bug-fixes:1973794d82e9b63d.
- 8 pt [claim-evidence] CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영: Claim references unresolved evidence_id: sx:545c1667e2f958629af66480105e1554b1726272a4979f69145d1b61229f62e7:release-camerax-1-6-0-march-25-2026-camerax-androidx-camera-bug-fixes-bug-fixes:0aecc02c99ec7a81.
- 8 pt [claim-evidence] CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영: Claim references unresolved evidence_id: sx:545c1667e2f958629af66480105e1554b1726272a4979f69145d1b61229f62e7:release-camerax-1-6-0-march-25-2026-camerax-androidx-camera-bug-fixes-bug-fixes:0aecc02c99ec7a81.
- 8 pt [source-integrity] CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영: CameraX source extraction failure: source_extraction.release.sections has no concrete release-note bullet.
- 1 pt [image-fallback] CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 단말별 YUV 스트림 호환성 패치 반영: Article image uses a local fallback visual.
- 8 pt [source-integrity] AOSP Camera ITS 업데이트: Honor Pad 20 태블릿 허용 목록 추가 및 테스트 지침 재정렬: Shared watch/release-note URL requires matching version_or_release or published_date evidence.
- 8 pt [claim-evidence] AOSP Camera ITS 업데이트: Honor Pad 20 태블릿 허용 목록 추가 및 테스트 지침 재정렬: Claim references unresolved evidence_id: candidate:bb0e15b6742fce012e2e0220ecfba35983722daa6e6c21581c9c5d661584a54d:source-summary.
- 8 pt [claim-evidence] AOSP Camera ITS 업데이트: Honor Pad 20 태블릿 허용 목록 추가 및 테스트 지침 재정렬: Claim references unresolved evidence_id: candidate:bb0e15b6742fce012e2e0220ecfba35983722daa6e6c21581c9c5d661584a54d:source-summary.
- 1 pt [image-fallback] AOSP Camera ITS 업데이트: Honor Pad 20 태블릿 허용 목록 추가 및 테스트 지침 재정렬: Article image uses a local fallback visual.
- 3 pt [source-integrity] Fact checker reported 1 source gap(s).
