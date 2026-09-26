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

## 2. 기사

기사 하나는 headline, 부제(출처 표기), lead, 본문, "Camera HAL/Driver 관점에서의 의미", 출처로 이루어집니다. 본문은 슬롯을 채우는 목록이 아니라 이어지는 글 한 편입니다.

### headline과 lead

headline은 원문 제목을 그대로 옮기지 않고, 확인된 변경점을 드러내는 문장으로 새로 씁니다.

lead는 본문으로 들어가는 문을 여는 한두 문장입니다. 독자가 마주칠 법한 장면이나 질문으로 열되 가정형으로 쓰고, 출처가 확인하지 않은 사건을 실제로 일어난 일처럼 단정하지 않습니다.

### 본문

본문은 `body_markdown` 필드 하나에 담는 markdown 문자열입니다. 허용하는 문법은 두 가지뿐입니다.

- 빈 줄로 구분한 평문 문단
- `### `로 시작하는 소제목 줄(0~4개, 선택)

그 밖의 markdown 문법은 결정론 lint가 거부하며 발행이 막힙니다. 다른 단계의 헤딩, 리스트 마커, 인용, 수평선, 링크, 이미지, 코드 블록과 백틱, HTML 태그, 볼드 표기가 모두 여기에 해당합니다. lint는 구문 이름이 아니라 문자로 판정하므로 `` ` `` `*` `[` `]` `<` `~` `|` 일곱 문자는 산문 어디에도 쓸 수 없습니다. 근사치는 "약 30%"처럼, 부등호·대괄호·세로줄 표기는 말로 풀어 씁니다. 강조는 볼드가 아니라 문장 구조로 합니다. 중요한 사실은 문장의 주어 자리에 놓거나 짧은 단독 문단으로 분리합니다.

본문이 다뤄야 할 내용은 정해져 있지만 순서는 기사마다 다르게 정합니다.

- 원문에서 실제로 일어난 일
- 그 기술의 정체, 적용 대상, 현재 상태
- Camera HAL 및 lower camera stack과의 거리(직접 변경인지, 참고할 하위 스택 흐름인지)
- 직접 변경 / 참고할 흐름 / 추적할 리스크 중 무엇으로 다뤄야 하는지에 대한 현실적인 판단

문단 수와 문단 길이도 기사마다 다르게 가져갑니다. 짧은 훅 문단과 길게 전개하는 문단을 섞고, 모든 기사를 같은 문단 수와 같은 리듬으로 찍어내지 않습니다. 소제목을 제외한 문단은 최소 2개입니다.

출처가 밝힌 제한 사항(review NACK, RAW-only 또는 제한된 모드, 특정 board·kernel·library 버전 한정, ISP bypass, 릴리스 전 상태 등)은 생략하지 않고 본문에 자연스럽게 반영합니다.

### 소제목

소제목은 선택입니다. 모든 기사에 소제목을 달 필요는 없습니다. 쓴다면 그 기사에서만 말이 되는 구체적인 표현으로 쓰고, 소제목 뒤에는 반드시 문단이 이어져야 합니다.

다음 계열은 소제목으로 쓸 수 없습니다. 정본 목록은 `src/generator/reporter/public-body-markdown.js`의 `RESERVED_SUBHEADING_TERMS`이며, 프롬프트도 그 상수에서 목록을 받습니다.

- v1 고정 라벨(예: "Camera HAL/Driver 관점에서의 의미")
- 이전 슬롯 라벨(예: "현업 장면", "확인된 변화", "왜 봐야 하나", "편집자 판단")
- 내부 필드 이름(예: `editorial_story`, `camera_hal_takeaway`)
- 조회형·인벤토리형 라벨(예: Impact, Layer, Scope, 요약, 배경, 결론)

### Camera HAL/Driver 관점에서의 의미

본문과 별도 필드(`camera_hal_takeaway`)이며 렌더링 때 고정 라벨이 붙습니다. 본문에 같은 라벨을 다시 쓰지 않습니다.

"직접적인 HAL 변경은 없으나" 같은 디스클레이머로 시작하지 않고, 개발자가 점검할 구체 항목을 먼저 제시합니다. 관련 metadata key, request/result 필드, CTS/VTS/ITS 항목, V4L2/uAPI 구조체, 버퍼·포맷, 라이브러리 버전과 재빌드 영향 중 출처가 뒷받침하는 것을 씁니다.

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

### 출처

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
