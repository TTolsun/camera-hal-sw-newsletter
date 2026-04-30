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
├── collected-news/
│   └── YYYY-MM-DD/
│       └── candidates.json
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
├── .github/
│   └── workflows/
│       ├── 00-collect-news-candidates.yml
│       ├── 01-weekly-newsletter-newsroom.yml
│       ├── 02-validate-site.yml
│       ├── 03-manual-newsletter-issue.yml
│       └── weekly-newsletter-update.yml
└── scripts/
    ├── collect-news-candidates.js
    ├── register-manual-newsletter.js
    ├── validate-site.js
    ├── generate-weekly-newsletter.js
    └── ai-newsroom-newsletter.js
```

## Structure

- `index.html`: 메인 랜딩 페이지입니다. `data/newsletters.json`을 읽어 최신호와 아카이브 목록을 렌더링합니다.
- `css/styles.css`: 사이트 공통 레이아웃, 카드, 버튼, 반응형 스타일입니다.
- `css/hero-override.css`: 메인 hero 비주얼을 카메라/센서 대시보드 형태로 조정하는 스타일입니다.
- `data/newsletters.json`: 메인 페이지가 사용하는 뉴스레터 메타데이터 목록입니다.
- `docs/sources.md`: 매주 뉴스 후보를 찾을 때 확인할 공식 문서와 신뢰 가능한 출처 목록입니다.
- `collected-news/YYYY-MM-DD/candidates.json`: GitHub Action이 무료로 수집한 원본 뉴스 후보 JSON입니다.
- `newsroom/YYYY-MM-DD/news-candidates.md`: GitHub Action 기자가 만든 뉴스 후보 Markdown입니다.
- `newsroom/YYYY-MM-DD/editor-draft.md`: ChatGPT 편집자가 작성한 뉴스레터 초안입니다.
- `newsroom/YYYY-MM-DD/fact-check-report.md`: 사실, 출처, 과장 여부 검수 결과입니다.
- `newsroom/YYYY-MM-DD/editor-in-chief-brief.md`: 편집장 승인을 위한 요약 보고입니다.
- `newsroom/YYYY-MM-DD/release-qa-report.md`: 최종 발행 전 검수 결과입니다.
- `newsletters/YYYY-MM-DD/index.html`: 개별 뉴스레터 HTML 페이지입니다.
- `newsletters/YYYY-MM-DD/newsletter.md`: 개별 뉴스레터 Markdown 원본입니다.
- `.github/workflows/00-collect-news-candidates.yml`: OpenAI API 없이 공식 출처에서 뉴스 후보를 수집하고 Issue/PR을 생성하는 워크플로입니다.
- `.github/workflows/01-weekly-newsletter-newsroom.yml`: 수동으로 저장한 뉴스레터 파일을 등록하고 최종 발행 PR을 만드는 워크플로입니다.
- `.github/workflows/02-validate-site.yml`: `newsletters.json`, 링크 파일 존재 여부, TODO 문자열, 중복 날짜, 필수 섹션을 검증하는 워크플로입니다.
- `.github/workflows/03-manual-newsletter-issue.yml`: 수동 작업이 필요할 때 뉴스레터 작성 Issue를 만드는 워크플로입니다.
- `.github/workflows/weekly-newsletter-update.yml`: 비상용 또는 테스트용 기본 뉴스레터 생성 워크플로입니다.
- `scripts/collect-news-candidates.js`: `docs/sources.md`의 출처를 읽고 RSS/HTML 기반 뉴스 후보를 수집합니다. OpenAI API를 사용하지 않습니다.
- `scripts/register-manual-newsletter.js`: 수동 작성된 `newsletters/YYYY-MM-DD/` 파일을 검사하고 `data/newsletters.json`과 누락된 `newsroom/YYYY-MM-DD/` 산출물을 등록합니다.
- `scripts/validate-site.js`: 발행 메타데이터와 필수 파일/섹션을 검증합니다.
- `scripts/ai-newsroom-newsletter.js`: OpenAI API 기반 자동 기자용 실험 스크립트입니다. 정규 workflow에서는 호출하지 않습니다.

## Current Operation Mode

현재는 **GitHub Action 무료 후보 수집 + ChatGPT 편집 + GitHub Actions 등록/검수 + 편집장 승인 + GitHub Pages 발행** 방식으로 운영합니다.

- `00 - Collect News Candidates`
  - 매주 월요일 KST 06:00에 자동 실행됩니다.
  - 수동 실행도 지원합니다.
  - `docs/sources.md`에 적힌 공식 출처를 기준으로 후보를 수집합니다.
  - OpenAI API를 사용하지 않습니다.
  - `collected-news/YYYY-MM-DD/candidates.json`과 `newsroom/YYYY-MM-DD/news-candidates.md`를 생성합니다.
  - ChatGPT에 붙여넣을 수 있는 편집 요청 프롬프트를 Issue 본문에 포함합니다.
  - 후보 보관용 PR을 생성합니다. 이 PR은 최종 발행 PR이 아닙니다.

- `01 - Manual Newsletter Publish`
  - 수동 실행만 지원합니다.
  - ChatGPT에서 만든 `newsletters/YYYY-MM-DD/newsletter.md`와 `newsletters/YYYY-MM-DD/index.html`을 등록합니다.
  - 누락된 `newsroom/YYYY-MM-DD/` 역할별 산출물 템플릿을 보완합니다.
  - `data/newsletters.json`을 업데이트합니다.
  - `manual-newsletter/YYYY-MM-DD` 브랜치를 만들고 최종 발행 PR을 생성합니다.

- `02 - Validate Site`
  - PR, `main` push, 수동 실행 시 사이트 품질을 검증합니다.
  - `data/newsletters.json`, 발행 파일 존재 여부, TODO 문자열, 중복 날짜, 필수 섹션을 확인합니다.

- `03 - Manual Newsletter Issue`
  - 수동 보완 작업이 필요할 때 뉴스레터 작성 Issue를 생성합니다.

- `Weekly Newsletter Basic Auto Update`
  - 비상용 또는 테스트용 기본 뉴스레터를 생성합니다.
  - 정규 운영에서는 `00 - Collect News Candidates`와 `01 - Manual Newsletter Publish` workflow를 우선 사용합니다.

## Operation Rules

- `main` 브랜치를 직접 수정하지 않습니다.
- 뉴스레터는 항상 PR로만 발행합니다.
- 편집장 승인 없는 자동 merge는 하지 않습니다.
- 출처 없는 뉴스 항목은 발행하지 않습니다.
- HAL 관점 Action Item 없는 뉴스 항목은 발행하지 않습니다.
- OpenAI API 비용이 들지 않도록 정규 후보 수집 workflow에서는 API를 호출하지 않습니다.

## Weekly Operation

1. 매주 월요일 KST 06:00에 `00 - Collect News Candidates`가 자동 실행됩니다.
2. 생성된 `[News Candidates] Camera HAL SW Newsletter - YYYY-MM-DD` Issue를 엽니다.
3. Issue의 `ChatGPT 편집 요청 프롬프트`와 후보 목록을 ChatGPT에 붙여넣습니다.
4. ChatGPT에서 뉴스레터 Markdown, HTML, 검토 산출물을 작성합니다.
5. `newsletters/YYYY-MM-DD/newsletter.md`와 `newsletters/YYYY-MM-DD/index.html`을 저장합니다.
6. 가능하면 `newsroom/YYYY-MM-DD/`에 `editor-draft.md`, `fact-check-report.md`, `editor-in-chief-brief.md`, `release-qa-report.md`를 함께 저장합니다.
7. GitHub Actions에서 `01 - Manual Newsletter Publish`를 실행하고 `newsletter_date`를 입력합니다.
8. 생성된 최종 발행 PR에서 `data/newsletters.json` 업데이트와 `02 - Validate Site` 결과를 확인합니다.
9. 편집장 승인 후 PR을 merge합니다.

## Manual Candidate Collection

필요하면 후보 수집만 수동으로 실행할 수 있습니다.

```text
GitHub → Actions → 00 - Collect News Candidates → Run workflow
```

입력값:

- `newsletter_date`: `YYYY-MM-DD`, 비우면 KST 기준 오늘 날짜
- `lookback_days`: 후보 수집 기간, 기본값 21일

로컬에서 실행하려면 다음 명령을 사용합니다.

```powershell
$env:NEWSLETTER_DATE="YYYY-MM-DD"
$env:LOOKBACK_DAYS="21"
node scripts/collect-news-candidates.js
```

## Add a Newsletter

정규 운영에서는 ChatGPT에서 뉴스 후보, Markdown, HTML, 검토 산출물을 만들고 저장소에 파일을 추가한 뒤 `01 - Manual Newsletter Publish`를 수동 실행합니다.

1. `newsletters/YYYY-MM-DD/` 디렉터리를 만듭니다.
2. `newsletter.md`에 원본 내용을 작성합니다.
3. `index.html`에 웹 페이지용 내용을 작성합니다.
4. 가능하면 `newsroom/YYYY-MM-DD/`에 역할별 산출물을 함께 저장합니다.
5. 각 뉴스 항목에 `Sources`를 붙이고, 마지막 `References`에 전체 링크를 모읍니다.
6. `data/newsletters.json`은 직접 수정하지 않습니다. `scripts/register-manual-newsletter.js`가 자동으로 업데이트합니다.

```powershell
$DATE = "YYYY-MM-DD"
New-Item -ItemType Directory -Force "newsletters/$DATE"
Copy-Item templates/newsletter.md "newsletters/$DATE/newsletter.md"
Copy-Item templates/newsletter.html "newsletters/$DATE/index.html"
```

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
