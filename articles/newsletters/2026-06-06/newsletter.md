# Camera HAL / SW Newsletter - 2026-06-06

Google I/O '26에서 발표된 Jetpack CameraX 및 Media3 기반의 새로운 CameraXViewfinder Composable을 통해 폴더블 및 태블릿 기기에서의 미디어 파이프라인과 카메라 미리보기 최적화 방안이 제시되었습니다. 또한, Linux 커널 메일링 리스트를 통해 Sony IMX678 이미지 센서용 V4L2 드라이버 및 dt-bindings 패치 세트가 공개되어 저수준 드라이버 통합을 위한 기반이 마련되었습니다.



## 1. 이번 주 3줄 브리핑

- Google I/O '26에서 Jetpack CameraX와 Media3를 활용하여 폴더블 및 태블릿 등 다양한 폼 팩터에 대응하는 CameraXViewfinder Composable이 발표되었습니다.
- Sony IMX678 이미지 센서용 V4L2 subdev 드라이버 및 dt-bindings 패치 v4가 제안되어 MIPI RAW12 출력 및 Bayer 필터 지원의 기틀이 마련되었습니다.
- Clang 23.0.0git 컴파일러 빌드 중 Linux 미디어 서브시스템 소스에서 헤더 누락 오류가 보고되어 네이티브 툴체인 검증 시 주의가 요구됩니다.

## 2. Google I/O '26: Jetpack CameraX 및 Media3 기반 CameraXViewfinder Composable 발표


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
