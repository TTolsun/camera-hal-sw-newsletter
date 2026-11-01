# 뉴스레터 품질 리포트 - 2026-11-02

## Gate Result

- Quality score: 92
- Quality threshold: 60
- Max score: 100
- Result: PASS
- Summary: Safety checks passed and the fact-checker found every article useful to a Camera HAL SW engineer. Editor review is ready.

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

- Main article count: 4
- Briefing count: 3
- Structured camera article count: 4
- Legacy regex camera article count: 4
- Expanded-scope article count: 4
- direct_aosp_camera count: 2
- camera_driver_image_pipeline count: 2
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
- Relevance bucket counts: {"direct_aosp_camera":2,"camera_driver_image_pipeline":2,"android":0,"android_supporting":0,"cpp_ai_tooling_fallback":0,"generic_tech_watchlist":0}
- Topic tier distribution (relevance_bucket): {"direct_camera":4,"supporting":0,"fallback":0,"watchlist":0}
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
- hal_impact_axis_counts: {"framework_hal_contract":2,"stream_buffer_metadata":4,"camerax_app_compatibility":1,"driver_image_pipeline":2}
- actionability_level_counts: {"measurable_test":4}
- effective_actionability_level_counts: {"measurable_test":4}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | Sony Xperia 1 V의 4개 유스케이스 스트림 공유 시 비디오 스냅샷 중단 우회 | strong_signal | measurable_test | measurable_test | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | complete | none |
| 2 | Camera2 Pipe FrameBuffer의 스트림 세트 포함 여부 검증 로직 추가 | strong_signal | measurable_test | measurable_test | framework_hal_contract, stream_buffer_metadata | complete | none |
| 3 | CameraX Recorder의 Surface 해제 시 잔류 포인터 정리로 녹화 멈춤 방지 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, stream_buffer_metadata | complete | none |
| 4 | Camera2 Extensions의 Ultra HDR(JPEG_R) 해상도 쿼리를 API 35 이상으로 제한 | strong_signal | measurable_test | measurable_test | driver_image_pipeline, stream_buffer_metadata | complete | none |

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
- Claim coverage: bound_claims=15; total_claims=15
- Derived evidence mapping count: 0
- Overclaim risk: low
- Uncovered fact count: 0

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sony Xperia 1 V의 4개 유스케이스 스트림 공유 시 비디오 스냅샷 중단 우회 | c1-fact-1: Gerrit 4399967 변경사항이 2026-10-30에 androidx-main 브랜치에 병합되었습니다. | fact | bound | camera_framework_behavior | low | none | source-body:6fc830f91a5c87610e6e | https://android-review.googlesource.com/c/platform/frameworks/support/+/4399967 |
| Sony Xperia 1 V의 4개 유스케이스 스트림 공유 시 비디오 스냅샷 중단 우회 | c1-fact-2: Sony Xperia 1 V (xq-dq72) 기기에서 StreamSharing 사용 시 Preview와 VideoCapture가 SurfaceTexture로 병합됩니다. | fact | bound | camera_framework_behavior | low | none | source-body:6fc830f91a5c87610e6e | https://android-review.googlesource.com/c/platform/frameworks/support/+/4399967 |
| Sony Xperia 1 V의 4개 유스케이스 스트림 공유 시 비디오 스냅샷 중단 우회 | c1-fact-3: 세션에 GraphicBufferSource가 없으면 Sony HAL이 미리보기/스틸 스트리밍 모드로 동작하여 TEMPLATE_VIDEO_SNAPSHOT을 무시합니다. | fact | bound | camera_framework_behavior | low | none | source-body:6fc830f91a5c87610e6e | https://android-review.googlesource.com/c/platform/frameworks/support/+/4399967 |
| Sony Xperia 1 V의 4개 유스케이스 스트림 공유 시 비디오 스냅샷 중단 우회 | c1-fact-4: ImageCaptureFailedForVideoSnapshotQuirk를 통해 인텐트를 STILL_CAPTURE로 변경하여 해결했습니다. | fact | bound | camera_framework_behavior | low | none | source-body:6fc830f91a5c87610e6e | https://android-review.googlesource.com/c/platform/frameworks/support/+/4399967 |
| Camera2 Pipe FrameBuffer의 스트림 세트 포함 여부 검증 로직 추가 | c2-fact-1: Gerrit 4395726 변경사항이 2026-10-28에 androidx-main 브랜치에 병합되었습니다. | fact | bound | camera_framework_behavior | low | none | source-body:466013815ccd95dfa21b | https://android-review.googlesource.com/c/platform/frameworks/support/+/4395726 |
| Camera2 Pipe FrameBuffer의 스트림 세트 포함 여부 검증 로직 추가 | c2-fact-2: FrameBufferImpl.kt의 onFrameStarted에 stream set 포함 여부 검증 조건문이 추가되었습니다. | fact | bound | camera_framework_behavior | low | none | source-body:466013815ccd95dfa21b | https://android-review.googlesource.com/c/platform/frameworks/support/+/4395726 |
| Camera2 Pipe FrameBuffer의 스트림 세트 포함 여부 검증 로직 추가 | c2-fact-3: 요청 메타데이터 스트림이 버퍼 스트림을 모두 포함하지 않는 경우 프레임이 무시됩니다. | fact | bound | camera_framework_behavior | low | none | source-body:466013815ccd95dfa21b | https://android-review.googlesource.com/c/platform/frameworks/support/+/4395726 |
| Camera2 Pipe FrameBuffer의 스트림 세트 포함 여부 검증 로직 추가 | c2-fact-4: 하위 스트림 집합 요청 시 일치하는 FrameBuffer에만 프레임이 적재됩니다. | fact | bound | camera_framework_behavior | low | none | source-body:466013815ccd95dfa21b | https://android-review.googlesource.com/c/platform/frameworks/support/+/4395726 |
| CameraX Recorder의 Surface 해제 시 잔류 포인터 정리로 녹화 멈춤 방지 | c3-fact-1: Gerrit 4399846 변경사항이 2026-10-30에 androidx-main 브랜치에 병합되었습니다. | fact | bound | camera_framework_behavior | low | none | source-body:6acf8102be67f0b37c6d | https://android-review.googlesource.com/c/platform/frameworks/support/+/4399846 |
| CameraX Recorder의 Surface 해제 시 잔류 포인터 정리로 녹화 멈춤 방지 | c3-fact-2: VideoEncoderSession 종료 시 getReadyToReleaseFuture 콜백에서 mActiveSurface를 null로 설정합니다. | fact | bound | camera_framework_behavior | low | none | source-body:6acf8102be67f0b37c6d | https://android-review.googlesource.com/c/platform/frameworks/support/+/4399846 |
| CameraX Recorder의 Surface 해제 시 잔류 포인터 정리로 녹화 멈춤 방지 | c3-fact-3: 기존에는 해제된 Surface 포인터가 잔류하여 다음 녹화가 PENDING_RECORDING에 고착되었습니다. | fact | bound | camera_framework_behavior | low | none | source-body:6acf8102be67f0b37c6d | https://android-review.googlesource.com/c/platform/frameworks/support/+/4399846 |
| CameraX Recorder의 Surface 해제 시 잔류 포인터 정리로 녹화 멈춤 방지 | c3-fact-4: INACTIVE 상태 처리 시 shouldRetainRecording()을 전달하여 영구 녹화의 오디오를 보존합니다. | fact | bound | camera_framework_behavior | low | none | source-body:6acf8102be67f0b37c6d | https://android-review.googlesource.com/c/platform/frameworks/support/+/4399846 |
| Camera2 Extensions의 Ultra HDR(JPEG_R) 해상도 쿼리를 API 35 이상으로 제한 | c-4402197-1: Gerrit change 4402197이 2026-10-30 androidx-main 브랜치에 병합되었습니다. | fact | bound | camera_framework_behavior | low | none | seed-01-801f1676ef-primary-01, source-body:66fd56e307fda1c763b1 | https://android-review.googlesource.com/c/platform/frameworks/support/+/4402197 |
| Camera2 Extensions의 Ultra HDR(JPEG_R) 해상도 쿼리를 API 35 이상으로 제한 | c-4402197-2: ImageFormat.JPEG_R 상수는 API 34에 도입되었으나, API 34 플랫폼의 CameraExtensionCharacteristics 구현은 JPEG와 YUV_4... | fact | bound | camera_framework_behavior | low | none | seed-01-801f1676ef-primary-01, source-body:66fd56e307fda1c763b1 | https://android-review.googlesource.com/c/platform/frameworks/support/+/4402197 |
| Camera2 Extensions의 Ultra HDR(JPEG_R) 해상도 쿼리를 API 35 이상으로 제한 | c-4402197-3: Camera2ExtensionsVendorExtender의 still capture 및 postview 해상도 질의 가드를 Build.VERSION_CODES.VANILLA_... | fact | bound | camera_framework_behavior | low | none | seed-01-801f1676ef-primary-01, source-body:66fd56e307fda1c763b1 | https://android-review.googlesource.com/c/platform/frameworks/support/+/4402197 |

### Uncovered Facts

- none

## Article Structure Contract

- Complete article sections: 4
- Incomplete article sections: 0

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Sony Xperia 1 V의 4개 유스케이스 스트림 공유 시 비디오 스냅샷 중단 우회 | pass | present+guarded | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | present | public-limitation |
| 2 | Camera2 Pipe FrameBuffer의 스트림 세트 포함 여부 검증 로직 추가 | pass | present+guarded | framework_hal_contract, stream_buffer_metadata | present | public-limitation |
| 3 | CameraX Recorder의 Surface 해제 시 잔류 포인터 정리로 녹화 멈춤 방지 | pass | present+guarded | driver_image_pipeline, stream_buffer_metadata | present | public-limitation |
| 4 | Camera2 Extensions의 Ultra HDR(JPEG_R) 해상도 쿼리를 API 35 이상으로 제한 | pass | present | driver_image_pipeline, stream_buffer_metadata | present | none |

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | PASS | preserve | Sony Xperia 1 V의 4개 유스케이스 스트림 공유 시 비디오 스냅샷 중단 우회 | direct_aosp_camera | 1 | true | false | false | true | bound | shortlist_selected | merged | none | direct_aosp_camera counts toward primary_camera_stack_count. | none | none | image-fallback: Article image uses a local fallback visual. |
| 2 | PASS | preserve | Camera2 Pipe FrameBuffer의 스트림 세트 포함 여부 검증 로직 추가 | direct_aosp_camera | 1 | true | false | false | true | bound | shortlist_selected | merged | none | direct_aosp_camera counts toward primary_camera_stack_count. | none | none | linked-evidence-limitation: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; image-fallback: Article image uses a local fallback visual. |
| 3 | PASS | preserve | CameraX Recorder의 Surface 해제 시 잔류 포인터 정리로 녹화 멈춤 방지 | camera_driver_image_pipeline | 5 | true | true | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | image-fallback: Article image uses a local fallback visual. |
| 4 | PASS | preserve | Camera2 Extensions의 Ultra HDR(JPEG_R) 해상도 쿼리를 API 35 이상으로 제한 | camera_driver_image_pipeline | 5 | true | true | false | true | bound | shortlist_selected | merged | none | camera_driver_image_pipeline counts toward primary_camera_stack_count. | none | none | image-fallback: Article image uses a local fallback visual. |

## Hard Fails

- none

## Soft Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.
- 1 pt [editorial-story] briefing 3: Briefing bullet misses story structure elements: action_hint.
- 1 pt [image-fallback] Sony Xperia 1 V의 4개 유스케이스 스트림 공유 시 비디오 스냅샷 중단 우회: Article image uses a local fallback visual.
- 2 pt [linked-evidence-limitation] Camera2 Pipe FrameBuffer의 스트림 세트 포함 여부 검증 로직 추가: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.
- 1 pt [image-fallback] Camera2 Pipe FrameBuffer의 스트림 세트 포함 여부 검증 로직 추가: Article image uses a local fallback visual.
- 1 pt [image-fallback] CameraX Recorder의 Surface 해제 시 잔류 포인터 정리로 녹화 멈춤 방지: Article image uses a local fallback visual.
- 1 pt [image-fallback] Camera2 Extensions의 Ultra HDR(JPEG_R) 해상도 쿼리를 API 35 이상으로 제한: Article image uses a local fallback visual.

## Unpublishable Articles

- none

## Top Deduction Categories

- image-fallback (4)
- editorial-story (2)
- linked-evidence-limitation (1)

## Candidate Exclusion Summary

- none

## Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.
- 1 pt [editorial-story] briefing 3: Briefing bullet misses story structure elements: action_hint.
- 1 pt [image-fallback] Sony Xperia 1 V의 4개 유스케이스 스트림 공유 시 비디오 스냅샷 중단 우회: Article image uses a local fallback visual.
- 2 pt [linked-evidence-limitation] Camera2 Pipe FrameBuffer의 스트림 세트 포함 여부 검증 로직 추가: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.
- 1 pt [image-fallback] Camera2 Pipe FrameBuffer의 스트림 세트 포함 여부 검증 로직 추가: Article image uses a local fallback visual.
- 1 pt [image-fallback] CameraX Recorder의 Surface 해제 시 잔류 포인터 정리로 녹화 멈춤 방지: Article image uses a local fallback visual.
- 1 pt [image-fallback] Camera2 Extensions의 Ultra HDR(JPEG_R) 해상도 쿼리를 API 35 이상으로 제한: Article image uses a local fallback visual.
