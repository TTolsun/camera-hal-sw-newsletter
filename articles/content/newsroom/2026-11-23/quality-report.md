# 뉴스레터 품질 리포트 - 2026-11-23

## Gate Result

- Quality score: 85
- Quality threshold: 60
- Max score: 100
- Result: PASS
- Summary: Safety checks passed and the fact-checker found every article useful to a Camera HAL SW engineer. Editor review is ready.

## Publication Mode

- publication_mode: n/a
- homepage_visibility: n/a
- content_quality_score: 85
- camera_relevance_score: n/a
- publication_mode_decision: n/a
- fallback_only: false
- camera_anchor_count: n/a
- fallback_public_ready: false

## Composition

- Main article count: 5
- Briefing count: 3
- Structured camera article count: 4
- Legacy regex camera article count: 4
- Expanded-scope article count: 5
- direct_aosp_camera count: 4
- camera_driver_image_pipeline count: 0
- android count: 0
- android_multimedia_camera_output count: 1
- soc_platform_signal count: 0
- cpp_ai_tooling_fallback count: 0
- generic_tech_watchlist count: 0
- primary_camera_stack_count: 4
- supporting_main_article_count: 1
- forbidden_main_article_count: 0
- fallback_relevance_count: 1
- publishable_scope_count: 5
- composition_mode: FALLBACK_COMPOSITION
- Newsletter Policy gate: main articles: 1-5; review gate primary camera stack articles: disabled; Publish-ready gate primary camera stack articles: disabled; Publish-ready gate direct AOSP Camera or driver/image pipeline articles: disabled; Publish-ready gate supporting main articles max: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 60
- Relevance bucket counts: {"direct_aosp_camera":4,"camera_driver_image_pipeline":0,"android":0,"android_supporting":1,"cpp_ai_tooling_fallback":0,"generic_tech_watchlist":0}
- Topic tier distribution (relevance_bucket): {"direct_camera":4,"supporting":1,"fallback":0,"watchlist":0}
- AI article count: 0
- Underfilled/composition failure: none

## HAL Signal Quality

- strong_signal_count: 5
- usable_signal_count: 0
- weak_signal_count: 0
- watchlist_only_count: 0
- blocked_source_gap_count: 0
- article_count_with_hal_signal_capsule: 5
- article_count_without_hal_signal_capsule: 0
- generic_signal_hard_blocker_count: 0
- hal_signal_hard_blocker_count: 0
- hard_blocker_reason_code_counts: {}
- hal_impact_axis_counts: {"framework_hal_contract":4,"stream_buffer_metadata":5,"camerax_app_compatibility":4}
- actionability_level_counts: {"owner_metric_log":2,"measurable_test":3}
- effective_actionability_level_counts: {"owner_metric_log":2,"measurable_test":3}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | CameraX 1.7.0에서 물리 카메라를 직접 고른다 | strong_signal | owner_metric_log | owner_metric_log | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | complete | none |
| 2 | 3A 요청이 곧바로 실패하면 카메라 ID부터 확인하세요 | strong_signal | owner_metric_log | owner_metric_log | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | complete | none |
| 3 | SM-F971에서 두 번째 렌즈 전환이 멈춘 이유 | strong_signal | measurable_test | measurable_test | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | complete | none |
| 4 | OPPO Find N3 Flip에서 물리 카메라 두 개가 목록에서 빠진 까닭 | strong_signal | measurable_test | measurable_test | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | complete | none |
| 5 | 녹화 첫 프레임은 언제 들어왔을까? CameraX가 인코더 입력을 여는 시점 | strong_signal | measurable_test | measurable_test | stream_buffer_metadata | complete | none |

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
- Soft deduction count: 11

## Claim Binding

- Claim validation status: available
- Claim coverage: bound_claims=27; total_claims=27
- Derived evidence mapping count: 0
- Overclaim risk: low
- Uncovered fact count: 0

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CameraX 1.7.0에서 물리 카메라를 직접 고른다 | c1_release_date: CameraX 1.7.0 버전이 2026년 11월 18일 공식 릴리스되었습니다. | fact | bound | app_api_or_framework_adjacent | low | none | sx:0d96eee1501c272d:325d12199944:f81573dd549fda29 | https://developer.android.com/jetpack/androidx/releases/camera#1.7.0 |
| CameraX 1.7.0에서 물리 카메라를 직접 고른다 | c1_interop_v2: Camera2Interop V2가 재설계되어 안정화되었으며 옵트인 없이 사용 가능합니다. | fact | bound | app_api_or_framework_adjacent | low | none | sx:0d96eee1501c272d:325d12199944:f81573dd549fda29 | https://developer.android.com/jetpack/androidx/releases/camera#1.7.0 |
| CameraX 1.7.0에서 물리 카메라를 직접 고른다 | c1_night_mode: NightModeIndicator(UNKNOWN, NOT_RECOMMENDED, RECOMMENDED) 인터페이스가 추가되었습니다. | fact | bound | app_api_or_framework_adjacent | low | none | sx:0d96eee1501c272d:010ad74c795f:04dbbce6bb6fe8c9 | https://developer.android.com/jetpack/androidx/releases/camera#1.7.0 |
| CameraX 1.7.0에서 물리 카메라를 직접 고른다 | c1_3a_locking: FocusMeteringAction에 3A 잠금 모드(FLAG_AE, FLAG_AWB, FLAG_AF) 설정 API가 도입되었습니다. | fact | bound | app_api_or_framework_adjacent | low | none | sx:0d96eee1501c272d:010ad74c795f:3a6eab1392f2995d | https://developer.android.com/jetpack/androidx/releases/camera#1.7.0 |
| CameraX 1.7.0에서 물리 카메라를 직접 고른다 | c1_physical_binding: 물리 카메라용 CameraSelector 획득 및 UseCase 직접 바인딩이 지원됩니다. | fact | bound | app_api_or_framework_adjacent | low | none | sx:0d96eee1501c272d:010ad74c795f:41ba44a459107198 | https://developer.android.com/jetpack/androidx/releases/camera#1.7.0 |
| CameraX 1.7.0에서 물리 카메라를 직접 고른다 | c1_auto_rotation: SessionConfig 등에 디바이스 센서 기반 회전 처리를 위한 setAutoRotationEnabled가 추가되었습니다. | fact | bound | app_api_or_framework_adjacent | low | none | sx:0d96eee1501c272d:010ad74c795f:da71429ba33eafbc | https://developer.android.com/jetpack/androidx/releases/camera#1.7.0 |
| CameraX 1.7.0에서 물리 카메라를 직접 고른다 | c1_low_light_boost: Low Light Boost와 Torch가 last setting wins 방식으로 동작하도록 개선되었습니다. | fact | bound | app_api_or_framework_adjacent | low | none | sx:0d96eee1501c272d:010ad74c795f:0f61d45d3d3b9efa | https://developer.android.com/jetpack/androidx/releases/camera#1.7.0 |
| CameraX 1.7.0에서 물리 카메라를 직접 고른다 | c1_extensions_deprecate: ExtensionSessionConfig 도입으로 ExtensionsManager.getExtensionEnabledCameraSelector()가 폐기 예정으로 지정되었습니다. | fact | bound | app_api_or_framework_adjacent | low | none | sx:0d96eee1501c272d:010ad74c795f:f7826612f9e60147 | https://developer.android.com/jetpack/androidx/releases/camera#1.7.0 |
| 3A 요청이 곧바로 실패하면 카메라 ID부터 확인하세요 | c2_merge_status: Gerrit 변경 4439488이 platform/frameworks/support의 androidx-main 브랜치에 2026년 11월 19일 병합되었습니다. | fact | bound | camera_framework_behavior | low | none | source-body:24b43cd05ef4e7a8f7f2 | https://android-review.googlesource.com/c/platform/frameworks/support/+/4439488 |
| 3A 요청이 곧바로 실패하면 카메라 ID부터 확인하세요 | c2_are_modes_supported: Controller3A의 lock3A, submit3A, update3A 메서드에 areModesSupported 사전 검사가 추가되었습니다. | fact | bound | camera_framework_behavior | low | none | source-body:24b43cd05ef4e7a8f7f2 | https://android-review.googlesource.com/c/platform/frameworks/support/+/4439488 |
| 3A 요청이 곧바로 실패하면 카메라 ID부터 확인하세요 | c2_submit_failed: CameraMetadata에 없는 미지원 AE, AF, AWB, Flash, Control 모드 요청 시 즉시 Result3A.Status.SUBMIT_FAILED를 반환합니다. | fact | bound | camera_framework_behavior | low | none | source-body:24b43cd05ef4e7a8f7f2 | https://android-review.googlesource.com/c/platform/frameworks/support/+/4439488 |
| 3A 요청이 곧바로 실패하면 카메라 ID부터 확인하세요 | c2_state_retained: 미지원 모드로 인해 반환된 실패 상황에서는 기존의 3A 상태가 변경되지 않고 유지됩니다. | fact | bound | camera_framework_behavior | low | none | source-body:24b43cd05ef4e7a8f7f2 | https://android-review.googlesource.com/c/platform/frameworks/support/+/4439488 |
| 3A 요청이 곧바로 실패하면 카메라 ID부터 확인하세요 | c2_unit_tests: Controller3ALock3ATest, Controller3ASubmit3ATest, Controller3AUpdate3ATest 단위 테스트가 함께 추가되었습니다. | fact | bound | camera_framework_behavior | low | none | source-body:24b43cd05ef4e7a8f7f2, source-body:b265e56cb8c86249fbb5 | https://android-review.googlesource.com/c/platform/frameworks/support/+/4439488 |
| SM-F971에서 두 번째 렌즈 전환이 멈춘 이유 | c3_merge_status: Gerrit 변경 4441195가 platform/frameworks/support의 androidx-main 브랜치에 2026년 11월 17일 병합되었습니다. | fact | bound | camera_framework_behavior | low | none | source-body:b7ee8549e1606c1901c3 | https://android-review.googlesource.com/c/platform/frameworks/support/+/4441195 |
| SM-F971에서 두 번째 렌즈 전환이 멈춘 이유 | c3_camx_stall: Samsung SM-F971U1에서 재처리 가능한 PRIVATE ZSL 세션 중 물리 렌즈 간 줌 전환 시 CamX SAT 파이프라인이 멈추는 문제가 발생했습니다. | fact | bound | driver_image_pipeline | low | none | source-body:b7ee8549e1606c1901c3 | https://android-review.googlesource.com/c/platform/frameworks/support/+/4441195 |
| SM-F971에서 두 번째 렌즈 전환이 멈춘 이유 | c3_result_timeout: 파이프라인 멈춤으로 인해 TotalCaptureResult가 전달되지 않아 CameraControl.setZoomRatio()가 타임아웃되었습니다. | fact | bound | camera_framework_behavior | low | none | source-body:b7ee8549e1606c1901c3 | https://android-review.googlesource.com/c/platform/frameworks/support/+/4441195 |
| SM-F971에서 두 번째 렌즈 전환이 멈춘 이유 | c3_non_zsl_ok: 비ZSL 세션에서는 줌 전환과 스틸 이미지 캡처가 정상 작동했습니다. | fact | bound | camera_framework_behavior | low | none | source-body:b7ee8549e1606c1901c3 | https://android-review.googlesource.com/c/platform/frameworks/support/+/4441195 |
| SM-F971에서 두 번째 렌즈 전환이 멈춘 이유 | c3_quirk_applied: ZslDisablerQuirk에 SM-F971이 추가되어 해당 기기에서 ZSL을 끄고 표준 스틸 캡처로 폴백하도록 처리되었습니다. | fact | bound | camera_framework_behavior | low | none | source-body:b7ee8549e1606c1901c3 | https://android-review.googlesource.com/c/platform/frameworks/support/+/4441195 |
| OPPO Find N3 Flip에서 물리 카메라 두 개가 목록에서 빠진 까닭 | c4_merge_status: Gerrit 변경 4440995가 platform/frameworks/support의 androidx-main 브랜치에 2026년 11월 17일 병합되었습니다. | fact | bound | app_api_or_framework_adjacent | low | none | source-body:9abc88eb2578c58b7eea | https://android-review.googlesource.com/c/platform/frameworks/support/+/4440995 |
| OPPO Find N3 Flip에서 물리 카메라 두 개가 목록에서 빠진 까닭 | c4_hal_hang: OPPO Find N3 Flip(PHT110)에서 물리 카메라 ID 2 또는 3을 지정할 때 벤더 HAL이 P2StreamingNode 및 BasicSession::flush... | fact | bound | driver_image_pipeline | low | none | source-body:9abc88eb2578c58b7eea | https://android-review.googlesource.com/c/platform/frameworks/support/+/4440995 |
| OPPO Find N3 Flip에서 물리 카메라 두 개가 목록에서 빠진 까닭 | c4_watchdog_abort: 이로 인해 camerahalserver 및 cameraserver watchdog abort(ERROR_CAMERA_DEVICE, CAMERA_DISCONNECTED)가 발생... | fact | bound | camera_framework_behavior | low | none | source-body:9abc88eb2578c58b7eea | https://android-review.googlesource.com/c/platform/frameworks/support/+/4440995 |
| OPPO Find N3 Flip에서 물리 카메라 두 개가 목록에서 빠진 까닭 | c4_quirk_applied: ExcludePhysicalCameraIdQuirk에 PHT110 모델 및 물리 ID 2, 3이 등록되어 API 노출에서 제외되었습니다. | fact | bound | camera_framework_behavior | low | none | source-body:9abc88eb2578c58b7eea | https://android-review.googlesource.com/c/platform/frameworks/support/+/4440995 |
| OPPO Find N3 Flip에서 물리 카메라 두 개가 목록에서 빠진 까닭 | c4_test_updated: ExcludePhysicalCameraIdQuirkTest 단위 테스트가 갱신되었습니다. | fact | bound | camera_framework_behavior | low | none | source-body:9abc88eb2578c58b7eea | https://android-review.googlesource.com/c/platform/frameworks/support/+/4440995 |
| 녹화 첫 프레임은 언제 들어왔을까? CameraX가 인코더 입력을 여는 시점 | enc0: 2026년 11월 20일 androidx-main에 비디오 인코더 변경이 병합됐습니다. | fact | bound | app_api_or_framework_adjacent | low | none | source-body:8929aa5fd76f7373bf07 | https://android-review.googlesource.com/c/platform/frameworks/support/+/4400407 |
| 녹화 첫 프레임은 언제 들어왔을까? CameraX가 인코더 입력을 여는 시점 | enc1: API 29 이상에서 KEY_CREATE_INPUT_SURFACE_SUSPENDED를 설정해 구성 중 들어온 프레임을 버립니다. | fact | bound | app_api_or_framework_adjacent | low | none | source-body:8929aa5fd76f7373bf07 | https://android-review.googlesource.com/c/platform/frameworks/support/+/4400407 |
| 녹화 첫 프레임은 언제 들어왔을까? CameraX가 인코더 입력을 여는 시점 | enc2: MediaCodec.start() 반환 직후 PARAMETER_KEY_SUSPEND로 입력을 재개합니다. | fact | bound | app_api_or_framework_adjacent | low | none | source-body:8929aa5fd76f7373bf07 | https://android-review.googlesource.com/c/platform/frameworks/support/+/4400407 |
| 녹화 첫 프레임은 언제 들어왔을까? CameraX가 인코더 입력을 여는 시점 | enc3: 추가된 테스트는 첫 출력의 presentationTimeUs와 키프레임 여부를 확인합니다. | fact | bound | app_api_or_framework_adjacent | low | none | source-body:8929aa5fd76f7373bf07 | https://android-review.googlesource.com/c/platform/frameworks/support/+/4400407 |

### Uncovered Facts

- none

## Article Structure Contract

- Complete article sections: 5
- Incomplete article sections: 0

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | CameraX 1.7.0에서 물리 카메라를 직접 고른다 | pass | present | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | low | none |
| 2 | 3A 요청이 곧바로 실패하면 카메라 ID부터 확인하세요 | pass | present | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | medium | none |
| 3 | SM-F971에서 두 번째 렌즈 전환이 멈춘 이유 | pass | present | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | medium | none |
| 4 | OPPO Find N3 Flip에서 물리 카메라 두 개가 목록에서 빠진 까닭 | pass | present | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | high | none |
| 5 | 녹화 첫 프레임은 언제 들어왔을까? CameraX가 인코더 입력을 여는 시점 | pass | present | stream_buffer_metadata | high | none |

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | PASS | preserve | CameraX 1.7.0에서 물리 카메라를 직접 고른다 | direct_aosp_camera | 1 | true | false | false | true | bound | shortlist_selected | merged | none | direct_aosp_camera counts toward primary_camera_stack_count. | none | none | none |
| 2 | PASS | preserve | 3A 요청이 곧바로 실패하면 카메라 ID부터 확인하세요 | direct_aosp_camera | 1 | true | false | false | true | bound | shortlist_selected | merged | none | direct_aosp_camera counts toward primary_camera_stack_count. | none | none | linked-evidence-limitation: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; image-fallback: Article image uses a local fallback visual. |
| 3 | PASS | preserve | SM-F971에서 두 번째 렌즈 전환이 멈춘 이유 | direct_aosp_camera | 1 | true | false | false | true | bound | shortlist_selected | merged | none | direct_aosp_camera counts toward primary_camera_stack_count. | none | none | linked-evidence-limitation: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; image-fallback: Article image uses a local fallback visual. |
| 4 | PASS | preserve | OPPO Find N3 Flip에서 물리 카메라 두 개가 목록에서 빠진 까닭 | direct_aosp_camera | 1 | true | false | false | true | bound | shortlist_selected | merged | none | direct_aosp_camera counts toward primary_camera_stack_count. | none | none | linked-evidence-limitation: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; image-fallback: Article image uses a local fallback visual. |
| 5 | PASS | preserve | 녹화 첫 프레임은 언제 들어왔을까? CameraX가 인코더 입력을 여는 시점 | android | 3 | false | false | false | true | bound | shortlist_selected | merged | none | android counts toward supporting_main_article_count, not primary_camera_stack_count. | Supporting bucket is allowed by Newsletter Policy but is not a Primary Camera Stack topic. | none | linked-evidence-limitation: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; image-fallback: Article image uses a local fallback visual. |

## Hard Fails

- none

## Soft Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.
- 1 pt [editorial-story] briefing 3: Briefing bullet misses story structure elements: action_hint.
- 2 pt [linked-evidence-limitation] 3A 요청이 곧바로 실패하면 카메라 ID부터 확인하세요: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.
- 1 pt [image-fallback] 3A 요청이 곧바로 실패하면 카메라 ID부터 확인하세요: Article image uses a local fallback visual.
- 2 pt [linked-evidence-limitation] SM-F971에서 두 번째 렌즈 전환이 멈춘 이유: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.
- 1 pt [image-fallback] SM-F971에서 두 번째 렌즈 전환이 멈춘 이유: Article image uses a local fallback visual.
- 2 pt [linked-evidence-limitation] OPPO Find N3 Flip에서 물리 카메라 두 개가 목록에서 빠진 까닭: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.
- 1 pt [image-fallback] OPPO Find N3 Flip에서 물리 카메라 두 개가 목록에서 빠진 까닭: Article image uses a local fallback visual.
- 2 pt [linked-evidence-limitation] 녹화 첫 프레임은 언제 들어왔을까? CameraX가 인코더 입력을 여는 시점: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.
- 1 pt [image-fallback] 녹화 첫 프레임은 언제 들어왔을까? CameraX가 인코더 입력을 여는 시점: Article image uses a local fallback visual.

## Unpublishable Articles

- none

## Top Deduction Categories

- image-fallback (4)
- linked-evidence-limitation (4)
- editorial-story (3)

## Candidate Exclusion Summary

- none

## Prose Style (reference only)

- 평균 문장 길이: 54.3자 (문장 61개)
- 120자 초과 문장: 0개 (0%)
- 목적절로 시작한 lead: 0/5
- 번역투 후보: ~에 대해 0, ~를 통해 0, ~에 있어 0, ~되어진다 0, ~을 위해 0, 연결어미 뒤 쉼표 2
- 이 지표는 참고용이며 발행 판정과 점수에 영향을 주지 않습니다.

## Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.
- 1 pt [editorial-story] briefing 3: Briefing bullet misses story structure elements: action_hint.
- 2 pt [linked-evidence-limitation] 3A 요청이 곧바로 실패하면 카메라 ID부터 확인하세요: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.
- 1 pt [image-fallback] 3A 요청이 곧바로 실패하면 카메라 ID부터 확인하세요: Article image uses a local fallback visual.
- 2 pt [linked-evidence-limitation] SM-F971에서 두 번째 렌즈 전환이 멈춘 이유: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.
- 1 pt [image-fallback] SM-F971에서 두 번째 렌즈 전환이 멈춘 이유: Article image uses a local fallback visual.
- 2 pt [linked-evidence-limitation] OPPO Find N3 Flip에서 물리 카메라 두 개가 목록에서 빠진 까닭: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.
- 1 pt [image-fallback] OPPO Find N3 Flip에서 물리 카메라 두 개가 목록에서 빠진 까닭: Article image uses a local fallback visual.
- 2 pt [linked-evidence-limitation] 녹화 첫 프레임은 언제 들어왔을까? CameraX가 인코더 입력을 여는 시점: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.
- 1 pt [image-fallback] 녹화 첫 프레임은 언제 들어왔을까? CameraX가 인코더 입력을 여는 시점: Article image uses a local fallback visual.
