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
│       ├── 02-validate-site.yml
│       └── weekly-newsroom-pr.yml
└── scripts/
    ├── collect-news-candidates.js
    ├── gemini-newsroom-newsletter.js
    ├── lib/
    │   ├── gemini-client.js
    │   ├── newsletter-renderer.js
    │   └── newsletter-schema.js
    ├── validate-site.js
```

## Structure

- `index.html`: 메인 랜딩 페이지입니다. `data/newsletters.json`을 읽어 최신호와 아카이브 목록을 렌더링합니다.
- `css/styles.css`: 사이트 공통 레이아웃, 카드, 버튼, 반응형 스타일입니다.
- `css/hero-override.css`: 메인 hero 비주얼을 카메라/센서 대시보드 형태로 조정하는 스타일입니다.
- `data/newsletters.json`: 메인 페이지가 사용하는 뉴스레터 메타데이터 목록입니다.
- `docs/sources.md`: 매주 뉴스 후보를 찾을 때 확인할 공식 문서와 신뢰 가능한 출처 목록입니다.
- `collected-news/YYYY-MM-DD/candidates.json`: GitHub Action이 무료로 수집한 원본 뉴스 후보 JSON입니다.
- `newsroom/YYYY-MM-DD/news-candidates.md`: GitHub Action 기자가 만든 뉴스 후보 Markdown입니다.
- `newsroom/YYYY-MM-DD/reporter-candidates.json`: Gemini AI 기자가 선별/점수화한 후보입니다.
- `newsroom/YYYY-MM-DD/editor-draft.json`: Gemini AI 편집자가 작성한 구조화 초안입니다.
- `newsroom/YYYY-MM-DD/editor-draft.md`: 편집자 초안을 Markdown으로 렌더링한 참고 파일입니다.
- `newsroom/YYYY-MM-DD/fact-check-report.json`: Gemini AI 검수자의 구조화 검수 결과입니다.
- `newsroom/YYYY-MM-DD/fact-check-report.md`: 사실, 출처, 과장 여부 검수 결과입니다.
- `newsroom/YYYY-MM-DD/editor-in-chief-brief.md`: 편집장 승인을 위한 요약 보고입니다.
- `newsroom/YYYY-MM-DD/release-qa-report.md`: 최종 발행 전 검수 결과입니다.
- `newsletters/YYYY-MM-DD/index.html`: 개별 뉴스레터 HTML 페이지입니다.
- `newsletters/YYYY-MM-DD/newsletter.md`: 개별 뉴스레터 Markdown 원본입니다.
- `.github/workflows/02-validate-site.yml`: `newsletters.json`, 링크 파일 존재 여부, TODO 문자열, 중복 날짜, 필수 섹션을 검증하는 워크플로입니다.
- `.github/workflows/weekly-newsroom-pr.yml`: 후보 수집, Gemini 뉴스룸 생성, 검증, PR 생성을 수행하는 정규 워크플로입니다.
- `scripts/collect-news-candidates.js`: `docs/sources.md`의 출처를 읽고 RSS/HTML 기반 뉴스 후보를 수집합니다. OpenAI API를 사용하지 않습니다.
- `scripts/gemini-newsroom-newsletter.js`: 수집 후보 JSON을 기반으로 Gemini 기자/편집자/검수자 파이프라인을 실행하고 뉴스레터 파일을 생성합니다.
- `scripts/lib/`: Gemini 호출, schema, Markdown/HTML 렌더링 공통 모듈입니다.
- `scripts/validate-site.js`: 발행 메타데이터와 필수 파일/섹션을 검증합니다.

## Current Operation Mode

현재는 **GitHub Actions 후보 수집 + Gemini AI 기자/편집자/검수자 + validate-site 검증 + 편집장 PR 승인 + GitHub Pages 발행** 방식으로 운영합니다.

- `Weekly Gemini Newsroom PR`
  - 매주 월요일 07:00 KST에 자동 실행됩니다.
  - `docs/sources.md`에 적힌 공식 출처를 기준으로 후보를 수집합니다.
  - OpenAI API와 ChatGPT UI를 사용하지 않습니다.
  - Gemini는 `collected-news/YYYY-MM-DD/candidates.json`과 `docs/sources.md`만 입력으로 사용합니다.
  - `newsroom/YYYY-MM-DD/`에 기자, 편집자, 검수자, 편집장 브리프, QA 산출물을 생성합니다.
  - `newsletters/YYYY-MM-DD/newsletter.md`, `newsletters/YYYY-MM-DD/index.html`, `data/newsletters.json`을 생성 또는 갱신합니다.
  - `newsletter/YYYY-MM-DD` 브랜치와 편집장 검토용 PR을 생성합니다.

- `02 - Validate Site`
  - PR, `main` push, 수동 실행 시 사이트 품질을 검증합니다.
  - `data/newsletters.json`, 발행 파일 존재 여부, TODO 문자열, 중복 날짜, 필수 섹션, source list를 확인합니다.

## Operation Rules

- `main` 브랜치를 직접 수정하지 않습니다.
- 뉴스레터는 항상 PR로만 발행합니다.
- 편집장 승인 없는 자동 merge는 하지 않습니다.
- 출처 없는 뉴스 항목은 발행하지 않습니다.
- HAL 관점 Action Item 없는 뉴스 항목은 발행하지 않습니다.
- OpenAI API는 정규 운영에서 호출하지 않습니다.

## Weekly Operation

1. 매주 월요일 KST 07:00에 `Weekly Gemini Newsroom PR`이 자동 실행됩니다.
2. workflow가 후보 수집, Gemini 기자/편집자/검수자 실행, 뉴스레터 렌더링, `data/newsletters.json` 갱신을 수행합니다.
3. `node scripts/validate-site.js`가 통과해야 PR 생성 단계로 넘어갑니다.
4. PR 본문과 `newsroom/YYYY-MM-DD/editor-in-chief-brief.md`를 확인합니다.
5. 편집장은 검수 결과와 출처를 확인한 뒤 PR을 승인하거나 수정 요청합니다.
6. 편집장 승인 후 PR을 merge합니다.

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

## Automated Editor-in-Chief Mode

정규 운영은 GitHub Actions가 후보 수집, Gemini 기반 기자/편집자/검수자 작업, 뉴스레터 파일 생성, 검증, PR 생성을 한 번에 수행하는 방식입니다. 사용자는 ChatGPT UI를 거치지 않고 PR에서 편집장 역할만 수행합니다.

이 모드는 OpenAI API를 사용하지 않습니다. 뉴스 수집은 `collect-news-candidates.js`가 수행하고, Gemini는 수집된 후보 JSON과 `docs/sources.md`만 입력으로 사용합니다.

### GitHub Secrets

Repository Settings > Secrets and variables > Actions에 다음 값을 등록합니다.

- `GEMINI_API_KEY`: 필수. Gemini API 호출에 사용합니다.
- `GEMINI_MODEL`: 선택. Variables에 등록할 수 있으며 기본값은 `gemini-2.5-flash`입니다.

### Weekly Automation

`.github/workflows/weekly-newsroom-pr.yml`은 매주 월요일 07:00 KST에 실행됩니다. UTC cron은 `0 22 * * 0`입니다. workflow는 다음 순서로 동작합니다.

1. `npm run collect`로 `collected-news/YYYY-MM-DD/candidates.json`을 생성합니다.
2. `npm run generate`로 Gemini 기자, 편집자, 검수자 산출물을 생성합니다.
3. `npm run validate`로 정적 사이트와 뉴스레터 형식을 검증합니다.
4. 변경사항이 있으면 `newsletter/YYYY-MM-DD` 브랜치와 PR을 생성합니다.

### On-demand Run

GitHub Actions에서 `Weekly Gemini Newsroom PR`을 선택하고 `Run workflow`를 누릅니다. 필요하면 `newsletter_date`와 `lookback_days`를 입력합니다. 비우면 KST 기준 오늘 날짜와 21일 lookback을 사용합니다.

### PR Review

PR 본문과 `newsroom/YYYY-MM-DD/editor-in-chief-brief.md`를 먼저 봅니다. 편집장은 핵심 메시지, 메인 기사, Camera HAL 실무 연결성, 검수 결과, 출처 누락 여부를 확인한 뒤 승인 또는 수정 요청을 결정합니다. `fact-check-report.json`이 `NEEDS_FIX`이고 `must_fix`가 있으면 workflow는 실패하며 산출물은 branch에 남지 않을 수 있으므로 로그와 로컬 실행 결과를 확인합니다.

### Local Test

```powershell
$env:NEWSLETTER_DATE="2026-05-04"
$env:LOOKBACK_DAYS="21"
$env:GEMINI_API_KEY="xxx"
npm run collect
npm run generate
npm run validate
```

macOS/Linux:

```bash
NEWSLETTER_DATE=2026-05-04 LOOKBACK_DAYS=21 GEMINI_API_KEY=xxx npm run collect
NEWSLETTER_DATE=2026-05-04 GEMINI_API_KEY=xxx npm run generate
npm run validate
```

직접 Node 스크립트를 실행해도 됩니다.

```bash
NEWSLETTER_DATE=2026-05-04 LOOKBACK_DAYS=21 GEMINI_API_KEY=xxx node scripts/collect-news-candidates.js
NEWSLETTER_DATE=2026-05-04 GEMINI_API_KEY=xxx node scripts/gemini-newsroom-newsletter.js
node scripts/validate-site.js
```
