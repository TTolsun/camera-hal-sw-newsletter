# AOSP Camera / Driver / SoC Platform 뉴스레터 - 2026-05-11

이번 2026-05-11호는 1개 기사(CameraX 1.6.1 업데이트: Android Camera 호환성 관찰)를 Camera HAL / Android camera 개발자가 확인할 변경 범위와 확인 포인트 중심으로 정리했습니다.


> 검토 발행본입니다.
> 각 기사는 공개 source 범위 안에서 해석하며 Camera HAL 직접 변경으로 과장하지 않습니다.


## 1. 이번 주 3줄 브리핑

- AndroidX Camera release note의 CameraX 1.6.1 / 1.7.0-alpha01 artifact 업데이트는 app/framework camera compatibility 확인 신호입니다. HAL 팀은 이를 새 HAL 요구사항이 아니라 기존 CameraX/Camera2 조합의 회귀 확인 입력으로 다뤄야 합니다.
- CameraX 업데이트는 app/framework compatibility 신호입니다. HAL 팀은 제품 dependency matrix와 reference app smoke 결과를 확인하고, device log 근거가 있을 때만 HAL follow-up으로 분리해야 합니다.
- CameraX 1.6.1 / 1.7.0-alpha01 artifact를 현재 product dependency matrix와 비교하는 것부터 보면 기사 내용을 실제 검증 작업으로 옮기기 쉽습니다.

## 2. CameraX 1.6.1 업데이트: Android Camera 호환성 관찰


![CameraX 1.6.1 업데이트: Android Camera 호환성 관찰](https://developer.android.com/static/images/social/android-developers.png?hl=es-419)

_이미지: [Android Developers Latest Updates](https://developer.android.com/jetpack/androidx/releases/camera#1.6.1)_


AndroidX Camera release note의 CameraX 1.6.1 / 1.7.0-alpha01 artifact 업데이트는 app/framework camera compatibility 확인 신호입니다. HAL 팀은 이를 새 HAL 요구사항이 아니라 기존 CameraX/Camera2 조합의 회귀 확인 입력으로 다뤄야 합니다.

CameraX는 Camera2 위에서 Preview, ImageCapture, VideoCapture 같은 use case를 앱 개발자가 다루기 쉽게 만드는 layer입니다. artifact version update는 app dependency matrix와 reference app smoke test가 필요한지 판단하는 자료이지, 그 자체로 device HAL behavior 변경을 의미하지 않습니다.

회귀가 보일 때는 app logcat, framework camera log, HAL/device log를 분리해 원인을 나눠야 합니다. CameraX/library 문제인지 downstream HAL issue인지 구분하지 않으면 HAL owner에게 잘못된 action item이 생깁니다.

**Camera HAL / Driver 관점**

CameraX 업데이트는 app/framework compatibility 신호입니다. HAL 팀은 제품 dependency matrix와 reference app smoke 결과를 확인하고, device log 근거가 있을 때만 HAL follow-up으로 분리해야 합니다.

### 확인할 점

- CameraX 1.6.1 / 1.7.0-alpha01 artifact를 현재 product dependency matrix와 비교합니다.
- Preview, ImageCapture, VideoCapture smoke run이 필요한 device/API 조합만 표시합니다.
- 회귀가 있으면 app logcat, framework camera log, HAL/device log를 분리해 원인을 기록합니다.

**출처**

- [Android Developers Latest Updates](https://developer.android.com/latest-updates)


## 참고자료

- [Android Developers Latest Updates](https://developer.android.com/latest-updates)
