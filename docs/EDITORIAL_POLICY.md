# AOSP Camera / Driver / SoC Platform 뉴스레터 편집 정책

이 문서는 기사를 어떤 기준으로 쓰고 무엇을 발행 가능한 글로 볼지를 정하는 편집 정책입니다.

## 근거 구체성 요구사항

각 main article은 출처가 제공한다면 concrete evidence(구체적 근거)를 반드시 포함해야 합니다. 구체적 근거란 version 또는 release name, release date, API/component, behavior change, explicit source gap 같은 것입니다.

"AOSP update를 모니터링한다", "CameraX change를 review한다" 같은 막연한 표현(generic wording)은 그 자체로는 발행할 수 없습니다. exact source, version, API, date, behavior를 함께 이름으로 적어야만 발행 가능합니다.

AI, C++, Linux, SoC/platform, tooling 기사는 다음 중 하나로 카메라와의 관련성을 설명해야 합니다: camera input path, stream/buffer/metadata/request/result behavior, V4L2/libcamera, ISP/image sensor, CTS/VTS/Camera ITS validation, latency, frame drop, thermal, memory, CPU/GPU/NPU/ISP contention, HAL/driver/native team workflow.

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

- 주요 기사 수, Primary Camera Stack 필수 조건, supporting/forbidden bucket은 아래 generated Newsletter Policy block과 `src/shared/config/newsletter-policy.json`을 따릅니다.
- briefing은 정확히 3개 bullet로 유지합니다.
- 각 주요 기사는 확인한 사실, 배경지식, Camera HAL 관점, Action Item, 과장 금지 메모, Sources를 포함합니다.
- AI 관련 기사는 필수가 아니라 보완 항목입니다. 포함하는 경우 일반 AI 제품 발표만으로는 충분하지 않으며 camera input path, on-device inference, NPU/GPU scheduling, image privacy, agent-assisted HAL workflow 중 하나와 연결되어야 합니다.
- Primary Camera Stack 기사 필수 조건은 `src/shared/config/newsletter-policy.json`의 `articlePolicy.primaryCameraStack`을 따릅니다.

## 발행 모드 (DEEP / CONTEXT / QUIET)

그날 수집된 카메라 신호량(camera signal)에 따라 발행 형식이 결정론적으로 정해집니다. 판정 임계값은 `src/shared/config/newsletter-policy.json`의 `publishModePolicy`를 따릅니다. 세 가지 모드는 다음과 같습니다.

- DEEP: 카메라 코어(direct_aosp_camera / camera_driver_image_pipeline) 후보가 1건 이상이면 메인 기사 중심으로 깊게 다룹니다.
- CONTEXT: 코어가 없지만 인접/SoC/도구 신호가 임계 이상이면, 메인 기사를 강요하지 않고 "실무 레이더" 관점의 맥락 브리핑으로 발행합니다.
- QUIET: 신호가 임계 미만이면 3줄 브리핑과 다음 관전 포인트만 간결하게 발행합니다.

CONTEXT/QUIET 모드에서도 근거·출처 규칙은 동일하게 적용됩니다. 모드는 발행 형식을 바꿀 뿐 품질 게이트를 낮추지 않습니다.

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

SoC/CPU/GPU/NPU/ISP, memory bandwidth, power/thermal/performance 정보는 우선순위가 낮은 fallback이지만 배제하지는 않습니다. 단, 두 조건을 지켜야 합니다.

- 사내 정보가 아니라 공개 기사 또는 공개 문서를 근거로 해야 합니다.
- Camera framework, HAL, driver, image pipeline, 성능/전력/발열 검증 관점 중 하나로 설명할 수 있어야 합니다.

Camera HAL / Android Camera 후보가 부족할 때는 C++ 기사를 fallback으로 쓸 수 있습니다. 이때 C++ 기사는 concurrency, memory safety, performance, compiler/toolchain, diagnostics처럼 native HAL code의 안정성과 직접 연결되어야 합니다. 일반 C++ community news는 제외합니다.

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
<!-- This block is generated. Update src/shared/config/newsletter-policy.json, then run npm.cmd run sync:policy-docs. -->

### 뉴스레터 정책 (Newsletter Policy)

- 정본 출처(source of truth): `src/shared/config/newsletter-policy.json`
- 주요 기사 수: 1-5
- 단일 기사 정책(one-article policy): 완전히 발행 가능한 주요 기사가 하나뿐이어도 공개 발행할 수 있습니다. 기사 수 상한은 위의 주요 기사 수(1-5)를 그대로 따릅니다.
- 기사 수만으로 단일 기사 호가 품질 저하 또는 검토 전용으로 분류되지는 않습니다. 단, 하드 품질 게이트는 그대로 적용됩니다.
- 보조 전용 정책(supporting-only policy): 보조 주요 버킷 기사 하나도 모든 하드 게이트를 통과하면 공개 가능 상태가 될 수 있습니다.
- 검토 게이트(review gate) Primary Camera Stack 기사: 단일 기사 정책으로 비활성화됨
- 발행 가능(publish-ready) Primary Camera Stack 기사: 단일 기사 정책으로 비활성화됨
- 발행 가능(publish-ready) direct AOSP Camera 또는 driver/image pipeline 기사: 단일 기사 정책으로 비활성화됨 (`direct_aosp_camera`, `camera_driver_image_pipeline` 버킷 대상)
- 발행 가능(publish-ready) 보조 주요 기사: 보조 주요 버킷 전체에서 최대 1개
- Primary Camera Stack 버킷: `direct_aosp_camera`, `camera_driver_image_pipeline`, `android_platform_camera_adjacent`
- 보조 주요 버킷: `android_multimedia_camera_output`, `soc_platform_signal`, `cpp_ai_tooling_fallback`
- 금지 주요 버킷: `generic_tech_watchlist`; 후보 수만으로 이 버킷을 주요 기사로 승격하지 않습니다
- 후보 풀 사전점검(candidate pool preflight): 발행 가능 후보 최소 1개; 예비 후보는 진단용으로만 사용; camera stack 후보 최소 0개
- 선정 기간(selection windows): primary 7일; fallback 21일; reference 35일
- 선정 기간 적용(selection window enforcement): 주요 선정은 강제 적용되며, fallback 기간 후보는 primary 기간 선정이 부족할 때에만 승격됩니다.
- 지난 소식(Catch-up) 레인: 신규 선정이 3개 미만이면, 비어 있는 주요 슬롯을 `direct_aosp_camera`, `camera_driver_image_pipeline`, `android_platform_camera_adjacent` 버킷에서 최대 35일 이내의 미게재 릴리스로 채웁니다. 호당 최대 2개이며 각각 한 번씩만 게재하고, 신규 콘텐츠를 밀어내지 않습니다.
- 릴리스 캐치업(release-class) 레인: 릴리스 채널(collectionModeHint `release-note-watch`) 소스의 미게재 릴리스는, 신규 선정이 목표를 채운 주에도 주요 기사 최대치 아래 여유 슬롯을 호당 최대 1개까지 쓸 수 있습니다. 같은 품질 하한·중복·게재 이력 검사를 그대로 통과해야 하며, 신규 콘텐츠를 밀어내지 않습니다.
- 심층(deep-dive) 발동 조건(파이프라인 내부 판정 — 편집 지시가 아닙니다): 위클리 발행이 모두 끝난 뒤, 그 주 최종 기사 중 `direct_aosp_camera` 버킷 수가 1 이하이면 심층 주제 큐에서 주제 하나를 고릅니다. 이 숫자는 기사 수 상한도, 버킷 구성 제한도 아닙니다 — 기사 수와 버킷 구성은 위의 주요 기사 수와 발행 가능 구성 규칙만 따릅니다. 1단계는 shadow라 결과는 report로만 남고 뉴스레터에는 실리지 않으므로, 편집 단계에서는 이 항목을 고려하지 마세요.
- 홈페이지 헤드라인 정책(homepage headline policy): linear decay; 일별 감쇠 2 point(s)/day; 교체 마진(replacement margin) 5; 최소 헤드라인 점수(minimum headline score) 40; 최신호 포함 필수(latest inclusion required) true; 이력 최대(history max) 50
- 발행 게이트(publish gate): PASS는 source gap이 없고, fact-check must_fix가 없으며, 차단성 감점(blocking deduction)이 없고, 모든 기사가 fact-checker에 의해 발행 가능으로 표시되어야 합니다. 수치 기반 품질 임계값은 없습니다.
- 편집 품질(editorial quality): fact-checker(LLM)가 각 기사를 Camera HAL SW 엔지니어에게 유용한지 기준으로 판정합니다(주제 무관 — C++, AI, Linux 기사라도 해당 엔지니어에게 도움이 되면 자격이 있습니다). 주제/깊이 휴리스틱은 결정론적 발행 게이트로 사용하지 않습니다.
- 하드 실패 조건은 계속 차단됩니다(hard fail conditions remain blocking): source-less main article; source candidate binding failure; missing dated evidence; source_gap_risk; fact-check must_fix; duplicate source URL; stale claim hard failure; undated watch/reference page promoted to main article; CameraX source extraction failure; blocked source quality; source quality drift

<!-- NEWSLETTER_POLICY:END -->
