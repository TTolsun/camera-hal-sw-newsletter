# AOSP Camera / Driver / SoC Platform 뉴스레터 (2026-05-21)

이번 주 뉴스레터에서는 Jetpack Compose를 사용한 적응형 UI에서 CameraX의 역할과 이것이 HAL의 스트림 설정 안정성에 미치는 영향을 분석합니다. 다양한 폼팩터와 윈도우 크기 변경에 따른 카메라 프리뷰 재설정 시나리오를 중점적으로 다룹니다.



## 1. 이번 주 3줄 브리핑

- Jetpack Compose 적응형 UI에서 CameraX 프리뷰가 핵심 요소로 언급됨에 따라, 다양한 화면 크기 및 분할 화면 모드에서 스트림 재설정 안정성 검증이 중요해졌습니다.
- 폴더블 기기나 태블릿에서 앱 레이아웃이 동적으로 변경될 때 발생하는 CameraX의 스트림 재설정 요청을 HAL이 얼마나 빠르고 안정적으로 처리하는지 확인해야 합니다.
- 이번 주 Action Item은 폴더블 및 태블릿 기기에서 화면 분할, 회전, 접기/펴기 동작을 반복하며 CameraX 프리뷰 스트림의 지연(latency) 및 프레임 드롭 여부를 측정하는 것입니다.

## 2. Jetpack Compose 적응형 UI의 핵심 요소로 부상한 CameraX, 다양한 화면 크기에서의 스트림 설정 안정성 요구


![Google I/O 로고와 함께 안드로이드 개발자를 위한 세션을 안내하는 이미지. 다양한 기기에서의 원활한 안드로이드 경험 구축이라는 주제를 시각적으로 나타냅니다.](https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhdDsacfyGtp3onpFDB8MfwDNaY70RiTJpN0e_M0NK9W7au1Ex8ghyphenhyphenGNrIq0sqqc1eb-g2fUPUYL1sS7Fhk5r7GTDZm3p-3gRDulDyPa0RqLcDXk6uV3TjBpLMDU5RMnvySqazjwL-8dKrrjkfqkgM_ODlmZVgGNnX5e067nNgWL146AHbsejj6KtLrtIs/s2048/GoogleForDevelopers-ComboIO-StrapiMetacard-2048x1323%20(1).png)

_이미지: [Android Developers Blog](https://goo.gle/AdaptiveApps_IO26)_


최근 Android Developers Blog는 Jetpack Compose를 사용해 폴더블, 태블릿 등 다양한 기기에서 매끄러운 사용자 경험을 구축하는 방법을 소개하며, 동적으로 변하는 UI 레이아웃에서 정확한 카메라 프리뷰를 구현하는 데 CameraX가 핵심적인 역할을 한다고 밝혔습니다. 이는 Camera HAL이 다양한 화면 크기와 윈도우 모드에 대응해 스트림 설정을 얼마나 빠르고 안정적으로 처리하는지가 중요해졌음을 시사합니다.

Jetpack Compose는 다양한 폼팩터에 대응하는 적응형 UI(adaptive UI) 개발을 위한 선언형 UI 툴킷입니다. 폴더블 기기를 접거나 펼 때, 또는 태블릿에서 멀티 윈도우 모드를 사용할 때 앱의 레이아웃은 동적으로 변경됩니다. 이 과정에서 앱에 포함된 카메라 프리뷰(CameraX PreviewView) 역시 새로운 크기와 종횡비에 맞춰 실시간으로 재구성되어야 합니다.

이러한 UI 변경은 단순한 화면 요소 크기 조정을 넘어, CameraX가 내부적으로 새로운 스트림 설정을 계산하고 Camera HAL에 세션 재설정을 요청하는 과정으로 이어집니다. 2026년 5월 19일자 공식 Android Developers Blog 게시물은 이처럼 복잡한 시나리오에서 올바른 카메라 프리뷰를 보장하는 핵심 도구로 CameraX를 명시했습니다. 이는 HAL 개발팀이 빈번한 스트림 재설정 요청에도 불구하고 지연이나 오류 없이 안정적인 프리뷰를 제공해야 하는 과제를 안게 되었음을 의미합니다.

**Camera HAL / Driver 관점**

Jetpack Compose 기반 적응형 UI의 확산은 HAL이 더 다양한 프리뷰 스트림 크기와 종횡비 전환을 빠르고 안정적으로 처리해야 함을 의미합니다. 특히 폴더블 기기의 접힘/펼침 상태 변경이나 멀티 윈도우 크기 조절 시 발생하는 스트림 재설정(reconfiguration) 요청에 대한 HAL의 성능과 안정성이 앱의 전체적인 품질을 좌우하게 됩니다. 이는 단순한 스트림 지원 여부를 넘어, 동적인 설정 변경 시의 지연 시간(latency), 프레임 드롭, 리소스 사용량까지 고려한 검증이 필요함을 시사합니다.

### 확인할 점

- 폴더블 및 태블릿 기기에서 화면 분할, 창 크기 조절, 화면 회전 시 CameraX 프리뷰가 깨지거나 지연 없이 갱신되는지 확인합니다.
- 앱이 접힌 상태와 펼친 상태를 오갈 때 발생하는 스트림 재설정 요청을 HAL이 얼마나 빠르게 처리하는지 측정합니다.
- 다양한 프리뷰 스트림 종횡비와 해상도 조합에 대한 HAL의 지원 범위를 재검토하고, 지원되지 않는 설정에 대한 오류 처리가 올바르게 이루어지는지 확인합니다.

**출처**

- [8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O](https://goo.gle/AdaptiveApps_IO26)


## 참고자료

- [8: Building seamless Android experiences across devices with Jetpack Compose - 17 Things to know for Android developers at Google I/O](https://goo.gle/AdaptiveApps_IO26)
