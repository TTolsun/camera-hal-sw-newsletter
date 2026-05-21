# AOSP Camera / Driver / SoC Platform 뉴스레터 - 2026-05-22

이번 2026-05-22호는 Camera HAL / Driver / Native tooling 독자가 확인할 만한 세 가지 항목을 정리했습니다: Jetpack Compose와 CameraX: 다양한 화면 크기의 camera preview 확인 포인트.


> 편집자 검토 후 공개 가능한 검토 발행본입니다.
> 이 호는 자동 정상 발행 기준을 통과하지 못했으며, 편집자 확인 후 merge해야 합니다.
> 각 기사는 공개 source 범위 안에서 해석하며 Camera HAL 직접 변경으로 과장하지 않습니다.


## 1. 이번 주 3줄 브리핑

- Google은 여러 화면 크기와 입력 방식에서 Android 앱 경험을 맞추기 위해 Jetpack Compose, Navigation 3, Grid/FlexBox layout, non-touch input 지원, 그리고 CameraX preview 대응을 함께 언급했습니다.
- 직접 HAL 변경 근거가 없는 항목은 참고 동향으로만 공유합니다.
- 직접 HAL 변경 근거가 없는 항목은 참고 동향으로만 공유합니다.

## 2. Jetpack Compose와 CameraX: 다양한 화면 크기의 camera preview 확인 포인트


![Jetpack Compose와 CameraX: 다양한 화면 크기의 camera preview 확인 포인트](https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhdDsacfyGtp3onpFDB8MfwDNaY70RiTJpN0e_M0NK9W7au1Ex8ghyphenhyphenGNrIq0sqqc1eb-g2fUPUYL1sS7Fhk5r7GTDZm3p-3gRDulDyPa0RqLcDXk6uV3TjBpLMDU5RMnvySqazjwL-8dKrrjkfqkgM_ODlmZVgGNnX5e067nNgWL146AHbsejj6KtLrtIs/s2048/GoogleForDevelopers-ComboIO-StrapiMetacard-2048x1323%20(1).png)

_이미지: [Android Developers Blog](https://goo.gle/AdaptiveApps_IO26)_


Google은 여러 화면 크기와 입력 방식에서 Android 앱 경험을 맞추기 위해 Jetpack Compose, Navigation 3, Grid/FlexBox layout, non-touch input 지원, 그리고 CameraX preview 대응을 함께 언급했습니다.

Google Android Developers Blog는 여러 기기와 화면 크기에서 Jetpack Compose를 중심으로 Android UX를 맞추는 흐름을 설명하면서, window size에 맞는 camera preview를 위해 CameraX를 함께 언급했습니다.

이 내용은 HAL API 변경 고지가 아니라 app/framework layer validation signal입니다. Camera HAL / Driver 팀은 preview aspect ratio, rotation, stream configuration, Surface 연결에서 회귀 테스트 범위를 잡는 참고로 쓰면 됩니다.

**Camera HAL / Driver 관점**

CameraX 또는 Camera2 usage pattern, compatibility assumption, app-facing behavior를 검증해 HAL boundary 위 계층의 문제 신호로 활용합니다.

### 확인할 점

- 즉시 조치할 항목은 없습니다. 참고 동향으로만 공유합니다.

**출처**

- [8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O](https://goo.gle/AdaptiveApps_IO26)


## 참고자료

- [8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O](https://goo.gle/AdaptiveApps_IO26)
