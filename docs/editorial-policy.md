# Camera HAL SW Newsletter Editorial Policy

## 목표

이 뉴스레터는 Camera HAL, Android Camera, CameraX, AOSP Camera, native C++ 개발자가 한 주의 변화를 실무 관점에서 판단하도록 돕는 기술 리포트다. 일반 IT 뉴스 요약이나 제품 홍보 모음이 아니라, HAL 구현과 검증, 성능, 안정성, 개발 워크플로에 바로 연결되는 내용을 우선한다.

## 기사 구성

- 새 이슈는 메인 기사 4-6개를 목표로 하며, 기본 목표는 5개다.
- 브리핑은 정확히 3개 bullet로 유지한다.
- 각 메인 기사는 확인한 사실, 배경지식, Camera HAL 관점 해석, 우리 팀이 확인할 Action Item, 팀 공유용 한 줄, Sources를 포함한다.
- 기존 3섹션 형식의 과거 이슈는 보존한다.

## 우선순위

1. AOSP Camera, Android Camera framework, CameraX, Android Compatibility, vendor camera behavior.
2. Camera HAL에 영향을 주는 Linux camera, driver, buffer, stream, metadata, request/result, performance, security 이슈.
3. Android on-device AI, NPU/GPU, image pipeline, inference runtime처럼 camera data path와 만나는 AI 이슈.
4. Camera HAL 개발 생산성에 영향을 주는 agent workflow, Android tooling, CI, debugging, testing 변화.
5. C++ native code 품질, concurrency, memory, toolchain, compiler, serialization, profiling 이슈.

## AI 필수 기사

각 새 이슈에는 최소 1개의 AI 관련 기사를 포함한다. 단, 일반 AI 제품 발표만으로는 충분하지 않다. Android camera pipeline, on-device inference, NPU/GPU scheduling, image data privacy, agent-assisted HAL workflow 중 하나와 연결해야 한다.

## Camera HAL 해석 기준

각 기사에는 다음 중 하나 이상을 명확히 써야 한다.

- HAL interface, request/result metadata, stream configuration, buffer lifecycle에 미치는 영향.
- CTS/VTS, compatibility, CDD, vendor test, app compatibility 검증 포인트.
- thermal, latency, dropped frame, memory, binder, scheduling, NPU/GPU/ISP contention 리스크.
- camera app, CameraX, framework, vendor HAL 사이의 계약 변화나 디버깅 포인트.

## C++ Fallback 규칙

Camera HAL/Android Camera 후보가 부족할 때 C++ 기사를 fallback으로 사용한다. C++ 기사는 concurrency, memory safety, performance, compiler/toolchain, serialization, diagnostics처럼 native HAL 코드 품질에 직접 연결되어야 한다. 일반 C++ 커뮤니티 뉴스는 제외한다.

## 품질 게이트

- 출처 없는 사실 주장은 허용하지 않는다.
- 후보의 source URL과 source name은 변경하지 않는다.
- 사실과 해석을 분리한다.
- 모든 메인 기사에는 팀이 바로 확인할 Action Item이 있어야 한다.
- 제품 홍보, 일반 IT 뉴스, Camera HAL 관련성이 약한 AI/C++ 뉴스는 낮은 우선순위로 둔다.
- 확실하지 않은 내용은 추정으로 표시하거나 제외한다.
