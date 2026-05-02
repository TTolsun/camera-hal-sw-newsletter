# Camera HAL SW Newsletter Template

# Camera HAL SW Newsletter - YYYY-MM-DD

이슈 전체 요약을 2-4문장으로 작성한다. 이번 주 변화가 Camera HAL / Android Camera / C++ native 개발팀에 왜 중요한지 먼저 말한다. 일반 기술 뉴스 요약처럼 쓰지 말고, Camera HAL 실무자가 이번 주 무엇을 확인해야 하는지 중심으로 작성한다.

## 1. 이번 주 3줄 브리핑

- 첫 번째 핵심 변화와 HAL 관점 의미.
- 두 번째 핵심 변화와 검증 포인트.
- 세 번째 핵심 변화와 팀 action 방향.

## 2. 메인 기사 제목

### 기사 headline

**왜 이 기사를 골랐나**

이 기사가 Camera HAL / Android Camera / CameraX / AOSP Camera / native C++ / AI input path 관점에서 왜 이번 주 메인 기사인지 설명한다. 일반 흥미나 마케팅 가치가 아니라 실무 영향 기준으로 쓴다.

**이번 주 확인한 사실**

- 출처로 확인된 사실만 쓴다.
- 날짜, 버전, 프로젝트명, API 이름은 가능한 한 구체적으로 쓴다.
- 원문에 없는 HAL 요구사항을 사실처럼 쓰지 않는다.

**배경지식**

Camera HAL 엔지니어가 이 뉴스를 이해하는 데 필요한 Android Camera, AOSP, CameraX, C++, AI 배경을 설명한다.

**Camera HAL 관점 해석**

HAL interface, stream/buffer, metadata, request/result, performance, compatibility, test, debugging 관점의 의미를 해석한다. 사실과 추정을 섞지 않는다.

가능하면 다음 용어를 구체적으로 사용한다.

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

- 팀이 이번 주 또는 2주 안에 확인하거나 실험할 구체적인 작업을 쓴다.
- 가능하면 test, log, code owner, metric, device class를 포함한다.
- “모니터링”, “검토”, “분석”처럼 끝나는 추상 표현만 쓰지 않는다.

**과장하면 안 되는 부분**

이 기사에서 과장하거나 오해하면 안 되는 지점을 명시한다.

예시:

- AI app API 기사라면 HAL이 AI 모델을 직접 실행해야 한다고 쓰지 않는다.
- GCC 또는 일반 C++ 기사라면 Android HAL toolchain 전환으로 단정하지 않는다.
- 앱/프레임워크 레벨 변화와 HAL 직접 요구사항을 분리한다.

**팀 공유용 한 줄**

회의나 메신저에 그대로 공유할 수 있는 한 문장으로 정리한다.

**Sources**

- [Source title](https://example.com)

---

메인 기사는 같은 구조를 반복한다. 새 이슈는 총 4-6개, 기본 목표는 5개다. 최소 1개는 AI 관련 기사여야 하며, 가능하면 최소 3개는 Camera HAL / Android Camera / CameraX / AOSP Camera 기사여야 한다.

## 이번 주 Action Items

- 이슈 전체에서 가장 중요한 팀 action을 3-6개로 정리한다.
- 각 action은 2주 안에 확인 가능한 형태로 쓴다.
- stream 조합, metadata, CTS/VTS/Camera ITS, CameraX compatibility, native runtime, AI input path 중 가능한 구체 항목을 포함한다.

## References

- [Source title](https://example.com)
