# AOSP Camera / Driver / SoC Platform 뉴스레터 - 2026-05-12

이번 2026-05-12호는 1개 기사(CameraX 1.6.1 업데이트: Android Camera 호환성 관찰)를 Camera HAL / Android camera 개발자가 확인할 변경 범위와 확인 포인트 중심으로 정리했습니다.


> 검토 발행본입니다.
> 각 기사는 공개 source 범위 안에서 해석하며 Camera HAL 직접 변경으로 과장하지 않습니다.


## 1. 이번 주 3줄 브리핑

- CameraX 1.6.1 release note는 viewfinder와 video 관련 artifact version을 포함한 AndroidX Camera 계층 업데이트입니다. Camera HAL 팀에는 direct contract 변경이 아니라 app-facing camera behavior를 smoke test로 확인할 계기입니다.
- CameraX 1.6.1은 app-facing compatibility 확인 항목입니다. HAL owner는 reference app smoke와 로그 분리를 통해 library issue와 device HAL regression을 구분해야 합니다.
- CameraX 1.6.1 dependency로 Preview + ImageCapture + VideoCapture smoke test를 실행할 조합을 정하는 것부터 보면 기사 내용을 실제 검증 작업으로 옮기기 쉽습니다.

## 2. CameraX 1.6.1 업데이트: Android Camera 호환성 관찰


![CameraX 1.6.1 업데이트: Android Camera 호환성 관찰](https://developer.android.com/static/images/social/android-developers.png)

_이미지: [Android Developers Latest Updates](https://developer.android.com/jetpack/androidx/releases/camera#1.6.1)_


CameraX 1.6.1 release note는 viewfinder와 video 관련 artifact version을 포함한 AndroidX Camera 계층 업데이트입니다. Camera HAL 팀에는 direct contract 변경이 아니라 app-facing camera behavior를 smoke test로 확인할 계기입니다.

CameraX와 Camera2는 HAL 위 계층이므로 release note를 곧바로 HAL API, stream, metadata 변경 근거로 쓰면 안 됩니다. 대신 reference app에서 Preview, ImageCapture, VideoCapture 조합이 기존 device matrix에서 깨지지 않는지 확인하는 방식이 안전합니다.

특히 Camera2 interop, extensions, session configuration 실패가 보고되면 app/framework log와 HAL/device log를 나눠 봐야 합니다. HAL follow-up은 device log 또는 stream/buffer evidence가 있을 때만 엽니다.

**Camera HAL / Driver 관점**

CameraX 1.6.1은 app-facing compatibility 확인 항목입니다. HAL owner는 reference app smoke와 로그 분리를 통해 library issue와 device HAL regression을 구분해야 합니다.

### 확인할 점

- CameraX 1.6.1 dependency로 Preview + ImageCapture + VideoCapture smoke test를 실행할 조합을 정합니다.
- `dumpsys media.camera`, app logcat, framework camera log에서 session configuration 실패를 분리해 확인합니다.
- Camera2 interop 또는 extensions 관련 변경은 release note 범위 안에서만 해석합니다.

**출처**

- [1.6.1](https://developer.android.com/jetpack/androidx/releases/camera#1.6.1)
- [CameraX 1.4.0-alpha07 release table row](https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07)


## 참고자료

- [1.6.1](https://developer.android.com/jetpack/androidx/releases/camera#1.6.1)
- [CameraX 1.4.0-alpha07 release table row](https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07)
