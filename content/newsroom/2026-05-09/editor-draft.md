# AOSP Camera / Driver / SoC Platform 뉴스레터 - 2026-05-09

이번 2026-05-09호는 libcamera v0.7.1 출시, CameraX 1.4.0-alpha07 viewfinder/video 모듈 업데이트, Glaze 7.2 native tooling serialization 동향을 중심으로 구성했습니다. CameraX 항목은 Camera HAL 요구사항 변경 근거가 아니라 app/framework 계층 호환성 관찰 신호로 정리했습니다.

## 1. 이번 주 3줄 브리핑

- libcamera v0.7.1은 SoftISP debaying 및 이미지 파이프라인 처리량 개선을 포함하지만, Android HAL 영향은 downstream vendor camera stack 통합 여부가 확인될 때만 판단하는 upstream driver/image-pipeline review signal입니다.
- CameraX 1.4.0-alpha07은 camera-viewfinder 및 camera-video 모듈 업데이트를 포함하지만, HAL 변경 요구가 아니라 CameraX/Camera2 compatibility matrix 확인 입력입니다.
- Glaze 7.2는 production HAL 변경 요구가 아니라 host-side native tooling 관찰 항목으로만 유지합니다.

## 2. libcamera v0.7.1 출시: SoftISP 및 파이프라인 처리량 개선


![libcamera v0.7.1 출시: SoftISP 및 파이프라인 처리량 개선 image](../../assets/images/fallback/android.svg)

_Image: [libcamera Release Announcements - libcamera v0.7.1](https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html)_


2026년 4월 28일, libcamera v0.7.1이 출시되었습니다. 이 버전에는 SoftISP debaying 및 이미지 파이프라인 처리량 개선, 새로운 파이프라인 핸들러 카메라 지원, 그리고 센서 모드 구성 업데이트가 포함되어 있습니다.

libcamera는 Linux 기반 시스템에서 카메라 하드웨어와의 상호 작용을 표준화하는 오픈 소스 프레임워크입니다. V4L2(Video for Linux Two) 드라이버 위에 추상화 계층을 제공하여 다양한 카메라 센서와 ISP(Image Signal Processor)에 대한 일관된 API를 제공합니다. Android HAL은 종종 V4L2 및 libcamera 기반의 커널 드라이버와 통신하여 카메라 스트림을 관리하고 이미지 데이터를 처리합니다. SoftISP는 하드웨어 ISP가 없거나 제한적인 경우 소프트웨어적으로 이미지 처리(예: debayering)를 수행하는 구성 요소입니다.

libcamera v0.7.1의 SoftISP, pipeline handler, sensor mode updates는 upstream Linux camera stack에서 확인할 driver/image-pipeline signal입니다. 이 source만으로 Android product camera stream, metadata, feature exposure, latency, power behavior change가 확인되지는 않습니다. HAL 팀은 vendor kernel/libcamera fork가 해당 release를 실제로 consume하거나 downstream device regression이 보고된 경우에만 RAW/YUV quality, stream combination, sensor mode log를 기존 compatibility evidence와 함께 검토합니다.

**Camera HAL / Driver 관점**

libcamera v0.7.1의 SoftISP, pipeline handler, sensor mode updates는 upstream Linux camera stack에서 확인할 driver/image-pipeline signal입니다. 이 source만으로 Android product camera stream, metadata, feature exposure, latency, power behavior change가 확인되지는 않습니다. HAL 팀은 vendor kernel/libcamera fork가 해당 release를 실제로 consume하거나 downstream device regression이 보고된 경우에만 RAW/YUV quality, stream combination, sensor mode log를 기존 compatibility evidence와 함께 검토합니다.

### 확인할 점

- vendor kernel/libcamera fork에 v0.7.1 변경이 통합됐다는 evidence가 있을 때만 Preview + Still Capture + Video Recording 조합의 YUV/RAW throughput과 latency를 기존 regression 범위에서 비교합니다.
- SoftISP debaying 평가는 downstream image-quality regression이나 product requirement가 있을 때만 특정 sensor mode에서 수행합니다.
- 새 pipeline handler support는 HAL feature declaration update 근거가 아니라, downstream camera stack이 해당 path를 consume하는지 확인하는 driver review item으로 기록합니다.

**Sources**

- [libcamera Release Announcements - libcamera v0.7.1](https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html)

---

## 3. CameraX 1.4.0-alpha07 출시: viewfinder 및 video 모듈 업데이트


![Android Developers 로고, CameraX 릴리스 노트를 나타냅니다.](https://developer.android.com/static/images/social/android-developers.png?hl=vi)

_Image: [Android Developers Latest Updates](https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07)_


2026년 5월 6일, Android Developers는 CameraX 라이브러리의 1.4.0-alpha07 버전을 출시했습니다. 이 업데이트는 `camera-viewfinder` 모듈을 1.4.0-alpha07로, `camera-video` 모듈을 1.6.1로 업데이트하는 내용을 포함합니다.

CameraX는 Android Jetpack 라이브러리의 일부로, Camera2 위에서 app-facing camera use case를 단순화하는 계층입니다. `camera-viewfinder`와 `camera-video` 업데이트는 앱/프레임워크 계층의 호환성 신호이며, 그 자체가 제품 camera path 변경을 요구한다는 뜻은 아닙니다.

이 CameraX release note는 viewfinder/video artifact version update를 알려주는 app/framework 계층 신호입니다. HAL 팀은 기존 CameraX/Camera2 compatibility matrix에서 Preview/Video scenario 회귀 여부를 확인하고, downstream device log나 product requirement가 있을 때만 별도 follow-up으로 기록합니다.

**Camera HAL / Driver 관점**

이 CameraX release note는 viewfinder/video artifact version update를 알려주는 app/framework 계층 신호입니다. HAL 팀은 기존 CameraX/Camera2 compatibility matrix에서 Preview/Video scenario 회귀 여부를 확인하고, downstream device log나 product requirement가 있을 때만 별도 follow-up으로 기록합니다.

### 확인할 점

- CameraX 1.4.0-alpha07을 쓰는 reference app에서 Preview + Video Recording smoke run을 실행하고, 실패가 있을 때만 기존 CameraX/Camera2 compatibility matrix에 기록합니다. (Owner: HAL 검증 팀)
- 회귀가 보이면 app logcat, framework camera log, HAL/device log를 분리해 원인이 app/library layer인지 downstream HAL issue인지 구분합니다. (Owner: HAL QA)
- release note만으로 Camera stack 요구사항이나 device characteristics 변경 요구를 만들지 않습니다. (Owner: HAL 아키텍트)

**Sources**

- [1.4.0-alpha07](https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07)

---

## 4. Glaze 7.2: native tooling serialization 관찰



It has grown to support many more formats and features, and in v7.2.0 C++26 Reflection support has been merged!

Glaze는 C++ native tooling에서 serialization format 지원을 제공하는 라이브러리입니다. 이 항목은 host-side tooling 관찰 신호로만 다룹니다.

host-side native tooling 관찰 항목으로 둡니다. Camera HAL 팀은 제품 tooling 계획이나 upstream evidence가 확인될 때만 별도 follow-up으로 승격합니다.

**Camera HAL / Driver 관점**

host-side native tooling 관찰 항목으로 둡니다. Camera HAL 팀은 제품 tooling 계획이나 upstream evidence가 확인될 때만 별도 follow-up으로 승격합니다.

### 확인할 점

- 공식 릴리스 날짜와 변경 범위를 확인해 내부 관찰 항목으로 둘지 판단합니다.
- toolchain migration으로 단정하지 말고 관찰 항목으로만 공유합니다.
- 후속 릴리스 노트나 upstream 변경이 나오면 다음 뉴스레터에서 재평가합니다.

**Sources**

- [Glaze 7.2 - C++26 Reflection | YAML, CBOR, MessagePack, TOML and more](https://isocpp.org//blog/2026/04/glaze-7.2-cpp26-reflection-yaml-cbor-messagepack-toml-and-more)


## 참고자료

- [libcamera Release Announcements - libcamera v0.7.1](https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html)
- [1.4.0-alpha07](https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07)
- [Glaze 7.2 - C++26 Reflection | YAML, CBOR, MessagePack, TOML and more](https://isocpp.org//blog/2026/04/glaze-7.2-cpp26-reflection-yaml-cbor-messagepack-toml-and-more)
- [GCC 16.1 released: C++26 reflection / contracts / safety hardening, C++20 by default, and more!](https://isocpp.org//blog/2026/04/gcc-16.1)
