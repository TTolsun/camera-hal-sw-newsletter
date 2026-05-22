# AOSP Camera / Driver / SoC Platform 뉴스레터 - 2026-05-22

이번 2026-05-22호는 2개 기사(8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O, Android Native Tooling: Build native Android apps in Google AI Studio)를 Camera HAL / Android camera 개발자가 확인할 변경 범위와 확인 포인트 중심으로 정리했습니다.


> 검토 발행본입니다.
> 각 기사는 공개 source 범위 안에서 해석하며 Camera HAL 직접 변경으로 과장하지 않습니다.


## 1. 이번 주 3줄 브리핑

- Google I/O Android 개발자 정리는 Jetpack Compose, Navigation 3, adaptive layout, non-touch input, CameraX preview across window sizes를 함께 다룹니다. Camera HAL 팀에는 앱 계층 preview UX가 다양한 화면 크기에서 HAL stream 품질을 어떻게 드러내는지 확인할 신호입니다.
- Google AI Studio의 native Android app 생성 기능은 prompt에서 Android app skeleton을 만들고 native API로 Camera 같은 device feature를 사용할 수 있게 하는 개발 도구 흐름입니다. Camera HAL 팀에는 제품 HAL 변화가 아니라 app prototype과 hardware API 사용 패턴을 검토할 tooling 신호입니다.
- 첫 번째 기사는 foldable/tablet/windowed mode에서 CameraX Preview crop, aspect ratio, rotation 문제가 재현되는지 reference app으로 확인하는 것, 두 번째 기사는 AI Studio가 생성한 camera sample이 있다면 permission, lifecycle, CameraX/Camera2 API 사용을 먼저 review하는 것부터 보면 실제 적용 범위를 판단하기 쉽습니다.

## 2. 8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O


![Jetpack Compose와 CameraX: 다양한 화면 크기의 camera preview 확인 포인트](https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhdDsacfyGtp3onpFDB8MfwDNaY70RiTJpN0e_M0NK9W7au1Ex8ghyphenhyphenGNrIq0sqqc1eb-g2fUPUYL1sS7Fhk5r7GTDZm3p-3gRDulDyPa0RqLcDXk6uV3TjBpLMDU5RMnvySqazjwL-8dKrrjkfqkgM_ODlmZVgGNnX5e067nNgWL146AHbsejj6KtLrtIs/s2048/GoogleForDevelopers-ComboIO-StrapiMetacard-2048x1323%20(1).png)

_이미지: [Android Developers Blog](https://goo.gle/AdaptiveApps_IO26)_


Google I/O Android 개발자 정리는 Jetpack Compose, Navigation 3, adaptive layout, non-touch input, CameraX preview across window sizes를 함께 다룹니다. Camera HAL 팀에는 앱 계층 preview UX가 다양한 화면 크기에서 HAL stream 품질을 어떻게 드러내는지 확인할 신호입니다.

Compose 자체는 Camera HAL contract를 바꾸지 않습니다. 다만 CameraX preview가 foldable, tablet, desktop-like window, external display 같은 환경에서 표시될 때 crop, aspect ratio, rotation, frame pacing 문제가 사용자에게 바로 보일 수 있습니다.

HAL owner가 볼 부분은 UI framework 기능이 아니라 downstream 증상입니다. CameraX/Camera2 log, preview surface size, stream combination, frame drop evidence가 있을 때만 HAL regression 또는 device-specific tuning으로 분리해야 합니다.

**Camera HAL / Driver 관점**

이 소식은 app/UI layer 업데이트지만 CameraX preview 품질을 다양한 form factor에서 점검하게 만드는 신호입니다. HAL 팀은 UI 변경 자체보다 stream size, rotation, frame pacing evidence가 있는지 확인해야 합니다.

### 확인할 점

- foldable/tablet/windowed mode에서 CameraX Preview crop, aspect ratio, rotation 문제가 재현되는지 reference app으로 확인합니다.
- 문제가 있으면 app layout log, CameraX/Camera2 log, HAL/device log를 분리해 원인을 나눕니다.
- stream/buffer/metadata 변경 요구는 device log와 reproducible stream combination이 있을 때만 엽니다.

**출처**

- [8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O](https://goo.gle/AdaptiveApps_IO26)

---

## 3. Android Native Tooling: Build native Android apps in Google AI Studio


![Google AI Studio native Android 앱 생성: Camera API 사용 범위 확인](https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjd6QUmqCnkvDT9M0IoWA6y_752MRk01nHVQOa644yYkgoMGMDk8Dy6ow6X4SqFzzODP-a1kRaNcuF-1ZyR_lk5fTfdbuEMKDvuX4s7LFaGNuMswzvMCFoYeaQ3RLf2OZPYUWN5BsnqRIsmDub85hpYZNGY7AsaHCsHlfkxLqfqm0PozMhkyqK4i6WfgGM/s2048/GoogleForDevelopers-AndroidCombo2-StrapiMetacard-2048x1323.png)

_이미지: [Android Developers Blog](https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html)_


Google AI Studio의 native Android app 생성 기능은 prompt에서 Android app skeleton을 만들고 native API로 Camera 같은 device feature를 사용할 수 있게 하는 개발 도구 흐름입니다. Camera HAL 팀에는 제품 HAL 변화가 아니라 app prototype과 hardware API 사용 패턴을 검토할 tooling 신호입니다.

AI Studio가 camera API를 쓰는 sample app을 빠르게 만들 수 있다면 app team은 prototype 속도를 얻을 수 있습니다. 하지만 생성된 app이 CameraX/Camera2 권한, lifecycle, preview/capture flow를 올바르게 쓰는지는 별도 검토가 필요하며, 생성 코드의 문제를 HAL regression으로 오인하면 안 됩니다.

HAL 팀이 관여할 지점은 AI-generated app이 실제 device에서 camera path 문제를 재현할 때입니다. 이때도 먼저 app code, CameraX/Camera2 usage, permission/lifecycle, framework log를 확인하고 device HAL log 근거가 있을 때만 HAL issue로 올려야 합니다.

**Android Native / Tooling 관점**

Google AI Studio native Android app 생성은 app prototype tooling입니다. Camera HAL 팀은 생성 코드가 CameraX/Camera2를 어떻게 쓰는지 확인하고, device-level evidence가 있을 때만 HAL follow-up으로 연결해야 합니다.

### 확인할 점

- AI Studio가 생성한 camera sample이 있다면 permission, lifecycle, CameraX/Camera2 API 사용을 먼저 review합니다.
- device 재현 문제가 있으면 app logcat, framework camera log, HAL/device log를 분리해 원인을 기록합니다.
- 생성 코드의 API 사용 오류를 HAL runtime regression으로 분류하지 않습니다.

**출처**

- [Build native Android apps in Google AI Studio](https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html)


## 참고자료

- [8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O](https://goo.gle/AdaptiveApps_IO26)
- [Build native Android apps in Google AI Studio](https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html)
