# Camera HAL SW Newsletter Newsroom Workflow

## Quality Gate

The newsroom pipeline now produces `newsroom/YYYY-MM-DD/quality-report.json` and `quality-report.md`.
The deterministic score must be at least `90/100` for publication readiness. Source gaps, fact-check must-fix items, and publication-critical deductions keep the draft out of publish-ready status even when the numeric score is high enough.
If a draft misses the gate, the generator retries up to `NEWSROOM_MAX_QUALITY_RETRIES` times, default `3`, preserving article sections that already pass per-article quality checks and writing `retry-history.json` / `retry-history.md`.

The quality gate checks Camera HAL relevance, evidence specificity, HAL engineering depth, actionability, source integrity, and article composition. Those categories are hard blockers; the 90-point threshold only leaves room for non-critical future deductions. If the score is below 90 or blockers remain after retry attempts, the weekly workflow can still open a review PR, labels it `needs-fix`, and fails the run so the issue is not treated as publishable.

이 문서는 Camera HAL SW Newsletter를 매일 낮은 수작업 비용으로 만들기 위한 역할 기반 workflow입니다.

## Goal

목표는 단순히 날짜별 newsletter 파일을 자동 생성하는 것이 아닙니다. 최신 소식을 수집하고, Camera HAL 엔지니어 관점으로 해석하고, 검증 가능한 초안을 PR로 남기는 것입니다. 사용자는 최종 편집장 역할로 PR을 승인하거나 수정 요청합니다.

```text
source registry
  -> candidate collector
  -> Gemini reporter
  -> Gemini editor
  -> Gemini fact checker
  -> static artifact writer
  -> npm run validate
  -> newsletter/YYYY-MM-DD PR
```

## Role 1. Candidate Collector

- `data/news-sources.json`의 enabled source를 읽습니다.
- JSON registry가 없을 때만 `docs/news-sources.md`의 `- Name: URL` 형식을 fallback으로 사용합니다.
- RSS 또는 HTML page에서 후보를 수집하고 `collected-news/YYYY-MM-DD/candidates.json`을 생성합니다.
- media/community/candidate-only source는 최종 기사로 쓰기 전에 공식 출처 교차 확인이 필요합니다.

## Role 2. Gemini Reporter

- 수집 후보 중 Camera HAL, Android Camera, CameraX, AOSP Camera, stream/buffer/metadata/request/result, C++, LLVM/Clang, AI workflow와 관련된 항목을 점수화합니다.
- source name, source URL, candidateOnly, requiresCrossCheck, imageCandidates를 유지합니다.
- 출력: `newsroom/YYYY-MM-DD/reporter-candidates.json`.

## Role 3. Gemini Editor

- 한국어 newsletter 초안을 작성합니다.
- 각 주요 기사에 확인한 사실, 배경지식, Camera HAL 관점, Action Item, Sources를 포함합니다.
- 이미지 URL을 새로 만들지 않고 collector가 제공한 `imageCandidates`에서만 선택합니다.
- 출력: `newsroom/YYYY-MM-DD/editor-draft.json`, `newsroom/YYYY-MM-DD/editor-draft.md`.

## Role 4. Gemini Fact Checker

- 출처 누락, 과장 표현, 사실과 해석 혼동, Action Item 누락, Camera HAL 관점 약화를 확인합니다.
- `NEEDS_FIX`와 `must_fix`가 있으면 workflow의 최종 gate가 실패합니다.
- 출력: `newsroom/YYYY-MM-DD/fact-check-report.json`, `newsroom/YYYY-MM-DD/fact-check-report.md`.

## Role 5. Artifact Writer

- `newsletters/YYYY-MM-DD/newsletter.md`를 생성합니다.
- `newsletters/YYYY-MM-DD/index.html`을 생성합니다.
- `data/newsletters.json`을 갱신합니다.
- `newsroom/YYYY-MM-DD/editor-in-chief-brief.md`와 `release-qa-report.md`를 생성합니다.

## Role 6. Validator

`npm run validate`가 최종 품질 gate입니다.

- `npm run validate:site`: metadata, 파일 존재, TODO leak, duplicate date, required sections, source/reference, HTML class hook, anchor balance를 확인합니다.
- `npm run validate:images`: article image URL과 local fallback file 존재를 확인합니다.

## GitHub Actions Operation

### Daily Draft PR

`Weekly Gemini Newsroom PR` workflow는 매일 09:00 KST에 실행됩니다.

```text
KST daily 09:00 = UTC daily 00:00
branch: newsletter/YYYY-MM-DD
```

workflow는 `main`에 직접 push하지 않고, 편집장 검토용 PR을 만듭니다.

### Required Secret

Repository Settings > Secrets and variables > Actions:

```text
GEMINI_API_KEY
```

선택 변수:

```text
GEMINI_MODEL=gemini-2.5-flash
GEMINI_FALLBACK_MODELS=gemini-2.5-flash-lite,gemini-3.1-flash-lite-preview
```

### On-demand Run

GitHub Actions에서 `Weekly Gemini Newsroom PR`을 선택하고 `Run workflow`를 누릅니다. 필요한 경우 `newsletter_date`와 `lookback_days`를 입력합니다. 비워 두면 KST 기준 오늘 날짜와 21일 lookback을 사용합니다.

## Editor-in-Chief Review

PR에서 다음 항목을 확인합니다.

- 이번 호 핵심 메시지가 명확한가?
- Camera HAL 엔지니어가 읽을 이유가 있는가?
- 단순 요약이 아니라 HAL 관점의 해석과 Action Item이 있는가?
- Sources와 References가 충분한가?
- fact-check 결과에 unresolved `must_fix`가 없는가?
- article image가 출처와 fallback 정책을 지키는가?

## Release

편집장이 PR을 승인하면 merge합니다. GitHub Pages는 `main` 기준으로 반영됩니다.
