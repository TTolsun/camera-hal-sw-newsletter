# 수동 품질 뉴스레터 예시

이 파일은 자동 editor가 참고하는 style과 structure 예시입니다. 최신 사실의 source가 아닙니다. 현재 candidate JSON에 같은 근거가 들어 있지 않다면 이 파일의 사실, 날짜, version, source URL, API name, behavior change, action item을 복사하지 않습니다.

## Main article 예시 구조

### Android Camera API: API/component 근거를 먼저 제시

- Headline: 이름이 있는 API/component와 release date를 포함한 Android Camera API change
- What changed: release/version/date를 먼저 쓰고, 바뀐 exact API, framework module, CTS/VTS/ITS 영역, compatibility requirement를 이름 붙입니다.
- Confirmed facts:
  - Release/version: `current candidate only`
  - Release date: `current candidate only`
  - API/component: `current candidate only`
  - Behavior change: `current candidate only`
- Background: request/result metadata, stream configuration, capability declaration, framework-to-HAL contract 중 무엇을 건드리는지 설명합니다.
- Camera HAL perspective: public API 또는 platform note를 HAL implementation impact로 번역합니다. metadata propagation, stream combination validation, latency budget, buffer ownership, vendor tag exposure, test coverage 중 하나 이상을 다룹니다.
- Camera HAL checks:
  - 바뀐 API/component를 HAL request/result key 또는 stream combination에 매핑합니다.
  - 영향을 받는 CTS/VTS/Camera ITS coverage를 확인합니다.
  - regression testing이 필요한 device class 또는 camera pipeline 하나를 이름 붙입니다.
- Action items:
  - 2주 안에 owner를 지정해 release note와 local HAL metadata behavior를 비교합니다.
  - concrete test, log, metric, device matrix entry 중 하나를 추가하거나 갱신합니다.
  - source URL, release date, API/component를 team tracking issue에 기록합니다.

### CameraX / AOSP Camera / compatibility: app-facing behavior를 HAL risk로 연결

- Headline: 구체 version과 behavior가 있는 CameraX 또는 AOSP camera compatibility item
- Evidence summary: 특정 CameraX artifact, AOSP compatibility document, CDD clause, CTS/VTS/ITS note, release note section에 연결합니다.
- Background: app-facing CameraX behavior가 framework camera service, Camera2 metadata, stream use cases, dynamic range handling, vendor-specific quirks에 어떻게 의존하는지 짧게 설명합니다.
- Camera HAL perspective: HAL team이 확인해야 할 session parameter handling, preview/capture stream combination, YUV/RAW behavior, Ultra HDR path, logical/physical camera metadata를 적습니다.
- Action items:
  - named stream 또는 metadata path를 reference device와 vendor device에서 다시 실행합니다.
  - 관찰 결과를 named release note 또는 compatibility requirement와 비교합니다.
  - app compatibility에 HAL, framework, app-side mitigation 중 무엇이 필요한지 기록합니다.

### libcamera / V4L2: Android relevance가 있는 Linux camera signal

- Headline: release/date/component 근거가 있는 libcamera 또는 V4L2 item
- Evidence summary: libcamera release/blog item, V4L2 subsystem area, media controller behavior, pipeline handler, sensor/ISP topic을 이름 붙입니다.
- Background: Linux camera concept를 한 문단으로 설명한 뒤 Android에 적용합니다.
- Camera HAL perspective: Linux-side change를 Android HAL design과 연결합니다. buffer queue, format negotiation, sensor mode selection, ISP tuning, frame timing, vendor kernel과 공유하는 debugging vocabulary를 다룹니다.
- Action items:
  - vendor kernel branch에 유사 V4L2/media patch가 있는지 확인합니다.
  - matching stream/buffer path에 diagnostic log 또는 trace point 하나를 추가합니다.
  - HAL backlog, kernel tracking, reference-only watch 중 어디에 둘지 결정합니다.

### AI camera path / HAL workflow: 왜 중요한지 정확히 설명

- Headline: camera input path, image/frame processing, NPU/GPU/ISP contention, HAL workflow relevance가 있는 AI item
- Evidence summary: 현재 candidate에서 나온 model/tool/platform release와 exact camera-adjacent behavior를 이름 붙입니다.
- Background: input data, inference placement, developer workflow, on-device resource constraint를 marketing language 없이 설명합니다.
- Camera HAL perspective: camera frame, ImageAnalysis, buffer lifetime, thermal/power budget, latency, privacy, metadata annotation, HAL debugging productivity 중 하나와 연결합니다.
- Action items:
  - input frame, expected metric, owner를 포함한 experiment 또는 PoC 하나를 정의합니다.
  - latency, frame drop, thermal, memory, developer review time 중 하나를 측정합니다.
  - source evidence를 기준으로 main article, briefing, reference 중 어디에 둘지 결정합니다.

### C++ / toolchain watch: native HAL actionability가 있을 때만 fallback

- Headline: release/version/date와 native-code consequence가 있는 LLVM/Clang/C++ item
- Evidence summary: exact compiler, sanitizer, standard feature, build-system behavior, release note item을 이름 붙입니다.
- Background: C++/toolchain change를 native Android camera service 또는 vendor HAL module 관점에서 실무적으로 설명합니다.
- Camera HAL perspective: build flags, sanitizer coverage, ABI risk, performance profiling, static analysis, concurrency safety, camera native code crash triage와 연결합니다.
- Action items:
  - HAL/native camera module을 대상으로 build 또는 sanitizer check 하나를 실행합니다.
  - warning class, binary size, performance, crash-triage impact를 기록합니다.
  - Camera HAL actionability가 concrete할 때만 main article 0-1개로 유지하고, 아니면 briefing/reference로 낮춥니다.
