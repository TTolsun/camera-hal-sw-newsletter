# AOSP Camera / Driver / SoC Platform 뉴스레터 - 2026-05-21

이번 2026-05-21호는 Camera HAL / Driver / Native tooling 독자가 확인할 만한 세 가지 항목을 정리했습니다: Jetpack Compose와 CameraX: 다양한 화면 크기의 camera preview 확인 포인트, libcamera v0.7.1 릴리스: SoftISP와 센서 모드 설정 업데이트, Google AI Studio native Android 앱 생성: Camera API 사용 범위 확인.


> 편집자 검토 후 공개 가능한 검토 발행본입니다.
> 이 호는 자동 정상 발행 기준을 통과하지 못했으며, 편집자 확인 후 merge해야 합니다.
> 각 기사는 공개 source 범위 안에서 해석하며 Camera HAL 직접 변경으로 과장하지 않습니다.


## 1. 이번 주 3줄 브리핑

- Google은 여러 화면 크기와 입력 방식에서 Android 앱 경험을 맞추기 위해 Jetpack Compose, Navigation 3, Grid/FlexBox layout, non-touch input 지원, 그리고 CameraX preview 대응을 함께 언급했습니다.
- libcamera v0.7.1은 SoftISP debayering, image pipeline throughput, pipeline handler camera support, sensor mode configuration 관련 업데이트를 포함합니다.
- Google AI Studio의 native Android 앱 생성 흐름은 Camera, GPS/Location, Accelerometer, Bluetooth 같은 native Android API 접근을 예로 들며 hardware-enabled app 구성을 설명했습니다.

## 2. Jetpack Compose와 CameraX: 다양한 화면 크기의 camera preview 확인 포인트


![Jetpack Compose와 CameraX: 다양한 화면 크기의 camera preview 확인 포인트](https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhdDsacfyGtp3onpFDB8MfwDNaY70RiTJpN0e_M0NK9W7au1Ex8ghyphenhyphenGNrIq0sqqc1eb-g2fUPUYL1sS7Fhk5r7GTDZm3p-3gRDulDyPa0RqLcDXk6uV3TjBpLMDU5RMnvySqazjwL-8dKrrjkfqkgM_ODlmZVgGNnX5e067nNgWL146AHbsejj6KtLrtIs/s2048/GoogleForDevelopers-ComboIO-StrapiMetacard-2048x1323%20(1).png)

_이미지: [Android Developers Blog](https://goo.gle/AdaptiveApps_IO26)_


Google은 여러 화면 크기와 입력 방식에서 Android 앱 경험을 맞추기 위해 Jetpack Compose, Navigation 3, Grid/FlexBox layout, non-touch input 지원, 그리고 CameraX preview 대응을 함께 언급했습니다.

Google Android Developers Blog는 여러 기기와 화면 크기에서 Jetpack Compose를 중심으로 Android UX를 맞추는 흐름을 설명하면서, window size에 맞는 camera preview를 위해 CameraX를 함께 언급했습니다.

이 내용은 HAL API 변경 고지가 아니라 app/framework layer validation signal입니다. Camera HAL / Driver 팀은 preview aspect ratio, rotation, stream configuration, Surface 연결에서 회귀 테스트 범위를 잡는 참고로 쓰면 됩니다.

**Camera HAL / Driver 관점**

Linked source가 직접 뒷받침하는 범위에서만 HAL API, metadata, request/result, stream, buffer contract 항목으로 다룹니다.

### 확인할 점

- 즉시 조치할 항목은 없습니다. 참고 동향으로만 공유합니다.

**출처**

- [8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O](https://goo.gle/AdaptiveApps_IO26)

---

## 3. libcamera v0.7.1 릴리스: SoftISP와 센서 모드 설정 업데이트



libcamera v0.7.1은 SoftISP debayering, image pipeline throughput, pipeline handler camera support, sensor mode configuration 관련 업데이트를 포함합니다.

libcamera v0.7.1이 공개되었습니다. 이번 릴리스에는 SoftISP debayering, image pipeline throughput, pipeline handler camera support, sensor mode configuration 관련 업데이트가 포함되었습니다.

Android Camera HAL API 변경으로 직접 해석할 근거는 없습니다. 다만 V4L2 기반 camera pipeline, sensor mode 선택, format negotiation, frame timing 검증 관점에서는 참고할 만한 upstream signal입니다.

**Camera HAL / Driver 관점**

Android HAL contract 변경으로 단정하지 말고 driver, sensor, ISP, image pipeline, frame timing, integration validation을 위한 camera stack input으로 검토합니다.

### 확인할 점

- sensor mode selection 관련 내부 이슈와 연결 가능한지 확인합니다.
- frame timing / format negotiation regression test 필요 여부를 검토합니다.
- downstream Android HAL 영향은 별도 evidence가 있을 때만 판단합니다.

**출처**

- [libcamera Release Announcements - libcamera v0.7.1](https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html)

---

## 4. Google AI Studio native Android 앱 생성: Camera API 사용 범위 확인


![Google AI Studio native Android 앱 생성: Camera API 사용 범위 확인](https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjd6QUmqCnkvDT9M0IoWA6y_752MRk01nHVQOa644yYkgoMGMDk8Dy6ow6X4SqFzzODP-a1kRaNcuF-1ZyR_lk5fTfdbuEMKDvuX4s7LFaGNuMswzvMCFoYeaQ3RLf2OZPYUWN5BsnqRIsmDub85hpYZNGY7AsaHCsHlfkxLqfqm0PozMhkyqK4i6WfgGM/s2048/GoogleForDevelopers-AndroidCombo2-StrapiMetacard-2048x1323.png)

_이미지: [Android Developers Blog](https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html#roundup-child-3-start-building-today)_


Google AI Studio의 native Android 앱 생성 흐름은 Camera, GPS/Location, Accelerometer, Bluetooth 같은 native Android API 접근을 예로 들며 hardware-enabled app 구성을 설명했습니다.

Google AI Studio의 native Android 앱 생성 흐름은 Camera, GPS/Location, Accelerometer, Bluetooth 같은 native Android APIs를 사용할 수 있다는 점을 예로 듭니다.

Camera HAL runtime 변경 근거는 아니지만, AI Studio로 만든 sample이나 prototype이 실제 Camera API를 호출할 수 있으므로 preview/capture path, permission, device feature 의존성을 검토할 때 참고할 만합니다.

**Camera HAL / Driver 관점**

CameraX 또는 Camera2 usage pattern, compatibility assumption, app-facing behavior를 검증해 HAL boundary 위 계층의 문제 신호로 활용합니다.

### 확인할 점

- 즉시 조치할 항목은 없습니다. 참고 동향으로만 공유합니다.

**출처**

- [Start building today - Build native Android apps in Google AI Studio](https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html#roundup-child-3-start-building-today)


## 참고자료

- [8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O](https://goo.gle/AdaptiveApps_IO26)
- [libcamera Release Announcements - libcamera v0.7.1](https://lists.libcamera.org/pipermail/libcamera-devel/2026-April/058408.html)
- [Start building today - Build native Android apps in Google AI Studio](https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html#roundup-child-3-start-building-today)
