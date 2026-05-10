# AOSP Camera / Driver / SoC Platform 뉴스레터 - 2026-05-10

이번 2026-05-10호는 CameraX 1.4.0-alpha07 업데이트: Android Camera 호환성 관찰, libcamera Release Announcements - libcamera v0.7.1, CameraX 1.6.1 업데이트: Android Camera 호환성 관찰를 중심으로 구성했습니다. hard failure article 1개는 main article에서 제거하거나 강등했습니다.

## 1. 이번 주 3줄 브리핑
- CameraX 1.4.0-alpha07이 릴리스되어 camera-viewfinder 및 camera-video 라이브러리가 업데이트되었습니다. HAL 팀은 관련 스트림 구성 및 성능을 검토해야 합니다.
- libcamera v0.7.1이 SoftISP 디베이어링, 이미지 파이프라인 처리량 개선, 센서 모드 구성 업데이트와 함께 릴리스되었습니다. Linux 카메라 드라이버 및 V4L2 스택에 직접적인 영향을 미칩니다.
- 편집장은 source와 article 표현을 최종 확인합니다.

## 2. Android Platform / CameraX

### CameraX 1.4.0-alpha07 업데이트: Android Camera 호환성 관찰


**이번 주 확인한 사실**

- Android Developers Latest Updates의 May 06, 2026 항목입니다.
- 관련 컴포넌트: CameraX / androidx.camera
- > camera-view 1.6.1 - - 1.7.0-alpha01 camera-viewfinder - - 1.3.0-beta02 1.4.0-alpha07 camera-video 1.6.1 - - 1.7.0-alpha01 This library was last updated on: May 06, 2026 View the Camera Library Close Wear Maven Group vers

**배경지식**

> camera-view 1.6.1 - - 1.7.0-alpha01 camera-viewfinder - - 1.3.0-beta02 1.4.0-alpha07 camera-video 1.6.1 - - 1.7.0-alpha01 This library was last updated on: May 06, 2026 View the Camera Library Close Wear Maven Group vers

**Camera HAL 관점 해석**

HAL/카메라 스택 영향 가능성을 검토합니다. Camera HAL 팀은 이 항목을 source/API/driver/image pipeline 영향 검토 목록에 올리고 실제 코드 변경이나 CTS/VTS 영향이 확인될 때만 후속 작업으로 승격합니다.

**우리 팀이 확인할 Action Item**

- Source URL과 published date를 확인해 내부 추적 항목으로 등록할지 판단합니다.
- 관련 camera stack owner가 API/driver/image pipeline 영향 여부를 확인합니다.
- 후속 릴리스 노트나 upstream 변경이 나오면 다음 뉴스레터에서 재평가합니다.

**팀 공유용 한 줄**

CameraX 1.4.0-alpha07 업데이트: Android Camera 호환성 관찰은 Camera HAL / Android Camera / driver-image pipeline 관점에서 확인할 가치가 있는 후보입니다.

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

- CameraX 1.4.0-alpha07을 사용하는 레퍼런스 앱에서 Preview + VideoCapture + ImageCapture 스트림 조합의 프레임 드롭 및 캡처 지연 시간을 측정합니다. (담당: Camera HAL 성능 팀)
- libcamera v0.7.1이 적용된 최신 Linux 커널 드라이버를 포팅하고, Preview 및 RAW 스트림을 사용하여 이미지 품질 및 처리량 벤치마크를 수행합니다. (담당: 카메라 드라이버 팀)
- Clang/LLVM의 C++26 컨트랙트 지원 현황을 조사하고, 해당 기능이 안정화되면 Camera HAL의 핵심 모듈에 컨트랙트를 적용하는 PoC를 수행하여 런타임 안전성 개선 효과를 측정합니다. (담당: 네이티브 HAL 개발 팀)
- 업데이트된 `camera-viewfinder` 및 `camera-video` 라이브러리가 요구하는 최소/최대 해상도 및 프레임 속도 범위가 HAL의 `STREAM_CONFIGURATION_MAP`과 일치하는지 확인합니다. (담당: Camera HAL 드라이버 팀)
- SoftISP 디베이어링 개선 사항이 HAL의 `ANDROID_COLOR_CORRECTION_MODE` 및 `ANDROID_TONEMAP_MODE` 설정에 미치는 영향을 분석하고, 필요한 경우 ISP 튜닝 파라미터를 조정합니다. (담당: ISP 튜닝 팀)

## 참고자료

- [1.4.0-alpha07](https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07)
- [libcamera Release Announcements - libcamera v0.7.1](https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html)
- [1.6.1](https://developer.android.com/jetpack/androidx/releases/camera#1.6.1)
- [GCC 16.1 released: C++26 reflection / contracts / safety hardening, C++20 by default, and more!](https://isocpp.org//blog/2026/04/gcc-16.1)
