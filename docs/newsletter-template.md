# AOSP Camera / Driver / SoC Platform 뉴스레터 템플릿

이 문서는 한 호의 뉴스레터가 어떤 모양이어야 하는지를 보여 주는 템플릿입니다. editor가 기사를 작성할 때 따라야 할 섹션 순서와 각 섹션에 들어갈 내용을 정의합니다.

## 필수 근거 field (evidence field)

모든 generated article JSON은 아래 세 field를 반드시 포함해야 합니다.

- `evidence_summary`
- `specificity_checks`
- `source_verification_notes`

이 field들은 기사의 근거를 적는 곳입니다. 즉 출처가 실제로 말한 concrete version/release(구체적인 버전·릴리스), release date(릴리스 날짜), API/component(API·구성요소), behavior change(동작 변화), explicit source gap(출처가 다루지 않은 부분)을 기록합니다.

"AOSP를 모니터링한다" 같은 generic monitoring language(막연한 감시 표현)는 쓰지 않습니다. 정확한 source, version, API, date, behavior를 함께 이름으로 적어야 합니다.

# AOSP Camera / Driver / SoC Platform 뉴스레터 - YYYY-MM-DD

이슈 전체 요약을 2-4문장으로 작성합니다. 이번 주 변화가 AOSP Camera / Camera HAL / Camera Driver / SoC Platform / C++ native 개발자에게 왜 중요한지 먼저 말합니다.

## 1. 이번 주 3줄 브리핑

- 첫 번째 핵심 변화와 HAL 관점
- 두 번째 핵심 변화와 검증 포인트
- 세 번째 핵심 변화와 팀 action 방향

## 2. 기사 카테고리

### 기사 headline

**이번 주 확인한 사실**

- 출처로 확인한 사실만 적습니다.
- 날짜, 버전, 프로젝트명, API 이름은 가능한 한 구체적으로 적습니다.
- 원문에 없는 HAL 요구사항을 사실처럼 쓰지 않습니다.

**배경지식**

Camera HAL 엔지니어가 이 뉴스를 이해하는 데 필요한 Android Camera, AOSP, CameraX, C++, AI 배경을 설명합니다.

**Camera HAL 관점 해석**

HAL interface, stream/buffer, metadata, request/result, performance, compatibility, test, debugging 관점의 의미를 해석합니다. 사실과 추정을 섞지 않습니다.

가능하면 다음 용어를 구체적으로 사용합니다.

- stream configuration
- request / result metadata
- session parameter
- buffer lifecycle
- logical / physical camera
- CameraX compatibility
- CTS / VTS / Camera ITS
- YUV / JPEG / RAW / PRIVATE stream
- latency / frame drop / thermal / power
- native Android runtime
- Clang / LLVM / libc++

**우리 팀이 확인할 Action Item**

- 이번 주 또는 2주 안에 확인하거나 실험할 구체적 작업을 적습니다.
- 가능하면 test, log, code owner, metric, device class를 포함합니다.

**과장하면 안 되는 부분**

이 기사에서 과장하거나 오해하면 안 되는 지점을 명시합니다.

**팀 공유용 한 줄**

회의나 메신저에 그대로 공유할 수 있는 한 문장으로 정리합니다.

**출처**

- [Source title](https://example.com)

---

주요 기사는 모두 위와 같은 구조를 반복합니다. 다음 기준은 직접 정하지 말고 정책을 따릅니다.

- 기사 수, Primary Camera Stack 필수 조건, supporting/forbidden bucket(보조·금지 버킷): `src/shared/config/newsletter-policy.json`과 운영 문서의 generated Newsletter Policy block을 따릅니다.
- `generic_tech_watchlist` 버킷 후보는 main article로 쓰지 않고 briefing/watchlist로만 사용합니다.

## 이번 주 실행 항목

- 이슈 전체에서 가장 중요한 팀 action을 3-6개로 정리합니다.
- 각 action은 2주 안에 확인 가능한 형태여야 합니다.
- stream 조합, metadata, CTS/VTS/Camera ITS, CameraX compatibility, native runtime, AI input path 중 가능한 구체 항목을 포함합니다.

## 참고자료

- [출처 제목](https://example.com)
