# AOSP Camera / Driver / SoC Platform 뉴스레터 - 2026-05-11

이번 2026-05-11호는 CameraX 1.4.0-alpha07 및 1.7.0-alpha01 업데이트, libcamera v0.7.1, CameraX 1.6.1 Android Camera 호환성 관찰을 중심으로 구성했습니다. CameraX 항목은 HAL 변경 근거가 아니라 app/framework 계층 compatibility review input으로 정리했습니다.



## 1. 이번 주 3줄 브리핑

- CameraX 1.4.0-alpha07 및 1.7.0-alpha01은 뷰파인더와 비디오 모듈 업데이트이며, HAL 변경 요구가 아니라 compatibility review input입니다.
- libcamera v0.7.1이 SoftISP 디베이어링 및 센서 모드 구성 개선과 함께 출시되어, Linux 카메라 드라이버 스택의 이미지 처리 및 센서 제어 방식에 변화를 가져옵니다.
- CameraX 1.6.1은 Android camera app/framework compatibility matrix에서 확인할 adjacent signal입니다.

## 2. CameraX 1.4.0-alpha07 및 1.7.0-alpha01 업데이트: 뷰파인더 및 비디오 모듈 변경


![Android Developers 로고](https://developer.android.com/static/images/social/android-developers.png)

_이미지: [Android Developers Latest Updates](https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07)_


2026년 5월 6일 CameraX release note는 viewfinder 및 video artifacts의 version update를 나열했습니다.

CameraX는 Android Jetpack의 일부로, 카메라 앱 개발을 간소화하는 라이브러리입니다. CameraX는 Camera2 API 위에 구축되어 있으며, HAL(Hardware Abstraction Layer)과의 상호작용은 Android Camera Framework를 통해 이루어집니다. 뷰파인더 및 비디오 모듈은 각각 프리뷰 스트림과 비디오 녹화 스트림을 처리하는 핵심 구성 요소입니다.

이 CameraX release note는 app/framework layer의 viewfinder/video artifact update입니다. HAL 팀은 기존 CameraX/Camera2 compatibility matrix에서 회귀 여부만 확인하고 downstream evidence가 있을 때만 별도 follow-up으로 분리합니다.

**Camera HAL / Driver 관점**

이 CameraX release note는 app/framework layer의 viewfinder/video artifact update입니다. HAL 팀은 기존 CameraX/Camera2 compatibility matrix에서 회귀 여부만 확인하고 downstream evidence가 있을 때만 별도 follow-up으로 분리합니다.

### 확인할 점

- CameraX 1.4.0-alpha07 및 1.7.0-alpha01을 쓰는 reference app으로 Preview + VideoCapture + ImageCapture smoke run을 실행하고, 실패한 조합만 compatibility matrix에 기록합니다. (Owner: HAL QA)
- 회귀가 보이면 app logcat, framework camera log, HAL/device log를 분리해 원인이 app/library layer인지 downstream HAL issue인지 구분합니다. (Owner: HAL QA)
- release note만으로 Camera stack 요구사항 변경 요구를 만들지 않습니다. (Owner: HAL 아키텍트)

**출처**

- [1.4.0-alpha07](https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07)

---

## 3. libcamera Release Announcements - libcamera v0.7.1



Released libcamera v0.7.1 with SoftISP debayering and image pipeline throughput, pipeline handler camera support, sensor mode configuration updates.

libcamera는 Linux camera stack에서 V4L2 기반 driver/image pipeline 동작을 추적하는 upstream project입니다. 이 항목은 upstream release note를 제품 driver/image-pipeline review input으로 정리합니다.

HAL 팀은 libcamera release note를 driver/image pipeline review input으로 보고, vendor kernel 또는 product integration evidence가 있을 때만 별도 follow-up으로 승격합니다.

**Camera HAL / Driver 관점**

HAL 팀은 libcamera release note를 driver/image pipeline review input으로 보고, vendor kernel 또는 product integration evidence가 있을 때만 별도 follow-up으로 승격합니다.

### 확인할 점

- 공식 릴리스 날짜와 변경 범위를 확인해 내부 관찰 항목으로 둘지 판단합니다.
- 관련 camera stack owner가 API/driver/image pipeline 영향 여부를 확인합니다.
- 후속 릴리스 노트나 upstream 변경이 나오면 다음 뉴스레터에서 재평가합니다.

**출처**

- [libcamera Release Announcements - libcamera v0.7.1](https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html)

---

## 4. CameraX 1.6.1 업데이트: Android Camera 호환성 관찰


![CameraX 1.6.1 업데이트: Android Camera 호환성 관찰](https://developer.android.com/static/images/social/android-developers.png?hl=es-419)

_이미지: [Android Developers Latest Updates](https://developer.android.com/jetpack/androidx/releases/camera#1.6.1)_


CameraX 1.6.1 / 1.7.0-alpha01 artifact rows were updated in the AndroidX Camera release notes dated May 06, 2026.

CameraX는 Camera2 위에서 앱 개발자가 preview, image capture, video capture 같은 use case를 다루도록 돕는 AndroidX library layer입니다. Artifact version update는 app/framework compatibility matrix 확인 입력이며, 그 자체가 제품 camera path 변경을 의미하지 않습니다.

이 CameraX release note는 AndroidX Camera artifact version update를 알려주는 app/framework 계층 신호입니다. HAL 팀은 기존 CameraX/Camera2 compatibility matrix에서 회귀 여부만 확인하고 downstream device evidence가 있을 때만 별도 follow-up으로 분리합니다.

**Camera HAL / Driver 관점**

이 CameraX release note는 AndroidX Camera artifact version update를 알려주는 app/framework 계층 신호입니다. HAL 팀은 기존 CameraX/Camera2 compatibility matrix에서 회귀 여부만 확인하고 downstream device evidence가 있을 때만 별도 follow-up으로 분리합니다.

### 확인할 점

- CameraX 1.6.1 / 1.7.0-alpha01 artifact update를 현재 product dependency matrix와 비교하고, reference app smoke run이 필요한 조합만 표시합니다. (Owner: Android framework 담당)
- 회귀가 보이면 app logcat, framework camera log, HAL/device log를 분리해 원인이 CameraX/library layer인지 downstream HAL issue인지 구분합니다. (Owner: HAL QA)
- release note만으로 Camera stack 요구사항이나 metadata 동작 변경 요구를 만들지 않습니다. (Owner: HAL 아키텍트)

**출처**

- [Android Developers Latest Updates](https://developer.android.com/latest-updates)


## 참고자료

- [1.4.0-alpha07](https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07)
- [libcamera Release Announcements - libcamera v0.7.1](https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html)
- [1.6.1](https://developer.android.com/jetpack/androidx/releases/camera#1.6.1)
- [GCC 16.1 released: C++26 reflection / contracts / safety hardening, C++20 by default, and more!](https://isocpp.org//blog/2026/04/gcc-16.1)
