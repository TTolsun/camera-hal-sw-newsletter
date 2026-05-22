# AOSP Camera / Driver / SoC Platform 뉴스레터 - 2026-05-12

이번 2026-05-12호는 중복 News Source를 최신 indexed issue 기준으로 정리하고, 남은 1개 기사(CameraX 1.6.1 업데이트: Android Camera 호환성 관찰)를 source-backed 내용으로 보강했습니다.


> 편집자 검토 후 공개 가능한 검토 발행본입니다.
> 이 호는 자동 정상 발행 기준을 통과하지 못했으며, 편집자 확인 후 merge해야 합니다.
> 각 기사는 공개 source 범위 안에서 해석하며 Camera HAL 직접 변경으로 과장하지 않습니다.


## 1. 이번 주 3줄 브리핑

- CameraX 1.6.1 업데이트: Android Camera 호환성 관찰: 1.6.1 기준으로 중복 issue에 흩어진 내용을 합쳐 CameraX 1.6.1 업데이트: Android Camera 호환성 관찰 항목을 다시 정리했습니다.
- 중복 source cleanup 후 남은 공개 source 기준으로 읽을 만한 개발자 관점만 유지했습니다.
- 중복 source cleanup 후 남은 공개 source 기준으로 읽을 만한 개발자 관점만 유지했습니다.

## 2. CameraX 1.6.1 업데이트: Android Camera 호환성 관찰


![CameraX 1.6.1 업데이트: Android Camera 호환성 관찰](https://developer.android.com/static/images/social/android-developers.png)

_이미지: [Android Developers Latest Updates](https://developer.android.com/jetpack/androidx/releases/camera#1.6.1)_


1.6.1 기준으로 중복 issue에 흩어진 내용을 합쳐 CameraX 1.6.1 업데이트: Android Camera 호환성 관찰 항목을 다시 정리했습니다.

이 article은 android_platform_camera_adjacent 범위에서 공개 source가 확인한 사실과 이전 issue의 중복 설명을 합친 survivor article입니다.

삭제된 중복 issue의 donor 내용은 구조화 필드로만 반영했고, source가 말하지 않은 HAL 영향은 새로 만들지 않았습니다.

**Camera HAL / Driver 관점**

Camera HAL / Driver owner는 source가 직접 말한 범위 안에서 stream, buffer, metadata, pipeline 검증 필요성을 확인합니다.

### 확인할 점

- 1.6.1의 release/version 범위를 기준으로 downstream camera stack 검토 범위를 정리합니다.
- Camera HAL / Driver owner가 downstream test나 log 확인이 필요한지 판단합니다.

**출처**

- [1.6.1](https://developer.android.com/jetpack/androidx/releases/camera#1.6.1)
- [Android Developers Latest Updates - CameraX 1.6.1](https://developer.android.com/jetpack/androidx/releases/camera#1.6.1)
- [CameraX 1.6.1 release table row](https://developer.android.com/jetpack/androidx/releases/camera#1.6.1)
- [CameraX 1.4.0-alpha07 release table row](https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07)
- [1.4.0-alpha07](https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07)


## 참고자료

- [1.6.1](https://developer.android.com/jetpack/androidx/releases/camera#1.6.1)
- [Android Developers Latest Updates - CameraX 1.6.1](https://developer.android.com/jetpack/androidx/releases/camera#1.6.1)
- [CameraX 1.6.1 release table row](https://developer.android.com/jetpack/androidx/releases/camera#1.6.1)
- [CameraX 1.4.0-alpha07 release table row](https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07)
- [1.4.0-alpha07](https://developer.android.com/jetpack/androidx/releases/camera#1.4.0-alpha07)
