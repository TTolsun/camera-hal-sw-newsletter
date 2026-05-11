# AOSP Camera / Driver / SoC Platform 뉴스레터 - 2026-05-11

이번 2026-05-11호는 CameraX 1.4.0-alpha07 및 1.7.0-alpha01 업데이트: 뷰파인더 및 비디오 모듈 변경, libcamera Release Announcements - libcamera v0.7.1, CameraX 1.6.1 업데이트: Android Camera 호환성 관찰를 중심으로 구성했습니다. hard failure article 1개는 main article에서 제거하거나 강등했습니다.

## 1. 이번 주 3줄 브리핑
- CameraX 1.4.0-alpha07 및 1.7.0-alpha01이 출시되어 뷰파인더 및 비디오 모듈이 업데이트되었으며, HAL 스트림 구성 및 버퍼 관리에 영향을 줄 수 있습니다.
- libcamera v0.7.1이 SoftISP 디베이어링 및 센서 모드 구성 개선과 함께 출시되어, Linux 카메라 드라이버 스택의 이미지 처리 및 센서 제어 방식에 변화를 가져옵니다.
- 편집장은 source와 article 표현을 최종 확인합니다.

## 2. android_platform_camera_adjacent

### CameraX 1.4.0-alpha07 및 1.7.0-alpha01 업데이트: 뷰파인더 및 비디오 모듈 변경

![Android Developers 로고](https://developer.android.com/static/images/social/android-developers.png)

_Image: [Android Developers Latest Updates](https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07)_


**이번 주 확인한 사실**

- 2026년 5월 6일, CameraX 라이브러리 1.4.0-alpha07이 릴리스되었습니다.
- camera-viewfinder 모듈은 1.3.0-beta02에서 1.4.0-alpha07로 업데이트되었습니다.
- camera-video 모듈은 1.6.1에서 1.7.0-alpha01로 업데이트되었습니다.

**배경지식**

CameraX는 Android Jetpack의 일부로, 카메라 앱 개발을 간소화하는 라이브러리입니다. CameraX는 Camera2 API 위에 구축되어 있으며, HAL(Hardware Abstraction Layer)과의 상호작용은 Android Camera Framework를 통해 이루어집니다. 뷰파인더 및 비디오 모듈은 각각 프리뷰 스트림과 비디오 녹화 스트림을 처리하는 핵심 구성 요소입니다.

**Camera HAL 관점 해석**

이번 CameraX 업데이트는 HAL이 지원해야 하는 스트림 조합, 버퍼 할당 방식, 그리고 비디오 인코더와의 인터페이스에 잠재적인 영향을 미칩니다. 특히, 새로운 뷰파인더 버전은 프리뷰 스트림의 Surface 생성 및 관리에 변화를 가져올 수 있으며, 이는 HAL의 `configure_streams` 호출 및 버퍼 큐 동작에 영향을 미칠 수 있습니다. 비디오 모듈의 변경은 `RECORD` 스트림 사용 시 HAL의 성능, 전력 소모, 그리고 `onCaptureOutput` 콜백 타이밍에 영향을 줄 수 있으므로, 해당 시나리오에서의 안정성 및 성능 검증이 필요합니다.

**우리 팀이 확인할 Action Item**

- Camera HAL 팀은 CameraX 1.4.0-alpha07 및 1.7.0-alpha01을 포함하는 테스트 빌드를 확보하고, Preview + VideoCapture + ImageCapture 스트림 조합에서 CTS/VTS/Camera ITS 테스트를 실행하여 회귀 여부를 확인합니다. (담당: HAL QA, 기한: 2주)
- 특정 디바이스 클래스(예: 고성능 플래그십, 저사양 엔트리)에서 CameraX 뷰파인더 및 비디오 녹화 시나리오의 버퍼 큐 상태, 프레임 드롭 수, 캡처 지연 시간을 모니터링하는 로그를 추가하고 분석합니다. (담당: HAL 개발, 기한: 2주)
- CameraX 릴리스 노트를 기반으로 `android.hardware.camera2` API 또는 HAL 인터페이스에 영향을 줄 수 있는 변경 사항을 식별하고, 해당 HAL 기능의 동작을 검토합니다. (담당: HAL 아키텍트, 기한: 1주)

**팀 공유용 한 줄**

CameraX의 뷰파인더 및 비디오 모듈 업데이트는 HAL의 스트림 처리 및 버퍼 관리에 영향을 미칠 수 있으므로, 호환성 및 성능 회귀 테스트가 필수적입니다.

**출처**

- [1.4.0-alpha07](https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07)

---

## 3. Camera Driver / Image Pipeline

### libcamera Release Announcements - libcamera v0.7.1


**이번 주 확인한 사실**

- libcamera Release Announcements의 2026-04-28 항목입니다.
- 관련 컴포넌트: libcamera / V4L2 camera pipeline
- Released libcamera v0.7.1 with SoftISP debayering and image pipeline throughput, pipeline handler camera support, sensor mode configuration updates.

**배경지식**

Released libcamera v0.7.1 with SoftISP debayering and image pipeline throughput, pipeline handler camera support, sensor mode configuration updates.

**Camera HAL 관점 해석**

HAL/카메라 스택 영향 가능성을 검토합니다. Camera HAL 팀은 이 항목을 source/API/driver/image pipeline 영향 검토 목록에 올리고 실제 코드 변경이나 CTS/VTS 영향이 확인될 때만 후속 작업으로 승격합니다.

**우리 팀이 확인할 Action Item**

- Source URL과 published date를 확인해 내부 추적 항목으로 등록할지 판단합니다.
- 관련 camera stack owner가 API/driver/image pipeline 영향 여부를 확인합니다.
- 후속 릴리스 노트나 upstream 변경이 나오면 다음 뉴스레터에서 재평가합니다.

**팀 공유용 한 줄**

libcamera Release Announcements - libcamera v0.7.1은 Camera HAL / Android Camera / driver-image pipeline 관점에서 확인할 가치가 있는 후보입니다.

**출처**

- [libcamera Release Announcements - libcamera v0.7.1](https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html)

---

## 4. Android Platform / CameraX

### CameraX 1.6.1 업데이트: Android Camera 호환성 관찰


**이번 주 확인한 사실**

- Android Developers Latest Updates의 May 06, 2026 항목입니다.
- 관련 컴포넌트: CameraX / androidx.camera
- camera-camera2 1.6.1 - - 1.7.0-alpha01 camera-core 1.6.1 - - 1.7.0-alpha01 camera-compose 1.6.1 - - 1.7.0-alpha01 camera-effects 1.6.1 - - 1.7.0-alpha01 camera-extensions 1.6.1 - - 1.7.0-alpha01 camera-feature-combination-query - - - 1.5.0-alpha06 camera-feature-combination-query-play-services - - - 1.5.0-alpha06 camera-lifecycle 1.6.1 - - 1.7.0-alpha01 camera-mlkit-vision 1.6.1 - - 1.7.0-alpha01 camera-view 1.6.1 - - 1.7.0-alpha01 camera-viewfinder - - 1.3.0-beta02 1.4.0-alpha07 camera-video 1.6.1 - - 1.7.0-alpha01 This library was last updated on: May 06, 2026 View the Camera Library Close Wear Maven Group versions This table lists all the artifacts in the androidx.wear group.

**배경지식**

camera-camera2 1.6.1 - - 1.7.0-alpha01 camera-core 1.6.1 - - 1.7.0-alpha01 camera-compose 1.6.1 - - 1.7.0-alpha01 camera-effects 1.6.1 - - 1.7.0-alpha01 camera-extensions 1.6.1 - - 1.7.0-alpha01 camera-feature-combination-query - - - 1.5.0-alpha06 camera-feature-combination-query-play-services - - - 1.5.0-alpha06 camera-lifecycle 1.6.1 - - 1.7.0-alpha01 camera-mlkit-vision 1.6.1 - - 1.7.0-alpha01 camera-view 1.6.1 - - 1.7.0-alpha01 camera-viewfinder - - 1.3.0-beta02 1.4.0-alpha07 camera-video 1.6.1 - - 1.7.0-alpha01 This library was last updated on: May 06, 2026 View the Camera Library Close Wear Maven Group versions This table lists all the artifacts in the androidx.wear group.

**Camera HAL 관점 해석**

HAL/카메라 스택 영향 가능성을 검토합니다. Camera HAL 팀은 이 항목을 source/API/driver/image pipeline 영향 검토 목록에 올리고 실제 코드 변경이나 CTS/VTS 영향이 확인될 때만 후속 작업으로 승격합니다.

**우리 팀이 확인할 Action Item**

- Source URL과 published date를 확인해 내부 추적 항목으로 등록할지 판단합니다.
- 관련 camera stack owner가 API/driver/image pipeline 영향 여부를 확인합니다.
- 후속 릴리스 노트나 upstream 변경이 나오면 다음 뉴스레터에서 재평가합니다.

**팀 공유용 한 줄**

CameraX 1.6.1 업데이트: Android Camera 호환성 관찰은 Camera HAL / Android Camera / driver-image pipeline 관점에서 확인할 가치가 있는 후보입니다.

**출처**

- [1.6.1](https://developer.android.com/jetpack/androidx/releases/camera#1.6.1)


## 이번 주 실행 항목

- Camera HAL 팀은 CameraX 1.4.0-alpha07 및 1.7.0-alpha01을 포함하는 테스트 빌드를 확보하고, Preview + VideoCapture + ImageCapture 스트림 조합에서 CTS/VTS/Camera ITS 테스트를 실행하여 회귀 여부를 확인합니다. (담당: HAL QA, 기한: 2주)
- HAL 드라이버 팀은 libcamera v0.7.1의 SoftISP 디베이어링 개선 사항이 vendor kernel 드라이버에 반영되었는지 확인하고, RAW 및 YUV 스트림의 이미지 품질 및 처리 지연 시간을 벤치마킹합니다. (담당: 드라이버 개발, 기한: 2주)
- 네이티브 HAL 개발팀은 Clang/LLVM 툴체인의 C++26 지원 현황을 조사하고, 특히 Safety Hardening 기능이 HAL 코드의 메모리 안전성 검사에 어떻게 활용될 수 있는지 PoC를 진행합니다. (담당: 네이티브 개발, 기한: 2주)
- 특정 디바이스 클래스에서 CameraX 뷰파인더 및 비디오 녹화 시나리오의 버퍼 큐 상태, 프레임 드롭 수, 캡처 지연 시간을 모니터링하는 로그를 추가하고 분석합니다. (담당: HAL 개발, 기한: 2주)
- HAL 팀은 libcamera v0.7.1의 센서 모드 구성 업데이트에 따라 HAL의 `camera_info` 및 `stream_configuration_map` 선언이 여전히 유효한지 검토하고, 필요한 경우 센서 모드 선택 로직을 조정합니다. (담당: HAL 개발, 기한: 2주)
- Camera HAL의 핵심 인터페이스에 C++ Contracts 개념을 적용하여, 입력 유효성 검사 및 오류 처리 로직을 개선하는 방안을 검토합니다. (담당: HAL 아키텍트, 기한: 2주)

## 참고자료

- [1.4.0-alpha07](https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07)
- [libcamera Release Announcements - libcamera v0.7.1](https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html)
- [1.6.1](https://developer.android.com/jetpack/androidx/releases/camera#1.6.1)
- [GCC 16.1 released: C++26 reflection / contracts / safety hardening, C++20 by default, and more!](https://isocpp.org//blog/2026/04/gcc-16.1)
