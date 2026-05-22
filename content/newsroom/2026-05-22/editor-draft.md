# AOSP Camera / Driver / SoC Platform 뉴스레터 - 2026-05-22

이번 2026-05-22호는 중복 News Source를 최신 indexed issue 기준으로 정리하고, 남은 2개 기사(8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O, Android Native Tooling: Build native Android apps in Google AI Studio)를 source-backed 내용으로 보강했습니다.


> 편집자 검토 후 공개 가능한 검토 발행본입니다.
> 이 호는 자동 정상 발행 기준을 통과하지 못했으며, 편집자 확인 후 merge해야 합니다.
> 각 기사는 공개 source 범위 안에서 해석하며 Camera HAL 직접 변경으로 과장하지 않습니다.


## 1. 이번 주 3줄 브리핑

- 8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O: 8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O 기준으로 중복 issue에 흩어진 내용을 합쳐 8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O 항목을 다시 정리했습니다.
- Android Native Tooling: Build native Android apps in Google AI Studio: Build native Android apps in Google AI Studio 기준으로 중복 issue에 흩어진 내용을 합쳐 Android Native Tooling: Build native Android apps in Google AI Studio 항목을 다시 정리했습니다.
- 중복 source cleanup 후 남은 공개 source 기준으로 읽을 만한 개발자 관점만 유지했습니다.

## 2. 8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O


![Jetpack Compose와 CameraX: 다양한 화면 크기의 camera preview 확인 포인트](https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhdDsacfyGtp3onpFDB8MfwDNaY70RiTJpN0e_M0NK9W7au1Ex8ghyphenhyphenGNrIq0sqqc1eb-g2fUPUYL1sS7Fhk5r7GTDZm3p-3gRDulDyPa0RqLcDXk6uV3TjBpLMDU5RMnvySqazjwL-8dKrrjkfqkgM_ODlmZVgGNnX5e067nNgWL146AHbsejj6KtLrtIs/s2048/GoogleForDevelopers-ComboIO-StrapiMetacard-2048x1323%20(1).png)

_이미지: [Android Developers Blog](https://goo.gle/AdaptiveApps_IO26)_


8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O 기준으로 중복 issue에 흩어진 내용을 합쳐 8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O 항목을 다시 정리했습니다.

이 article은 android_platform_camera_adjacent 범위에서 공개 source가 확인한 사실과 이전 issue의 중복 설명을 합친 survivor article입니다.

삭제된 중복 issue의 donor 내용은 구조화 필드로만 반영했고, source가 말하지 않은 HAL 영향은 새로 만들지 않았습니다.

**Camera HAL / Driver 관점**

Camera HAL / Driver owner는 source가 직접 말한 범위 안에서 stream, buffer, metadata, pipeline 검증 필요성을 확인합니다.

### 확인할 점

- 8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O의 release/version 범위를 기준으로 downstream camera stack 검토 범위를 정리합니다.
- Camera HAL / Driver owner가 downstream test나 log 확인이 필요한지 판단합니다.

**출처**

- [8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O](https://goo.gle/AdaptiveApps_IO26)

---

## 3. Android Native Tooling: Build native Android apps in Google AI Studio


![Google AI Studio native Android 앱 생성: Camera API 사용 범위 확인](https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjd6QUmqCnkvDT9M0IoWA6y_752MRk01nHVQOa644yYkgoMGMDk8Dy6ow6X4SqFzzODP-a1kRaNcuF-1ZyR_lk5fTfdbuEMKDvuX4s7LFaGNuMswzvMCFoYeaQ3RLf2OZPYUWN5BsnqRIsmDub85hpYZNGY7AsaHCsHlfkxLqfqm0PozMhkyqK4i6WfgGM/s2048/GoogleForDevelopers-AndroidCombo2-StrapiMetacard-2048x1323.png)

_이미지: [Android Developers Blog](https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html)_


Build native Android apps in Google AI Studio 기준으로 중복 issue에 흩어진 내용을 합쳐 Android Native Tooling: Build native Android apps in Google AI Studio 항목을 다시 정리했습니다.

이 article은 cpp_ai_tooling_fallback 범위에서 공개 source가 확인한 사실과 이전 issue의 중복 설명을 합친 survivor article입니다.

삭제된 중복 issue의 donor 내용은 구조화 필드로만 반영했고, source가 말하지 않은 HAL 영향은 새로 만들지 않았습니다.

**Android Native / Tooling 관점**

직접 HAL 변경으로 단정하지 않고, native build/test/debug workflow에 줄 수 있는 간접 신호로만 봅니다.

### 확인할 점

- Build native Android apps in Google AI Studio의 release/version 범위를 기준으로 downstream camera stack 검토 범위를 정리합니다.
- Native tooling owner가 camera validation workflow에 참고할 항목인지 검토합니다.

**출처**

- [Build native Android apps in Google AI Studio](https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html)
- [Start building today - Build native Android apps in Google AI Studio](https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html#roundup-child-3-start-building-today)


## 참고자료

- [8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O](https://goo.gle/AdaptiveApps_IO26)
- [Build native Android apps in Google AI Studio](https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html)
- [Start building today - Build native Android apps in Google AI Studio](https://android-developers.googleblog.com/2026/05/build-android-apps-google-ai-studio.html#roundup-child-3-start-building-today)
