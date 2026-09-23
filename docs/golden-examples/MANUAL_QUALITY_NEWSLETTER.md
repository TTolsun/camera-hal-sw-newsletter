# 수동 품질 뉴스레터 예시

이 파일은 자동 editor가 "좋은 기사는 이렇게 생겼다"를 참고하도록 만든 style·structure 예시입니다. 즉 작성 방식의 본보기일 뿐, 최신 사실의 출처(source)가 아닙니다.

따라서 이 파일에 적힌 사실, 날짜, version, source URL, API name, behavior change, action item은 그대로 복사하면 안 됩니다. 같은 근거가 현재 candidate JSON에 실제로 들어 있을 때만 사용합니다.

아래 예시에서 구체 사실이 들어갈 자리는 전부 `《 》`로 비워 두었습니다. 이것은 문장 리듬과 전개 방식을 보여 주기 위한 표기이며, 실제 기사에는 `《 》`를 쓰지 않고 candidate JSON이 확인한 값을 넣습니다.

## 본문은 슬롯이 아니라 글 한 편입니다

Story Contract v2의 본문은 `body_markdown` 문자열 하나입니다. "확인된 사실 / 배경 / 관점 / 액션" 같은 칸을 차례로 채우지 않고, 기사마다 다른 흐름으로 이어 씁니다. 같은 뉴스라도 직접 변경이면 확인 항목부터, 참고 흐름이면 맥락부터 여는 편이 자연스럽습니다.

허용 문법은 빈 줄로 구분한 평문 문단과 `### ` 소제목 줄뿐입니다. 볼드 라벨을 줄 머리에 붙이는 v1 형태는 lint가 거부합니다.

## 예시 1: 직접 변경 — 확인 항목으로 열고 제한으로 닫기

lead 예시입니다.

《컴포넌트》의 동작이 이번 릴리스에서 바뀌었다면, 지금 쓰고 있는 《검증 경로》가 먼저 흔들릴 자리입니다.

본문 예시입니다. 아래 문단들이 그대로 `body_markdown` 한 문자열에 들어가며, 문단 사이는 빈 줄 하나입니다.

《출처》가 《버전》에서 《변경 내용》을 공개했습니다. 바뀐 지점은 《API 또는 구조체》 하나이고, 나머지 경로는 그대로입니다.

이 변경이 닿는 곳은 《계층》입니다. 《메타데이터 키 또는 버퍼 경로》를 거쳐 《소비 지점》까지 이어지므로, 같은 값을 읽던 코드는 《조건》에서 다른 결과를 받습니다.

### 《기사 고유의 구체 소제목》

확인은 《테스트 항목》에서 시작하는 편이 빠릅니다. 《디바이스 클래스》에서 《관찰 대상》을 비교하면 변경 전후가 갈리는 지점이 드러납니다.

다만 출처가 말한 범위는 《제한 조건》까지입니다. 그 밖의 경로에 같은 변화가 있다고 단정할 근거는 원문에 없습니다.

읽을 점: 첫 문단은 짧게 사실만 놓고, 둘째 문단에서 계층과 경로를 길게 풀고, 마지막 문단은 제한으로 닫습니다. 문단 길이가 일정하지 않습니다.

## 예시 2: 참고 흐름 — 맥락으로 열고 거리감을 분명히 하기

lead 예시입니다.

《주제》는 아직 Android 카메라 경로에 직접 들어오지 않았지만, 《이유》 때문에 이름은 계속 보이게 됩니다.

본문 예시입니다.

《출처》의 《문서 또는 패치》는 《기술》을 다룹니다. 《적용 대상》에서 《동작》을 바꾸는 작업이고, 현재 상태는 《진행 단계》입니다.

Camera HAL과의 거리는 한 단계 떨어져 있습니다. 《하위 스택 요소》가 먼저 바뀌어야 《상위 경로》에 값이 올라오는 구조이고, 그 연결은 원문이 다루지 않습니다.

그래서 지금 할 일은 확인이 아니라 추적입니다. 《추적 대상》이 《조건》을 만족하는 시점에 다시 볼 항목으로 두는 편이 맞습니다.

읽을 점: 소제목이 없습니다. 세 문단으로 충분한 기사에 소제목을 달면 형식만 늘어납니다.

## 예시 3: 도구·워크플로 — 왜 카메라 개발자에게 닿는지 먼저 말하기

lead 예시입니다.

《도구》를 쓰는 팀이라면, 《변경》이 《작업 단계》의 시간을 바꿉니다.

본문 예시입니다.

《출처》가 《버전》에서 《변경 내용》을 발표했습니다. 《기능》이 《범위》까지 적용됩니다.

카메라 쪽 연결점은 《작업 흐름》입니다. 《네이티브 모듈 또는 빌드 경로》를 다루는 팀은 《관찰 가능한 지표》에서 차이를 봅니다.

이 항목은 Android 카메라 런타임 변경이 아닙니다. 《명시 범위》 안에서만 다루고, HAL 계약이나 스트림 동작으로 넓히지 않습니다.

읽을 점: 도구 기사에서도 과장 방지 문장이 본문 안에 자연스럽게 들어갑니다. 별도 라벨을 달지 않습니다.

## 기사 유형별로 반드시 담아야 할 근거

아래는 형식이 아니라 근거의 최소선입니다. 흐름은 위 예시처럼 기사마다 다르게 잡되, 해당 유형이면 아래 항목은 본문 어딘가에 있어야 합니다.

### Android Camera API

- release/version과 release date, 바뀐 API·framework module·CTS/VTS/ITS 영역을 이름으로 적습니다.
- request/result metadata, stream configuration, capability declaration, framework-to-HAL 계약 중 무엇을 건드리는지 설명합니다.
- metadata propagation, stream combination validation, latency budget, buffer ownership, vendor tag exposure, test coverage 중 하나 이상을 HAL 영향으로 번역합니다.

### CameraX / AOSP Camera / compatibility

- 특정 CameraX artifact, AOSP compatibility 문서, CDD clause, CTS/VTS/ITS note, release note 섹션에 연결합니다.
- app-facing 동작이 framework camera service, Camera2 metadata, stream use case, dynamic range handling, vendor quirk에 어떻게 의존하는지 짧게 설명합니다.
- session parameter handling, preview/capture stream 조합, YUV/RAW 동작, Ultra HDR 경로, logical/physical camera metadata 중 확인할 것을 적습니다.

### libcamera / V4L2

- libcamera release/blog item, V4L2 subsystem 영역, media controller 동작, pipeline handler, sensor/ISP 주제를 이름 붙입니다.
- Linux 쪽 개념을 한 문단으로 설명한 뒤 Android에 적용합니다.
- buffer queue, format negotiation, sensor mode selection, ISP tuning, frame timing처럼 vendor kernel과 공유하는 어휘로 연결합니다.

### AI camera path / HAL workflow

- 현재 candidate에서 나온 model/tool/platform release와 카메라에 닿는 구체 동작을 이름 붙입니다.
- input data, inference 위치, 개발 워크플로, on-device 자원 제약을 마케팅 표현 없이 설명합니다.
- camera frame, ImageAnalysis, buffer lifetime, thermal/power budget, latency, privacy, metadata annotation 중 하나와 연결합니다.

### C++ / toolchain

- 정확한 compiler, sanitizer, standard feature, build-system 동작, release note 항목을 이름 붙입니다.
- native Android camera service 또는 vendor HAL module 관점에서 실무적으로 설명합니다.
- build flag, sanitizer coverage, ABI 위험, performance profiling, static analysis, crash triage와 연결합니다.
- Camera HAL 관점의 실행 가능성이 구체적일 때만 main article로 두고, 아니면 briefing이나 reference로 낮춥니다.
