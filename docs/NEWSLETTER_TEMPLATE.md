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

## 1. 이번 주 핵심

공개 주간호는 최종 기사 순서와 공개 설명으로 만든 핵심 목록 하나를 보여 줍니다. 별도의 목차로 같은 목록을 반복하지 않습니다. 웹 화면의 전체 소개는 핵심 목록 뒤에 접어서 제공하며, 내부 `briefing` 3개 bullet은 공개 목록과 구분합니다.

- 첫 번째 핵심 변화와 HAL 관점
- 두 번째 핵심 변화와 검증 포인트
- 세 번째 핵심 변화와 확인하거나 알아둘 사항

## 2. 기사

기사 하나는 headline, 부제(출처 표기), lead, 본문, "Camera HAL/Driver 관점에서의 의미", 출처로 이루어집니다. 본문은 슬롯을 채우는 목록이 아니라 이어지는 글 한 편입니다.

### headline과 lead

headline은 원문 제목을 그대로 옮기지 않고, 확인된 변경점을 드러내는 문장으로 새로 씁니다.

lead는 앱·기기·개발 작업에서 무엇이 달라지는지 쉬운 문장으로 먼저 설명합니다. 생소한 용어는 처음 등장할 때 짧게 풀어 쓰되 지원 조건·예외·제안 상태는 생략하지 않습니다. 장면이나 질문으로 열 수도 있지만 가정형으로 쓰고, 출처가 확인하지 않은 사건을 실제로 일어난 일처럼 단정하지 않습니다.

홈페이지는 공개 headline·lead·camera_hal_takeaway를 사용합니다. 본문을 먼저 읽지 않아도 핵심 변화, 해당 독자와 업무상 의미, 지금 확인하거나 관찰할 판단을 이해할 수 있어야 합니다. 본문은 같은 요약을 반복하는 대신 원문이 뒷받침하는 변경 전후·정확한 기술 조건·한계를 보충합니다. 영어판에도 이 설명과 확실성 수준을 동일하게 보존합니다.

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

"직접적인 HAL 변경은 없으나" 같은 디스클레이머로 시작하지 않고, 기사 유형에 맞는 독자 의미와 적용 조건을 먼저 설명합니다. HAL/Framework/Driver 변경은 관련 metadata key, request/result 필드, CTS/VTS/ITS 항목, V4L2/uAPI 구조체, 버퍼·포맷, 라이브러리 버전과 재빌드 영향 중 출처가 뒷받침하는 내용을 씁니다.

AI/C++ 도구는 어떤 개발 업무에서 새로운 선택지가 되는지와 지원 범위·미검증 사항을 설명합니다. 연구·패치 제안은 참고할 설계와 리뷰 쟁점, 확정되지 않은 부분을 설명합니다. 기술 인지 자체로 유용한 기사에 실행 지시나 비교 실험을 강요하지 않으며, 사내 제품·담당자·성과를 추측하지 않습니다. 필요한 확인 사항은 공개 문장 안에 설명하고 `reader_checkpoints` 등 내부 QA 필드는 공개하지 않습니다.

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

## 실행 항목 작성 기준

확인할 일이 있는 기사에만 적용하는 작성 기준이며, 별도 공개 섹션이나 고정 개수의 실행 항목을 요구하지 않습니다.

- 적용 대상과 확인할 결과를 출처가 뒷받침하는 범위 안에서 구체적으로 설명합니다.
- stream 조합, metadata, CTS/VTS/Camera ITS, CameraX compatibility, native 개발 업무 등 해당 기사에 맞는 대상을 사용합니다.
- 비교 방법을 제안할 때는 출처의 실측 결과와 편집 제안을 구분합니다. 설명·인지·참고가 적절하면 실행 지시 없이 의미와 한계를 전달합니다.
- 내부 QA의 필수 필드와 발행 안전 검증은 유지합니다.

## 과거 공개 페이지의 화면 전환

`npm.cmd run migrate:public-newsletters -- --inventory`는 Git이 추적하는 공개 한국어·영어
페이지의 입력 형식, 원본 hash, 기사·출처·이미지·ID, 색인 노출과 번역 정합성을 읽기만 합니다.
이슈 #1305의 W19~W41 한영과 2026-10-12까지의 일간 URL을 `candidate`, W42 한영을
`regression`, 이후 추가된 일간 페이지를 `post_issue_scope`로 구분합니다. 새 페이지를
기존 전환 범위에 자동으로 포함하지 않습니다.

대상을 명시하면 현재 공통 renderer로 만든 결과와 보존 검사를 JSON으로 출력합니다.
기본값은 파일을 쓰지 않는 dry-run입니다. 변경 파일에는 전후 텍스트와 SHA-256 hash가
포함되므로 실제 쓰기 전에 차이를 검토할 수 있습니다.

```powershell
npm.cmd run migrate:public-newsletters -- --issue 2026-W19,2026-W41 --locale ko,en --dry-run
npm.cmd run migrate:public-newsletters -- --issue 2026-10-12 --locale ko --dry-run
```

검토한 선택에 `--write`를 지정하면 해당 파일만 갱신합니다. 선택한 페이지 중 하나라도
복원·번역·보존 검사에 실패하면 전체 선택의 쓰기를 차단합니다. 주간호는 기존 `issue.json`과
`translation.en.json`의 바이트를 유지하며, 원본 hash를 새로 찍거나 번역을 무효화하지 않습니다.
홈페이지·아카이브 색인, sitemap, 역사적 newsroom 실행 기록도 쓰지 않습니다.
구형 주간 JSON 본문에 독립된 Markdown 소제목·강조 제목·목록이 들어 있으면,
화면에서만 실제 소제목과 목록으로 표시합니다. 기사 제목과 요약이 같아 핵심 목록의 설명이
비는 경우에는 기존 본문의 첫 설명 문단을 사용합니다. 원본 문장이나 번역 hash는 바꾸지 않습니다.

일간호는 공개 HTML과 Markdown에서 복원한 입력을 같은 디렉터리의
`publication-source.json`에 저장합니다. 이 파일은 `published-html-projection` 형식이며,
원본 파일 경로·hash, 발행 날짜, 공개 기사·참고자료·이미지와 본문 블록을 보존합니다.
이후 재실행은 이 입력을 사용합니다. 새 Story Contract 버전이나 발행 적합성 판정을
역사적 데이터에 부여하지 않으며, 주간 키나 존재하지 않는 영어판도 만들지 않습니다.
복원 입력인 `publication-source.json`의 추가만으로 새 생성 실행을 판정하지 않습니다.
수정한 공개 페이지는 계속 strict 검증 대상이며, 새 HTML·Markdown이나 newsroom 실행 기록이
추가되면 기존 생성 실행 검증도 그대로 적용합니다. 과거 실행의 정본 입력이 없는 상태에서
quality-report나 image-audit-report를 사후에 만들어 검사에 맞추지 않습니다.
이미지 실시간 검증은 한 실행 안에서 정확히 같은 URL의 결과를 공유합니다. 중복 참조의
불필요한 CDN 요청을 줄이되 실패 결과도 모든 참조에 적용하고, 다음 실행에는 다시 검증합니다.
로컬 파일·URL scheme·strict 대상·이미지 응답 형식과 크기 기준은 그대로 검사합니다.

기존 ID가 새 렌더 결과에서 없어지면 대응 기사 또는 탐색 목록에 호환 anchor를 남깁니다.
기사 순서·문장·출처·이미지·alt·캡션·canonical·참고자료와 Markdown 본문을 전후 대조하고,
중복 ID와 끊어진 내부 anchor를 차단합니다. 제목과 같은 문장의 중복 표시 제거, 고정 관점
라벨 이동, fallback 이미지의 Markdown 장식 표시는 현재 공통 renderer의 표시 계약을 따릅니다.

일간 복원기는 평문 문단·소제목, 기사당 이미지 한 개, 공개 체크리스트와 인라인 코드를 지원합니다.
Markdown 기사의 개수·순서·제목을 HTML과 먼저 대조합니다. 같은 기사의 Markdown에만 남은
문단·소제목·체크리스트는 `origin: "published-markdown"` 블록으로 보존하고 HTML에도 표시합니다.
이 복원으로 추가되는 공개 문장에는 dry-run 결과의 `contentEdits`에 원본 Markdown 경로와
`same-article-published-markdown` 근거를 남깁니다. 다른 호나 newsroom 기록에서 내용을 가져오지 않습니다.
기존 catch-up 제목·주 단위 나이 표시는 그대로 두며 정확한 경과 일수를 추정하지 않습니다.

과거 출처 목록은 텍스트와 링크를 묶은 구조로 보존하므로 현재 renderer가 자동으로 붙이는
패치 시리즈 URL을 과거 기사에 새로 추가하지 않습니다. 참고자료의 월 단위·자유 형식 날짜와
ChromeOS 링크 묶음도 원문 그대로 유지합니다. 기존 발행 안내문은 문구를 보존하며,
Tooling Watch를 정상 Camera HAL 발행이나 새로운 발행 적합성 판정으로 바꾸지 않습니다.
복잡한 코드·표·인용·인라인 마크업과 지원하지 않는 Markdown 블록은 삭제하거나 평문으로
축약하지 않고 차단 사유로 보고합니다. 저장한 projection도 기사 정체성·블록 형식·출처 연결과
링크 protocol을 다시 검증합니다.
차단은 원본 자체가 복원 불가능하다는 판정이 아니라 추가 호환 처리가 필요하다는 뜻입니다.
임시 실행 결과와 화면 캡처는 `.tmp/` 아래에 보관하고 공식 문서로 커밋하지 않습니다.

배치는 한영 쌍과 소수 대표 일간호 단위로 검토합니다. 되돌릴 때는 해당 배치의 공개 HTML·Markdown과
새로 추가한 `publication-source.json`만 함께 되돌립니다. 기존 입력 JSON과 번역은 전환 전후
동일해야 합니다. 재실행의 변경 파일이 0개인지, 관련 회귀 테스트와 전체 test·validate 및
한영 실제 Chrome 데스크톱·모바일 화면이 정상인지 확인한 뒤 다음 배치로 넘어갑니다.

기사 제목 위 TAG만 정리할 때는 `--tags-only`를 사용합니다. `--all-tags`는 추적 중인 공개
한영 페이지 전체의 TAG를 검사하며, 전체 화면 전환과 별도로 동작합니다.

```powershell
npm.cmd run migrate:public-newsletters -- --all-tags --dry-run
npm.cmd run migrate:public-newsletters -- --issue 2026-W19 --tags-only --dry-run
```

기사 TAG는 `article-display.js`의 `articleCategoryLabel`이 표시합니다. C++ 기사와 AI 도구
기사를 `C++`와 `AI Tooling`으로 구분하고, C++ 기사에 편집 상태인 `Tooling Watch`를 붙이지
않습니다. JSON이 없는 일간호는 자기 페이지의 기존 제목·분류·클래스만 읽습니다. 제목에
CameraX·libcamera·Mali-C55처럼 구체적인 주제가 있으면 해당 표시를 사용하고, 모호한
`main`·`camera-hal` 클래스만으로 정밀한 분류를 만들지 않습니다. 확인할 수 없는 분류는
일반 `Camera` 표시와 보고서의 `preciseCategoryKnown: false`로 드러냅니다.

TAG 정리는 기존 카테고리 span 또는 번호 옆의 공통 eyebrow 영역만 고칩니다. 기사 본문,
Markdown, 원본 JSON, 번역, 이미지, 홈페이지·아카이브 필터 태그를 수정하지 않습니다.
원본 기사 수·제목이 맞지 않거나 본문·출처·이미지·ID 보존 검사에 실패하면 쓰기를 막습니다.

홈·아카이브의 `전체`는 주간호를 표시하며, 주제 TAG를 선택하면 해당 주제의 기사별 카드를
표시합니다. 같은 호에 해당 기사가 여러 개 있으면 각각 표시하며, 각 카드의 제목·썸네일·alt·
본문 anchor는 같은 공개 기사의 `reader_brief.items`에서 가져옵니다. 건수와 페이지 나누기도
필터를 통과한 기사 수를 기준으로 합니다. 유효한 기사 데이터가 없는 주간호에서 첫 기사나
다른 기사 이미지를 대신 가져와 필터 결과를 만들지 않습니다.

과거 주간호의 기사별 데이터를 보강할 때는 `npm.cmd run refresh:reader-briefs -- --dry-run`으로
확인한 뒤 `--write`로 갱신합니다. 이 도구는 모든 한영 입력과 실제 공개 기사 수·제목·anchor를
먼저 검증하고 `articles/data/newsletters-weekly.json`의 한영 `reader_brief`만 갱신합니다.
원본 JSON·번역 hash·본문·호 순서·날짜·기존 색인 필드는 유지하며 재실행은 추가 변경이 없어야 합니다.

## 참고자료

- [출처 제목](https://example.com)
