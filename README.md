# Camera HAL SW Newsletter

Camera HAL, Android Camera, C++, AI 개발 생산성과 관련된 소식을 수집하고, Gemini 기반 newsroom 자동화로 검토 가능한 정적 뉴스레터를 만드는 저장소입니다.

## 처음 보는 사람은 여기부터

- [처음 보는 사람은 여기부터](docs/START_HERE.ko.md)
- [GitHub Actions Secrets and Variables](docs/config/action-variables.ko.md)
- [news-sources.json 필드 안내](docs/config/news-sources-fields.ko.md)
- [Source editorial view](docs/news-sources.md)
- [Newsroom workflow](docs/newsroom-workflow.md)

## 품질 게이트

생성된 이슈는 `newsroom/YYYY-MM-DD/quality-report.json`과 `quality-report.md`를 포함합니다.
발행 준비 상태가 되려면 deterministic quality score가 최소 `90/100`이어야 합니다. 다만 source gap, fact-check `must_fix`, 발행 품질에 치명적인 deduction이 있으면 점수가 90 이상이어도 `NEEDS_FIX` 상태로 유지됩니다.

게이트를 통과하지 못하면 Gemini는 기본 `3`회, `NEWSROOM_MAX_QUALITY_RETRIES` 값만큼 재시도하고 `newsroom/YYYY-MM-DD/retry-history.json` 및 `retry-history.md`를 남깁니다.

품질 게이트는 Camera HAL 관련성, evidence specificity, HAL engineering depth, actionability, source integrity, article composition을 확인합니다. 이 항목들은 hard blocker입니다. 기사에는 가능한 경우 version/release, release date, API/component, behavior change, 명시적 source gap 같은 구체 evidence가 있어야 합니다. "AOSP 업데이트를 모니터링한다" 같은 일반 문장은 정확한 source, version, API, date, behavior를 함께 적지 않으면 충분하지 않습니다.

`npm.cmd run validate`는 site, image, quality validation을 모두 실행합니다. fact-check 또는 quality가 실패하면 workflow가 `needs-fix` 라벨의 review PR을 만들 수는 있지만, run은 실패하며 publication-ready로 보지 않습니다.

## 프로젝트 구조

상세 폴더 안내는 [처음 보는 사람은 여기부터](docs/START_HERE.ko.md)에 정리되어 있습니다.

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
│   ├── newsroom-workflow.md
│   └── golden-examples/
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
│       ├── quality-report.json
│       ├── quality-report.md
│       ├── retry-history.json
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
│   ├── validate-quality.js
│   └── lib/
└── .github/workflows/
    ├── 02-validate-site.yml
    └── weekly-newsroom-pr.yml
```

## 현재 운영 방식

현재 운영 방식은 **GitHub Actions 후보 수집 + Gemini reporter/editor/fact-checker + site/image/quality 검증 + 편집자 검토 PR + GitHub Pages 발행**입니다.

### Weekly Gemini Newsroom PR

- 매일 09:00 KST에 실행됩니다. UTC cron은 `0 0 * * *`입니다.
- `data/news-sources.json`의 enabled source를 우선 사용하고, registry가 없을 때만 `docs/news-sources.md`를 fallback으로 사용합니다.
- `GEMINI_API_KEY`로 Gemini newsroom pipeline을 실행합니다.
- Gemini는 `collected-news/YYYY-MM-DD/candidates.json`, source registry, editorial docs만 입력으로 사용하며 웹을 직접 browse하지 않습니다.
- `newsroom/YYYY-MM-DD/`에 candidates, reporter/editor/fact-check 결과, editor-in-chief brief, QA report를 저장합니다.
- `newsletters/YYYY-MM-DD/newsletter.md`, `newsletters/YYYY-MM-DD/index.html`, `data/newsletters.json`을 생성 또는 갱신합니다.
- `newsletter/YYYY-MM-DD` 브랜치로 편집자 검토용 PR을 만듭니다.

### 02 - Validate Site and Images

- PR, `main` push, manual run에서 `npm.cmd run validate`를 실행합니다.
- `data/newsletters.json`, published files, TODO leak, duplicate date, required sections, source/reference, HTML anchor, article image/fallback contract를 검증합니다.
- 변경된 `newsletters/`, `newsroom/`, `collected-news/` 날짜의 quality report는 hard gate로 검사합니다. 변경되지 않은 과거 review artifact는 warning-only로 둡니다.

## 운영 규칙

- 뉴스레터 발행은 PR 기반입니다. 생성 workflow가 `main`에 직접 발행하지 않습니다.
- 편집자 승인 없는 자동 merge는 하지 않습니다.
- 출처가 없거나 Camera HAL 관점의 action item이 없는 항목은 발행하지 않습니다.
- `data/news-sources.json`이 machine-readable source of truth입니다.
- `docs/news-sources.md`는 사람이 검토하기 위한 editorial view이며, JSON registry가 없을 때 fallback 문서입니다.
- external article image는 임의로 대체하지 않습니다. resolver와 local fallback contract를 사용합니다.
- validator를 약화해서 publication risk를 숨기지 않습니다.

## 명령어

Node 20을 사용합니다.

```powershell
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

개별 검증이 필요할 때는 아래 명령을 사용할 수 있습니다.

```powershell
npm.cmd run validate:site
npm.cmd run validate:images
npm.cmd run validate:quality
```

## 뉴스레터 계약

발행 Markdown과 HTML은 다음 계약을 지켜야 합니다.

- 이번 주 briefing은 정확히 3개 bullet입니다.
- main article은 4-5개입니다. 후보가 부족하면 억지로 5개를 채우지 않습니다.
- 각 main article은 confirmed facts, background, Camera HAL perspective, Camera HAL checks, action items, sources를 포함해야 합니다.
- AI 관련 기사는 최소 1개 포함합니다. 단, camera input path 또는 HAL workflow와 연결되어야 합니다.
- `## References`를 포함합니다.
- 발행 artifact에 `TODO` 문자를 남기지 않습니다.
- Camera HAL 관련성은 capability, request/result, stream/buffer, metadata, CTS/VTS/ITS/CDD, latency, frame drop, thermal, power, native runtime, C++ tooling처럼 실제 검증 가능한 단위로 작성합니다.

## Collector와 Source Eligibility

collector는 후보마다 schema v5 eligibility metadata를 붙입니다.

- `collectionMode`
- `isArticleCandidate`
- `isWatchPage`
- `hasDatedEvidence`
- `evidenceLevel`
- `finalSelectionEligibility`
- `source_kind`
- `has_published_date`
- `has_version_or_release`
- `has_api_or_component`
- `has_behavior_change`
- `source_gap_risk`
- `main_eligible`
- `briefing_only`
- `reference_only`
- `evidence_score`

`finalSelectionEligibility`는 `main`, `short`, `watchlist`, `exclude` 중 하나입니다. main newsletter article에는 `main` 또는 `short` 후보만 사용할 수 있습니다.

Static documentation page, release-note index page, homepage는 monitoring target으로 유지하지만, published date, version/release, API/component, behavior change가 모두 추출되지 않으면 `watchlist`에 머뭅니다. Source keyword는 real article candidate의 contextual relevance에만 쓰고 watch page를 main/short tier로 올리지 않습니다.

`source_kind`, `main_eligible`, `reference_only`, `evidence_score`는 backward compatibility를 위해 유지하며 같은 classification rule에서 파생합니다.

현재 item-level parser 대상은 다음과 같습니다.

- `camerax-release-notes`
- `aosp-whats-new-release-notes`
- `android-security-bulletin`
- `libcamera-blog`
- `llvm-release-notes`

Reporter, editor, quality gate는 prompt에만 의존하지 않습니다. reporter candidate URL과 editor section source URL을 대조해 watchlist/exclude 후보가 `selected=true`가 되지 못하게 막고, ineligible source가 main article로 올라오면 blocking `source-integrity` deduction으로 replacement/demotion 대상 처리합니다.

## 로컬 미리보기

`fetch()`가 JSON을 읽을 수 있도록 local HTTP server로 확인합니다.

```powershell
npx serve .
```

## GitHub Secrets and Variables

GitHub repository의 `Settings -> Secrets and variables -> Actions`에서 설정합니다.
`GEMINI_API_KEY`는 Secret으로만 관리하고, 모델과 retry 관련 값은 필요할 때 Variables로 override합니다.

현재 workflow 기본값과 변경 시 주의점은 [GitHub Actions Secrets and Variables](docs/config/action-variables.ko.md)에 정리되어 있습니다.

## PR 검토

PR 본문과 `newsroom/YYYY-MM-DD/editor-in-chief-brief.md`를 먼저 확인합니다. 편집자는 다음 항목을 검토한 뒤 승인하거나 수정 요청합니다.

- 핵심 메시지와 main article 구성
- Camera HAL 업무와의 연결성
- fact-check 결과와 `must_fix`
- source gap 및 replacement/demotion 이력
- fallback image 경고
- `quality-report.md`와 `retry-history.md`

`fact-check-report.json`이 `NEEDS_FIX`이고 `must_fix`가 있으면 workflow는 실패해야 합니다. 이 경우 publication-ready가 아니며, 생성 artifact는 GitHub Actions uploaded artifact 또는 workflow log에서 검토합니다.
