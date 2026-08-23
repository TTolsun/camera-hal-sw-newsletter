# 2026 W23 (06.01 ~ 06.07)

이번 주에는 ‘CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 기기별 스트림 호환성 패치 대거 반영’, ‘Google I/O '26: Jetpack CameraX 및 Media3 기반 CameraXViewfinder Composable 발표’ 두 건의 소식을 다룹니다.



## 1. 이번 주 기사

- CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 기기별 스트림 호환성 패치 대거 반영
- Google I/O '26: Jetpack CameraX 및 Media3 기반 CameraXViewfinder Composable 발표

## 2. CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 기기별 스트림 호환성 패치 대거 반영


![CameraX 1.6.0 정식 출시: 유스케이스 사전 쿼리 API 도입 및 기기별 스트림 호환성 패치 대거 반영 image](https://developer.android.com/static/images/social/android-developers.png?hl=bn)

_이미지: [CameraX Release Notes](https://developer.android.com/jetpack/androidx/releases/camera)_


CameraX 1.6.0 Release Notes (March 25, 2026)

2026년 3월 25일 공식 발표된 CameraX 1.6.0 릴리스에서는 앱이 카메라 라이프사이클에 바인딩하기 전에 기기의 하드웨어 지원 여부를 미리 확인할 수 있는 강력한 기능 조합 쿼리 API가 도입되었습니다. 이와 함께 차세대 Android 17 대응 크래시 패치와 Samsung Z Fold 4, A53 등 특정 단말에서 보고된 YUV 스트림 왜곡 및 플래시 연동 캡처 실패를 우회하는 호환성 패치가 대거 적용되었습니다.

이번 CameraX 1.6.0 릴리스의 가장 핵심적인 변화는 개발자가 HDR, 손떨림 방지(PREVIEW_STABILIZATION), 특정 해상도 설정, CameraX 확장 기능(Extensions) 또는 슬로우 모션과 같은 복잡한 유스케이스 조합이 타겟 기기에서 정상적으로 작동하는지 사전에 쿼리할 수 있는 API를 도입한 것입니다. 이를 통해 앱 계층에서 지원되지 않는 하드웨어 스트림 조합을 무리하게 요청하여 발생하던 런타임 예외나 오동작을 사전에 방지할 수 있게 되었습니다.

또한 다가올 Android 17 기기에서 새롭게 추가되는 미지의 다이내믹 레인지 모드로 인해 기존 CameraX 기반 앱들이 비정상 종료되던 치명적인 호환성 문제가 해결되었습니다. 이 크래시 방지 패치는 하위 버전인 1.5.2에도 체리픽되었으며, 구글은 향후 Android 17 배포 시 발생할 수 있는 앱 비정상 종료를 예방하기 위해 모든 개발자에게 CameraX 버전을 1.5.2 또는 1.6.0 이상으로 즉시 업데이트할 것을 강력히 권장하고 있습니다.

기기별 하드웨어 특성에 대응하는 호환성 패치도 대거 포함되었습니다. 대표적으로 Samsung Z Fold 4 기기에서 이미지 왜곡 현상을 일으키던 특정 YUV 포맷 출력 크기를 지원 대상에서 제외(Exclude)하는 조치가 취해졌습니다. 또한 Samsung A53 기기에서 비디오 녹화(VideoCapture) 유스케이스가 활성화된 상태로 토치를 켜고 사진을 촬영할 때 간헐적으로 캡처가 실패하던 타이밍 이슈가 수정되었습니다.

그 외에도 초광각 카메라에서 플래시를 사용할 때 노출 부족으로 이미지가 어둡게 나오던 현상과, 일부 기기의 JPEG 인코더가 마커 앞에 0xFF 패딩 바이트를 추가하여 이미지 파싱이 실패하던 문제를 해결하기 위해 ExifInterface 라이브러리 의존성을 업데이트하는 등 하위 이미지 처리 파이프라인의 안정성을 높이기 위한 세부 수정들이 대거 반영되었습니다.

### Camera HAL/Driver 관점에서의 의미

이번 릴리스는 Camera HAL 개발팀에게 시사하는 바가 큽니다. 상위 프레임워크 계층에서 유스케이스 조합 지원 여부를 사전에 쿼리하는 API가 도입됨에 따라, HAL 수준에서 선언하는 CameraCharacteristics 및 isStreamCombinationSupported 인터페이스의 정확성이 더욱 엄격하게 요구됩니다. 또한 Z Fold 4의 YUV 왜곡이나 A53의 토치 연동 캡처 실패처럼 HAL/드라이버 계층의 불안정성이 상위 라이브러리에서 강제로 우회(Exclude/Filter) 처리되고 있는 만큼, 벤더사에서는 자사 기기의 스트림 조합 신뢰성과 버퍼 처리 로직을 재검증해야 합니다.

**출처**

- [CameraX Release Notes - CameraX 1.6.0](https://developer.android.com/jetpack/androidx/releases/camera#1.6.0)

---

## 3. Google I/O '26: Jetpack CameraX 및 Media3 기반 CameraXViewfinder Composable 발표


![Google I/O '26 Android Developers session thumbnail](https://i.ytimg.com/vi/Wh3LWb_Phfk/hqdefault.jpg?sqp=-oaymwEXCOADEI4CSFryq4qpAwkIARUAAIhCGAE=&rs=AOn4CLA4wZOV-TY1ydEqFUXpCAG3sm5sQA&days_since_epoch=20609)

_이미지: [Android Developers Blog](https://android-developers.googleblog.com/)_


_Jetpack CameraX와 Media3를 활용한 고품질 안드로이드 미디어 경험 구축_

Google I/O '26에서 Jetpack CameraX와 Media3를 활용하여 폴더블 및 태블릿 등 다양한 폼 팩터에서 유연하게 반응하는 카메라 미리보기를 제공하는 CameraXViewfinder Composable이 발표되었습니다.

안드로이드 생태계가 고품질 미디어 라이프사이클을 지원하는 플랫폼으로 진화함에 따라, 구글은 첫 캡처부터 최종 재생까지의 개발 여정을 단순화하기 위한 툴킷을 제시했습니다. 이번 Google I/O '26 발표의 핵심은 Jetpack CameraX와 Media3의 긴밀한 통합입니다.

새롭게 도입된 CameraXViewfinder Composable은 선언형 UI 프레임워크인 Jetpack Compose 환경에서 카메라 미리보기를 쉽게 구현할 수 있도록 돕습니다. 특히 화면 크기가 동적으로 변하는 폴더블 기기나 대화면 태블릿 환경에서 레이아웃 변화에 맞춰 완벽하게 확장되고 반응하는 뷰파인더를 제공합니다.

이 툴킷은 애플리케이션 개발자가 복잡한 Surface 생명주기 관리나 화면 비율 계산 없이도 네이티브 수준의 고품질 카메라 및 재생 경험을 구축할 수 있도록 설계되었습니다. 이를 통해 앱 개발 프로세스가 크게 단축될 것으로 기대됩니다.

### Camera HAL/Driver 관점에서의 의미

이번 변화는 Camera HAL의 직접적인 인터페이스 변경을 수반하지는 않지만, 프레임워크 및 앱 계층에서 HAL이 제공하는 스트림(Preview, ImageCapture)을 어떻게 소비하고 렌더링하는지 보여줍니다. 폴더블 기기의 화면 전환 시 발생할 수 있는 Surface 재구성 및 스트림 재설정 요청에 대해 HAL이 프레임 드롭 없이 안정적으로 버퍼를 공급해야 함을 시사합니다.

**출처**

- [Supercharge your media pipeline with a complete, production-ready toolkit (『Building Premium Android Experiences at Google I/O ‘26』)](https://youtube.com/playlist?list=PLWz5rJ2EKKc8lSdmWQ_fSpV9yEGRvEL6S&si=H6-8-AbtEyTqSxeY)


## 참고자료

- [Supercharge your media pipeline with a complete, production-ready toolkit (『Building Premium Android Experiences at Google I/O ‘26』)](https://youtube.com/playlist?list=PLWz5rJ2EKKc8lSdmWQ_fSpV9yEGRvEL6S&si=H6-8-AbtEyTqSxeY)
