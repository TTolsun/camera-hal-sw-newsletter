# AOSP Camera / Driver / SoC Platform Newsletter

AOSP Camera Framework, Camera HAL, Camera Driver, V4L2/libcamera, ISP/image sensor, SoC/CPU/GPU/NPU, power/thermal/performance, C++/AI tooling 소식을 수집하고 Gemini 기반 newsroom 자동화로 검토 가능한 정적 뉴스레터를 만드는 저장소입니다.

## 핵심 용어

이 저장소의 문서는 코드 식별자와 artifact 이름을 영어 원문으로 유지합니다. 처음 보는 운영자가 의미를 빠르게 잡을 수 있도록 주요 용어는 아래처럼 읽으면 됩니다.

| 용어 | 의미 |
| --- | --- |
| `scheduled run`(예약 자동 실행) | GitHub Actions가 매일 09:00 KST에 자동으로 후보 수집, 생성, 검증, PR 생성을 시도하는 실행입니다. 기본값은 비용 안전성을 우선합니다. |
| `manual high-quality run`(수동 고품질 실행) | 사람이 GitHub Actions에서 `Run workflow`로 직접 시작하는 실행입니다. `allow_pro=true`를 명시한 경우에만 Pro 모델을 사용할 수 있습니다. |
| `fallback model`(대체 모델) | 기본 Gemini 모델 호출이 실패했을 때 순서대로 시도하는 모델입니다. 예약 자동 실행의 기본 fallback은 `gemini-2.5-flash-lite`까지만 허용합니다. |
| `article composition`(기사 구성 방식) | main article이 4-5개인지, briefing이 3개인지, 각 기사에 필요한 field가 있는지 보는 구성 규칙입니다. |
| `collectionMode`(기사 수집 방식) | source registry에서 후보를 RSS, HTML, watch page 등 어떤 방식으로 수집할지 알려주는 field입니다. |
| `source gap`(출처 근거 부족) | 날짜, version, API/component, behavior change 같은 발행 근거가 부족하거나 원문으로 확인되지 않는 상태입니다. main article은 rewrite로 억지 통과시키지 않고 demote 또는 replace합니다. |
| `quality gate`(품질 통과 기준) | `npm.cmd run validate`와 `quality-report.json`이 적용하는 발행 안전 기준입니다. 점수와 hard fail을 함께 봅니다. |
| `cost report`(비용 리포트) | Gemini 호출별 stage/model/attempt, token, thinking token, cached token, estimated cost를 보여주는 비용 분석 artifact입니다. |
| `selection report`(기사 선정 리포트) | deterministic scoring과 final selection 결과를 확인하는 artifact 묶음입니다. 현재는 `shortlisted-candidates.json`, `article-capsules.json`, PR 본문/brief의 selection diagnostics를 함께 봅니다. |
| `generation status artifact`(생성 상태 결과 파일) | `.tmp/newsletter-generation-status.json`입니다. 생성 성공 여부, `publish_ready`, article count, quality/fact-check 상태를 workflow gate가 읽습니다. |

## 처음 보는 사람은 여기부터

- [처음 보는 사람은 여기부터](docs/START_HERE.ko.md)
- [GitHub Actions Secret과 Variable](docs/config/action-variables.ko.md)
- [news-sources.json 필드 안내](docs/config/news-sources-fields.ko.md)
- [출처 editorial view](docs/news-sources.md)
- [뉴스룸 workflow](docs/newsroom-workflow.md)

## 최종 비용 절감 workflow

현재 운영 기준의 생성 흐름은 아래 순서입니다.

```text
1. Collect candidates(후보 수집)
2. Deterministic eligibility filter(코드 기반 적격성 필터)
3. Scope-first scoring(AOSP Camera / Driver / SoC bucket 우선 점수화)
4. Top 8-12 article capsules(압축 기사 capsule) 생성
5. Gemini reporter/editor/fact-check 실행
6. Quality gate(품질 통과 기준) 확인
7. 실패 section만 repair 또는 replace
8. Markdown/HTML 렌더링
9. Cost/selection/quality/status artifact 저장
10. Review PR 생성
```

비용 절감은 품질 기준을 낮추는 방식이 아닙니다. LLM 호출 전에 코드가 후보를 `direct_aosp_camera`, `camera_driver_image_pipeline`, `android_platform_camera_adjacent`, `soc_platform_signal`, `cpp_ai_tooling_fallback`, `generic_tech_watchlist` bucket으로 분류하고, Gemini에는 compact capsule만 전달합니다. retry도 전체 뉴스레터 재생성이 아니라 실패 section 중심으로 제한합니다. 비용 초과 기준은 현재 warning-only이며, 발행 가능 여부는 `quality gate`와 fact-check 결과가 결정합니다.

### Editorial scope bucket

| Bucket | 용도 |
| --- | --- |
| `direct_aosp_camera` | Camera HAL/HAL3/AIDL/HIDL, CameraProvider/CameraService, Android Camera Framework, Camera2/CameraX, ImageReader/Surface/AHardwareBuffer, stream/buffer/metadata/request/result, camera CTS/VTS/ITS/CDD 직접 기사입니다. |
| `camera_driver_image_pipeline` | Linux camera driver, V4L2, media controller, libcamera, image sensor, ISP, MIPI CSI-2, DMA-BUF, video capture pipeline, Linux media subsystem 기사입니다. |
| `android_platform_camera_adjacent` | Android release, compatibility, graphics buffer/Surface, media framework, power/thermal, scheduler, memory pressure, security bulletin 중 camera 영향 설명이 가능한 기사입니다. |
| `soc_platform_signal` | CPU/GPU/NPU/ISP/DSP, memory bandwidth, cache/interconnect, power/thermal/DVFS, scheduler/EAS, Qualcomm/Samsung/Arm/MediaTek, Exynos/Snapdragon/Tensor 같은 공개 SoC/platform 기사입니다. 낮은 우선순위 fallback이지만 배제하지 않습니다. |
| `cpp_ai_tooling_fallback` | C++, LLVM/Clang/GCC, sanitizer, native performance, build/test tooling, AI coding tools, on-device AI, LLM agent workflow fallback 기사입니다. |
| `generic_tech_watchlist` | camera/driver/soc/native 개발 관점 연결이 약한 일반 IT 뉴스입니다. main article보다 briefing/watchlist로 둡니다. |

### 안전한 scheduled run 기본값

예약 자동 실행에서는 Pro 모델을 자동 fallback으로 두지 않습니다. workflow 기본값은 `.github/workflows/weekly-newsroom-pr.yml`과 `scripts/newsroom/common/runtime-config.js`에 맞춰 아래처럼 운영합니다.

| 환경변수 | 기본값 | 역할 |
| --- | --- | --- |
| `LOOKBACK_DAYS` | `21` | 후보를 몇 일 전까지 볼지 정합니다. 최신성은 보통 3-4주 안쪽을 허용하지만 기본 수집 창은 21일입니다. |
| `GEMINI_MODEL` | `gemini-2.5-flash` | 기본 생성 모델입니다. |
| `GEMINI_FALLBACK_MODELS` | `gemini-2.5-flash-lite` | 예약 자동 실행의 fallback model(대체 모델)입니다. Pro는 포함하지 않습니다. |
| `GEMINI_MAX_RETRIES` | `2` | retryable API failure 또는 invalid JSON에 대한 모델별 재시도 수입니다. |
| `GEMINI_RETRY_DELAYS_MS` | `20000,10000` | Gemini가 retry hint를 주지 않을 때 사용하는 대기 시간입니다. |
| `GEMINI_RETRY_MAX_DELAY_MS` | `300000` | 서버 retry hint를 따를 때 허용하는 최대 대기 시간입니다. 300000ms는 5분입니다. |
| `GEMINI_THINKING_BUDGET_REPORTER` | `0` | reporter stage의 thinking budget입니다. 후보 tagging 성격이라 기본 0입니다. |
| `GEMINI_THINKING_BUDGET_EDITOR` | `512` | editor/completion stage의 thinking budget입니다. 최종 문장 품질이 필요한 단계만 제한적으로 허용합니다. |
| `GEMINI_THINKING_BUDGET_REPAIR` | `0` | section repair stage의 thinking budget입니다. 실패 section만 좁게 고치므로 기본 0입니다. |
| `GEMINI_THINKING_BUDGET_FACTCHECK` | `0` | fact-check stage의 thinking budget입니다. deterministic gate를 대체하지 않습니다. |
| `GEMINI_THINKING_BUDGET_SCORING` | `0` | scoring 성격 stage의 thinking budget입니다. 현재 main scoring은 코드가 수행합니다. |
| `NEWSROOM_MAX_QUALITY_RETRIES` | `1` | quality retry 최대 횟수입니다. |
| `NEWSROOM_MAX_SECTION_REPAIRS` | `1` | retry 한 번에서 repair/replace할 section 수입니다. |
| `NEWSROOM_WARN_COST_USD` | `0.15` | estimated cost가 넘으면 warning을 남기는 기준입니다. |
| `NEWSROOM_MAX_COST_USD` | `0.25` | 운영상 비용 상한 참고값입니다. 현재는 초과해도 warning-only입니다. |
| `NEWSROOM_ALLOW_PRO_ON_SCHEDULE` | `false` | scheduled run(예약 자동 실행)에서 Pro 사용을 막습니다. |
| `NEWSROOM_ALLOW_PRO_ON_MANUAL` | `false` | manual run의 기본값도 Pro 금지입니다. workflow input `allow_pro=true`일 때만 true가 됩니다. |
| `NEWSROOM_PRO_ESCALATION` | `manual` | Pro 사용 정책을 log와 cost report에 표시하는 label입니다. |

### Manual high-quality run에서 Pro 허용

`manual high-quality run`(수동 고품질 실행)은 편집자가 비용 증가를 알고 명시적으로 선택할 때만 사용합니다.

1. GitHub Actions에서 `Weekly Gemini Newsroom PR`을 선택합니다.
2. `Run workflow`를 누릅니다.
3. 필요하면 `newsletter_date`, `lookback_days`를 입력합니다.
4. Pro 사용이 꼭 필요할 때만 `allow_pro=true`를 선택합니다.

이 경우 workflow가 `GEMINI_FALLBACK_MODELS`에 `gemini-2.5-pro`를 붙이고 `NEWSROOM_ALLOW_PRO_ON_MANUAL=true`로 실행합니다. Pro가 실제 호출되면 workflow log와 `cost-report.md`의 `pro_policy`, `pro_model` 항목에 남습니다. Pro 모델은 thinking disable이 제한될 수 있으므로 `thinking_tokens`, `thinking_budget_requested`, `thinking_budget_applied`를 반드시 확인합니다.

## 주요 artifact 읽는 법

| Artifact | 위치 | 읽는 방법 |
| --- | --- | --- |
| `cost report`(비용 리포트) | `.tmp/newsroom-cost-report.json`, `content/newsroom/YYYY-MM-DD/cost-report.md` | stage/model/attempt별 token과 estimated cost를 봅니다. `thinking_tokens`가 크면 `GEMINI_THINKING_BUDGET_*` 조정 후보입니다. |
| `selection report`(기사 선정 리포트) | `content/newsroom/YYYY-MM-DD/shortlisted-candidates.json`, `article-capsules.json`, PR 본문 selection diagnostics | 후보가 왜 선택/제외됐는지, LLM에 전달된 capsule이 top 8-12개 안에 제한됐는지 봅니다. |
| `quality report`(품질 리포트) | `content/newsroom/YYYY-MM-DD/quality-report.json`, `quality-report.md` | `score`, hard fail, soft deduction, `article_results`의 `PASS` / `DEMOTE` / `FAIL`을 확인합니다. |
| `generation status artifact`(생성 상태 결과 파일) | `.tmp/newsletter-generation-status.json` | `status`, `publish_ready`, `quality_status`, `final_selected_article_count_for_gate`를 확인합니다. workflow 최종 실패 조건이 이 값을 읽습니다. |
| `summary cache report`(요약 cache 리포트) | `.tmp/summary-cache-report.json`, `content/newsroom/YYYY-MM-DD/summary-cache-report.md` | summary cache hit/miss와 miss reason을 확인합니다. cache file 자체는 `cache/news-summary/` 아래 untracked 상태로 둡니다. |
| `retry history`(재시도 이력) | `content/newsroom/YYYY-MM-DD/retry-history.json`, `retry-history.md` | locked article, failed section, repair/replace 정책, skipped repair section을 확인합니다. |

## 품질 게이트

생성된 이슈는 `content/newsroom/YYYY-MM-DD/quality-report.json`과 `quality-report.md`를 포함합니다.
발행 준비 상태가 되려면 deterministic quality score가 기본 `85/100` 이상이어야 합니다. 이 조정은 Gemini 반복 비용과 운영 false negative를 줄이기 위한 튜닝이며, 검증 우회가 아닙니다. Quality threshold: 85. Hard blocker result: NEEDS_FIX.

게이트를 통과하지 못하면 Gemini는 기본 `1`회, `NEWSROOM_MAX_QUALITY_RETRIES` 값만큼 quality repair retry를 실행합니다. retry 한 번에서 repair 또는 replace할 section 수는 기본 `NEWSROOM_MAX_SECTION_REPAIRS=1`로 제한하며, source gap article은 rewrite하지 않고 demote 또는 replace합니다. `content/newsroom/YYYY-MM-DD/retry-history.json` 및 `retry-history.md`는 locked article, failed section, repair policy를 남깁니다. Gemini API retry max delay 기본값은 `GEMINI_RETRY_MAX_DELAY_MS=300000`이며, 300000ms는 5분입니다.

Gemini thinking budget은 stage별로 제한합니다. 기본값은 reporter `0`, editor/completion `512`, repair `0`, fact-check `0`, scoring `0`이며 `GEMINI_THINKING_BUDGET_*` 변수로 조정합니다. Pro 계열 모델은 thinking disable이 불가능하거나 제한될 수 있으므로 manual escalation 시 cost report의 `thinking_tokens`와 budget 기록을 확인해야 합니다.

품질 게이트는 AOSP Camera / Camera Driver / SoC Platform 관련성, 근거 구체성, engineering depth, 실행 가능성, source integrity, article composition을 확인합니다. 점수가 85 이상이어도 hard blocker가 있으면 `NEEDS_FIX` 또는 `publish_ready=false`가 유지됩니다. hard blocker에는 source gap, fact-check `must_fix`, source/reference 누락, underfilled article count, 약한 AOSP Camera / driver / SoC / native relevance, 약한 evidence specificity, 필요한 date/version/API/component/behavior-change 근거 누락이 포함됩니다. 기사에는 가능한 경우 version/release, release date, API/component, behavior change, 명시적 source gap 같은 구체 evidence가 있어야 합니다. "AOSP 업데이트를 모니터링한다" 같은 일반 문장은 정확한 source, version, API, date, behavior를 함께 적지 않으면 충분하지 않습니다.

`npm.cmd run validate`는 config, site, image, quality, localization validation을 모두 실행합니다. weekly newsroom workflow에서 review 가능한 artifact와 PR이 생성되면 fact-check 또는 quality가 `needs-fix`여도 PR 생성 job은 성공할 수 있습니다. 이 상태는 발행 가능을 뜻하지 않으며, `publish-ready` 라벨과 PR body의 `final_publish_ready=true`가 있을 때만 publication-ready로 봅니다. `fallback-composition`은 낮은 우선순위 SoC/platform/tooling 기사로 보강된 상태이고, `thin-week`는 자동 발행 대상이 아닌 편집장 검토용 경로입니다.

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
├── content/collected-news/
│   └── YYYY-MM-DD/candidates.json
├── content/newsroom/
│   └── YYYY-MM-DD/
│       ├── news-candidates.md
│       ├── reporter-candidates.json
│       ├── editor-draft.json
│       ├── editor-draft.md
│       ├── fact-check-report.json
│       ├── fact-check-report.md
│       ├── cost-report.md
│       ├── shortlisted-candidates.json
│       ├── article-capsules.json
│       ├── summary-cache-report.md
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
│   ├── lib/
│   └── newsroom/
│       ├── cli/
│       ├── collect/
│       ├── generate/
│       ├── render/
│       ├── validate/
│       └── common/
└── .github/workflows/
    ├── 02-validate-site.yml
    └── weekly-newsroom-pr.yml
```

## 현재 운영 방식

현재 운영 방식은 **GitHub Actions 후보 수집 + Gemini reporter/editor/fact-checker + site/image/quality/localization 검증 + 편집자 검토 PR + GitHub Pages 발행**입니다.

### 주간 Gemini Newsroom PR

- 매일 09:00 KST에 실행됩니다. UTC cron은 `0 0 * * *`입니다.
- `data/news-sources.json`의 enabled source를 우선 사용하고, registry가 없을 때만 `docs/news-sources.md`를 fallback으로 사용합니다.
- `GEMINI_API_KEY`로 Gemini newsroom pipeline을 실행합니다.
- Gemini는 `content/collected-news/YYYY-MM-DD/candidates.json`, source registry, editorial docs만 입력으로 사용하며 웹을 직접 browse하지 않습니다.
- `content/newsroom/YYYY-MM-DD/`에 candidates, reporter/editor/fact-check 결과, editor-in-chief brief, QA report를 저장합니다.
- `newsletters/YYYY-MM-DD/newsletter.md`, `newsletters/YYYY-MM-DD/index.html`, `data/newsletters.json`을 생성 또는 갱신합니다.
- `newsletter/YYYY-MM-DD` 브랜치로 편집자 검토용 PR을 만듭니다.

### 02 - 사이트와 이미지 검증

- PR, `main` push, manual run에서 `npm.cmd run validate`를 실행합니다.
- `data/newsletters.json`, published files, TODO leak, duplicate date, required sections, source/reference, HTML anchor, article image/fallback contract, 유지 문서 한글화 규칙을 검증합니다.
- 변경된 `newsletters/`, `content/newsroom/`, `content/collected-news/` 날짜의 quality report는 hard gate로 검사합니다. 변경되지 않은 과거 review artifact는 warning-only로 둡니다.

## 운영 규칙

- 뉴스레터 발행은 PR 기반입니다. 생성 workflow가 `main`에 직접 발행하지 않습니다.
- 편집자 승인 없는 자동 merge는 하지 않습니다.
- 출처가 없거나 Camera HAL 관점의 action item이 없는 항목은 발행하지 않습니다.
- `data/news-sources.json`이 machine-readable source of truth입니다.
- `docs/news-sources.md`는 사람이 검토하기 위한 editorial view이며, JSON registry가 없을 때 fallback 문서입니다.
- external article image는 임의로 대체하지 않습니다. resolver와 local fallback contract를 사용합니다.
- `selectedImage`는 최종 렌더링 이미지 경로입니다. 외부 이미지가 404, timeout, invalid content-type 등으로 실패하고 local fallback이 존재하면 `selectedImage`는 fallback 경로로 바뀌며 원본 URL은 `originalImage` 또는 `resolvedImage.originalUrl`에 보존됩니다. fallback 성공은 warning only이고, fallback 파일 누락이나 깨진 외부 URL 잔존만 fail입니다.
- validator를 약화해서 publication risk를 숨기지 않습니다.
- 유지 문서와 표시용 JSON 값은 한국어를 기본으로 작성합니다. 내부 계약 문자열인 JSON key, enum, source ID, URL, 명령어, 파일명은 번역하지 않습니다.

## 명령어

Node 20을 사용합니다.

```powershell
npm.cmd run doctor:config
```

CI와 같은 runtime 환경에서 `collect`와 `generate`를 실행하기 전에 날짜, lookback, Gemini 모델, retry, 품질 retry 설정을 검증합니다. `GEMINI_API_KEY`는 설정 여부만 확인하고 값을 출력하지 않습니다.

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
npm.cmd run validate:config
npm.cmd run validate:site
npm.cmd run validate:images
npm.cmd run validate:quality
npm.cmd run validate:localization
```

## 뉴스레터 계약

발행 Markdown과 HTML은 다음 계약을 지켜야 합니다.

- 이번 주 briefing은 정확히 3개 bullet입니다.
- main article은 4-5개입니다. 후보가 부족하면 억지로 5개를 채우지 않습니다.
- 각 main article은 confirmed facts, background, Camera HAL perspective, Camera HAL checks, action items, sources를 포함해야 합니다.
- AI 또는 C++ 기사는 필수가 아니라 optional bonus입니다. 가능하면 둘 중 하나를 포함하지만, Camera HAL / Android Camera 관련 후보가 충분하면 generic AI/C++ 기사를 main article로 올리지 않습니다.
- `## References`를 포함합니다.
- 발행 artifact에 `TODO` 문자를 남기지 않습니다.
- Scope 관련성은 AOSP Camera capability, request/result, stream/buffer, metadata, CTS/VTS/ITS/CDD, V4L2/libcamera, ISP/image sensor, SoC CPU/GPU/NPU, thermal/power/performance, native runtime, C++ tooling처럼 실제 검증 가능한 단위로 작성합니다.

## Collector와 출처 적격성

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

## GitHub Secret과 Variable

GitHub repository의 `Settings -> Secrets and variables -> Actions`에서 설정합니다.
`GEMINI_API_KEY`는 Secret으로만 관리하고, 모델과 retry 관련 값은 필요할 때 Variables로 override합니다.

현재 workflow 기본값과 변경 시 주의점은 [GitHub Actions Secret과 Variable](docs/config/action-variables.ko.md)에 정리되어 있습니다.

## PR 검토

PR 본문과 `content/newsroom/YYYY-MM-DD/editor-in-chief-brief.md`를 먼저 확인합니다. 편집자는 다음 항목을 검토한 뒤 승인하거나 수정 요청합니다.

- 핵심 메시지와 main article 구성
- Camera HAL 업무와의 연결성
- fact-check 결과와 `must_fix`
- source gap 및 replacement/demotion 이력
- fallback image 경고
- `quality-report.md`와 `retry-history.md`

`fact-check-report.json`이 `NEEDS_FIX`이고 `must_fix`가 있으면 workflow는 실패해야 합니다. 이 경우 publication-ready가 아니며, 생성 artifact는 GitHub Actions uploaded artifact 또는 workflow log에서 검토합니다.
