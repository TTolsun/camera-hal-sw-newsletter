# 뉴스레터 품질 리포트 - 2026-11-23

## Gate Result

- Quality score: 48
- Quality threshold: 60
- Max score: 100
- Result: NEEDS_FIX
- Summary: Resolve source gaps, fact-check must-fix items, composition blockers, and any article the fact-checker marked not useful to a Camera HAL SW engineer before publishing.

## Publication Mode

- publication_mode: n/a
- homepage_visibility: n/a
- content_quality_score: 48
- camera_relevance_score: n/a
- publication_mode_decision: n/a
- fallback_only: false
- camera_anchor_count: n/a
- fallback_public_ready: false

## Composition

- Main article count: 5
- Briefing count: 3
- Structured camera article count: 5
- Legacy regex camera article count: 5
- Expanded-scope article count: 5
- direct_aosp_camera count: 5
- camera_driver_image_pipeline count: 0
- android count: 0
- android_multimedia_camera_output count: 0
- soc_platform_signal count: 0
- cpp_ai_tooling_fallback count: 0
- generic_tech_watchlist count: 0
- primary_camera_stack_count: 5
- supporting_main_article_count: 0
- forbidden_main_article_count: 0
- fallback_relevance_count: 0
- publishable_scope_count: 5
- composition_mode: NORMAL
- Newsletter Policy gate: main articles: 1-5; review gate primary camera stack articles: disabled; Publish-ready gate primary camera stack articles: disabled; Publish-ready gate direct AOSP Camera or driver/image pipeline articles: disabled; Publish-ready gate supporting main articles max: 1; forbidden main buckets: generic_tech_watchlist; quality threshold: 60
- Relevance bucket counts: {"direct_aosp_camera":5,"camera_driver_image_pipeline":0,"android":0,"android_supporting":0,"cpp_ai_tooling_fallback":0,"generic_tech_watchlist":0}
- Topic tier distribution (relevance_bucket): {"direct_camera":5,"supporting":0,"fallback":0,"watchlist":0}
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
- hal_impact_axis_counts: {"framework_hal_contract":5,"stream_buffer_metadata":5,"camerax_app_compatibility":5,"driver_image_pipeline":1}
- actionability_level_counts: {"owner_metric_log":1,"measurable_test":4}
- effective_actionability_level_counts: {"owner_metric_log":1,"measurable_test":4}

| # | Article | signal_quality_status | actionability_level | effective_actionability_level | hal_impact_axes | HAL Signal Capsule | hard_blocker_reason_codes |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | CameraX 1.7.0 릴리스: Camera2Interop V2 안정화 및 물리 카메라 직접 바인딩 지원 | strong_signal | owner_metric_log | owner_metric_log | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | complete | none |
| 2 | Samsung SM-F971 ZSL 비활성화: 물리 렌즈 줌 전환 시 CamX SAT 파이프라인 멈춤 대응 | strong_signal | measurable_test | measurable_test | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | complete | none |
| 3 | OPPO Find N3 Flip 물리 카메라 제외: ID 2·3 스트림 구성 시 발생하는 HAL 비정상 종료 수정 | strong_signal | measurable_test | measurable_test | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | complete | none |
| 4 | Samsung Extensions 카메라 장치 닫기 쿼크 API 35 이상 확장: 세션 재바인딩 후 캡처 타임아웃 방지 | strong_signal | measurable_test | measurable_test | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | complete | none |
| 5 | HLG10 크기 확인 지연 로딩: Android 15 이상 Pixel 기기의 Ultra HDR 충돌 해결 | strong_signal | measurable_test | measurable_test | framework_hal_contract, driver_image_pipeline, stream_buffer_metadata, camerax_app_compatibility | complete | none |

## Fact Check And Source Integrity

- Fact-check status: NEEDS_FIX
- Must-fix count: 1
- Source-gap count: 0
- Stale claim status: UNKNOWN
- Stale claim removals: 0
- Stale claim hard failures: 0
- Source integrity violation count: 0
- Blocking deduction count: 5
- Blocking deduction categories: linked-evidence-overclaim, source-integrity
- Hard fail count: 5
- Soft deduction count: 11

## Claim Binding

- Claim validation status: available
- Claim coverage: bound_claims=32; total_claims=32
- Derived evidence mapping count: 0
- Overclaim risk: low
- Uncovered fact count: 0

| Article | Claim | Type | Status | Impact | Risk | Reason codes | Evidence | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CameraX 1.7.0 릴리스: Camera2Interop V2 안정화 및 물리 카메라 직접 바인딩 지원 | camerax_170_rel_date: CameraX 1.7.0은 2026년 11월 18일 공식 출시되었습니다. | fact | bound | app_api_or_framework_adjacent | low | none | sx:0d96eee1501c272d:325d12199944:f81573dd549fda29 | https://developer.android.com/jetpack/androidx/releases/camera#1.7.0 |
| CameraX 1.7.0 릴리스: Camera2Interop V2 안정화 및 물리 카메라 직접 바인딩 지원 | camerax_170_interop_v2: Camera2Interop V2가 안정화되었으며 ImageWrapper, ImagePlane, CameraCharacteristicsWrapper, CaptureRequest... | fact | bound | app_api_or_framework_adjacent | low | none | sx:0d96eee1501c272d:325d12199944:f81573dd549fda29 | https://developer.android.com/jetpack/androidx/releases/camera#1.7.0 |
| CameraX 1.7.0 릴리스: Camera2Interop V2 안정화 및 물리 카메라 직접 바인딩 지원 | camerax_170_physical_cam: CameraInfo.getPhysicalCameraInfos()를 통해 물리 카메라용 CameraSelector를 얻고 UseCase를 물리 카메라에 직접 바인딩할 수 있습니다. | fact | bound | camera_framework_behavior | low | none | sx:0d96eee1501c272d:010ad74c795f:41ba44a459107198 | https://developer.android.com/jetpack/androidx/releases/camera#1.7.0 |
| CameraX 1.7.0 릴리스: Camera2Interop V2 안정화 및 물리 카메라 직접 바인딩 지원 | camerax_170_3a_locking: FocusMeteringAction에 setLockingMode(int)가 추가되어 연속 AF 모드를 유지한 채 AE와 AWB를 개별 잠금하거나 측정 영역을 갱신할 수 있습니다. | fact | bound | app_api_or_framework_adjacent | low | none | sx:0d96eee1501c272d:010ad74c795f:3a6eab1392f2995d | https://developer.android.com/jetpack/androidx/releases/camera#1.7.0 |
| CameraX 1.7.0 릴리스: Camera2Interop V2 안정화 및 물리 카메라 직접 바인딩 지원 | camerax_170_night_mode_indicator: Night Mode Indicator가 추가되어 저조도 장면 감지 상태(UNKNOWN, NOT_RECOMMENDED, RECOMMENDED)를 제공합니다. | fact | bound | app_api_or_framework_adjacent | low | none | sx:0d96eee1501c272d:010ad74c795f:04dbbce6bb6fe8c9 | https://developer.android.com/jetpack/androidx/releases/camera#1.7.0 |
| CameraX 1.7.0 릴리스: Camera2Interop V2 안정화 및 물리 카메라 직접 바인딩 지원 | camerax_170_auto_rotation: SessionConfig.Builder와 CameraController에 setAutoRotationEnabled가 추가되어 디바이스 센서 기반 출력 회전 자동 갱신을 제어할... | fact | bound | app_api_or_framework_adjacent | low | none | sx:0d96eee1501c272d:010ad74c795f:da71429ba33eafbc | https://developer.android.com/jetpack/androidx/releases/camera#1.7.0 |
| CameraX 1.7.0 릴리스: Camera2Interop V2 안정화 및 물리 카메라 직접 바인딩 지원 | camerax_170_low_light_torch: 저조도 부스트와 토치는 요청을 거부하는 대신 마지막 설정을 우선 적용하도록 변경되었으며 저조도 부스트 동작 중 ImageCapture 시 플래시 발광이 허용됩니다. | fact | bound | camera_framework_behavior | low | none | sx:0d96eee1501c272d:010ad74c795f:0f61d45d3d3b9efa | https://developer.android.com/jetpack/androidx/releases/camera#1.7.0 |
| CameraX 1.7.0 릴리스: Camera2Interop V2 안정화 및 물리 카메라 직접 바인딩 지원 | camerax_170_extensions_deprecate: ExtensionsManager.getExtensionEnabledCameraSelector()가 Deprecated되고 ExtensionSessionConfig로 대체되었습니다. | fact | bound | app_api_or_framework_adjacent | low | none | sx:0d96eee1501c272d:010ad74c795f:f7826612f9e60147 | https://developer.android.com/jetpack/androidx/releases/camera#1.7.0 |
| Samsung SM-F971 ZSL 비활성화: 물리 렌즈 줌 전환 시 CamX SAT 파이프라인 멈춤 대응 | sm_f971_zsl_merged: Gerrit 변경 4441195가 2026년 11월 17일 androidx-main 브랜치에 병합(MERGED)되었습니다. | fact | bound | camera_framework_behavior | low | none | source-body:b7ee8549e1606c1901c3 | https://android-review.googlesource.com/c/platform/frameworks/support/+/4441195 |
| Samsung SM-F971 ZSL 비활성화: 물리 렌즈 줌 전환 시 CamX SAT 파이프라인 멈춤 대응 | sm_f971_zsl_camx_stall: Samsung SM-F971U1 기기에서 재처리 가능한 PRIVATE ZSL 세션 구성 중 물리 렌즈 간 줌 비율(예: 0.6x에서 2.0x)을 전환할 때 CamX SAT 파... | fact | bound | stream_buffer_metadata | low | none | source-body:b7ee8549e1606c1901c3 | https://android-review.googlesource.com/c/platform/frameworks/support/+/4441195 |
| Samsung SM-F971 ZSL 비활성화: 물리 렌즈 줌 전환 시 CamX SAT 파이프라인 멈춤 대응 | sm_f971_zsl_timeout: 파이프라인이 멈추면 새로운 반복 요청에 대해 TotalCaptureResult 콜백이 전달되지 않아 CameraControl.setZoomRatio() 비동기 호출이 타임아웃... | fact | bound | camera_framework_behavior | low | none | source-body:b7ee8549e1606c1901c3 | https://android-review.googlesource.com/c/platform/frameworks/support/+/4441195 |
| Samsung SM-F971 ZSL 비활성화: 물리 렌즈 줌 전환 시 CamX SAT 파이프라인 멈춤 대응 | sm_f971_non_zsl_ok: 일반 비-ZSL 세션에서는 모든 줌 전환과 스틸 이미지 캡처가 멈춤 없이 정상 완료되었습니다. | fact | bound | camera_framework_behavior | low | none | source-body:b7ee8549e1606c1901c3 | https://android-review.googlesource.com/c/platform/frameworks/support/+/4441195 |
| Samsung SM-F971 ZSL 비활성화: 물리 렌즈 줌 전환 시 CamX SAT 파이프라인 멈춤 대응 | sm_f971_zsl_disabler_added: ZslDisablerQuirk에 SM-F971 접두사가 등록되어 해당 기기 제품군에서 ZSL이 비활성화되고 일반 스틸 캡처가 사용됩니다. | fact | bound | camera_framework_behavior | low | none | source-body:b7ee8549e1606c1901c3 | https://android-review.googlesource.com/c/platform/frameworks/support/+/4441195 |
| Samsung SM-F971 ZSL 비활성화: 물리 렌즈 줌 전환 시 CamX SAT 파이프라인 멈춤 대응 | sm_f971_zsl_test_added: 테스트 코드로 ZslDisablerQuirkTest에 samsungSmF971_loadsQuirk()가 추가되었습니다. | fact | bound | camera_framework_behavior | low | none | source-body:b7ee8549e1606c1901c3 | https://android-review.googlesource.com/c/platform/frameworks/support/+/4441195 |
| OPPO Find N3 Flip 물리 카메라 제외: ID 2·3 스트림 구성 시 발생하는 HAL 비정상 종료 수정 | oppo_pht110_merged: Gerrit 변경 4440995가 2026년 11월 17일 androidx-main 브랜치에 병합(MERGED)되었습니다. | fact | bound | camera_framework_behavior | low | none | source-body:9abc88eb2578c58b7eea | https://android-review.googlesource.com/c/platform/frameworks/support/+/4440995 |
| OPPO Find N3 Flip 물리 카메라 제외: ID 2·3 스트림 구성 시 발생하는 HAL 비정상 종료 수정 | oppo_pht110_hal_hang: OPPO Find N3 Flip(PHT110, MediaTek mt6985)에서 후면 논리 카메라 0의 물리 카메라 ID 2 또는 3을 타깃으로 스트림을 구성하면 벤더 HAL... | fact | bound | direct_hal_contract | low | none | source-body:9abc88eb2578c58b7eea | https://android-review.googlesource.com/c/platform/frameworks/support/+/4440995 |
| OPPO Find N3 Flip 물리 카메라 제외: ID 2·3 스트림 구성 시 발생하는 HAL 비정상 종료 수정 | oppo_pht110_watchdog_abort: 이 멈춤 현상으로 인해 camerahalserver 및 cameraserver 워치독이 동작하여 ERROR_CAMERA_DEVICE 및 CAMERA_DISCONNECTED 에... | fact | bound | camera_framework_behavior | low | none | source-body:9abc88eb2578c58b7eea | https://android-review.googlesource.com/c/platform/frameworks/support/+/4440995 |
| OPPO Find N3 Flip 물리 카메라 제외: ID 2·3 스트림 구성 시 발생하는 HAL 비정상 종료 수정 | oppo_pht110_quirk_added: ExcludePhysicalCameraIdQuirk의 OPPO_PROBLEM_MODELS에 PHT110 모델과 물리 카메라 ID 세트(2, 3)가 추가되었습니다. | fact | bound | camera_framework_behavior | low | none | source-body:9abc88eb2578c58b7eea | https://android-review.googlesource.com/c/platform/frameworks/support/+/4440995 |
| OPPO Find N3 Flip 물리 카메라 제외: ID 2·3 스트림 구성 시 발생하는 HAL 비정상 종료 수정 | oppo_pht110_info_hidden: 이 변경으로 CameraInfo.getPhysicalCameraInfos()에서 해당 물리 카메라 식별자가 숨겨져 상위 앱이 문제의 스트림을 구성하지 않도록 차단합니다. | fact | bound | app_api_or_framework_adjacent | low | none | source-body:9abc88eb2578c58b7eea | https://android-review.googlesource.com/c/platform/frameworks/support/+/4440995 |
| OPPO Find N3 Flip 물리 카메라 제외: ID 2·3 스트림 구성 시 발생하는 HAL 비정상 종료 수정 | oppo_pht110_test_verified: ExcludePhysicalCameraIdQuirkTest에 PHT110 모델에 대한 매핑 검증 테스트가 추가되었습니다. | fact | bound | camera_framework_behavior | low | none | source-body:9abc88eb2578c58b7eea | https://android-review.googlesource.com/c/platform/frameworks/support/+/4440995 |
| Samsung Extensions 카메라 장치 닫기 쿼크 API 35 이상 확장: 세션 재바인딩 후 캡처 타임아웃 방지 | samsung_ext_close_merged: Gerrit 변경 4441276이 2026년 11월 18일 androidx-main 브랜치에 병합(MERGED)되었습니다. | fact | bound | camera_framework_behavior | low | none | source-body:6a2a0ed8524b780fc643 | https://android-review.googlesource.com/c/platform/frameworks/support/+/4441276 |
| Samsung Extensions 카메라 장치 닫기 쿼크 API 35 이상 확장: 세션 재바인딩 후 캡처 타임아웃 방지 | samsung_ext_close_cap_removed: 기존 CloseCameraDeviceOnCameraGraphCloseQuirk는 Samsung 단말의 쿼크 적용 대상을 API 34 이하로 제한하고 있었습니다. | fact | bound | camera_framework_behavior | low | none | source-body:6a2a0ed8524b780fc643 | https://android-review.googlesource.com/c/platform/frameworks/support/+/4441276 |
| Samsung Extensions 카메라 장치 닫기 쿼크 API 35 이상 확장: 세션 재바인딩 후 캡처 타임아웃 방지 | samsung_ext_close_api36_failures: API 36 Samsung 모델들에서 UseCase 재바인딩 스트레스 테스트(BindUnbindUseCasesStressTest) 중 후면 카메라 NIGHT 모드 실패가 지속... | fact | bound | camera_framework_behavior | low | none | source-body:6a2a0ed8524b780fc643 | https://android-review.googlesource.com/c/platform/frameworks/support/+/4441276 |
| Samsung Extensions 카메라 장치 닫기 쿼크 API 35 이상 확장: 세션 재바인딩 후 캡처 타임아웃 방지 | samsung_ext_close_models_restored: API 35 이상에 대해 쿼크를 다시 활성화하자 SM-F966U, SM-F968U1, SM-S942U1, SM-S947U1 단말에서 후면 카메라 NIGHT 캡처가 정상 복원되... | fact | bound | camera_framework_behavior | low | none | source-body:6a2a0ed8524b780fc643 | https://android-review.googlesource.com/c/platform/frameworks/support/+/4441276 |
| Samsung Extensions 카메라 장치 닫기 쿼크 API 35 이상 확장: 세션 재바인딩 후 캡처 타임아웃 방지 | samsung_ext_close_scope: 이 쿼크는 Extensions가 활성화된 세션에 한해 새로운 캡처 세션을 생성하기 전 카메라 장치를 완전히 닫고 다시 열도록 동작합니다. | fact | bound | camera_framework_behavior | low | none | source-body:6a2a0ed8524b780fc643, source-body:f87b0744b5a641b5333d | https://android-review.googlesource.com/c/platform/frameworks/support/+/4441276 |
| Samsung Extensions 카메라 장치 닫기 쿼크 API 35 이상 확장: 세션 재바인딩 후 캡처 타임아웃 방지 | samsung_ext_close_front_residual: 단, SM-S947U1의 전면 카메라(cameraId=1) NIGHT 모드에서 발생하는 잔여 광원 맵 누락(no light map!) 타임아웃은 별도 버그로 추적 중입니다. | fact | bound | camera_framework_behavior | low | none | source-body:6a2a0ed8524b780fc643 | https://android-review.googlesource.com/c/platform/frameworks/support/+/4441276 |
| HLG10 크기 확인 지연 로딩: Android 15 이상 Pixel 기기의 Ultra HDR 충돌 해결 | hlg10_lazy_merged: Gerrit 변경 4447086이 2026년 11월 17일 androidx-main 브랜치에 병합(MERGED)되었습니다. | fact | bound | camera_framework_behavior | low | none | source-body:d69c3d7fbf48388e43cb | https://android-review.googlesource.com/c/platform/frameworks/support/+/4447086 |
| HLG10 크기 확인 지연 로딩: Android 15 이상 Pixel 기기의 Ultra HDR 충돌 해결 | hlg10_lazy_npe_cause: 이전 패치(aosp/4425978)에서 CameraCrashWhenHlg10UhdWithVideoStabilizationQuirk 검사 전 모든 스트림에 대해 SurfaceC... | fact | bound | camera_framework_behavior | low | none | source-body:d69c3d7fbf48388e43cb | https://android-review.googlesource.com/c/platform/frameworks/support/+/4447086 |
| HLG10 크기 확인 지연 로딩: Android 15 이상 Pixel 기기의 Ultra HDR 충돌 해결 | hlg10_lazy_pixel_jpegr: Android 15 이상 Google Pixel 기기에서 벤더 Extensions(야간 모드 등)는 CameraExtensionCharacteristics를 통해 Ultra ... | fact | bound | camera_framework_behavior | low | none | source-body:d69c3d7fbf48388e43cb | https://android-review.googlesource.com/c/platform/frameworks/support/+/4447086 |
| HLG10 크기 확인 지연 로딩: Android 15 이상 Pixel 기기의 Ultra HDR 충돌 해결 | hlg10_lazy_null_max_size: 이 경우 SurfaceSizeDefinition.getMaximumSize(JPEG_R)가 null로 남아 조기 해상도 조회 시 크래시가 발생했습니다. | fact | bound | camera_framework_behavior | low | none | source-body:d69c3d7fbf48388e43cb | https://android-review.googlesource.com/c/platform/frameworks/support/+/4447086 |
| HLG10 크기 확인 지연 로딩: Android 15 이상 Pixel 기기의 Ultra HDR 충돌 해결 | hlg10_lazy_validator_updated: 수정된 Hlg10UhdVideoStabilizationValidator.isUnsupported()는 쿼크가 켜져 있고 비디오 안정화가 ON이며 해당 스트림의 동적 범위가 H... | fact | bound | camera_framework_behavior | low | none | source-body:d69c3d7fbf48388e43cb | https://android-review.googlesource.com/c/platform/frameworks/support/+/4447086 |
| HLG10 크기 확인 지연 로딩: Android 15 이상 Pixel 기기의 Ultra HDR 충돌 해결 | hlg10_lazy_test_verified: 단위 테스트로 SupportedSurfaceCombinationTest 및 Hlg10UhdVideoStabilizationValidatorTest에 비-HLG10 스트림에 대... | fact | bound | camera_framework_behavior | low | none | source-body:d69c3d7fbf48388e43cb, source-body:fca20097a1b9ce55a5dd | https://android-review.googlesource.com/c/platform/frameworks/support/+/4447086 |

### Uncovered Facts

- none

## Article Structure Contract

- Complete article sections: 5
- Incomplete article sections: 0

| # | Article | 5-section | Fact boundary | HAL impact axis | Actionability | Limitations |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | CameraX 1.7.0 릴리스: Camera2Interop V2 안정화 및 물리 카메라 직접 바인딩 지원 | pass | present+guarded | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | direct_check | public-limitation |
| 2 | Samsung SM-F971 ZSL 비활성화: 물리 렌즈 줌 전환 시 CamX SAT 파이프라인 멈춤 대응 | pass | present+guarded | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | direct_check | public-limitation |
| 3 | OPPO Find N3 Flip 물리 카메라 제외: ID 2·3 스트림 구성 시 발생하는 HAL 비정상 종료 수정 | pass | present+guarded | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | direct_check | public-limitation |
| 4 | Samsung Extensions 카메라 장치 닫기 쿼크 API 35 이상 확장: 세션 재바인딩 후 캡처 타임아웃 방지 | pass | present+guarded | framework_hal_contract, stream_buffer_metadata, camerax_app_compatibility | direct_check | public-limitation |
| 5 | HLG10 크기 확인 지연 로딩: Android 15 이상 Pixel 기기의 Ultra HDR 충돌 해결 | pass | present+guarded | framework_hal_contract, driver_image_pipeline, stream_buffer_metadata, camerax_app_compatibility | direct_check | public-limitation |

## Article Gate Results

| # | Result | Repair action | Headline | relevance_bucket | editorial_priority | primary_camera | driver | soc | publishable_scope | binding_status | binding_source | metadata_source | missing_score_fields | count_reason | exclusion_reason_if_not_counted | Hard fail reasons | Soft deductions |
| ---: | --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | PASS | preserve | CameraX 1.7.0 릴리스: Camera2Interop V2 안정화 및 물리 카메라 직접 바인딩 지원 | direct_aosp_camera | 1 | true | false | false | true | bound | shortlist_selected | merged | none | direct_aosp_camera counts toward primary_camera_stack_count. | none | none | none |
| 2 | FAIL | repair-section | Samsung SM-F971 ZSL 비활성화: 물리 렌즈 줌 전환 시 CamX SAT 파이프라인 멈춤 대응 | direct_aosp_camera | 1 | true | false | false | true | bound | shortlist_selected | merged | none | direct_aosp_camera counts toward primary_camera_stack_count. | none | Article describes unresolved linked evidence as confirmed detail. | linked-evidence-limitation: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; image-fallback: Article image uses a local fallback visual. |
| 3 | FAIL | repair-section | OPPO Find N3 Flip 물리 카메라 제외: ID 2·3 스트림 구성 시 발생하는 HAL 비정상 종료 수정 | direct_aosp_camera | 1 | true | false | false | true | bound | shortlist_selected | merged | none | direct_aosp_camera counts toward primary_camera_stack_count. | none | Article describes unresolved linked evidence as confirmed detail.; Fact-check must_fix item mentions this section. | linked-evidence-limitation: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; image-fallback: Article image uses a local fallback visual. |
| 4 | FAIL | repair-section | Samsung Extensions 카메라 장치 닫기 쿼크 API 35 이상 확장: 세션 재바인딩 후 캡처 타임아웃 방지 | direct_aosp_camera | 1 | true | false | false | true | bound | shortlist_selected | merged | none | direct_aosp_camera counts toward primary_camera_stack_count. | none | Article describes unresolved linked evidence as confirmed detail. | linked-evidence-limitation: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; image-fallback: Article image uses a local fallback visual. |
| 5 | FAIL | repair-section | HLG10 크기 확인 지연 로딩: Android 15 이상 Pixel 기기의 Ultra HDR 충돌 해결 | direct_aosp_camera | 1 | true | false | false | true | bound | shortlist_selected | merged | none | direct_aosp_camera counts toward primary_camera_stack_count. | none | Article describes unresolved linked evidence as confirmed detail. | linked-evidence-limitation: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.; image-fallback: Article image uses a local fallback visual. |

## Hard Fails

- 8 pt [linked-evidence-overclaim] Samsung SM-F971 ZSL 비활성화: 물리 렌즈 줌 전환 시 CamX SAT 파이프라인 멈춤 대응: Article describes unresolved linked evidence as confirmed detail.
- 8 pt [linked-evidence-overclaim] OPPO Find N3 Flip 물리 카메라 제외: ID 2·3 스트림 구성 시 발생하는 HAL 비정상 종료 수정: Article describes unresolved linked evidence as confirmed detail.
- 8 pt [linked-evidence-overclaim] Samsung Extensions 카메라 장치 닫기 쿼크 API 35 이상 확장: 세션 재바인딩 후 캡처 타임아웃 방지: Article describes unresolved linked evidence as confirmed detail.
- 8 pt [linked-evidence-overclaim] HLG10 크기 확인 지연 로딩: Android 15 이상 Pixel 기기의 Ultra HDR 충돌 해결: Article describes unresolved linked evidence as confirmed detail.
- 5 pt [source-integrity] Fact checker returned 1 must_fix item(s).

## Soft Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.
- 1 pt [editorial-story] briefing 3: Briefing bullet misses story structure elements: what_happened.
- 2 pt [linked-evidence-limitation] Samsung SM-F971 ZSL 비활성화: 물리 렌즈 줌 전환 시 CamX SAT 파이프라인 멈춤 대응: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.
- 1 pt [image-fallback] Samsung SM-F971 ZSL 비활성화: 물리 렌즈 줌 전환 시 CamX SAT 파이프라인 멈춤 대응: Article image uses a local fallback visual.
- 2 pt [linked-evidence-limitation] OPPO Find N3 Flip 물리 카메라 제외: ID 2·3 스트림 구성 시 발생하는 HAL 비정상 종료 수정: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.
- 1 pt [image-fallback] OPPO Find N3 Flip 물리 카메라 제외: ID 2·3 스트림 구성 시 발생하는 HAL 비정상 종료 수정: Article image uses a local fallback visual.
- 2 pt [linked-evidence-limitation] Samsung Extensions 카메라 장치 닫기 쿼크 API 35 이상 확장: 세션 재바인딩 후 캡처 타임아웃 방지: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.
- 1 pt [image-fallback] Samsung Extensions 카메라 장치 닫기 쿼크 API 35 이상 확장: 세션 재바인딩 후 캡처 타임아웃 방지: Article image uses a local fallback visual.
- 2 pt [linked-evidence-limitation] HLG10 크기 확인 지연 로딩: Android 15 이상 Pixel 기기의 Ultra HDR 충돌 해결: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.
- 1 pt [image-fallback] HLG10 크기 확인 지연 로딩: Android 15 이상 Pixel 기기의 Ultra HDR 충돌 해결: Article image uses a local fallback visual.

## Unpublishable Articles

- #2 [confidence: high] OPPO Find N3 Flip 물리 카메라 ID 제외: 스트림 구성 시 발생하는 카메라 서버 강제 종료 차단: 특정 플랫폼 및 단말 조합에서 물리 스트림 플러시 시 발생하는 서버 강제 종료 결함과 프레임워크 대응 방식을 구체적으로 제시하여 유용합니다. / 공개 본문에 버그 수정 효과를 확인할 수 있는 구체적인 점검 조건과 예상 관찰 결과가 기술되지 않아 검증 필수 요건을 충족하지 못했습니다. / https://android-review.googlesource.com/c/platform/frameworks/support/+/4440995 (원문 구절: 'CameraInfo.getPhysicalCameraInfos() does not expose them', 'Test: ExcludePhysicalCameraIdQuirkTest, PhysicalCameraDeviceTest'): PHT110 기기 환경에서 CameraInfo.getPhysicalCameraInfos() 호출 시 물리 ID 2와 3이 반환 목록에서 누락되는지 확인하는 구체적인 점검 조건과 관찰 대상, 그리고 이것이 완료된 테스트가 아닌 편집 제안이라는 구분이 공개 본문에 기술되어야 합니다. / public_verification: 테이크어웨이에 일반적인 락업 점검 권고만 제시되었을 뿐, 독자가 수행해 볼 수 있는 구체적인 입력 조건(PHT110에서 getPhysicalCameraInfos 호출)과 관찰 결과(물리 ID 2, 3 제외 확인)를 담은 점검 제안이 본문에 누락되었습니다.
- #3 [confidence: high] Samsung Extensions 닫기 쿼크 API 35 이상 확장: 재바인딩 후 야간 촬영 멈춤 방지: 최신 OS 버전 단말에서도 지속되는 Extensions 파이프라인 재구성 락업과 디바이스 수명주기 강제 재오픈의 실무적 영향을 균형 있게 설명했습니다. / 소프트웨어 변경 원리와 범위는 충실히 설명되었으나, 소스 병합 외 라이브러리 릴리스 및 제품 반영 미확인 한계와 구체적 점검 제안이 공개 본문에 빠져 있습니다. / https://android-review.googlesource.com/c/platform/frameworks/support/+/4441276 ('BindUnbindUseCasesStressTest'): API 35 이상 삼성 기기에서 Extensions 야간 모드 UseCase를 반복 바인딩/해제한 후 캡처 멈춤이 재발하는지 확인하는 점검 방법과, 이것이 원문 기반 확인 제안이라는 설명의 누락. / https://android-review.googlesource.com/c/platform/frameworks/support/+/4441276 ('status: MERGED'): Gerrit 소스 트리에 병합된 상태만 확인되었으며 실제 CameraX/Camera2 배포 라이브러리 릴리스나 제품 빌드 반영은 확인되지 않았다는 반영 한계 설명의 누락. / public_verification: 원문의 원격 측정 및 스트레스 테스트 언급만 전달했을 뿐, 독자가 해당 환경에서 재바인딩 후 캡처 성공 여부를 관찰할 수 있는 점검 방법과 이것이 검증 제안이라는 설명이 공개 본문에 누락되었습니다. / release_limitations: 2026년 11월 18일 패치 병합 사실만 서술하고 있으며, 실제 배포 라이브러리 릴리스 버전 포함 및 제품 빌드 탑재 여부는 별도 확인이 필요하다는 미확인 한계를 명시하지 않았습니다.

## Top Deduction Categories

- image-fallback (4)
- linked-evidence-limitation (4)
- linked-evidence-overclaim (4)
- editorial-story (3)
- source-integrity (1)

## Candidate Exclusion Summary

- none

## Prose Style (reference only)

- 평균 문장 길이: 76.2자 (문장 75개)
- 120자 초과 문장: 3개 (4%)
- 목적절로 시작한 lead: 0/5
- 번역투 후보: ~에 대해 3, ~를 통해 3, ~에 있어 0, ~되어진다 0, ~을 위해 2, 연결어미 뒤 쉼표 5
- 이 지표는 참고용이며 발행 판정과 점수에 영향을 주지 않습니다.

## Deductions

- 1 pt [editorial-story] briefing 1: Briefing bullet misses story structure elements: action_hint.
- 1 pt [editorial-story] briefing 2: Briefing bullet misses story structure elements: what_happened, reader_perspective, action_hint.
- 1 pt [editorial-story] briefing 3: Briefing bullet misses story structure elements: what_happened.
- 8 pt [linked-evidence-overclaim] Samsung SM-F971 ZSL 비활성화: 물리 렌즈 줌 전환 시 CamX SAT 파이프라인 멈춤 대응: Article describes unresolved linked evidence as confirmed detail.
- 2 pt [linked-evidence-limitation] Samsung SM-F971 ZSL 비활성화: 물리 렌즈 줌 전환 시 CamX SAT 파이프라인 멈춤 대응: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.
- 1 pt [image-fallback] Samsung SM-F971 ZSL 비활성화: 물리 렌즈 줌 전환 시 CamX SAT 파이프라인 멈춤 대응: Article image uses a local fallback visual.
- 8 pt [linked-evidence-overclaim] OPPO Find N3 Flip 물리 카메라 제외: ID 2·3 스트림 구성 시 발생하는 HAL 비정상 종료 수정: Article describes unresolved linked evidence as confirmed detail.
- 2 pt [linked-evidence-limitation] OPPO Find N3 Flip 물리 카메라 제외: ID 2·3 스트림 구성 시 발생하는 HAL 비정상 종료 수정: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.
- 1 pt [image-fallback] OPPO Find N3 Flip 물리 카메라 제외: ID 2·3 스트림 구성 시 발생하는 HAL 비정상 종료 수정: Article image uses a local fallback visual.
- 8 pt [linked-evidence-overclaim] Samsung Extensions 카메라 장치 닫기 쿼크 API 35 이상 확장: 세션 재바인딩 후 캡처 타임아웃 방지: Article describes unresolved linked evidence as confirmed detail.
- 2 pt [linked-evidence-limitation] Samsung Extensions 카메라 장치 닫기 쿼크 API 35 이상 확장: 세션 재바인딩 후 캡처 타임아웃 방지: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.
- 1 pt [image-fallback] Samsung Extensions 카메라 장치 닫기 쿼크 API 35 이상 확장: 세션 재바인딩 후 캡처 타임아웃 방지: Article image uses a local fallback visual.
- 8 pt [linked-evidence-overclaim] HLG10 크기 확인 지연 로딩: Android 15 이상 Pixel 기기의 Ultra HDR 충돌 해결: Article describes unresolved linked evidence as confirmed detail.
- 2 pt [linked-evidence-limitation] HLG10 크기 확인 지연 로딩: Android 15 이상 Pixel 기기의 Ultra HDR 충돌 해결: Article source_verification_notes do not explain unresolved or limited linked evidence diagnostics.
- 1 pt [image-fallback] HLG10 크기 확인 지연 로딩: Android 15 이상 Pixel 기기의 Ultra HDR 충돌 해결: Article image uses a local fallback visual.
- 5 pt [source-integrity] Fact checker returned 1 must_fix item(s).
