# Camera HAL SW Newsletter

Camera HAL, Android Camera, C++, AI 개발 생산성과 관련된 소식을 정리하는 정적 뉴스레터 사이트입니다.

## File Tree

```text
.
├── index.html
├── assets/
│   └── images/fallback/
├── css/
│   ├── styles.css
│   └── hero-override.css
├── data/
│   ├── newsletters.json
│   └── news-sources.json
├── docs/
│   ├── news-sources.md
│   ├── news-sources-guide.md
│   ├── editorial-policy.md
│   ├── newsletter-template.md
│   └── newsroom-workflow.md
├── collected-news/
│   └── YYYY-MM-DD/candidates.json
├── newsroom/
│   └── YYYY-MM-DD/
│       ├── news-candidates.md
│       ├── reporter-candidates.json
│       ├── editor-draft.json
│       ├── editor-draft.md
│       ├── fact-check-report.json
│       ├── fact-check-report.md
│       ├── editor-in-chief-brief.md
│       └── release-qa-report.md
├── newsletters/
│   └── YYYY-MM-DD/
│       ├── index.html
│       └── newsletter.md
├── scripts/
│   ├── collect-news-candidates.js
│   ├── gemini-newsroom-newsletter.js
│   ├── validate-site.js
│   ├── validate-external-images.js
│   └── lib/
│       ├── article-image-resolver.js
│       ├── common.js
│       ├── gemini-client.js
│       ├── image-candidates.js
│       ├── newsletter-renderer.js
│       └── newsletter-schema.js
└── .github/workflows/
    ├── 02-validate-site.yml
    └── weekly-newsroom-pr.yml
```

## Current Operation Mode

정규 운영은 **GitHub Actions 후보 수집 + Gemini 기자/편집자/검증자 + 사이트/이미지 검증 + 편집장 PR 승인 + GitHub Pages 발행** 흐름입니다.

- `Weekly Gemini Newsroom PR`
  - 매일 09:00 KST에 실행됩니다. UTC cron은 `0 0 * * *`입니다.
  - `data/news-sources.json`의 enabled source를 우선 사용하고, registry가 없을 때만 `docs/news-sources.md`로 fallback합니다.
  - `GEMINI_API_KEY`로 Gemini pipeline을 실행합니다.
  - `collected-news/YYYY-MM-DD/candidates.json`과 source/editorial 문서만 입력으로 사용합니다.
  - `newsroom/YYYY-MM-DD/`에 후보, reporter/editor/fact-check, 편집장 brief, QA report를 남깁니다.
  - `newsletters/YYYY-MM-DD/newsletter.md`, `newsletters/YYYY-MM-DD/index.html`, `data/newsletters.json`을 생성하거나 갱신합니다.
  - `newsletter/YYYY-MM-DD` branch로 편집장 검토용 PR을 생성합니다.

- `02 - Validate Site and Images`
  - PR, `main` push, 수동 실행에서 `npm run validate`를 수행합니다.
  - `data/newsletters.json`, 발행 파일 존재 여부, TODO leak, 중복 날짜, 필수 section, source/reference, HTML anchor, article image/fallback을 검증합니다.

## Operation Rules

- 뉴스레터 발행은 PR 기반입니다. 생성 workflow가 `main`에 직접 발행하지 않습니다.
- 편집장 승인 없는 자동 merge는 하지 않습니다.
- 출처가 없거나 Camera HAL 관점의 action item이 없는 항목은 발행하지 않습니다.
- `data/news-sources.json`은 machine source of truth입니다.
- `docs/news-sources.md`는 사람이 검토하기 위한 editorial view이며, JSON registry가 없을 때의 fallback 문서입니다.

## Commands

Use Node 20.

```powershell
node scripts/validate-site.js
npm.cmd run validate
```

```powershell
$env:NEWSLETTER_DATE="YYYY-MM-DD"
$env:LOOKBACK_DAYS="21"
npm.cmd run collect
```

```powershell
$env:NEWSLETTER_DATE="YYYY-MM-DD"
$env:GEMINI_API_KEY="xxx"
npm.cmd run generate
```

## Newsletter Contract

발행 Markdown은 다음 구조를 지켜야 합니다.

- `## 1. 이번 주 3줄 브리핑`: 정확히 3개 bullet.
- 주요 기사 4-6개 권장.
- 각 주요 기사에는 확인한 사실, 배경지식, Camera HAL 관점, Action Item, Sources가 필요합니다.
- AI 관련 기사는 최소 1개 포함합니다.
- `## References`를 포함합니다.
- `TODO` 문자는 발행 artifact에 남기지 않습니다.

Camera HAL 관점은 capability, request/result, stream/buffer, metadata, CTS/VTS/ITS/CDD, latency, frame drop, thermal, power, native runtime, C++ tooling처럼 실제 검증 가능한 단위로 적습니다.

## Local Preview

`fetch()`가 JSON을 읽을 수 있도록 로컬 HTTP 서버로 확인합니다.

```powershell
npx serve .
```

## GitHub Secrets and Variables

- `GEMINI_API_KEY`: 필수. Gemini API 호출에 사용합니다.
- `GEMINI_MODEL`: 선택. 기본값은 workflow의 `gemini-2.5-flash`입니다.
- `GEMINI_FALLBACK_MODELS`: 선택. 쉼표로 구분한 fallback 모델 목록입니다.

## PR Review

PR 본문과 `newsroom/YYYY-MM-DD/editor-in-chief-brief.md`를 먼저 확인합니다. 편집장은 핵심 메시지, 주요 기사, Camera HAL 업무 연결, fact-check 결과, source gap, fallback image 경고를 확인한 뒤 승인하거나 수정을 요청합니다.

`fact-check-report.json`이 `NEEDS_FIX`이고 `must_fix`가 있으면 workflow는 실패합니다. 이 실패 경로에서는 `newsletter/YYYY-MM-DD` branch와 PR이 생성되지 않으므로, 생성 artifact는 GitHub Actions의 uploaded workflow artifact와 workflow log에서 확인합니다.
