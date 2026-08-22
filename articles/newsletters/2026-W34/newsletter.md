# 2026 W33 (08.10 ~ 08.16)

이번 주에는 ‘CameraX 1.7.0-alpha03 출시: Camera2Interop API 개편 및 멀티 카메라 ZSL HAL 충돌 해결’ 소식을 다룹니다.



## 1. 이번 주 기사

- CameraX 1.7.0-alpha03 출시: Camera2Interop API 개편 및 멀티 카메라 ZSL HAL 충돌 해결

## 2. CameraX 1.7.0-alpha03 출시: Camera2Interop API 개편 및 멀티 카메라 ZSL HAL 충돌 해결


![CameraX 1.7.0-alpha03 출시: Camera2Interop API 개편 및 멀티 카메라 ZSL HAL 충돌 해결](https://developer.android.com/static/images/social/android-developers.png?hl=ar)

_이미지: [CameraX Release Notes](https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha03)_


_Android Jetpack CameraX 공식 릴리스 노트 분석_

최근 공개된 Android Jetpack CameraX 1.7.0-alpha03 릴리스에서는 앱 개발자가 하위 Camera2 및 HAL 계층과 상호작용하는 핵심 통로인 Camera2Interop API가 대대적으로 개편되었습니다. 이와 함께 멀티 카메라 기기에서 ZSL(Zero-Shutter Lag)을 활성화한 채 물리 카메라 경계를 넘나들며 줌을 조작할 때 발생하던 치명적인 HAL 충돌 버그가 수정되어, 시스템 안정성이 크게 개선되었습니다.

이번 CameraX 1.7.0-alpha03 업데이트의 가장 큰 변화는 Camera2Interop API의 현대화입니다. 기존의 레거시 API인 Camera2Interop.Extender, Camera2CameraControl, Camera2CameraInfo, CaptureRequestOptions가 모두 Deprecated 처리되었습니다. 대신 더욱 직관적이고 안전한 설정을 지원하는 Camera2Interop configurator factory 메서드(forUseCase, forImageCapture, forSessionConfig, forCameraControl)와 Kotlin DSL 확장 함수가 도입되었습니다. 이를 통해 개발자는 Use Case 빌더 단계에서 setInterop 또는 applyInteropAsync 메서드를 활용해 하위 Camera2 파라미터를 손쉽게 주입할 수 있게 되었습니다.

또한, Preview와 VideoCapture에 미러 모드를 제어할 수 있는 setMirrorMode 및 getMirrorMode API가 정식 추가되면서 기존의 ExperimentalMirrorMode 어노테이션이 제거되었습니다. 이미지 처리 파이프라인 관점에서는 ImagePlane.buffer의 반환 타입이 non-nullable ByteBuffer로 변경되어, 프레임 분석(ImageAnalysis) 시 발생할 수 있는 NullPointerException 위험을 원천적으로 차단했습니다. SessionConfig.Builder 등의 프로퍼티 게터 역시 Kotlin DSL에서 쓰기 전용(write-only)으로 제한되어 설정 오용을 방지합니다.

하위 HAL 및 드라이버 레이어에서 가장 주목해야 할 부분은 멀티 카메라 기기에서의 ZSL(Zero-Shutter Lag) 안정성 개선입니다. 기존에는 멀티 카메라 환경에서 ZSL을 활성화한 상태로 물리 카메라 간의 경계를 넘나들며 줌을 변경할 때, 프레임워크와 HAL 간의 스트림 제어 불일치로 인해 HAL 충돌(HAL crash)이 발생하는 문제가 있었습니다. 이번 릴리스에서는 이 충돌 문제를 해결하여 줌 동작 중에도 안정적인 프레임 캡처가 가능하도록 보장합니다. 추가적으로 삼성 Galaxy S25, S26, Fold 7 기기에서 발생하던 HDR 비디오 녹화 실패 현상과, OverlayEffect 사용 시 멀티 Preview 스트림 중 하나가 전달되지 않던 버그도 함께 수정되었습니다.

### Camera HAL/Driver 관점에서의 의미

이번 변경은 직접적인 HAL3 규격 변경은 아니지만, 상위 프레임워크가 HAL에 요청을 전달하는 방식과 밀접하게 연계되어 있습니다. 특히 ZSL 활성화 상태에서 물리 카메라 간 줌 전환 시 발생하는 HAL 충돌 수정(b/527782712)은 멀티 카메라 스트림 구성 및 버퍼 수명 주기 제어 로직을 점검해야 함을 시사합니다. 또한 삼성 Galaxy S25/S26/Fold 7 등 특정 벤더 기기 대상의 HDR 비디오 녹화 실패 수정(b/529618629) 사례처럼, 벤더 고유의 HDR 메타데이터 처리 및 코덱 연동부에서 예외가 발생하지 않는지 VTS 및 자체 시나리오 테스트를 통해 검증해야 합니다.

**출처**

- [CameraX Release Notes - CameraX 1.7.0-alpha03](https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha03)


## 참고 / 더 읽을거리

- [Camera ITS tests](<https://source.android.com/docs/compatibility/cts/camera-its-tests>) — AOSP Site Updates (2026-07) · AOSP Camera 프레임워크 관련 참고
- [Camera ITS overview](<https://source.android.com/docs/compatibility/cts/camera-its>) — AOSP Site Updates (2026-07) · AOSP Camera 프레임워크 관련 참고
- [\[PATCH\] media: v4l2-isp: reject zero-sized parameter blocks](<https://lore.kernel.org/linux-media/20260815193839.141406-1-devnexen@gmail.com/>) — lore.kernel.org linux-media list (2026-08-15) · 카메라 드라이버 / 이미지 파이프라인 참고
- [\[PATCH\] media: uvcvideo: Do not read beyond the uvc_status_control memory](<https://lore.kernel.org/linux-media/20260813-uvc-status-11-v1-1-2cf43e9590b0@chromium.org/>) — lore.kernel.org linux-media list (2026-08-13) · 카메라 드라이버 / 이미지 파이프라인 참고

## 참고자료

- [CameraX Release Notes - CameraX 1.7.0-alpha03](https://developer.android.com/jetpack/androidx/releases/camera#1.7.0-alpha03)
