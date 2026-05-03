# Camera HAL SW 뉴스레터 - 2026-05-03

2026년 5월 3일자 Camera HAL SW 뉴스레터입니다. 이번 주에는 Android 17 Beta 4 출시로 플랫폼 안정성 및 앱 호환성 최종 검증이 중요해졌으며, Android용 하이브리드 AI 추론 및 새로운 Gemini 모델 지원은 Camera HAL의 AI 데이터 경로 및 리소스 관리에 새로운 과제를 제시합니다. 또한, 2026년 연례 C++ 개발자 설문조사를 통해 HAL 개발자들이 C++ 표준 및 도구 개선에 직접 기여할 기회가 있습니다.

## 1. 이번 주 3줄 브리핑
- Android 17 Beta 4는 플랫폼 안정성 최종 점검 단계로, Camera HAL의 CTS/VTS/Camera ITS 호환성 및 CameraX 연동 안정성 검증이 필수적입니다.
- Android용 하이브리드 AI 추론 및 새로운 Gemini 모델 지원은 Camera HAL의 AI 스트림 처리, NPU/GPU 리소스 스케줄링, 성능 및 전력 관리에 대한 심층적인 분석을 요구합니다.
- 2026년 연례 C++ 개발자 설문조사에 참여하여 Camera HAL 개발에 필요한 C++ 언어 기능 및 도구 체인 개선에 대한 피드백을 전달할 수 있습니다.

## 2. Android Camera / platform API

### Android 17 Beta 4 출시: 플랫폼 안정성 및 앱 호환성 최종 점검

![Android 17 베타 4 출시를 알리는 이미지. Android 로고와 함께 "Beta 4" 텍스트가 표시되어 있습니다.](https://blogger.googleusercontent.com/img/a/AVvXsEjRi_pfW7jI2yTebiDh4niQsTN1UL9MmUbO1DUy_ensXVVhStxJt5PUfBSQVOkpOC4ReJ1G2OMtpOZj0fq_3XiUY3fVq91hldHzZU-FPcHkLnG33NAEAV9Wxl4PVZWJHUwbbi1mZxUzQA5YIOGMhDC6mL00CYZei7fNAGDpMhK1JqtlwIOtoIVmIZn2XTE)

_Image: [Android Developers Blog](https://android-developers.googleblog.com/2026/04/the-fourth-beta-of-android-17.html)_


**이번 주 확인한 사실**

- Android 17 Beta 4는 2026년 4월 16일 출시되었습니다.
- 이는 이번 릴리스 주기의 마지막 예정된 베타 버전으로, 앱 호환성 및 플랫폼 안정성에 중점을 둡니다.
- 개발자는 최신 API를 활용하여 앱, 라이브러리, 도구 및 게임 엔진을 테스트할 수 있는 거의 최종적인 환경을 제공받습니다.

**배경지식**

Android 베타 프로그램은 개발자가 다음 버전의 Android 플랫폼에 대한 앱을 준비하고 호환성 문제를 조기에 발견할 수 있도록 합니다. 베타 4는 일반적으로 최종 릴리스 직전의 안정화 단계로, API가 거의 확정되고 시스템 동작이 고정됩니다. 이는 HAL 구현이 새로운 플랫폼 요구사항과 완벽하게 호환되는지 확인하는 중요한 시점입니다.

**Camera HAL 관점 해석**

Android 17 Beta 4 환경에서 기존 Camera HAL 구현이 CTS/VTS/Camera ITS 테스트를 통과하는지 확인해야 합니다. 특히 Camera2 API의 변경 사항이나 새로운 CDD 요구사항이 있는지 면밀히 검토해야 합니다. CameraX 라이브러리의 최신 버전이 Android 17 Beta 4에서 예상대로 작동하는지, HAL이 제공하는 기능(예: Ultra HDR, 확장된 동적 범위)이 올바르게 노출되고 사용되는지 검증해야 합니다. 플랫폼 안정화 단계이므로, HAL에서 발생하는 비정상적인 동작(크래시, ANR, 프레임 드롭)이 플랫폼 변경 사항 때문인지, HAL 버그 때문인지 명확히 구분하여 디버깅해야 합니다. 새로운 API나 동작 변경이 있다면, HAL의 stream configuration, request/result metadata, buffer lifecycle 관리에 어떤 영향을 미치는지 분석하고 필요한 경우 HAL 업데이트를 계획해야 합니다.

**우리 팀이 확인할 Action Item**

- 2주 내에 Android 17 Beta 4가 적용된 레퍼런스 기기에서 Camera HAL의 모든 CTS/VTS/Camera ITS 테스트를 재실행하고, 실패하는 테스트 케이스에 대해 HAL 코드 오너를 지정하여 분석 및 수정 계획을 수립합니다.
- CameraX의 최신 스냅샷 버전과 Android 17 Beta 4를 사용하여 Preview + ImageCapture + VideoCapture + ImageAnalysis 스트림 조합을 포함한 주요 카메라 앱 시나리오에서 프레임 드롭, capture latency, 메모리 사용량을 측정하고, 이전 베타 버전 또는 Android 16과 비교하여 회귀 여부를 확인합니다.
- Android 17 Beta 4의 변경 로그를 검토하여 Camera2 API 또는 관련 프레임워크 서비스에 HAL에 영향을 미칠 수 있는 변경 사항이 있는지 확인하고, 해당 API를 사용하는 HAL 로직에 대한 코드 리뷰를 수행합니다.

**팀 공유용 한 줄**

Android 17 Beta 4는 플랫폼 안정성 및 앱 호환성 최종 점검 단계이므로, Camera HAL은 모든 CTS/VTS/Camera ITS 테스트를 재실행하고 CameraX 호환성을 검증하여 최종 릴리스에 대비해야 합니다.

**Sources**

- [Android 17 네 번째 베타 버전 출시](https://android-developers.googleblog.com/2026/04/the-fourth-beta-of-android-17.html)

---

## 3. AI plus camera input path or HAL workflow

### Android용 하이브리드 추론 및 새로운 Gemini 모델 지원

![Android용 하이브리드 추론 솔루션 다이어그램. 온디바이스 및 클라우드 추론의 결합을 보여줍니다.](https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgoPylOD-Ekyhe8AVg3iMvz6S1rsvUT_2Eb4m-77FRH4eebi5psKE8VJwu6xVxCzKXyTXpoxb3-k04e21C6-8KX0BQw0qiCBGToSHJzVYQRckBYqby9csdOCHWp_23DTfPOpWqfjFTL-vJh86Q-DhGLZnbs1L62q4iUsaHHWlpQ2oyLXo3OO0rGsH9ngxw/s1600/Hybrid%20inference%20solution%20for%20Android%20%20-%20Meta.png)

_Image: [Android Developers Blog](https://android-developers.googleblog.com/2026/04/Hybrid-inference-and-new-AI-models-are-coming-to-Android.html)_


**이번 주 확인한 사실**

- 2026년 4월 17일 Android Developers Blog 게시물에서 하이브리드 추론, Firebase AI Logic용 새 API, 최신 Nano Banana 모델을 포함한 새 Gemini 모델 지원이 발표되었습니다.
- 이 업데이트는 온디바이스 및 클라우드 추론을 결합하여 AI 기능을 구현하는 방식을 제공합니다.

**배경지식**

Android에서 AI 모델 추론은 온디바이스 또는 클라우드에서 수행될 수 있습니다. 온디바이스 추론은 지연 시간이 짧고 개인 정보 보호에 유리하지만, 장치 리소스(NPU, GPU, CPU, 메모리) 제약이 있습니다. 클라우드 추론은 더 강력한 모델을 사용할 수 있지만, 네트워크 지연과 데이터 전송 비용이 발생합니다. 하이브리드 추론은 이 두 가지 방식의 장점을 결합하여 최적의 성능과 효율성을 목표로 합니다.

**Camera HAL 관점 해석**

카메라 HAL은 AI 추론을 위한 프레임 데이터(YUV, PRIVATE stream)를 효율적으로 제공해야 합니다. 하이브리드 추론은 온디바이스 추론 시 NPU/GPU/ISP 리소스 스케줄링 및 할당에 대한 HAL의 역할을 중요하게 만듭니다. 새로운 Gemini 모델, 특히 Nano Banana와 같은 경량 모델은 온디바이스 추론 시 HAL이 관리하는 버퍼 수명 주기, 메모리 효율성, 전력 소비에 영향을 줄 수 있습니다. AI 추론 결과 메타데이터를 Camera HAL이 어떻게 수신하고, Camera2 API를 통해 앱에 전달할지에 대한 인터페이스 정의 또는 확장 가능성을 검토해야 합니다. CTS/VTS/Camera ITS는 AI 관련 성능 및 안정성 요구사항을 포함할 수 있으므로, 하이브리드 추론 시나리오에서의 프레임 드롭, 지연 시간, 열 관리 등을 검증해야 합니다.

**우리 팀이 확인할 Action Item**

- 2주 내에 AI 팀과 협력하여 Firebase AI Logic API를 사용하는 온디바이스 AI 추론 워크플로우에서 Camera HAL의 YUV/PRIVATE 스트림 사용 패턴을 분석하고, NPU/GPU 로드 및 메모리 사용량을 측정하는 테스트 계획을 수립합니다.
- AI 분석 스트림과 고해상도 비디오 녹화 스트림을 동시에 사용하는 시나리오에서 프레임 드롭률과 capture latency를 측정하는 자동화된 테스트를 추가하고, 특정 디바이스 클래스(예: 보급형, 플래그십)에서 성능 저하 여부를 확인합니다.
- AI 추론 결과가 Camera HAL의 request/result metadata에 어떤 방식으로 영향을 미치는지, 또는 새로운 vendor tag가 필요한지 여부를 검토하고, 필요한 경우 관련 팀과 논의를 시작합니다.

**팀 공유용 한 줄**

Android의 하이브리드 AI 추론 및 새로운 Gemini 모델 지원은 Camera HAL의 데이터 경로, NPU/GPU 스케줄링, 성능 및 전력 관리에 직접적인 영향을 미치므로, 관련 리소스 사용 및 지연 시간 측정을 통해 HAL 최적화 방안을 모색해야 합니다.

**Sources**

- [Android용 실험적 하이브리드 추론 및 새로운 Gemini 모델](https://android-developers.googleblog.com/2026/04/Hybrid-inference-and-new-AI-models-are-coming-to-Android.html)

---

## 4. C++ / toolchain fallback

### 2026년 연례 C++ 개발자 설문조사 시작: HAL 개발자의 목소리를 전달할 기회

![2026년 연례 C++ 개발자 설문조사 시작: HAL 개발자의 목소리를 전달할 기회 image](../../assets/images/fallback/android.svg)

_Image: [2026년 연례 C++ 개발자 설문조사 "Lite" 시작](https://isocpp.org//blog/2026/04/2026-annual-cpp-developer-survey-lite1)_


**이번 주 확인한 사실**

- 2026년 연례 C++ 개발자 설문조사 "Lite"가 2026년 4월 22일 시작되었습니다.
- 이 설문조사는 C++ 표준화 및 C++ 도구 공급업체에 개발자 피드백을 제공하는 데 사용됩니다.

**배경지식**

C++는 Android Camera HAL을 포함한 많은 네이티브 시스템 구성 요소의 기반 언어입니다. C++ 표준은 언어의 기능과 동작을 정의하며, 컴파일러 및 도구 체인(Clang/LLVM/libc++)은 이 표준을 구현합니다. 개발자 설문조사는 표준 위원회와 도구 공급업체가 실제 개발자의 요구 사항과 문제점을 파악하고, 향후 C++ 표준 및 도구 개선 방향을 결정하는 데 중요한 역할을 합니다.

**Camera HAL 관점 해석**

Camera HAL 개발자는 C++ 언어의 새로운 기능, 라이브러리, 컴파일러 최적화, 정적 분석 도구 등에 대한 의견을 설문조사를 통해 전달할 수 있습니다. 이는 HAL 코드의 메모리 안전성, 동시성 관리, 성능 최적화, 디버깅 용이성 등에 영향을 미칠 수 있는 개선 사항을 제안할 기회입니다. 특히 Android HAL 개발에 사용되는 Clang/LLVM, libc++와 관련된 특정 요구사항이나 문제점(예: 특정 C++20/23 기능의 부재, 특정 최적화 문제, sanitizer 통합)에 대한 피드백은 향후 Android NDK 및 빌드 시스템의 발전에 기여할 수 있습니다. 설문조사 결과를 통해 C++ 커뮤니티의 주요 관심사를 파악하고, HAL 개발에 적용할 수 있는 잠재적인 C++ 표준 기능이나 도구 개선 사항을 미리 검토할 수 있습니다.

**우리 팀이 확인할 Action Item**

- 2주 내에 Camera HAL 팀 내에서 C++ 표준(C++20/23) 기능 중 HAL 코드베이스에 적용 시 성능, 안정성, 코드 가독성 개선에 크게 기여할 수 있는 항목을 2-3개 선정하고, 해당 기능에 대한 팀의 의견을 2026년 연례 C++ 개발자 설문조사에 제출합니다.
- 현재 Camera HAL 빌드에 사용되는 Clang/LLVM 버전에서 발생하는 특정 경고 또는 최적화 문제를 식별하고, 이러한 문제에 대한 개선이 필요한 경우 설문조사를 통해 피드백을 제공합니다.
- 2주 내에 설문조사 문항을 분석하여 Camera HAL 개발에 직접적인 영향을 미칠 수 있는 C++ 표준 기능 또는 도구 개선 사항 3가지를 식별하고, 이에 대한 팀 내부 토론을 진행합니다.

**팀 공유용 한 줄**

2026년 연례 C++ 개발자 설문조사는 Camera HAL 개발자가 C++ 표준 및 도구 개선에 직접 기여할 수 있는 기회이므로, 적극적으로 참여하여 HAL 코드의 성능과 안정성 향상에 필요한 피드백을 전달해야 합니다.

**Sources**

- [2026년 연례 C++ 개발자 설문조사 "Lite" 시작](https://isocpp.org//blog/2026/04/2026-annual-cpp-developer-survey-lite1)


## 이번 주 Action Items

- 2주 내에 Android 17 Beta 4가 적용된 레퍼런스 기기에서 Camera HAL의 모든 CTS/VTS/Camera ITS 테스트를 재실행하고, 실패하는 테스트 케이스에 대해 HAL 코드 오너를 지정하여 분석 및 수정 계획을 수립합니다.
- AI 팀과 협력하여 Firebase AI Logic API를 사용하는 온디바이스 AI 추론 워크플로우에서 Camera HAL의 YUV/PRIVATE 스트림 사용 패턴을 분석하고, NPU/GPU 로드 및 메모리 사용량을 측정하는 테스트 계획을 수립합니다.
- CameraX의 최신 스냅샷 버전과 Android 17 Beta 4를 사용하여 Preview + ImageCapture + VideoCapture + ImageAnalysis 스트림 조합을 포함한 주요 카메라 앱 시나리오에서 프레임 드롭, capture latency, 메모리 사용량을 측정하고, 이전 베타 버전 또는 Android 16과 비교하여 회귀 여부를 확인합니다.
- 2주 내에 Camera HAL 팀 내에서 C++ 표준(C++20/23) 기능 중 HAL 코드베이스에 적용 시 성능, 안정성, 코드 가독성 개선에 크게 기여할 수 있는 항목을 2-3개 선정하고, 해당 기능에 대한 팀의 의견을 2026년 연례 C++ 개발자 설문조사에 제출합니다.

## References

- [Android 17 네 번째 베타 버전 출시](https://android-developers.googleblog.com/2026/04/the-fourth-beta-of-android-17.html)
- [Android용 실험적 하이브리드 추론 및 새로운 Gemini 모델](https://android-developers.googleblog.com/2026/04/Hybrid-inference-and-new-AI-models-are-coming-to-Android.html)
- [2026년 연례 C++ 개발자 설문조사 "Lite" 시작](https://isocpp.org//blog/2026/04/2026-annual-cpp-developer-survey-lite1)
