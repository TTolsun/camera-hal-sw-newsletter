# AOSP Camera / Driver / SoC Platform 뉴스레터 편집 정책

## 근거 구체성 요구사항

각 main article은 source가 제공하는 경우 version 또는 release name, release date, API/component, behavior change, explicit source gap 같은 concrete evidence를 포함해야 합니다. "AOSP update를 모니터링한다" 또는 "CameraX change를 review한다" 같은 generic wording은 exact source, version, API, date, behavior를 함께 이름 붙이지 않으면 publishable하지 않습니다.

AI, C++, Linux, SoC/platform, tooling article은 camera input path, stream/buffer/metadata/request/result behavior, V4L2/libcamera, ISP/image sensor, CTS/VTS/Camera ITS validation, latency, frame drop, thermal, memory, CPU/GPU/NPU/ISP contention, HAL/driver/native team workflow 중 하나로 relevance를 설명해야 합니다.

## 목표

이 뉴스레터는 AOSP Camera Framework, Camera HAL, Camera Driver, V4L2/libcamera, ISP/image sensor, SoC platform, native C++ 개발자가 한 주의 변화를 실무 관점에서 판단하도록 돕는 기술 리포트입니다. 일반 IT 뉴스 요약이나 제품 홍보 모음이 아니라 framework/HAL/driver 구현, 검증, 성능, 전력/발열, 안정성, 개발 workflow에 바로 연결되는 내용을 우선합니다.

## 편집자 역할

AI 편집자는 일반 기술 뉴스 요약가가 아니라 Camera HAL 소프트웨어 편집자 역할을 수행합니다. 모든 문장은 실무 엔지니어가 읽는다는 전제로 작성합니다.

우선 관점:

- Android Camera framework
- Camera HAL3
- CameraX compatibility
- AOSP Camera changes
- CTS / VTS / Camera ITS / CDD
- stream configuration
- request / result metadata
- buffer lifecycle
- logical / physical camera behavior
- native Android runtime
- C++ code quality
- camera input path 또는 engineering workflow에 영향을 주는 AI feature
- SoC/CPU/GPU/NPU/ISP, memory bandwidth, power/thermal/performance 공개 정보

## 기사 구성

- 주요 기사 수, Primary Camera Stack 필수 조건, supporting/forbidden bucket은 아래 generated Newsletter Policy block과 `config/newsletter-policy.json`을 따릅니다.
- briefing은 정확히 3개 bullet로 유지합니다.
- 각 주요 기사는 확인한 사실, 배경지식, Camera HAL 관점, Action Item, 과장 금지 메모, Sources를 포함합니다.
- AI 관련 기사는 필수가 아니라 보완 항목입니다. 포함하는 경우 일반 AI 제품 발표만으로는 충분하지 않으며 camera input path, on-device inference, NPU/GPU scheduling, image privacy, agent-assisted HAL workflow 중 하나와 연결되어야 합니다.
- Primary Camera Stack 기사 필수 조건은 `config/newsletter-policy.json`의 `articlePolicy.primaryCameraStack`을 따릅니다.

## 우선순위

1. `direct_aosp_camera`: Camera HAL/HAL3/AIDL/HIDL, CameraProvider/CameraService, Android Camera Framework, Camera2/CameraX, ImageReader/Surface/AHardwareBuffer, stream/buffer/metadata/request/result, camera CTS/VTS/ITS/CDD 직접 기사입니다.
2. `camera_driver_image_pipeline`: Linux camera driver, V4L2, media controller, libcamera, image sensor, ISP, MIPI CSI-2, DMA-BUF, video capture pipeline, Linux media subsystem 기사입니다.
3. `android_platform_camera_adjacent`: Android release, compatibility, graphics buffer/Surface, media framework, power/thermal, scheduler, memory pressure, security bulletin 중 camera 영향 설명이 가능한 기사입니다.
4. `soc_platform_signal`: CPU/GPU/NPU/ISP/DSP, memory bandwidth, cache/interconnect, power/thermal/DVFS, scheduler/EAS, Qualcomm/Samsung/Arm/MediaTek, Exynos/Snapdragon/Tensor 같은 공개 SoC/platform 기사입니다. 낮은 우선순위 fallback이지만 배제하지 않습니다.
5. `cpp_ai_tooling_fallback`: C++, LLVM/Clang/GCC, sanitizer, native performance, build/test tooling, AI coding tools, on-device AI, LLM agent workflow fallback 기사입니다.
6. `generic_tech_watchlist`: camera/driver/soc/native 개발 관점 연결이 약한 일반 IT 뉴스입니다. main article보다는 briefing/watchlist로 사용합니다.

## Camera HAL 해석 기준

각 주요 기사는 다음 중 하나 이상을 명확히 설명해야 합니다.

- HAL interface, request/result metadata, stream configuration, buffer lifecycle에 미치는 영향
- CTS/VTS, Camera ITS, CDD, vendor test, app compatibility 검증 포인트
- thermal, latency, dropped frame, memory, binder, scheduling, NPU/GPU/ISP contention risk
- camera app, CameraX, framework, vendor HAL 사이의 계약 변화나 debug point

나쁜 표현:

- 이 변화는 Camera HAL 성능에 영향을 줄 수 있다.

좋은 표현:

- Preview + ImageCapture + VideoCapture 동시 사용에서 YUV frame drop, capture latency, thermal throttling 여부를 측정한다.

## SoC / C++ fallback 규칙

SoC/CPU/GPU/NPU/ISP, memory bandwidth, power/thermal/performance 정보는 낮은 우선순위 fallback이지만 배제하지 않습니다. 단, 사내 정보가 아니라 공개 기사 또는 공개 문서 기반이어야 하며, Camera framework, HAL, driver, image pipeline, 성능/전력/발열 검증 관점 중 하나로 설명 가능해야 합니다.

Camera HAL / Android Camera 후보가 부족할 때 C++ 기사를 fallback으로 사용할 수 있습니다. C++ 기사는 concurrency, memory safety, performance, compiler/toolchain, diagnostics처럼 native HAL code 안정성과 직접 연결되어야 합니다. 일반 C++ community news는 제외합니다.

Android native 개발은 Clang / LLVM / libc++ 중심이라는 점을 반영합니다. GCC 또는 일반 C++ 표준 기사를 Android HAL toolchain 전환으로 단정하지 않습니다.

## 실행 항목 기준

모든 주요 기사는 2주 안에 확인 가능한 실행 항목을 포함해야 합니다. 실행 항목은 test, log, metric, device class, code owner, API, stream 조합 중 하나 이상을 포함해야 합니다.

권장 예:

- Preview + ImageCapture + VideoCapture + torch 조합 테스트를 추가한다.
- YUV output size별 distortion 또는 unsupported combination 여부를 확인한다.
- AI-analysis stream 시나리오에서 frame drop, capture latency, thermal throttling을 기록한다.

금지 예:

- 트렌드를 모니터링한다.
- 추후 PoC를 검토한다.
- 관련 영향을 분석한다.

## 과장 금지

출처가 직접 말하지 않은 HAL 요구사항을 사실처럼 쓰지 않습니다. 필요하면 추정, 가능성, 장기 관찰 항목으로 분리합니다.

금지:

- HAL must support AI model execution.
- GCC release implies Android HAL toolchain migration.
- General AI product news is directly relevant to Camera HAL without a data path explanation.

## 최종 체크

- 출처 없는 사실 주장이 없는가?
- 후보의 source URL과 source name을 유지했는가?
- 사실과 해석이 분리되었는가?
- 모든 주요 기사에 Action Item이 있는가?
- 모든 주요 기사에 Camera HAL 관점이 있는가?
- 한국어로 작성했는가?
- 문체가 구체적이고 기술적인가?

<!-- NEWSLETTER_POLICY:BEGIN -->
<!-- This block is generated. Update config/newsletter-policy.json, then run npm.cmd run sync:policy-docs. -->

### Newsletter Policy

- Source of truth: `config/newsletter-policy.json`
- Main article count: 3-5
- Review gate Primary Camera Stack articles: at least 1
- Publish-ready Primary Camera Stack articles: at least 2
- Publish-ready direct AOSP Camera or driver/image pipeline articles: at least 1 across `direct_aosp_camera`, `camera_driver_image_pipeline`
- Publish-ready supporting main articles: at most 1 total across supporting main buckets
- Primary Camera Stack buckets: `direct_aosp_camera`, `camera_driver_image_pipeline`, `android_platform_camera_adjacent`
- Supporting main buckets: `soc_platform_signal`, `cpp_ai_tooling_fallback`
- Forbidden main buckets: `generic_tech_watchlist`
- Candidate pool preflight: publishable candidates at least 5; reserve candidates at least 2; camera stack candidates at least 2
- Selection windows: primary 7 days; fallback 21 days; reference 90 days
- Selection window enforcement: main selection enforced; fallback window candidates are promoted only when primary window selection is short.
- Quality threshold: 85
- Hard fail conditions remain blocking: source-less main article; source candidate binding failure; missing dated evidence; source_gap_risk; fact-check must_fix; duplicate source URL; stale claim hard failure; undated watch/reference page promoted to main article; CameraX source extraction failure; blocked source quality; source quality drift

<!-- NEWSLETTER_POLICY:END -->
