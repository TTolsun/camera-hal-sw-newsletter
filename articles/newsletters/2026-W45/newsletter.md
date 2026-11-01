# 2026 W44 (10.26 ~ 11.01)





<a id="issue-briefing"></a>

## 1. 이번 주 핵심

이번 주 뉴스레터에서는 카메라 파이프라인의 안정성과 호환성 개선 소식을 전해드립니다. 먼저, CameraX Recorder에서 Surface 해제 시 잔류 포인터 정리를 통해 녹화 멈춤을 방지하고, Camera2 Pipe FrameBuffer의 스트림 세트 포함 여부 검증 로직 추가로 버퍼링 오류를 막았습니다. 또한, Sony Xperia 1 V 기기에서 4개 유스케이스 스트림 공유 시 비디오 스냅샷 중단 문제를 우회했으며, Camera2 Extensions의 Ultra HDR(JPEG_R) 해상도 쿼리를 API 35 이상으로 제한하여 안정성을 높였습니다. 독자 여러분의 개발에 도움이 되기를 바랍니다.

- [Sony Xperia 1 V의 4개 유스케이스 스트림 공유 시 비디오 스냅샷 중단 우회](#article-sony-xperia-1-v-4)

  HAL이 세션 구성 스트림 유형에 따라 특정 요청 템플릿 처리를 거부하는 경우 프레임워크 수준에서 캡처 인텐트를 조정해 해결할 수 있음을 보여줍니다. 독자 환경에서 유사한 스트림 공유 세션을 다룰 때 템플릿 호환성과 버퍼 생성 흐름을 점검할 필요가 있습니다.

- [Camera2 Pipe FrameBuffer의 스트림 세트 포함 여부 검증 로직 추가](#article-camera2-pipe-framebuffer)

  프레임워크 내부 버퍼 관리 계층이 스트림 요청 메타데이터와의 정확한 매칭을 강제함으로써 메모리 누수와 잘못된 출력 수신을 차단합니다. HAL 개발 관점에서는 프레임워크가 단일 프레임별로 스트림 타깃을 엄격하게 필터링한다는 점을 인지할 필요가 있습니다.

- [CameraX Recorder의 Surface 해제 시 잔류 포인터 정리로 녹화 멈춤 방지](#article-camerax-recorder-surface)

  하위 인코더 Surface의 릴리스 완료 시점과 프레임워크 상태 머신 간의 비동기 레이스 컨디션을 해결한 사례입니다. HAL/드라이버 파이프라인 개발자에게도 비디오 스트림 정지 및 Surface 재바인딩 타이밍의 안정성 확보 방안을 제시합니다.

- [Camera2 Extensions의 Ultra HDR(JPEG_R) 해상도 쿼리를 API 35 이상으로 제한](#article-camera2-extensions-ultra-hdr-jpeg-r-api-35)

  플랫폼 프레임워크와 하위 벤더 확장 구현 간의 버전별 포맷 지원 차이로 인한 런타임 충돌을 방어한 패치입니다. HAL 및 벤더 라이브러리 개발팀은 대상 안드로이드 버전별 지원 포맷 열거 규격을 준수하고 불필요한 예외가 발생하지 않도록 정합성을 유지해야 합니다.




<a id="article-sony-xperia-1-v-4"></a>

## 2. Sony Xperia 1 V의 4개 유스케이스 스트림 공유 시 비디오 스냅샷 중단 우회

_AndroidX Gerrit Camera 패치 4399967_

Sony Xperia 1 V 기기에서 4가지 유스케이스를 동시에 묶을 때 비디오 녹화 중 스냅샷 촬영이 멈추던 문제가 CameraX 쿼크 적용으로 우회되었습니다.

### Camera HAL/Driver 관점에서의 의미

HAL이 세션 구성 스트림 유형에 따라 특정 요청 템플릿 처리를 거부하는 경우 프레임워크 수준에서 캡처 인텐트를 조정해 해결할 수 있음을 보여줍니다. 독자 환경에서 유사한 스트림 공유 세션을 다룰 때 템플릿 호환성과 버퍼 생성 흐름을 점검할 필요가 있습니다.


![](../../assets/images/fallback/android.svg)


Sony Xperia 1 V (모델명 xq-dq72) 기기에서 Preview, VideoCapture, ImageCapture, ImageAnalysis 4개 유스케이스를 동시에 실행할 때 비디오 스냅샷 촬영이 완료되지 않고 멈추는 현상이 발생했습니다. CameraX의 StreamSharing 기능은 하드웨어 스트림 수 제한을 극복하기 위해 미리보기와 비디오 캡처를 OpenGL SurfaceTexture 단일 스트림으로 병합하고 세션 템플릿으로 TEMPLATE_RECORD를 전달합니다.

이 과정에서 세션에 미디어 인코더 전용 GraphicBufferSource surface가 포함되지 않게 됩니다. Sony HAL 구현은 이를 미리보기와 스틸 스트리밍 모드(모드 0 0)로 인식하여, 세션 템플릿과 무관하게 전달되는 TEMPLATE_VIDEO_SNAPSHOT 요청을 무시하고 출력 JPEG 버퍼를 생산하지 않는 동작을 보였습니다.

### 캡처 인텐트 대체와 검증 조건

구글은 ImageCaptureFailedForVideoSnapshotQuirk 대상 기기 목록에 xq-dq72를 등록했습니다. 이를 통해 해당 환경에서는 캡처 인텐트를 CONTROL_CAPTURE_INTENT_VIDEO_SNAPSHOT 대신 CONTROL_CAPTURE_INTENT_STILL_CAPTURE로 재정의하여 HAL이 JPEG 처리를 수행하도록 유도합니다.

이 변경은 현재 AndroidX 메인 브랜치에 병합된 단계이며 공식 라이브러리 버전으로 배포되거나 상용 제품 펌웨어에 반영된 것은 아닙니다. 유사한 증상을 검증할 때는 4개 유스케이스를 바인딩한 뒤 비디오 녹화 도중 스냅샷 촬영 콜백이 정상적으로 수신되는지, 프레임 지연이나 파이프라인 정체가 없는지 확인할 수 있습니다.

[이번 주 핵심으로](#issue-briefing)

**출처**

- [Fix video snapshot hang on Sony xq-dq72 - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4399967)

---

<a id="article-camera2-pipe-framebuffer"></a>

## 3. Camera2 Pipe FrameBuffer의 스트림 세트 포함 여부 검증 로직 추가

_AndroidX Gerrit Camera 패치 4395726_

Camera2 Pipe 파이프라인에서 버퍼가 필요로 하는 스트림을 완전히 포함하지 않는 프레임이 잘못 버퍼링되지 않도록 검증하는 로직이 추가되었습니다.

### Camera HAL/Driver 관점에서의 의미

프레임워크 내부 버퍼 관리 계층이 스트림 요청 메타데이터와의 정확한 매칭을 강제함으로써 메모리 누수와 잘못된 출력 수신을 차단합니다. HAL 개발 관점에서는 프레임워크가 단일 프레임별로 스트림 타깃을 엄격하게 필터링한다는 점을 인지할 필요가 있습니다.


![](../../assets/images/fallback/android.svg)


Camera2 Pipe의 FrameGraph 내부에서는 프레임 생성 시 각 FrameBuffer로 프레임 참조를 배포합니다. 기존 구조에서는 프레임 요청 메타데이터에 포함된 스트림과 FrameBuffer가 요구하는 스트림 목록의 일치 여부를 온전히 확인하지 못해 부적절한 프레임이 대기열에 진입할 위험이 있었습니다.

이번 변경을 통해 FrameBufferImpl의 onFrameStarted 콜백 내에 조건문이 추가되었습니다. 들어오는 FrameReference의 requestMetadata에 정의된 스트림 키 집합이 FrameBuffer가 구성된 streams 집합을 모두 포함하고 있는지 확인합니다. 만약 프레임이 요구 스트림을 전부 담고 있지 않다면 즉시 처리를 종료합니다.

### 부분 스트림 요청 시의 프레임 격리

이 변경으로 특정 스트림의 하위 집합만 타깃으로 하는 캡처 요청이 발생했을 때, 해당 스트림을 포함하지 않는 다른 FrameBuffer는 해당 프레임을 무시하고 기존 버퍼 상태를 그대로 보존합니다.

해당 패치는 2026-10-28 소스 트리에 병합되었으며 라이브러리 릴리스 전 단계입니다. 동적 스트림 구성이나 부분 캡처 파이프라인을 테스트할 때 잘못된 프레임 참조가 버퍼 흐름에 섞이지 않는지 단위 검증을 참고할 수 있습니다.

[이번 주 핵심으로](#issue-briefing)

**출처**

- [Check if buffer's stream set is contained in request metadata of the Frame - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4395726)

---

<a id="article-camerax-recorder-surface"></a>

## 4. CameraX Recorder의 Surface 해제 시 잔류 포인터 정리로 녹화 멈춤 방지

_AndroidX Gerrit Camera 패치 4399846_

비디오 인코더 세션의 Surface가 해제되는 시점에 잔류 포인터를 정리하여, 빠른 화면 전환 후 다음 녹화가 영구히 대기 상태에 머무는 문제를 해결했습니다.

### Camera HAL/Driver 관점에서의 의미

하위 인코더 Surface의 릴리스 완료 시점과 프레임워크 상태 머신 간의 비동기 레이스 컨디션을 해결한 사례입니다. HAL/드라이버 파이프라인 개발자에게도 비디오 스트림 정지 및 Surface 재바인딩 타이밍의 안정성 확보 방안을 제시합니다.


![](../../assets/images/fallback/android.svg)


CameraX Recorder 모듈에서 앱 수명 주기가 빠르게 전환될 때 비디오 녹화가 시작되지 않는 교착 현상이 보고되었습니다. 이전에는 VideoEncoderSession의 Surface가 종료되고 getReadyToReleaseFuture가 완료되었을 때, 순차 실행기 상에서 onSourceStateChangedInternal(INACTIVE)가 실행되기 전에 인코더 리셋이 먼저 일어나면서 mActiveSurface가 이미 해제된 Surface를 가리킨 채 남아 있었습니다.

이 상태에서 소스 비활성화(INACTIVE) 신호가 도착하면, 널이 아닌 mActiveSurface를 감지한 Recorder는 구성(CONFIGURING) 상태에서 다음 시작 전 리셋 플래그(mNeedsResetBeforeNextStart)를 참으로 설정했습니다. 이로 인해 다음 녹화 요청이 PENDING_RECORDING 상태에서 영구적으로 대기하는 문제가 발생했습니다.

### 콜백 내부 정리 및 오디오 유지

수정 사항은 getReadyToReleaseFuture의 성공(onSuccess) 및 실패(onFailure) 콜백에서 mActiveSurface를 null로 명시적으로 초기화하도록 했습니다. 또한 소스 비활성화 시 mActiveSurface가 null일 경우 영구 녹화(persistent recording)에서 오디오 소스를 유지할 수 있도록 변경했습니다.

해당 변경은 2026-10-30 메인 브랜치에 병합되었으나, 공식 라이브러리 배포나 단말 제품 빌드 반영 여부는 아직 확인되지 않았습니다. 빠른 녹화 시작과 종료, 화면 회전 같은 수명 주기 전환 후 새 Surface 요청을 다시 연결했을 때 다음 녹화가 PENDING_RECORDING 상태에 갇히지 않고 정상 시작되는지 확인하는 것이 유용한 점검 사항입니다.

[이번 주 핵심으로](#issue-briefing)

**출처**

- [Clear Recorder.mActiveSurface on surface release - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4399846)

---

<a id="article-camera2-extensions-ultra-hdr-jpeg-r-api-35"></a>

## 5. Camera2 Extensions의 Ultra HDR(JPEG_R) 해상도 쿼리를 API 35 이상으로 제한

_AndroidX Gerrit Camera 패치 4402197_

카메라 확장 기능에서 Ultra HDR(JPEG_R) 지원 해상도를 질의할 때 발생하던 비정상 종료를 방지하기 위해 쿼리 대상 API 레벨이 35 이상으로 상향 조정되었습니다.

### Camera HAL/Driver 관점에서의 의미

플랫폼 프레임워크와 하위 벤더 확장 구현 간의 버전별 포맷 지원 차이로 인한 런타임 충돌을 방어한 패치입니다. HAL 및 벤더 라이브러리 개발팀은 대상 안드로이드 버전별 지원 포맷 열거 규격을 준수하고 불필요한 예외가 발생하지 않도록 정합성을 유지해야 합니다.


![](../../assets/images/fallback/android.svg)


Camera2 Extensions 벤더 확장 계층에서 기기 지원 해상도를 질의할 때 예외가 발생하는 결함이 수정되었습니다. ImageFormat.JPEG_R(정수값 4101) 상수는 Android 14(API 34)에 처음 도입되었기 때문에, 기존 쿼리 로직은 API 34 이상일 경우 해당 포맷의 확장 지원 해상도를 함께 조회하도록 구성되어 있었습니다.

그러나 API 34 플랫폼의 CameraExtensionCharacteristics 내부 구현인 getExtensionSupportedSizes 및 getPostviewSupportedSizes 메서드는 JPEG와 YUV_420_888 두 가지 형식만 허용하도록 하드코딩되어 있었습니다. 따라서 API 34 기기에서 JPEG_R을 쿼리하면 지원되지 않는 형식이라는 IllegalArgumentException 예외가 발생했습니다.

### 확장 쿼리 가드 상향 및 검증

카메라 확장에서의 JPEG_R 지원은 Android 15(API 35)에 이르러 공식 추가되었습니다. 이에 따라 Camera2ExtensionsVendorExtender의 still capture 및 postview 포맷 쿼리 가드를 Build.VERSION_CODES.VANILLA_ICE_CREAM(API 35) 이상으로 상향했습니다. 이제 API 34 환경에서는 JPEG와 YUV_420_888만 쿼리합니다.

이 수정은 2026년 10월 30일 Gerrit androidx-main 브랜치에 병합된 소스 코드 변경입니다. 확인된 범위는 메인 개발 브랜치의 커밋 병합이며, 실제 배포 라이브러리인 CameraX 정식 릴리스 버전이나 특정 제조사의 상용 단말 제품 빌드에 포함되었는지는 아직 확인되지 않았습니다. Android 14 기기 환경에서 카메라 확장 초기화 시 4101 포맷 질의 단계의 충돌 여부를 사전 점검할 수 있습니다.

[이번 주 핵심으로](#issue-briefing)

**출처**

- [Only query JPEG_R extension sizes on API 35+ in Camera2ExtensionsVendorExtender - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4402197)


## 참고 / 더 읽을거리

- [Add default implementation for CameraMetadata#isExtensionSupported - platform/frameworks/support](<https://android-review.googlesource.com/c/platform/frameworks/support/+/4393805>) — AndroidX Gerrit Camera (2026-10-30) · AOSP Camera 프레임워크 관련 참고

## 참고자료

- [Fix video snapshot hang on Sony xq-dq72 - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4399967)
- [Check if buffer's stream set is contained in request metadata of the Frame - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4395726)
- [Clear Recorder.mActiveSurface on surface release - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4399846)
- [Only query JPEG_R extension sizes on API 35+ in Camera2ExtensionsVendorExtender - platform/frameworks/support](https://android-review.googlesource.com/c/platform/frameworks/support/+/4402197)
