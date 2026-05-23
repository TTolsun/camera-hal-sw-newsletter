# AOSP Camera / Driver / SoC Platform 뉴스레터 - 2026-05-23

이번 2026-05-23호는 Camera HAL / Driver / Native tooling 독자가 확인할 만한 세 가지 항목을 정리했습니다: Jetpack Compose와 CameraX: 다양한 화면 크기의 camera preview 확인 포인트, Google AI Studio native Android 앱 생성: Camera API 사용 범위 확인.


> 검토 발행본입니다.
> 각 기사는 공개 source 범위 안에서 해석하며 Camera HAL 직접 변경으로 과장하지 않습니다.


## 1. 이번 주 3줄 브리핑

- Google은 여러 화면 크기와 입력 방식에서 Android 앱 경험을 맞추기 위해 Jetpack Compose, Navigation 3, Grid/FlexBox layout, non-touch input 지원, 그리고 CameraX preview 대응을 함께 언급했습니다.
- Google AI Studio의 native Android 앱 생성 흐름은 Camera, GPS/Location, Accelerometer, Bluetooth 같은 native Android API 접근을 예로 들며 hardware-enabled app 구성을 설명했습니다.
- 직접 HAL 변경 근거가 없는 항목은 참고 동향으로만 공유합니다.

## 2. Jetpack Compose와 CameraX: 다양한 화면 크기의 camera preview 확인 포인트


![Jetpack Compose와 CameraX: 다양한 화면 크기의 camera preview 확인 포인트](https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhdDsacfyGtp3onpFDB8MfwDNaY70RiTJpN0e_M0NK9W7au1Ex8ghyphenhyphenGNrIq0sqqc1eb-g2fUPUYL1sS7Fhk5r7GTDZm3p-3gRDulDyPa0RqLcDXk6uV3TjBpLMDU5RMnvySqazjwL-8dKrrjkfqkgM_ODlmZVgGNnX5e067nNgWL146AHbsejj6KtLrtIs/s2048/GoogleForDevelopers-ComboIO-StrapiMetacard-2048x1323%20(1).png)

_이미지: [Android Developers Blog](https://goo.gle/AdaptiveApps_IO26)_


Google은 여러 화면 크기와 입력 방식에서 Android 앱 경험을 맞추기 위해 Jetpack Compose, Navigation 3, Grid/FlexBox layout, non-touch input 지원, 그리고 CameraX preview 대응을 함께 언급했습니다.

Google Android Developers Blog는 여러 기기와 화면 크기에서 Jetpack Compose를 중심으로 Android UX를 맞추는 흐름을 설명하면서, window size에 맞는 camera preview를 위해 CameraX를 함께 언급했습니다.

이 내용은 HAL API 변경 고지가 아니라 app/framework layer validation signal입니다. Camera HAL / Driver 팀은 preview aspect ratio, rotation, stream configuration, Surface 연결에서 회귀 테스트 범위를 잡는 참고로 쓰면 됩니다.

**Camera HAL / Driver 관점**

8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O은 앱/API 또는 media output path 관점의 신호입니다. HAL/driver 변경 근거는 없음으로 제한하고 CameraX/Camera2 compatibility와 stream configuration 회귀만 확인합니다.

### 확인할 점

- 8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O의 release note 범위에서 CameraX / Android camera APIs 관련 API/component/date가 현재 device matrix와 맞는지 확인합니다.
- HAL/driver 변경 근거는 없음으로 제한하고 CameraX / Android camera APIs compatibility test scenario 또는 stream/metadata 확인 항목만 추적합니다.

**출처**

- [8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O](https://goo.gle/AdaptiveApps_IO26)

---

## 3. Google AI Studio native Android 앱 생성: Camera API 사용 범위 확인


![Google AI Studio native Android 앱 생성: Camera API 사용 범위 확인](https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjd6QUmqCnkvDT9M0IoWA6y_752MRk01nHVQOa644yYkgoMGMDk8Dy6ow6X4SqFzzODP-a1kRaNcuF-1ZyR_lk5fTfdbuEMKDvuX4s7LFaGNuMswzvMCFoYeaQ3RLf2OZPYUWN5BsnqRIsmDub85hpYZNGY7AsaHCsHlfkxLqfqm0PozMhkyqK4i6WfgGM/s2048/GoogleForDevelopers-AndroidCombo2-StrapiMetacard-2048x1323.png)

_이미지: [Android Developers Blog](https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html)_


Google AI Studio의 native Android 앱 생성 흐름은 Camera, GPS/Location, Accelerometer, Bluetooth 같은 native Android API 접근을 예로 들며 hardware-enabled app 구성을 설명했습니다.

Google AI Studio의 native Android 앱 생성 흐름은 Camera, GPS/Location, Accelerometer, Bluetooth 같은 native Android APIs를 사용할 수 있다는 점을 예로 듭니다.

Camera HAL runtime 변경 근거는 아니지만, AI Studio로 만든 sample이나 prototype이 실제 Camera API를 호출할 수 있으므로 preview/capture path, permission, device feature 의존성을 검토할 때 참고할 만합니다.

**Android Native / Tooling 관점**

Build native Android apps in Google AI Studio은 native tooling workflow 참고 항목입니다. production HAL runtime behavior 변경이 아니라 build/test/debug metric 확인 범위로 제한합니다.

### 확인할 점

- Build native Android apps in Google AI Studio의 release note 범위에서 Google AI Studio 관련 API/component/date가 현재 device matrix와 맞는지 확인합니다.
- HAL/driver 변경 근거는 없음으로 제한하고 Google AI Studio compatibility test scenario 또는 stream/metadata 확인 항목만 추적합니다.

**출처**

- [Build native Android apps in Google AI Studio](https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html)


## 참고자료

- [8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O](https://goo.gle/AdaptiveApps_IO26)
- [Build native Android apps in Google AI Studio](https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html)
