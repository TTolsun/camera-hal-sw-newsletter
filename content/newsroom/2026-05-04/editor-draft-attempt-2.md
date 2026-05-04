# Camera HAL SW 뉴스레터 - 2026-05-04

이번 주 뉴스레터는 Android 17 Beta 4의 플랫폼 안정성 도달, Android용 하이브리드 AI 추론 및 새로운 Gemini 모델 출시, 그리고 Linux 7.1 커널의 SoC 및 GPU 드라이버 개선 소식을 다룹니다. Camera HAL 엔지니어는 Android 17 호환성 최종 검증, AI 워크로드의 효율적인 데이터 경로 및 자원 관리, 그리고 Linux 커널 변경이 SoC 및 GPU 활용 카메라 HAL의 안정성과 성능에 미치는 간접적인 영향에 주목해야 합니다.

## 1. 이번 주 3줄 브리핑
- Android 17 Beta 4가 플랫폼 안정성 단계에 진입하여 HAL 호환성 최종 검증이 필요합니다.
- Android용 하이브리드 AI 추론 및 새로운 Gemini 모델이 출시되어 카메라 HAL의 AI 데이터 경로 및 NPU/GPU 자원 관리에 대한 최적화가 중요해졌습니다.
- Linux 7.1 커널 및 7.1-rc2 GPU 드라이버 개선은 SoC 및 GPU 활용 카메라 HAL의 안정성과 성능에 간접적인 영향을 미칠 수 있습니다.

## 2. Android / AOSP / Camera

### Android 17 Beta 4 출시: 플랫폼 안정성 강화 및 HAL 호환성 검증 필수

![Android 17 Beta 4 로고 및 개발자 블로그 이미지](https://blogger.googleusercontent.com/img/a/AVvXsEjRi_pfW7jI2yTebiDh4niQsTN1UL9MmUbO1DUy_ensXVVhStxJt5PUfBSQVOkpOC4ReJ1G2OMtpOZj0fq_3XiUY3fVq91hldHzZU-FPcHkLnG33NAEAV9Wxl4PVZWJHUwbbi1mZxUzQA5YIOGMhDC6mL00CYZei7fNAGDpMhK1JqtlwIOtoIVmIZn2XTE=w1200-h630-p-k-no-nu)

_Image: [The Fourth Beta of Android 17 - Android Developers Blog](https://android-developers.googleblog.com/2026/04/the-fourth-beta-of-android-17.html)_


**이번 주 확인한 사실**

- Release date: 2026년 4월 16일
- Version/Release: Android 17 Beta 4
- API/Component: Android SDK, Platform Stability
- Behavior change: Android 17의 마지막 베타 버전으로, 앱 호환성 및 플랫폼 안정성 향상에 중점을 둡니다.

**배경지식**

Android 베타 버전은 차기 OS 릴리스의 최종 형태를 미리 경험하고 앱 및 시스템 구성 요소의 호환성을 테스트할 기회를 제공합니다. 플랫폼 안정성 단계는 API 및 시스템 동작이 최종 릴리스에 가까워졌음을 의미하며, 이는 HAL 계층의 안정성에도 중요한 영향을 미칩니다.

**Camera HAL 관점 해석**

Android 17 Beta 4는 Camera HAL 인터페이스(HIDL/AIDL), Camera2 API 동작, 그리고 관련 CTS/VTS/Camera ITS 테스트 케이스에 대한 최종 검증 기회를 제공합니다. 특히 request/result metadata 필드의 변경, stream configuration 제약 조건의 업데이트, buffer lifecycle 관리의 미묘한 변화가 있는지 면밀히 검토해야 합니다. 플랫폼 안정성 단계에서는 이러한 변경 사항이 더 이상 크게 바뀌지 않을 것으로 예상되므로, 현재 HAL 구현이 새로운 요구사항을 충족하는지 확인하는 것이 중요합니다.

**우리 팀이 확인할 Action Item**

- 2026년 5월 17일까지 Android 17 Beta 4를 탑재한 레퍼런스 기기에서 모든 Camera CTS/VTS/Camera ITS 테스트를 실행하고, 실패 항목을 Camera HAL 팀의 [Owner: John Doe]에게 보고합니다.
- 2026년 5월 17일까지 Android 17 Beta 4의 camera3.h 및 camera3_metadata.h 헤더 파일과 기존 HAL 구현을 비교하여 API 변경 사항을 식별하고, [Owner: Jane Smith]가 변경 영향 분석을 수행하도록 합니다.
- 2026년 5월 17일까지 Preview + ImageCapture + VideoCapture 동시 스트림 조합에서 capture latency 및 frame drop 지표를 수집하고, [Owner: Alice Brown]가 성능 회귀 여부를 확인합니다.

**팀 공유용 한 줄**

Android 17 Beta 4는 최종 릴리스 전 HAL 호환성을 검증할 마지막 기회입니다. 모든 Camera CTS/VTS/ITS 테스트를 실행하고, API 변경 사항을 면밀히 검토하여 안정적인 HAL 구현을 보장해야 합니다.

**출처**

- [The Fourth Beta of Android 17](https://android-developers.googleblog.com/2026/04/the-fourth-beta-of-android-17.html)

---

## 3. Linux camera / libcamera / V4L2

### Linux 7.1 커널, Steam Deck OLED 오디오 문제 해결: SoC 드라이버 변경의 HAL 영향 가능성

![Steam Deck OLED 기기 이미지](https://www.phoronix.net/image.php?id=steam-deck-oled-benchmarks&image=steamdeck_oled_2_med)

_Image: [Linux 7.1 Fixes Audio For The Steam Deck OLED After Being Broken 2 Years On The Upstream Kernel - Phoronix](https://www.phoronix.com/news/Steam-Deck-OLED-Audio-Fix)_


**이번 주 확인한 사실**

- Release date: 2026년 5월 2일 (Phoronix 기사 게시일)
- Version/Release: Linux 7.1 커널
- API/Component: AMD ASoC audio driver, Linux kernel
- Behavior change: Steam Deck OLED에서 오디오 지원이 Linux 7.1 커널에서 수정됨. 이전에는 AMD ASoC 오디오 변경으로 인해 오디오가 작동하지 않았음.

**배경지식**

Linux 커널은 Android의 기반이 되며, 특히 SoC(System on Chip) 수준의 드라이버 변경은 Android HAL에 간접적인 영향을 미칠 수 있습니다. ASoC(ALSA System on Chip) 드라이버는 임베디드 시스템의 오디오 하드웨어를 관리하며, 카메라와 같은 다른 미디어 서브시스템과 밀접하게 연관될 수 있습니다.

**Camera HAL 관점 해석**

이 오디오 드라이버 수정 자체는 직접적인 카메라 HAL 인터페이스 변경을 의미하지는 않습니다. 그러나 AMD SoC의 ASoC 드라이버 변경은 해당 SoC를 사용하는 Android 기기의 kernel 수준에서 미디어 buffer 처리 방식, interrupt 처리, power management 정책에 영향을 줄 수 있습니다. 이는 카메라 stream의 frame timing, latency, thermal 특성에 간접적인 영향을 미칠 가능성이 있습니다. 특히 비디오 녹화 중 audio-video sync 문제나 dropped frames가 발생하는 경우, 하위 kernel driver의 변경 사항을 검토할 필요가 있습니다.

**우리 팀이 확인할 Action Item**

- 2026년 5월 17일까지 현재 개발 중인 기기의 vendor kernel 소스 코드에서 Linux 7.1의 AMD ASoC 오디오 드라이버 관련 패치와 유사한 변경 사항이 있는지 [Owner: Frank Black] 팀에서 검토합니다.
- 2026년 5월 24일까지 비디오 녹화(Preview + VideoCapture + Audio) 시나리오에서 audio-video sync 오차를 측정하는 자동화 테스트를 추가하고, [Owner: Grace White] 팀에서 logcat 및 kernel log를 통해 관련 오류를 모니터링합니다.
- 2026년 5월 24일까지 thermal 및 power 프로파일링 툴을 사용하여 장시간 비디오 녹화 시나리오에서 SoC의 전반적인 thermal 동작 변화를 분석하고, [Owner: Henry Green] 팀에서 결과를 보고합니다.

**팀 공유용 한 줄**

Linux 7.1의 AMD ASoC 오디오 드라이버 수정은 직접적인 HAL 변경은 아니지만, SoC 수준의 미디어 처리 안정성에 영향을 줄 수 있습니다. vendor kernel 패치 여부 확인 및 비디오 녹화 시나리오에서의 audio-video sync 및 thermal 모니터링이 필요합니다.

**출처**

- [Linux 7.1 Fixes Audio For The Steam Deck OLED After Being Broken 2 Years On The Upstream Kernel](https://www.phoronix.com/news/Steam-Deck-OLED-Audio-Fix)

---

## 4. Linux camera / libcamera / V4L2

### Linux 7.1-rc2 GPU 드라이버 개선: 카메라 HAL의 이미지 처리 및 NPU/GPU 연동 영향

![구형 AMD GPU가 장착된 시스템 이미지](https://www.phoronix.net/image.php?id=amd_radeon_hd7850&image=amd_hd7850_sys2_med)

_Image: [Linux 7.1-rc2 Bringing Some More Improvements/Fixes For Older AMD GPUs - Phoronix](https://www.phoronix.com/news/Linux-7.1-rc2-GPU-Driver-Fixes)_


**이번 주 확인한 사실**

- Release date: 2026년 5월 2일 (Phoronix 기사 게시일)
- Version/Release: Linux 7.1-rc2
- API/Component: DRM (Direct Rendering Manager) kernel graphics driver, AMD GPUs
- Behavior change: Linux 7.1-rc2에서 DRM 커널 그래픽 드라이버 수정 및 구형 AMD GPU 개선.

**배경지식**

DRM(Direct Rendering Manager)은 Linux 커널의 그래픽 서브시스템으로, GPU 하드웨어에 대한 직접 접근을 관리합니다. Android 기기에서 GPU는 카메라 stream의 후처리, 디스플레이 렌더링, 그리고 AI 추론 가속화에 중요한 역할을 합니다. 커널 수준의 GPU 드라이버 변경은 이러한 작업의 성능과 안정성에 직접적인 영향을 미칩니다.

**Camera HAL 관점 해석**

카메라 HAL은 PRIVATE stream 또는 YUV stream을 통해 얻은 buffer를 GPU로 전달하여 후처리(예: 노이즈 감소, 이미지 보정, AI 필터)를 수행하는 경우가 많습니다. DRM 드라이버의 개선은 이러한 GPU 기반 이미지 처리 작업의 효율성을 높이고, NPU/GPU/ISP contention을 줄이며, buffer 전송 및 동기화 latency를 개선할 수 있습니다. HAL은 Gralloc을 통해 buffer를 할당하고 관리하므로, GPU 드라이버의 안정성은 buffer lifecycle 관리의 견고성과도 직결됩니다.

**우리 팀이 확인할 Action Item**

- 2026년 5월 17일까지 현재 개발 중인 기기의 vendor kernel 소스 코드에서 Linux 7.1-rc2의 DRM 그래픽 드라이버 관련 패치와 유사한 변경 사항이 있는지 [Owner: Lisa Kim] 팀에서 검토합니다.
- 2026년 5월 24일까지 ImageAnalysis 또는 Video Recording 스트림에서 GPU 기반 후처리(예: OpenGL ES 또는 Vulkan 렌더링)를 사용하는 시나리오에 대한 latency 및 frame drop 테스트를 실행하고, [Owner: Mark Lee] 팀에서 GPU utilization을 측정합니다.
- 2026년 5월 24일까지 Gralloc buffer 할당 및 해제 시 kernel log를 모니터링하여 GPU 드라이버 관련 crash 또는 warning이 증가했는지 확인하고, [Owner: Nancy Park] 팀에서 결과를 보고합니다.

**팀 공유용 한 줄**

Linux 7.1-rc2의 GPU 드라이버 개선은 카메라 HAL의 이미지 처리 성능과 안정성에 긍정적인 영향을 줄 수 있습니다. vendor kernel의 패치 통합 여부를 확인하고, GPU 기반 카메라 stream 시나리오에서 성능 및 안정성 테스트를 수행해야 합니다.

**출처**

- [Linux 7.1-rc2 Bringing Some More Improvements/Fixes For Older AMD GPUs](https://www.phoronix.com/news/Linux-7.1-rc2-GPU-Driver-Fixes)

---

## 5. AI plus camera input path or HAL workflow

### Android용 하이브리드 추론 및 새로운 Gemini 모델 출시: 카메라 HAL의 AI 통합 및 성능 최적화 과제

![Android 하이브리드 추론 솔루션 아키텍처 다이어그램](https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgoPylOD-Ekyhe8AVg3iMvz6S1rsvUT_2Eb4m-77FRH4eebi5psKE8VJwu6xVxCzKXyTXpoxb3-k04e21C6-8KX0BQw0qiCBGToSHJzVYQRckBYqby9csdOCHWp_23DTfPOpWqfjFTL-vJh86Q-DhGLZnbs1L62q4iUsaHHWlpQ2oyLXo3OO0rGsH9ngxw/s1600/Hybrid%20inference%20solution%20for%20Android%20%20-%20Meta.png)

_Image: [Experimental hybrid inference and new Gemini models for Android](https://android-developers.googleblog.com/2026/04/Hybrid-inference-and-new-AI-models-are-coming-to-Android.html)_


**이번 주 확인한 사실**

- 출시일: 2026년 4월 17일
- API/컴포넌트: Firebase AI Logic용 새로운 API, Gemini 모델 (Nano Banana 모델)
- 동작 변경: 온디바이스 및 클라우드 추론을 활용하는 하이브리드 추론 도입, 이미지 생성을 위한 새로운 Gemini 모델 지원.

**배경지식**

모바일 기기에서 AI 추론은 온디바이스 처리와 클라우드 처리 사이의 균형을 필요로 합니다. 온디바이스 추론은 낮은 지연 시간과 개인 정보 보호 이점을 제공하지만, 기기 리소스(NPU, GPU, 메모리, 배터리)에 제약이 있습니다. 클라우드 추론은 더 강력한 모델과 컴퓨팅 파워를 제공하지만, 네트워크 지연과 데이터 전송 비용이 발생합니다. 하이브리드 추론은 이 두 가지 접근 방식의 장점을 결합하여 최적의 성능과 효율성을 달성하려는 전략입니다.

**Camera HAL 관점 해석**

하이브리드 추론 도입은 카메라 HAL이 제공하는 스트림(YUV, PRIVATE)이 AI 모델의 입력으로 사용될 때, 온디바이스 NPU/GPU 스케줄링 및 메모리 관리에 새로운 고려 사항을 추가합니다. HAL은 AI 워크로드의 우선순위, 버퍼 수명 주기, 그리고 클라우드 전송을 위한 데이터 준비(예: 압축, 형식 변환)에 대한 영향을 평가해야 합니다. 특히, 이미지 생성 모델은 고해상도 또는 특정 형식의 데이터를 요구할 수 있으며, 이는 HAL의 스트림 구성 및 버퍼 할당 전략에 영향을 미칠 수 있습니다. HAL은 AI 파이프라인의 시작점으로서, 프레임 데이터의 효율적인 전달과 추론 결과에 따른 카메라 동작 조정을 위한 메타데이터 동기화에 주의를 기울여야 합니다.

**우리 팀이 확인할 Action Item**

- 2026년 5월 17일까지, Firebase AI Logic의 하이브리드 추론 API를 사용하는 샘플 앱을 구현하여 Preview + ImageAnalysis 스트림 조합에서 온디바이스/클라우드 추론 전환 시 `dumpsys media.camera` 및 `systrace`를 통해 NPU/GPU 스케줄링 및 버퍼 수명 주기 변화를 분석합니다. (담당: AI 통합 팀)
- 2026년 5월 17일까지, 이미지 생성을 위한 Gemini Nano Banana 모델이 요구하는 카메라 스트림 형식(예: YUV_420_888)을 HAL이 효율적으로 제공하는지 확인하기 위해, 특정 해상도(예: 1920x1080)에서 ImageReader를 통한 프레임 획득 및 전처리 지연 시간을 측정합니다. (담당: 스트림 관리 팀)
- 2026년 5월 17일까지, 하이브리드 추론 시나리오에서 AI 워크로드 발생 전후의 카메라 캡처 지연 시간(capture latency) 및 프레임 드롭(frame drop) 지표를 기록하고, Baseline (온디바이스 전용)과 비교하여 성능 회귀 여부를 확인하는 테스트 케이스를 추가합니다. (담당: 성능 검증 팀)

**팀 공유용 한 줄**

Android의 하이브리드 AI 추론 및 새로운 Gemini 모델은 카메라 HAL이 AI 워크로드의 효율적인 데이터 경로, NPU/GPU 자원 관리, 그리고 새로운 이미지 생성 기능 지원을 위해 스트림 구성 및 버퍼 처리를 최적화해야 함을 시사합니다.

**출처**

- [Experimental hybrid inference and new Gemini models for Android](https://android-developers.googleblog.com/2026/04/Hybrid-inference-and-new-AI-models-are-coming-to-Android.html)


## 이번 주 실행 항목

- Android 17 Beta 4 빌드에서 모든 Camera ITS, CTS, VTS 카메라 관련 테스트를 실행하고, 실패하는 테스트 케이스에 대한 근본 원인을 분석하여 HAL 수정 계획을 수립합니다.
- Firebase AI Logic의 하이브리드 추론 API를 사용하는 샘플 앱을 구현하여 Preview + ImageAnalysis 스트림 조합에서 온디바이스/클라우드 추론 전환 시 NPU/GPU 스케줄링 및 버퍼 수명 주기 변화를 분석합니다.
- Linux 7.1 커널 기반의 테스트 빌드에서 비디오 녹화 중 오디오 재생 시나리오를 포함한 모든 카메라 CTS/VTS 테스트를 실행하고, 실패 또는 성능 저하가 발생하는지 확인합니다.
- GPU 기반 이미지 후처리 및 AI 워크로드를 사용하는 카메라 시나리오의 엔드투엔드 지연 시간을 측정하고, Linux 7.1-rc2 커널 업데이트 후 성능 향상 또는 회귀 여부를 보고합니다.

## 참고자료

- [The Fourth Beta of Android 17](https://android-developers.googleblog.com/2026/04/the-fourth-beta-of-android-17.html)
- [Experimental hybrid inference and new Gemini models for Android](https://android-developers.googleblog.com/2026/04/Hybrid-inference-and-new-AI-models-are-coming-to-Android.html)
- [Linux 7.1 Fixes Audio For The Steam Deck OLED After Being Broken 2 Years On The Upstream Kernel](https://www.phoronix.com/news/Steam-Deck-OLED-Audio-Fix)
- [Linux 7.1-rc2 Bringing Some More Improvements/Fixes For Older AMD GPUs](https://www.phoronix.com/news/Linux-7.1-rc2-GPU-Driver-Fixes)
