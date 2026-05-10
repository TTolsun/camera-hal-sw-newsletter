# AOSP Camera / Driver / SoC Platform 뉴스레터 - 2026-05-11

이번 2026-05-11호는 CameraX 1.4.0-alpha07 업데이트: Android Camera 호환성 관찰, CameraX 1.6.1 업데이트: Android Camera 호환성 관찰, CameraX 1.3.0-beta02 업데이트: Android Camera 호환성 관찰를 중심으로 구성했습니다. hard failure article 2개는 main article에서 제거하거나 강등했습니다.

## 1. 이번 주 3줄 브리핑
- CameraX 1.4.0-alpha07이 업데이트되어 CameraX 기반 앱의 호환성 및 HAL 동작 검증이 필요합니다.
- hard failure article은 main article에서 제거하거나 강등했습니다.
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

## 3. Android Platform / CameraX

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

---

## 4. Android Platform / CameraX

### CameraX 1.3.0-beta02 업데이트: Android Camera 호환성 관찰


**이번 주 확인한 사실**

- Android Developers Latest Updates의 May 06, 2026 항목입니다.
- 관련 컴포넌트: CameraX / androidx.camera
- 1.7.0-alpha01 camera-view 1.6.1 - - 1.7.0-alpha01 camera-viewfinder - - 1.3.0-beta02 1.4.0-alpha07 camera-video 1.6.1 - - 1.7.0-alpha01 This library was last updated on: May 06, 2026 View the Camera Library Close <h3 class="hide-from-toc no-link" id="wear-mave

**배경지식**

1.7.0-alpha01 camera-view 1.6.1 - - 1.7.0-alpha01 camera-viewfinder - - 1.3.0-beta02 1.4.0-alpha07 camera-video 1.6.1 - - 1.7.0-alpha01 This library was last updated on: May 06, 2026 View the Camera Library Close <h3 class="hide-from-toc no-link" id="wear-mave

**Camera HAL 관점 해석**

HAL/카메라 스택 영향 가능성을 검토합니다. Camera HAL 팀은 이 항목을 source/API/driver/image pipeline 영향 검토 목록에 올리고 실제 코드 변경이나 CTS/VTS 영향이 확인될 때만 후속 작업으로 승격합니다.

**우리 팀이 확인할 Action Item**

- Source URL과 published date를 확인해 내부 추적 항목으로 등록할지 판단합니다.
- 관련 camera stack owner가 API/driver/image pipeline 영향 여부를 확인합니다.
- 후속 릴리스 노트나 upstream 변경이 나오면 다음 뉴스레터에서 재평가합니다.

**팀 공유용 한 줄**

CameraX 1.3.0-beta02 업데이트: Android Camera 호환성 관찰은 Camera HAL / Android Camera / driver-image pipeline 관점에서 확인할 가치가 있는 후보입니다.

**출처**

- [1.3.0-beta02](https://developer.android.com/jetpack/androidx/releases/camera#1.3.0-beta02)


## 이번 주 실행 항목

- Camera HAL 팀은 CameraX 1.4.0-alpha07을 사용하는 내부 테스트 앱을 최신화하고, 모든 지원되는 카메라 ID에 대해 Preview + ImageCapture 스트림 조합에서 캡처 지연 시간과 프레임 드롭을 측정하는 테스트를 2주 이내에 수행합니다.
- Camera HAL 메타데이터 담당자는 CameraX 1.4.0-alpha07 릴리스 노트를 검토하여 새로운 `CaptureRequest` 또는 `CaptureResult` 키가 도입되었는지 확인하고, 필요한 경우 HAL 구현을 업데이트할 계획을 수립합니다.
- HAL 네이티브 코드 소유자는 현재 카메라 HAL 모듈에서 C++20 기능을 활용하여 코드 복잡성을 줄이고 성능을 개선할 수 있는 부분을 2주 이내에 식별하고, 잠재적인 변경 사항 목록을 작성합니다.

## 참고자료

- [1.4.0-alpha07](https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07)
- [1.6.1](https://developer.android.com/jetpack/androidx/releases/camera#1.6.1)
- [1.3.0-beta02](https://developer.android.com/jetpack/androidx/releases/camera#1.3.0-beta02)
- [libcamera Release Announcements - libcamera v0.7.1](https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html)
- [GCC 16.1 released: C++26 reflection / contracts / safety hardening, C++20 by default, and more!](https://isocpp.org//blog/2026/04/gcc-16.1)
