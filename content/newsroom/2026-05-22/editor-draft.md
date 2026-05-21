# Camera HAL SW 뉴스레터 - 2026-05-22

이번 주 뉴스레터에서는 Google I/O 2026에서 발표된 Jetpack Compose 기반의 멀티 디바이스 대응 기술과 CameraX를 활용한 다양한 창 크기에서의 카메라 미리보기 검증 요소를 다룹니다. 또한 Google AI Studio의 Android 앱 빌드 기능 도입에 따른 native 개발 워크플로우 지원 동향을 공유합니다.



## 1. 이번 주 3줄 브리핑

- Google I/O 2026에서 Jetpack Compose와 Jetpack Navigation 3를 활용한 멀티 디바이스 대응 및 다양한 창 크기에서의 CameraX 미리보기 호환성이 강조되었습니다.
- 다양한 화면 크기 전환 시 CameraX의 preview stream이 올바르게 리사이징되고 버퍼가 정상적으로 순환하는지 검증하는 HAL/Framework 호환성 테스트의 중요성이 커지고 있습니다.
- Google AI Studio가 프롬프트 기반 Android 앱 빌드를 지원하기 시작했으며, 이는 C++ native 개발팀의 테스트 스텁 작성 및 디버깅 워크플로우 생산성 향상에 기여할 수 있습니다.

## 2. Google I/O 2026: Jetpack Compose 멀티 디바이스 전환에 따른 CameraX 미리보기 호환성 검증


![Google For Developers Combo IO Strapi Metacard](https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhdDsacfyGtp3onpFDB8MfwDNaY70RiTJpN0e_M0NK9W7au1Ex8ghyphenhyphenGNrIq0sqqc1eb-g2fUPUYL1sS7Fhk5r7GTDZm3p-3gRDulDyPa0RqLcDXk6uV3TjBpLMDU5RMnvySqazjwL-8dKrrjkfqkgM_ODlmZVgGNnX5e067nNgWL146AHbsejj6KtLrtIs/s2048/GoogleForDevelopers-ComboIO-StrapiMetacard-2048x1323%20(1).png)

_이미지: [Android Developers Blog](https://android-developers.googleblog.com/)_


Google I/O 2026에서 Jetpack Compose와 Jetpack Navigation 3를 중심으로 한 멀티 디바이스 대응 전략이 공개되었습니다. 특히 폴더블폰, 태블릿 등 다양한 화면 크기 변화 속에서 CameraX를 활용해 끊김 없고 정확한 카메라 미리보기(Preview)를 구현하는 방안이 강조되었습니다.

Jetpack Compose는 Android의 선언형 UI 프레임워크로서, 단일 코드베이스로 다양한 폼 팩터와 화면 크기에 유연하게 대응할 수 있도록 돕습니다. 이번 Google I/O 2026에서 발표된 Jetpack Navigation 3와 새로운 실험적 Grid 및 FlexBox 레이아웃은 앱이 동적으로 창 크기를 변경할 때 UI를 매끄럽게 재구성할 수 있도록 지원합니다. 이 과정에서 카메라 미리보기 화면 역시 실시간으로 리사이징되어야 하므로 CameraX의 역할이 더욱 중요해졌습니다.

CameraX는 하위 Camera2 API를 추상화하여 개발자가 복잡한 스트림 구성이나 버퍼 관리에 직접 개입하지 않고도 안정적인 카메라 기능을 구현할 수 있도록 돕는 Jetpack 라이브러리입니다. 멀티 윈도우나 화면 분할, 디바이스 접힘/펼침 등의 시나리오에서 CameraX는 Surface의 크기 변경을 감지하고 이에 맞게 Preview 스트림을 재구성합니다. 이는 앱 개발자에게는 편리함을 제공하지만, 시스템 하위의 Camera HAL 및 드라이버 레이어에서는 동적인 스트림 변경과 버퍼 할당 요청이 빈번하게 발생할 수 있음을 의미합니다.

**Camera HAL / Driver 관점**

앱 레이어의 동적 화면 크기 변경(Jetpack Compose/Navigation 3)은 CameraX를 거쳐 HAL 레이어에 빈번한 Surface 재구성 및 스트림 재설정 요청으로 이어질 수 있습니다. HAL 엔지니어는 Preview 스트림의 동적 리사이징 시 YUV/PRIVATE 버퍼의 라이프사이클이 정상적으로 유지되는지, 프레임 드롭이나 메모리 누수가 발생하지 않는지 검증해야 합니다.

### 확인할 점

- Jetpack Compose 멀티 윈도우 환경에서 CameraX Preview 스트림의 동적 리사이징 동작 확인
- 화면 크기 전환 시 Camera HAL3의 configure_streams 호출 및 버퍼 해제/할당 주기 모니터링
- 폴더블 및 태블릿 타깃 기기에서 화면 전환 시 발생할 수 있는 프레임 드롭 및 렌더링 지연(Latency) 측정

**출처**

- [Building seamless Android experiences across devices with Jetpack Compose - Android Developers Blog](https://goo.gle/AdaptiveApps_IO26)


## 참고자료

- [Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O](https://goo.gle/AdaptiveApps_IO26)
