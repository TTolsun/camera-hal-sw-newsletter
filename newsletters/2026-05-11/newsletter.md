# AOSP Camera / Driver / SoC Platform 뉴스레터 - 2026-05-11

이번 2026-05-11호는 CameraX 1.4.0-alpha07 및 1.7.0-alpha01 업데이트, libcamera v0.7.1, CameraX 1.6.1 Android Camera 호환성 관찰을 중심으로 구성했습니다. CameraX 항목은 HAL 변경 근거가 아니라 app/framework 계층 compatibility review input으로 정리했습니다.

## 1. 이번 주 3줄 브리핑
- CameraX 1.4.0-alpha07 및 1.7.0-alpha01은 뷰파인더와 비디오 모듈 업데이트이며, HAL 변경 요구가 아니라 compatibility review input입니다.
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

이 CameraX release note는 app/framework layer의 viewfinder/video artifact update입니다. HAL 팀은 기존 CameraX/Camera2 compatibility matrix에서 회귀 여부만 확인하고 downstream evidence가 있을 때만 별도 follow-up으로 분리합니다.

### 확인할 점

- CameraX 1.4.0-alpha07 및 1.7.0-alpha01을 쓰는 reference app으로 Preview + VideoCapture + ImageCapture smoke run을 실행하고, 실패한 조합만 compatibility matrix에 기록합니다. (Owner: HAL QA)
- 회귀가 있으면 app logcat, framework camera log, HAL/device log를 분리해 downstream HAL evidence 여부를 확인합니다. (Owner: HAL 검증 팀)
- release note만으로 Camera stack 요구사항 변경 요구를 만들지 않습니다. (Owner: HAL 아키텍트)

**팀 공유용 한 줄**

CameraX viewfinder/video 업데이트는 HAL 변경 요구가 아니라 app-facing compatibility signal입니다. HAL 팀은 기존 matrix에서 회귀만 확인하고 downstream evidence가 있을 때만 후속 조치합니다.

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

### 확인할 점

- 공식 릴리스 날짜와 변경 범위를 확인해 내부 관찰 항목으로 둘지 판단합니다.
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
- CameraX release note는 `camera-camera2`, `camera-core`, `camera-view`, `camera-viewfinder`, `camera-video` 등 AndroidX Camera artifacts의 2026년 5월 6일 기준 버전 업데이트를 나열합니다.

**배경지식**

CameraX는 Camera2 위에서 앱 개발자가 preview, image capture, video capture 같은 use case를 다루도록 돕는 AndroidX library layer입니다. Artifact version update는 app/framework compatibility matrix 확인 입력이며, 그 자체가 제품 camera path 변경을 의미하지 않습니다.

**Camera HAL 관점 해석**

이 CameraX release note는 AndroidX Camera artifact version update를 알려주는 app/framework 계층 신호입니다. HAL 팀은 기존 CameraX/Camera2 compatibility matrix에서 회귀 여부만 확인하고 downstream device evidence가 있을 때만 별도 follow-up으로 분리합니다.

### 확인할 점

- CameraX 1.6.1 / 1.7.0-alpha01 artifact update를 현재 product dependency matrix와 비교하고, reference app smoke run이 필요한 조합만 표시합니다. (Owner: Android framework 담당)
- 회귀가 보이면 app logcat, framework camera log, HAL/device log를 분리해 원인이 CameraX/library layer인지 downstream HAL issue인지 구분합니다. (Owner: HAL QA)
- release note만으로 Camera stack 요구사항이나 metadata 동작 변경 요구를 만들지 않습니다. (Owner: HAL 아키텍트)

**팀 공유용 한 줄**

CameraX 1.6.1 업데이트는 Android camera app/framework compatibility signal입니다. HAL 팀은 기존 matrix에서 회귀만 확인하고 downstream evidence가 있을 때만 후속 조치합니다.

**출처**

- [Android Developers Latest Updates](https://developer.android.com/latest-updates)


## 이번 주 실행 항목

- CameraX 1.4.0-alpha07 및 1.7.0-alpha01 reference app smoke run을 기존 compatibility matrix에서만 확인하고, HAL 변경 요구로 등록하지 않습니다. (담당: HAL QA, 기한: 2주)
- HAL 드라이버 팀은 libcamera v0.7.1의 SoftISP 디베이어링 개선 사항이 vendor kernel 드라이버에 반영되었는지 확인하고, RAW 및 YUV 스트림의 이미지 품질 및 처리 지연 시간을 벤치마킹합니다. (담당: 드라이버 개발, 기한: 2주)
- 네이티브 HAL 개발팀은 Clang/LLVM 툴체인의 C++26 지원 현황을 조사하고, 특히 Safety Hardening 기능이 HAL 코드의 메모리 안전성 검사에 어떻게 활용될 수 있는지 PoC를 진행합니다. (담당: 네이티브 개발, 기한: 2주)
- CameraX 회귀가 보이면 app/framework/HAL log를 분리해 downstream evidence가 있는 경우에만 HAL follow-up으로 승격합니다. (담당: HAL QA, 기한: 2주)
- HAL 팀은 libcamera v0.7.1의 센서 모드 구성 업데이트에 따라 HAL의 `camera_info` 및 `stream_configuration_map` 선언이 여전히 유효한지 검토하고, 필요한 경우 센서 모드 선택 로직을 조정합니다. (담당: HAL 개발, 기한: 2주)
- Camera HAL의 핵심 인터페이스에 C++ Contracts 개념을 적용하여, 입력 유효성 검사 및 오류 처리 로직을 개선하는 방안을 검토합니다. (담당: HAL 아키텍트, 기한: 2주)

## 참고자료

- [1.4.0-alpha07](https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07)
- [libcamera Release Announcements - libcamera v0.7.1](https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html)
- [Android Developers Latest Updates](https://developer.android.com/latest-updates)
- [GCC 16.1 released: C++26 reflection / contracts / safety hardening, C++20 by default, and more!](https://isocpp.org//blog/2026/04/gcc-16.1)
