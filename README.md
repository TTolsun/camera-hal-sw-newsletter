# Camera HAL SW Newsletter

Camera HAL, Android Camera, C++, AI 개발 생산성 관련 소식을 정리하는 정적 뉴스레터 사이트입니다.

## File Tree

```text
.
├── index.html
├── css/
│   ├── styles.css
│   └── hero-override.css
├── data/
│   └── newsletters.json
├── docs/
│   └── sources.md
├── newsroom/
│   └── YYYY-MM-DD/
│       ├── news-candidates.md
│       ├── editor-draft.md
│       ├── fact-check-report.md
│       ├── editor-in-chief-brief.md
│       └── release-qa-report.md
├── newsletters/
│   └── YYYY-MM-DD/
│       ├── index.html
│       └── newsletter.md
└── .github/
    └── workflows/
        ├── 01-weekly-newsletter-newsroom.yml
        ├── 02-validate-site.yml
        ├── 03-manual-newsletter-issue.yml
        └── weekly-newsletter-update.yml
```

## Structure

- `index.html`: 메인 랜딩 페이지입니다. `data/newsletters.json`을 읽어 최신호와 아카이브 목록을 렌더링합니다.
- `css/styles.css`: 사이트 공통 레이아웃, 카드, 버튼, 반응형 스타일입니다.
- `css/hero-override.css`: 메인 hero 비주얼을 카메라/센서 대시보드 형태로 조정하는 스타일입니다.
- `data/newsletters.json`: 메인 페이지가 사용하는 뉴스레터 메타데이터 목록입니다.
- `docs/sources.md`: 매주 뉴스 후보를 찾을 때 확인할 공식 문서와 신뢰 가능한 출처 목록입니다.
- `newsroom/YYYY-MM-DD/news-candidates.md`: AI 기자가 수집한 뉴스 후보입니다.
- `newsroom/YYYY-MM-DD/editor-draft.md`: AI 편집자가 작성한 뉴스레터 초안입니다.
- `newsroom/YYYY-MM-DD/fact-check-report.md`: 1차 검수자의 사실, 출처, 과장 여부 검수 결과입니다.
- `newsroom/YYYY-MM-DD/editor-in-chief-brief.md`: 편집장 승인을 위한 요약 보고입니다.
- `newsroom/YYYY-MM-DD/release-qa-report.md`: 최종 발행 전 검수 결과입니다.
- `newsletters/YYYY-MM-DD/index.html`: 개별 뉴스레터 HTML 페이지입니다.
- `newsletters/YYYY-MM-DD/newsletter.md`: 개별 뉴스레터 Markdown 원본입니다.
- `.github/workflows/01-weekly-newsletter-newsroom.yml`: AI 뉴스룸이 뉴스 후보 수집, 초안 작성, 검수 산출물 생성 후 PR을 만드는 정규 워크플로입니다.
- `.github/workflows/02-validate-site.yml`: `newsletters.json`, 링크 파일 존재 여부, TODO 문자열, 중복 날짜를 검증하는 워크플로입니다.
- `.github/workflows/03-manual-newsletter-issue.yml`: 수동 작업이 필요할 때 뉴스레터 작성 Issue를 만드는 워크플로입니다.
- `.github/workflows/weekly-newsletter-update.yml`: 비상용 또는 테스트용 기본 뉴스레터 생성 워크플로입니다.

## Current Operation Mode

현재는 **Newsroom 기반 자동 초안 생성 + 편집장 승인 + GitHub Actions 검수 + GitHub Pages 발행** 방식으로 운영합니다.

- `01 - Weekly Newsletter Newsroom`
  - 매주 월요일 KST 06:30 실행합니다.
  - AI 기자와 편집자가 뉴스 후보를 수집하고 뉴스레터 초안을 생성합니다.
  - `newsroom/YYYY-MM-DD/`에 역할별 산출물을 남깁니다.
  - `weekly-newsletter/YYYY-MM-DD` 브랜치를 만들고 PR을 생성합니다.

- `02 - Validate Site`
  - PR, `main` push, 수동 실행 시 사이트 품질을 검증합니다.
  - `data/newsletters.json`, 발행 파일 존재 여부, TODO 문자열, 중복 날짜, 필수 섹션을 확인합니다.

- `03 - Manual Newsletter Issue`
  - 수동 보완 작업이 필요할 때 뉴스레터 작성 Issue를 생성합니다.
  - 정규 운영은 Newsroom workflow를 우선 사용합니다.

- `Weekly Newsletter Basic Auto Update`
  - 비상용 또는 테스트용 기본 뉴스레터를 생성합니다.
  - 정규 운영에서는 Newsroom workflow를 우선 사용합니다.

## Operation Rules

- `main` 브랜치를 직접 수정하지 않습니다.
- 뉴스레터는 항상 PR로만 발행합니다.
- 편집장 승인 없는 자동 merge는 하지 않습니다.
- 출처 없는 뉴스 항목은 발행하지 않습니다.
- HAL 관점 Action Item 없는 뉴스 항목은 발행하지 않습니다.

## Add a Newsletter

정규 운영에서는 `01 - Weekly Newsletter Newsroom`이 아래 파일을 자동 생성하고 PR을 만듭니다. 수동 보완이 필요할 때만 같은 구조를 직접 맞춥니다.

1. `newsletters/YYYY-MM-DD/` 디렉터리를 만듭니다.
2. `newsletter.md`에 원본 내용을 작성합니다.
3. `index.html`에 웹 페이지용 내용을 작성합니다.
4. `data/newsletters.json`에 새 항목을 추가합니다.
5. 각 뉴스 항목에 `Sources`를 붙이고, 마지막 `References`에 전체 링크를 모읍니다.

## Weekly Operation

```powershell
$DATE = "YYYY-MM-DD"
New-Item -ItemType Directory -Force "newsletters/$DATE"
Copy-Item templates/newsletter.md "newsletters/$DATE/newsletter.md"
Copy-Item templates/newsletter.html "newsletters/$DATE/index.html"
```

1. `01 - Weekly Newsletter Newsroom` workflow가 정규 초안 PR을 생성합니다.
2. 편집장은 PR 본문과 `newsroom/YYYY-MM-DD/` 산출물을 확인합니다.
3. 수정이 필요하면 PR에서 변경 요청을 남기거나 수동 보완합니다.
4. `02 - Validate Site` workflow 결과를 확인합니다.
5. 편집장 승인 후 PR을 merge합니다.

## Newsletter Sections

| 카테고리 | 역할 |
|---|---|
| 이번 주 3줄 브리핑 | 핵심만 빠르게 요약 |
| AOSP Camera Watch | Android Camera 최신 흐름 |
| Tech Trend Radar | Camera / AI / Mobile / C++ 기술 동향 |
| 이번 주 C++ / AI 실전 팁 | 개발자가 바로 흥미를 느낄 실전 팁 |

각 주요 항목에는 `배경지식`과 `Camera HAL에서 확인해볼 아이템`을 반드시 포함합니다. 확인 아이템은 capability, request/result, stream/buffer, metadata, 로그/테스트 영향처럼 실제로 점검 가능한 단위로 나눕니다.

가능하면 기사에는 그림이나 block diagram을 포함합니다. HTML 페이지에는 CSS 기반 `.diagram-block`을 우선 사용하고, Markdown 원본에는 간단한 텍스트 다이어그램을 함께 남깁니다.

```json
{
  "date": "YYYY-MM-DD",
  "title": "Camera HAL SW Newsletter - YYYY-MM-DD",
  "summary": "이번 호 요약",
  "html": "newsletters/YYYY-MM-DD/index.html",
  "md": "newsletters/YYYY-MM-DD/newsletter.md",
  "tags": ["Camera HAL", "Android", "C++", "AI"]
}
```

## Local Preview

`fetch()`로 JSON을 읽기 때문에 브라우저에서 파일을 직접 여는 대신 로컬 HTTP 서버로 확인하는 편이 안전합니다.

```powershell
npx serve .
```
