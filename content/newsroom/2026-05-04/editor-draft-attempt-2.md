# Camera HAL SW 뉴스레터 - 2026-05-04

이번 주 뉴스레터는 Android 플랫폼의 AI 및 카메라 관련 주요 업데이트와 Linux 커널의 미디어 스택 개선 사항을 다룹니다. Android 17 베타 4 출시로 HAL 호환성 최종 점검이 중요해졌으며, 하이브리드 AI 추론 도입은 카메라 프레임 처리 및 NPU/GPU 리소스 관리에 새로운 과제를 제시합니다. 또한, Linux 커널의 GPU 드라이버 개선과 새로운 AV2 비디오 디코더 공개는 HAL의 이미지 처리 및 비디오 인코딩/디코딩 파이프라인에 장기적인 영향을 미칠 수 있습니다.

## 1. 이번 주 3줄 브리핑
- Android 하이브리드 AI 추론 및 Gemini 모델 지원이 발표되어, HAL은 AI 스트림의 NPU/GPU 리소스 및 전력/열 관리를 최적화해야 합니다.
- Android 17 베타 4가 출시되어 플랫폼 안정성 단계에 진입했으며, HAL 팀은 Camera2 API 호환성 및 CTS/VTS/Camera ITS 통과 여부를 최종 점검해야 합니다.
- Linux 7.1-rc2 커널에 구형 AMD GPU 드라이버 개선 사항이 포함되어, HAL의 GPU 기반 이미지 처리 및 AI 추론 성능에 영향을 줄 수 있습니다.

## 2. AI plus camera input path or HAL workflow

### Android 하이브리드 추론 및 새로운 Gemini 모델 지원

![Android 하이브리드 추론 솔루션 다이어그램](../../assets/images/fallback/ai.svg)

_Image: [Android Developers Blog](https://android-developers.googleblog.com/2026/04/Hybrid-inference-and-new-AI-models-are-coming-to-Android.html)_


**이번 주 확인한 사실**

- Release date: 2026-04-17
- API/component: Firebase AI Logic API, Gemini models (Nano Banana)
- Behavior change: 하이브리드 추론을 위한 새로운 Firebase API가 도입되어 on-device 및 Cloud 추론을 모두 활용할 수 있게 되었으며, 이미지 생성을 위한 최신 Nano Banana 모델을 포함한 새로운 Gemini 모델이 지원됩니다.

**배경지식**

AI 추론은 on-device에서 저지연 및 개인 정보 보호 이점을 제공하지만, 복잡한 모델은 클라우드 리소스가 필요합니다. 하이브리드 추론은 이 두 가지 접근 방식을 결합하여 최적의 성능과 효율성을 달성합니다. 카메라 HAL은 이미지/비디오 프레임을 AI 모델에 제공하는 중요한 역할을 합니다.

**Camera HAL 관점 해석**

HAL은 on-device AI 추론을 위해 카메라 프레임을 효율적으로 NPU/GPU로 전달해야 합니다. 하이브리드 추론 시나리오에서는 on-device 추론 부하가 증가할 수 있으므로, HAL은 스트림 구성, 버퍼 관리, 전력 및 열 제어 메커니즘을 최적화하여 프레임 드롭 없이 안정적인 성능을 보장해야 합니다. 특히 ImageAnalysis 유스케이스와 같은 AI 관련 스트림의 우선순위 및 리소스 할당을 검토해야 합니다.

**우리 팀이 확인할 Action Item**

- ImageAnalysis 스트림을 사용하는 AI 추론 시나리오에서 특정 NPU/GPU 로드 조건(예: 50%, 80%)에서 YUV 프레임 드롭률과 end-to-end 지연 시간을 측정하는 자동화된 테스트를 추가합니다. (담당: AI 통합 팀)
- Gemini Nano Banana 모델을 활용하는 이미지 생성 앱에서 카메라 프리뷰와 동시에 동작할 때 디바이스의 열 스로틀링(thermal throttling) 발생 여부와 전력 소모를 기록합니다. (담당: 전력/열 관리 팀)
- Firebase AI Logic API의 on-device 추론 경로에서 카메라 HAL이 제공하는 ANativeWindow 또는 HardwareBuffer의 버퍼 수명 주기 및 동기화가 올바르게 처리되는지 로그를 통해 확인합니다. (담당: HAL 코어 팀)

**팀 공유용 한 줄**

Android의 하이브리드 AI 추론 및 Gemini 모델 지원은 HAL이 카메라 프레임을 AI 파이프라인에 효율적으로 제공하고, NPU/GPU 리소스 및 전력/열 관리를 최적화해야 함을 의미합니다.

**출처**

- [Experimental hybrid inference and new Gemini models for Android](https://android-developers.googleblog.com/2026/04/Hybrid-inference-and-new-AI-models-are-coming-to-Android.html)

---

## 3. Android Camera / platform API

### Android 17 베타 4 출시: 플랫폼 안정성 최종 점검

![Android 17 베타 4 로고](https://blogger.googleusercontent.com/img/a/AVvXsEjRi_pfW7jI2yTebiDh4niQsTN1UL9MmUbO1DUy_ensXVVhStxJt5PUfBSQVOkpOC4ReJ1G2OMtpOZj0fq_3XiUY3fVq91hldHzZU-FPcHkLnG33NAEAV9Wxl4PVZWJHUwbbi1mZxUzQA5YIOGMhDC6mL00CYZei7fNAGDpMhK1JqtlwIOtoIVmIZn2XTE=w1200-h630-p-k-no-nu)

_Image: [Android Developers Blog](https://android-developers.googleblog.com/2026/04/the-fourth-beta-of-android-17.html)_


**이번 주 확인한 사실**

- Release date: 2026-04-16
- Version/release: Android 17 Beta 4
- API/component: Android SDK, Platform Stability
- Behavior change: Android 17의 마지막 베타 릴리스로, 앱 호환성 및 플랫폼 안정성에 중점을 둡니다. 새로운 API 및 기능에 대한 최종 테스트 환경을 제공합니다.

**배경지식**

Android 베타 릴리스는 다음 주요 OS 버전의 안정성을 확보하고 개발자가 앱을 테스트할 수 있도록 합니다. 플랫폼 안정성 단계는 API가 확정되었음을 의미하며, HAL 구현은 이러한 확정된 API 및 동작에 대한 호환성을 최종적으로 검증해야 합니다.

**Camera HAL 관점 해석**

HAL 팀은 Android 17 Beta 4에서 Camera2 API의 변경 사항이나 새로운 CDD(Compatibility Definition Document) 요구사항이 있는지 면밀히 검토해야 합니다. 특히 camera.request.template, camera.capture.result 메타데이터 필드의 동작 변화, 새로운 스트림 조합 지원 여부, 그리고 logical/physical camera 동작의 일관성을 확인해야 합니다. 플랫폼 안정성 단계이므로, 기존 HAL 구현이 새로운 프레임워크 동작과 충돌하지 않는지 확인하는 것이 중요합니다.

**우리 팀이 확인할 Action Item**

- Android 17 Beta 4가 설치된 개발 보드에서 adb shell dumpsys media.camera 명령을 사용하여 모든 CameraCharacteristics 필드와 HAL이 선언하는 기능을 검토하고, 변경된 CDD 요구사항과 비교하여 불일치 사항을 보고합니다. (담당: HAL 아키텍처 팀)
- Android 17 Beta 4용 최신 CTS/VTS/Camera ITS 테스트 스위트를 다운로드하여 모든 카메라 관련 테스트를 실행하고, 실패한 테스트 케이스에 대해 근본 원인 분석을 시작합니다. (담당: QA 및 테스트 팀)
- Preview (YUV) + ImageCapture (JPEG) + VideoCapture (PRIVATE) 스트림 조합을 사용하는 자동화된 테스트를 10분간 실행하여 프레임 드롭률이 0%를 유지하는지, 그리고 캡처 지연 시간이 이전 Android 버전과 비교하여 회귀하지 않았는지 확인합니다. (담당: 성능 팀)

**팀 공유용 한 줄**

Android 17 베타 4는 플랫폼 안정성을 위한 최종 점검 단계로, HAL 팀은 Camera2 API 호환성, CTS/VTS/Camera ITS 통과 여부, 그리고 주요 스트림 조합의 성능 회귀를 철저히 확인해야 합니다.

**출처**

- [The Fourth Beta of Android 17](https://android-developers.googleblog.com/2026/04/the-fourth-beta-of-android-17.html)

---

## 4. Linux camera / libcamera / V4L2

### Linux 7.1-rc2, 구형 AMD GPU 드라이버 개선 및 수정

![구형 AMD Radeon HD 7850 그래픽 카드](https://www.phoronix.net/image.php?id=amd_radeon_hd7850&image=amd_hd7850_sys2)

_Image: [Phoronix Linux Camera / Media](https://www.phoronix.com/news/Linux-7.1-rc2-GPU-Driver-Fixes)_


**이번 주 확인한 사실**

- Release date: 2026-05-02
- Version/release: Linux 7.1-rc2
- API/component: Direct Rendering Manager (DRM), GPU driver
- Behavior change: Linux 7.1-rc2 커널에 DRM 그래픽 드라이버 수정 사항 병합, 구형 AMD GPU에 대한 개선 사항 포함.

**배경지식**

Linux 커널의 GPU 드라이버는 Android 시스템의 그래픽 렌더링 및 컴퓨팅 작업에 필수적입니다. Camera HAL은 종종 GPU를 사용하여 이미지 처리, 노이즈 감소, AI 추론 후처리 등 고성능 작업을 오프로드합니다. 드라이버의 안정성과 성능은 이러한 작업의 효율성에 직접적인 영향을 미칩니다.

**Camera HAL 관점 해석**

HAL은 카메라 스트림의 후처리(예: 3A 알고리즘, 이미지 보정, AI 전처리)를 위해 GPU를 활용할 수 있습니다. GPU 드라이버의 안정성 및 성능 개선은 이러한 작업의 지연 시간을 줄이고 프레임 드롭을 방지하는 데 기여할 수 있습니다. 특히 GRALLOC_USAGE_HW_COMPOSER 또는 GRALLOC_USAGE_GPU_DATA_BUFFER와 같은 GPU 관련 버퍼 사용 플래그를 사용하는 스트림에서 HAL의 동작을 검토해야 합니다.

**우리 팀이 확인할 Action Item**

- Preview (PRIVATE) + ImageAnalysis (YUV) 스트림 조합에서 GPU 기반 노이즈 감소 또는 샤프닝 알고리즘을 활성화한 후, Linux 7.1-rc2 커널을 사용하는 개발 보드에서 GPU 사용률과 프레임 처리 지연 시간을 벤치마킹하여 이전 커널 버전과 비교합니다. (담당: ISP/GPU 통합 팀)
- camera.request.maxNumOutputStreams 및 camera.request.maxNumInputStreams와 같은 HAL 특성 중 GPU 관련 버퍼 사용 플래그(GRALLOC_USAGE_GPU_DATA_BUFFER)를 포함하는 스트림 조합에 대한 지원 여부와 성능을 확인하는 테스트 케이스를 실행합니다. (담당: HAL 코어 팀)
- 고부하 카메라 시나리오(예: 4K 60fps 비디오 녹화 중 AI 객체 감지)에서 systrace 또는 perf 도구를 사용하여 NPU와 GPU 간의 스케줄링 경합 지표를 수집하고, Linux 7.1-rc2 커널 업데이트가 이 경합에 미치는 영향을 분석합니다. (담당: 성능 분석 팀)

**팀 공유용 한 줄**

Linux 7.1-rc2의 GPU 드라이버 개선은 카메라 HAL의 GPU 기반 이미지 처리 및 AI 추론 성능에 긍정적인 영향을 줄 수 있습니다. HAL 팀은 GPU 활용 스트림의 성능과 NPU/GPU 리소스 경합을 면밀히 모니터링해야 합니다.

**출처**

- [Linux 7.1-rc2 Bringing Some More Improvements/Fixes For Older AMD GPUs](https://www.phoronix.com/news/Linux-7.1-rc2-GPU-Driver-Fixes)

---

## 5. Linux camera / libcamera / V4L2

### VideoLAN, 오픈 소스 AV2 디코더 Dav2d 공개

![AV2 로고](https://www.phoronix.net/image.php?id=2026&image=av2)

_Image: [Phoronix Linux Camera / Media](https://www.phoronix.com/news/Dav2d-Open-Source-AV2-Decode)_


**이번 주 확인한 사실**

- Release date: 2026-05-02
- API/component: Dav2d (AV2 decoder), AV2 specification
- Behavior change: VideoLAN이 오픈 소스 AV2 디코더인 Dav2d를 출시했습니다. AV2 사양은 아직 초안 단계입니다.

**배경지식**

AV2는 차세대 비디오 코덱으로, 기존 코덱보다 더 높은 압축 효율을 목표로 합니다. VideoLAN의 오픈 소스 디코더 출시는 이 새로운 코덱의 채택을 가속화할 수 있습니다. Android 미디어 프레임워크와 Camera HAL은 비디오 인코딩/디코딩 기능을 제공하며, 새로운 코덱에 대한 하드웨어 가속 지원은 중요한 고려 사항입니다.

**Camera HAL 관점 해석**

Camera HAL은 비디오 녹화 스트림(예: VideoCapture)을 통해 인코딩된 비디오 데이터를 미디어 프레임워크에 전달합니다. 미래에 AV2 코덱이 널리 채택되면, HAL은 AV2 인코딩을 위한 하드웨어 가속 기능을 노출하고 지원해야 할 수 있습니다. Dav2d 디코더의 출시는 AV2 콘텐츠의 소비가 증가할 수 있음을 시사하며, 이는 HAL이 AV2 인코딩 기능을 제공해야 하는 압력을 높일 수 있습니다. HAL은 AV2 인코딩/디코딩 시나리오에서 PRIVATE 또는 YUV 스트림의 버퍼 형식, 성능, 전력 효율성을 검토해야 합니다.

**우리 팀이 확인할 Action Item**

- AV2 사양의 최종 확정 여부와 Android 미디어 프레임워크의 공식 지원 계획을 매월 1회 AOSP 개발자 문서 및 관련 포럼을 통해 확인하고, HAL 로드맵에 반영할 필요성을 평가합니다. (담당: HAL 아키텍처 팀)
- 현재 디바이스에서 AV1 비디오 인코딩 시 VideoCapture 스트림의 CPU/GPU/ISP 사용률, 전력 소모, 인코딩 지연 시간을 측정하고, 이 데이터를 기반으로 AV2 하드웨어 인코더 지원 시 예상되는 리소스 요구사항을 추정합니다. (담당: 성능 팀)
- Dav2d 디코더를 사용하여 AV2 샘플 비디오를 재생할 때, Camera HAL이 PRIVATE 또는 YUV 스트림을 통해 제공하는 비디오 버퍼의 디코딩 성능 및 프레임 동기화 문제를 테스트할 수 있는 PoC(Proof of Concept) 환경 구축을 검토합니다. (담당: 미디어 통합 팀)

**팀 공유용 한 줄**

VideoLAN의 오픈 소스 AV2 디코더 출시는 미래에 Camera HAL이 AV2 비디오 인코딩/디코딩을 위한 하드웨어 가속 지원을 고려해야 할 필요성을 시사합니다. HAL 팀은 사양 진행 상황을 모니터링하고 성능 요구사항을 예측해야 합니다.

**출처**

- [VideoLAN Publishes Dav2d For Open-Source AV2 Decoder](https://www.phoronix.com/news/Dav2d-Open-Source-AV2-Decode)


## 이번 주 실행 항목

- ImageAnalysis 스트림을 사용하는 AI 추론 시나리오에서 특정 NPU/GPU 로드 조건(예: 50%, 80%)에서 YUV 프레임 드롭률과 end-to-end 지연 시간을 측정하는 자동화된 테스트를 추가합니다. (담당: AI 통합 팀)
- Android 17 Beta 4가 설치된 개발 보드에서 adb shell dumpsys media.camera 명령을 사용하여 모든 CameraCharacteristics 필드와 HAL이 선언하는 기능을 검토하고, 변경된 CDD 요구사항과 비교하여 불일치 사항을 보고합니다. (담당: HAL 아키텍처 팀)
- Preview (PRIVATE) + ImageAnalysis (YUV) 스트림 조합에서 GPU 기반 노이즈 감소 또는 샤프닝 알고리즘을 활성화한 후, Linux 7.1-rc2 커널을 사용하는 개발 보드에서 GPU 사용률과 프레임 처리 지연 시간을 벤치마킹하여 이전 커널 버전과 비교합니다. (담당: ISP/GPU 통합 팀)
- AV2 사양의 최종 확정 여부와 Android 미디어 프레임워크의 공식 지원 계획을 매월 1회 AOSP 개발자 문서 및 관련 포럼을 통해 확인하고, HAL 로드맵에 반영할 필요성을 평가합니다. (담당: HAL 아키텍처 팀)
- Android 17 Beta 4용 최신 CTS/VTS/Camera ITS 테스트 스위트를 다운로드하여 모든 카메라 관련 테스트를 실행하고, 실패한 테스트 케이스에 대해 근본 원인 분석을 시작합니다. (담당: QA 및 테스트 팀)
- 현재 디바이스에서 AV1 비디오 인코딩 시 VideoCapture 스트림의 CPU/GPU/ISP 사용률, 전력 소모, 인코딩 지연 시간을 측정하고, 이 데이터를 기반으로 AV2 하드웨어 인코더 지원 시 예상되는 리소스 요구사항을 추정합니다. (담당: 성능 팀)

## 참고자료

- [Experimental hybrid inference and new Gemini models for Android](https://android-developers.googleblog.com/2026/04/Hybrid-inference-and-new-AI-models-are-coming-to-Android.html)
- [The Fourth Beta of Android 17](https://android-developers.googleblog.com/2026/04/the-fourth-beta-of-android-17.html)
- [Linux 7.1-rc2 Bringing Some More Improvements/Fixes For Older AMD GPUs](https://www.phoronix.com/news/Linux-7.1-rc2-GPU-Driver-Fixes)
- [VideoLAN Publishes Dav2d For Open-Source AV2 Decoder](https://www.phoronix.com/news/Dav2d-Open-Source-AV2-Decode)
