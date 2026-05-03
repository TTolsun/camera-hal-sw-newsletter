# Camera HAL SW 뉴스레터 Newsroom workflow

이 문서는 Camera HAL SW 뉴스레터를 낮은 수작업 비용으로 매일 생성하기 위한 역할 기반 workflow를 설명합니다.

## 품질 게이트

newsroom pipeline은 `content/newsroom/YYYY-MM-DD/quality-report.json`과 `quality-report.md`를 생성합니다. 발행 준비 상태가 되려면 deterministic score가 기본 `85/100` 이상이어야 합니다. Quality threshold: 85. 이 threshold 완화는 Gemini 비용과 false negative를 줄이기 위한 운영 튜닝이며, 품질 검증 우회가 아닙니다. source gap, fact-check `must_fix`, 발행에 치명적인 deduction이 있으면 숫자 점수가 85 이상이어도 publish-ready로 보지 않습니다.

draft가 gate를 통과하지 못하면 generator는 `NEWSROOM_MAX_QUALITY_RETRIES` 값만큼 재시도합니다. 기본값은 `1`입니다. 이미 article quality check를 통과한 section은 보존하고, `retry-history.json`과 `retry-history.md`를 남깁니다. Gemini API retry max delay 기본값은 `GEMINI_RETRY_MAX_DELAY_MS=300000`이며, 300000ms는 5분입니다.

quality gate는 Camera HAL relevance, evidence specificity, HAL engineering depth, actionability, source integrity, article composition을 확인합니다. source gap, fact-check `must_fix`, source/reference 누락, underfilled article count, 약한 Camera HAL / Android Camera relevance, 약한 evidence specificity, 필요한 date/version/API/component/behavior-change 근거 누락은 점수가 충분해도 Hard blocker result: NEEDS_FIX 또는 `publish_ready=false`를 강제합니다. actionability처럼 단독 발행 차단보다는 개선 권고에 가까운 항목은 non-blocking deduction으로 점수만 낮출 수 있으며, 이 경우에도 Quality score가 85 미만이면 통과하지 않습니다. retry 후에도 점수가 낮거나 blocker가 남아 있으면 weekly workflow는 review PR을 만들 수 있지만 `needs-fix`로 표시하고 run을 실패시켜 발행 가능한 이슈로 취급하지 않습니다.

## 목표

목표는 단순히 날짜별 newsletter 파일을 자동 생성하는 것이 아닙니다. 최신 소식을 수집하고, Camera HAL 엔지니어 관점으로 해석하고, 검증 가능한 초안을 PR로 남기는 것입니다. 사용자는 최종 편집장으로 PR을 승인하거나 수정 요청합니다.

```text
source registry
  -> candidate collector
  -> deterministic shortlist and final article selection
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
- RSS 또는 HTML page에서 후보를 수집하고 `content/collected-news/YYYY-MM-DD/candidates.json`을 생성합니다.
- media/community/candidate-only source는 최종 기사로 올리기 전에 공식 출처 교차 확인이 필요합니다.

## Role 2. Gemini Reporter

Gemini 실행 전에 `scripts/newsroom/generate/newsroom-selection.js`가 `content/collected-news/YYYY-MM-DD/candidates.json`을 읽고 source-gap/watch/reference 후보를 제거합니다. 기존 `scripts/lib/newsroom-selection.js` 경로는 호환 shim으로 유지합니다. URL과 near-duplicate title을 dedupe하고, eligible candidate를 점수화한 뒤 `content/newsroom/YYYY-MM-DD/shortlisted-candidates.json`을 작성합니다.

shortlist는 최대 12개 후보로 제한됩니다. local selector는 editor prompt가 실행되기 전에 4-5개의 final main article input을 선택합니다. Camera HAL, Android Camera, AOSP, CameraX 항목을 우선하고, AI 관련 기사 최소 1개를 요구합니다. C++ 또는 developer-productivity material은 강한 camera/platform 항목이 4개보다 적을 때 보완용으로 사용합니다. eligible non-duplicate final input이 4개 미만이면 생성은 조기에 실패하고 `content/newsroom/YYYY-MM-DD/recovery-prompt.md`를 남깁니다.

- 수집 후보 중 Camera HAL, Android Camera, CameraX, AOSP Camera, stream/buffer/metadata/request/result, C++, LLVM/Clang, AI workflow와 관련된 항목을 점수화합니다.
- source name, source URL, candidateOnly, requiresCrossCheck, imageCandidates를 유지합니다.
- 출력: `content/newsroom/YYYY-MM-DD/reporter-candidates.json`.

Gemini reporter는 전체 collected candidate가 아니라 deterministic shortlist만 받습니다. 요약, tag, evidence field를 보강하되 local `selected=true` final article decision을 보존해야 합니다.

## Role 3. Gemini Editor

- 한국어 newsletter 초안을 작성합니다.
- 각 주요 기사는 확인한 사실, 배경지식, Camera HAL 관점, Action Item, Sources를 포함합니다.
- 이미지 URL을 새로 만들지 않고 collector가 제공한 `imageCandidates`에서만 선택합니다.
- 출력: `content/newsroom/YYYY-MM-DD/editor-draft.json`, `content/newsroom/YYYY-MM-DD/editor-draft.md`.

editor는 deterministic final article input과 locked/retry context만 받습니다. retry가 필요하면 통과한 section은 lock하고, repair prompt는 실패한 section만 재생성하도록 요청합니다. retry artifact는 `locked_sections`, `failed_sections`, `regenerated_sections`, rejected retry output을 기록합니다.

## Role 4. Gemini Fact Checker

- 출처 누락, 과장 표현, 사실과 해석 혼동, Action Item 누락, Camera HAL 관점 약화를 확인합니다.
- `NEEDS_FIX`와 `must_fix`가 있으면 workflow의 최종 gate가 실패해야 합니다.
- 출력: `content/newsroom/YYYY-MM-DD/fact-check-report.json`, `content/newsroom/YYYY-MM-DD/fact-check-report.md`.

## Role 5. Artifact Writer

- `newsletters/YYYY-MM-DD/newsletter.md`를 생성합니다.
- `newsletters/YYYY-MM-DD/index.html`을 생성합니다.
- `data/newsletters.json`을 갱신합니다.
- `content/newsroom/YYYY-MM-DD/editor-in-chief-brief.md`와 `release-qa-report.md`를 생성합니다.

## Role 6. Validator

`npm run validate`가 최종 safety gate입니다.

- `npm run validate:config`: `data/news-sources.json` 구조, 필수 field, source ID, URL, category-to-section mapping, source entry의 중복 `section` 금지, canonical JSON formatting을 확인합니다.
- `npm run validate:site`: metadata, 파일 존재, TODO leak, duplicate date, required sections, source/reference, HTML class hook, anchor balance를 확인합니다.
- `npm run validate:images`: article image URL과 local fallback file 존재를 확인합니다.
- `npm run validate:quality`: deterministic quality report를 재계산하고 4개 미만 또는 5개 초과 main article, AI 관련 기사 누락, main section 간 source URL 중복, source 누락, Camera HAL perspective 누락, action item 부족, source-gap mapped candidate, dated evidence 없는 selected candidate를 차단합니다.
- `npm run validate:localization`: 유지 문서와 표시용 JSON 값이 한국어 규칙을 지키는지 확인합니다.

## URL Summary Cache

Reporter summary record는 `cache/news-summary/{sha256(normalized_url)}.json`에 cache됩니다. cache file은 의도적으로 untracked이며 CI에서는 `actions/cache`로 복원합니다.

cache hit은 normalized URL과 content fingerprint가 일치할 때만 사용합니다. fingerprint는 URL, title, published date, source, summary, version/release, API/component, behavior evidence를 포함하므로 article evidence가 바뀌면 stale summary를 재사용하지 않습니다.

## Recovery Artifacts

`content/newsroom/YYYY-MM-DD/recovery-prompt.md`는 deterministic selection, Gemini JSON parsing, fact-check, quality, validation이 retry 후에도 실패할 때 작성됩니다. shortlist, selected input, failed section, quality deduction, fact-check finding, exact rerun command를 포함합니다.

## GitHub Actions 운영

### 일일 Draft PR

`Weekly Gemini Newsroom PR` workflow는 매일 09:00 KST에 실행됩니다.

```text
KST daily 09:00 = UTC daily 00:00
branch: newsletter/YYYY-MM-DD
```

workflow는 `main`에 직접 push하지 않고 편집자 검토용 PR을 만듭니다.

### 필수 Secret

Repository Settings > Secrets and variables > Actions:

```text
GEMINI_API_KEY
```

선택 변수:

```text
GEMINI_MODEL=gemini-2.5-flash
GEMINI_FALLBACK_MODELS=gemini-2.5-flash-lite,gemini-2.5-pro
```

### 수동 실행

GitHub Actions에서 `Weekly Gemini Newsroom PR`을 선택하고 `Run workflow`를 누릅니다. 필요하면 `newsletter_date`와 `lookback_days`를 입력합니다. 비워 두면 KST 기준 오늘 날짜와 21일 lookback을 사용합니다.

## Editor-in-Chief Review

PR에서 다음 항목을 확인합니다.

- 이번 주 핵심 메시지가 명확한가?
- Camera HAL 엔지니어가 읽을 이유가 있는가?
- 단순 요약이 아니라 HAL 관점의 해석과 Action Item이 있는가?
- Sources와 References가 충분한가?
- fact-check 결과에 unresolved `must_fix`가 없는가?
- article image가 source attribution과 fallback contract를 지키는가?

## Release

편집자가 PR을 승인하면 merge합니다. GitHub Pages는 `main` 기준으로 반영됩니다.
