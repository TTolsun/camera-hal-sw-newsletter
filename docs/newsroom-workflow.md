# Camera HAL SW 뉴스레터 Newsroom workflow

이 문서는 AOSP Camera / Camera Driver / SoC Platform 뉴스레터를 낮은 수작업 비용으로 매일 생성하기 위한 역할 기반 workflow를 설명합니다.

## 품질 게이트

newsroom pipeline은 `content/newsroom/YYYY-MM-DD/quality-report.json`과 `quality-report.md`를 생성합니다. 발행 준비 상태가 되려면 deterministic score가 `config/newsletter-policy.json`의 `qualityGatePolicy.threshold` 이상이어야 합니다. 이 threshold 완화는 LLM 비용과 false negative를 줄이기 위한 운영 튜닝이며, 품질 검증 우회가 아닙니다. source gap, fact-check `must_fix`, 발행에 치명적인 deduction이 있으면 숫자 점수가 threshold 이상이어도 publish-ready로 보지 않습니다.

draft가 gate를 통과하지 못하면 generator는 `NEWSROOM_MAX_QUALITY_RETRIES` 값만큼 재시도합니다. 기본값은 `1`입니다. 이미 article quality check를 통과한 section은 보존하고, quality retry 한 번에서 repair 또는 replace할 section 수는 `NEWSROOM_MAX_SECTION_REPAIRS=1`로 제한합니다. `retry-history.json`과 `retry-history.md`에는 locked article, failed section, repair policy, skipped repair section을 남깁니다. Gemini API retry max delay 기본값은 `GEMINI_RETRY_MAX_DELAY_MS=300000`이며, 300000ms는 5분입니다.

quality gate는 AOSP Camera / Camera Driver / SoC Platform relevance, evidence specificity, engineering depth, actionability, source integrity, article composition을 확인합니다. source 없음, source gap, duplicate main article, invalid/broken source URL, underfilled article count, expanded scope 연결이 없는 generic AI/main article은 hard fail로 유지되며 점수가 충분해도 Hard blocker result: NEEDS_FIX 또는 `publish_ready=false`를 강제합니다. actionability, 약한 설명, local fallback image처럼 단독 발행 차단보다는 개선 권고에 가까운 항목은 soft deduction으로 점수와 report에 남깁니다. 이 경우에도 Quality score가 configured threshold 미만이면 통과하지 않습니다. `quality-report.json`의 `article_results`는 article별 `PASS` / `DEMOTE` / `FAIL`, hard fail reason, soft deduction, repair action을 표시합니다. retry 후에도 점수가 낮거나 blocker가 남아 있으면 weekly workflow는 review PR을 만들 수 있고 `needs-fix`로 표시합니다. review 가능한 PR 생성 성공은 발행 가능 품질 통과와 분리되며, `publish-ready` 라벨과 PR body의 `final_publish_ready=true`가 있을 때만 발행 가능한 이슈로 취급합니다.

workflow의 `create-newsroom-pr` job은 후보 수집, LLM 생성, 검증, review PR 생성을 담당합니다. review 가능한 `content/newsroom/YYYY-MM-DD/` artifact와 PR body가 만들어지면 fact-check 또는 quality가 실패해도 job은 성공할 수 있습니다. 반대로 fatal generation error로 review artifact가 없으면 job은 실패합니다. publish/deploy gate는 `final_publish_ready=true`, fact-check `PASS`, quality `PASS`, policy minimum article count, publish 가능한 `composition_mode`, source integrity, stale claim 없음이 모두 만족될 때만 통과합니다.

PR label은 상태를 분리해서 보여 줍니다. `needs-fix`는 편집장 수리 또는 검토가 필요한 PR, `fallback-composition`은 direct camera/driver 후보가 부족해 SoC/platform/tooling fallback을 사용한 PR, `thin-week`는 자동 발행 대상이 아닌 얇은 주간 review path, `publish-ready`는 최종 발행 gate를 통과한 PR에만 사용합니다. summary cache는 restore와 save를 분리하고 save를 `if: always()`로 실행해 실패 run 이후 retry 비용을 줄입니다.

## 목표

목표는 단순히 날짜별 newsletter 파일을 자동 생성하는 것이 아닙니다. 최신 소식을 수집하고, Camera HAL 엔지니어 관점으로 해석하고, 검증 가능한 초안을 PR로 남기는 것입니다. 사용자는 최종 편집장으로 PR을 승인하거나 수정 요청합니다.

```text
source registry
  -> candidate collector
  -> deterministic shortlist and final article selection
  -> LLM reporter (default: Gemini)
  -> LLM editor (default: Gemini)
  -> LLM fact checker (default: Gemini)
  -> static artifact writer
  -> npm run validate
  -> newsletter/YYYY-MM-DD PR
```

## LLM provider 운영

기본 provider는 `gemini`이며 scheduled run은 `runtime-config.js`의 `DEFAULT_RUNTIME_CONFIG`에 정의된 provider/model/fallback model을 사용합니다. scheduled run은 `LLM_PROVIDER`, `LLM_MODEL`, `LLM_FALLBACK_MODELS` repo variable을 읽지 않습니다.

`workflow_dispatch` 수동 실행에서만 `llm_provider`, `llm_model`, `llm_fallback_models` input이 `LLM_PROVIDER`, `LLM_MODEL`, `LLM_FALLBACK_MODELS` runtime env로 전달됩니다. `LLM_PROVIDER=gemini`은 `GEMINI_API_KEY`만 요구하고, `LLM_PROVIDER=internal`은 `INTERNAL_LLM_API_KEY`, `INTERNAL_LLM_ENDPOINT`, explicit `LLM_MODEL`을 요구합니다. `GEMINI_MODEL`은 internal model 지정으로 인정하지 않습니다. token은 GitHub Secrets에서만 읽고 log, artifact, PR body에 출력하지 않습니다.

사내 API의 request/response 차이는 `scripts/newsroom/llm/providers/internal-provider.js` 안에서만 수정합니다. 이번 범위에서 internal provider는 manual override 전용이며 scheduled/code default provider 승격은 별도 PR에서 `DEFAULT_RUNTIME_CONFIG`와 validation rule을 함께 수정합니다. generation orchestration, source binding, quality gate, fact-check blocker, publish-ready 판단은 provider와 무관하게 유지합니다.

## Role 1. Candidate Collector

- `data/news-sources.json`의 enabled source를 읽습니다.
- JSON registry가 없을 때만 `docs/news-sources.md`의 `- Name: URL` 형식을 fallback으로 사용합니다.
- RSS 또는 HTML page에서 후보를 수집하고 `content/collected-news/YYYY-MM-DD/candidates.json`을 생성합니다.
- media/community/candidate-only source는 최종 기사로 올리기 전에 공식 출처 교차 확인이 필요합니다.

## Role 2. LLM Reporter

LLM 실행 전에 `scripts/newsroom/generate/newsroom-selection.js`가 `content/collected-news/YYYY-MM-DD/candidates.json`을 읽고 source-gap/watch/reference 후보를 제거합니다. 기존 `scripts/lib/newsroom-selection.js` 경로는 호환 shim으로 유지합니다. URL과 near-duplicate title을 dedupe하고, eligible candidate를 점수화한 뒤 `content/newsroom/YYYY-MM-DD/shortlisted-candidates.json`을 작성합니다. LLM prompt에는 full candidate 대신 `content/newsroom/YYYY-MM-DD/article-capsules.json`의 compact capsule을 전달합니다.

shortlist는 기본 8-12개 수준, hard cap 12개 후보로 제한됩니다. local selector는 LLM reporter/editor prompt가 실행되기 전에 deterministic scoring으로 후보를 줄이고 `config/newsletter-policy.json`이 정한 final main article input을 선택합니다. scoring은 `direct_aosp_camera`, `camera_driver_image_pipeline`, `android_platform_camera_adjacent`, `soc_platform_signal`, `cpp_ai_tooling_fallback`, `generic_tech_watchlist` bucket과 구체 evidence, 최신성, 실무 actionability, source reliability를 함께 봅니다. source gap, 날짜 근거 없음, dated evidence 없는 watch page, 구체 API/component 근거 없음은 main article에서 제외되거나 강하게 감점됩니다. SoC/CPU/GPU/NPU/ISP/power/thermal/performance 기사는 configured supporting main bucket일 때만 main article 보강에 사용할 수 있습니다. `generic_tech_watchlist`는 main article보다 briefing/watchlist로 유지합니다. eligible non-duplicate final input이 configured article count range를 만족하지 못하면 생성은 조기에 실패하고 `content/newsroom/YYYY-MM-DD/recovery-prompt.md`를 남깁니다.

- 수집 후보 중 AOSP Camera, Camera HAL, Camera Driver, V4L2/libcamera, ISP/image sensor, Android platform camera-adjacent, SoC platform, C++, LLVM/Clang/GCC, AI workflow와 관련된 항목을 점수화합니다.
- source name, source URL, candidateOnly, requiresCrossCheck, imageCandidates를 유지합니다.
- 출력: `content/newsroom/YYYY-MM-DD/reporter-candidates.json`.
- `article-capsules.json`은 title, url, source, published_date, topic_type, component, what_changed, why_hal_engineer_cares, evidence, risk, score 중심의 compact prompt 입력입니다. reporter stage에는 top shortlist capsule 8-12개, editor/fact-check/repair/completion stage에는 final-selected 또는 필요한 completion capsule만 전달합니다.

LLM reporter는 전체 collected candidate가 아니라 deterministic shortlist만 받습니다. 요약, tag, evidence field를 보강하되 local `selected=true` final article decision을 보존해야 합니다.

## Role 3. LLM Editor

- 한국어 newsletter 초안을 작성합니다.
- 각 주요 기사는 확인한 사실, 배경지식, Camera HAL 관점, Action Item, Sources를 포함합니다.
- 이미지 URL을 새로 만들지 않고 collector가 제공한 `imageCandidates`에서만 선택합니다.
- 출력: `content/newsroom/YYYY-MM-DD/editor-draft.json`, `content/newsroom/YYYY-MM-DD/editor-draft.md`.

editor는 deterministic final article input과 locked/retry context만 받습니다. retry가 필요하면 통과한 section은 lock하고, repair prompt는 실패한 section만 재생성하도록 요청합니다. source gap 또는 ineligible source는 rewrite하지 않고 demote 또는 replace 대상으로 처리합니다. weak HAL relevance와 duplicate는 replace, missing actionability와 required/evidence 부족은 same-source section repair 대상으로 분리합니다. retry artifact는 `locked_sections`, `failed_sections`, `regenerated_sections`, `repair_plan`, `skipped_repair_plan`, rejected retry output을 기록합니다.

## Role 4. LLM Fact Checker

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
  current/changed/generated validation target에 해당하는 artifact에서 fact-check `must_fix`가 남으면 hard fail입니다. 같은 `must_fix`가 historical artifact outside strict target에서만 발견되면 소급 hard fail 대신 warning-only로 기록하지만, publish-ready로 간주하지 않습니다.
- `npm run validate:images`: article image URL과 local fallback file 존재를 확인합니다.
  외부 이미지가 404, timeout, invalid content-type 등으로 실패해도 local fallback이 존재하고 최종 `selectedImage`가 fallback 경로로 정리되면 warning only입니다. 원본 URL은 `originalImage` 또는 `resolvedImage.originalUrl`에 보존하며, fallback 파일 누락이나 깨진 외부 URL이 publish 산출물에 남은 경우에만 fail합니다.
- `npm run validate:quality`: deterministic quality report를 재계산하고 configured article count range 위반, Primary Camera Stack 필수 조건 미달, forbidden main bucket 포함, main section 간 source URL 중복, source 누락, Camera HAL perspective 누락, action item 부족, source-gap mapped candidate, dated evidence 없는 selected candidate를 차단합니다. AI/C++ 기사는 configured supporting main bucket일 때만 보강 기사로 허용됩니다.
- `npm run validate:localization`: 유지 문서와 표시용 JSON 값이 한국어 규칙을 지키는지 확인합니다.

## 편집자 승인 발행 정책

- `publish-ready`는 AI 자동 발행 가능 상태이며 `has_ai_publish_ready=true`일 때만 사용합니다.
- `review_publication_ready=true`는 `public_newsletter_ready=true`인 검증된 public issue가 있고, `final_publish_ready=false`라서 편집장 검토 후 merge로만 공개할 수 있음을 뜻합니다. 이 값은 raw file existence가 아니라 `resolve-reviewable-artifacts`의 public newsletter readiness 결과에서만 파생합니다.
- `diagnostics_only=true`는 `review_pr_ready=true && public_newsletter_ready=false`인 진단 전용 PR입니다. merge해도 Newsletter 홈페이지에 표시되지 않으며 public files 누락 이유가 PR body에 남아야 합니다.
- `homepage_visible_after_merge=true`는 `data/newsletters.json`의 date/html/md entry가 `newsletters/YYYY-MM-DD/index.html` 및 `newsletter.md`와 일치하는 public issue에만 설정합니다. fallback builder가 성공 status에 이 값을 쓰더라도 workflow output의 최종 판단은 `resolve-reviewable-artifacts`가 public files와 index entry를 다시 검증한 결과입니다.
- `needs-fix`는 편집장 검토 또는 수정이 필요한 상태입니다. 자동 발행 기준을 통과하지 못한 editor review PR에는 broad signal인 `review-only`를 붙이고, public files가 준비된 review publication PR에는 `review-only-publication`, public files가 없는 진단 PR에는 `diagnostics-only`를 함께 붙입니다. 두 세부 label은 동시에 붙지 않아야 합니다.
- `final_publish_ready=false`는 자동 발행 기준 미충족을 뜻하지만, `review_publication_ready=true`인 PR의 공개 가능성을 혼자 차단하지 않습니다.
- `Validate Site and Images` (`.github/workflows/validate-site.yml`)는 structural validation을 blocking으로 유지하고 quality/fact-check 문제를 non-blocking annotation으로 보고합니다.

## URL Summary Cache

Reporter summary record는 `cache/news-summary/by-url/{sha256(normalized_url)}.json`과 `cache/news-summary/by-content/{content_hash}.json`에 cache됩니다. cache file은 의도적으로 untracked이며 CI에서는 `actions/cache`로 복원합니다.

cache hit은 같은 normalized URL을 먼저 확인하고, URL이 달라도 `content_hash`가 같으면 by-content record를 재사용합니다. `content_hash`는 title, summary, version/release, API/component, behavior evidence 중심으로 계산하며 URL, published date, source metadata는 제외합니다. published date나 source label만 바뀐 경우에는 summary를 다시 만들지 않고 freshness와 metadata는 현재 candidate에서 다시 판단합니다. article evidence가 바뀌면 `content-hash-mismatch`로 miss 처리합니다.

generator는 `content/newsroom/YYYY-MM-DD/summary-cache-report.json`, `summary-cache-report.md`, `.tmp/summary-cache-report.json`에 cache hit/miss와 miss reason을 남깁니다. 이 report는 비용 분석용 debug artifact이며, generated cache file 자체는 `cache/news-summary/` 아래에 남아 PR diff에 포함되지 않습니다.

## Cost Report

비용 artifact는 provider-neutral한 LLM 비용 리포트입니다. Gemini provider에서는 Gemini usage metadata와 local pricing table로 estimated cost를 계산하고, internal provider는 pricing table이 없으면 `estimated_cost_usd=null`과 pricing warning을 남깁니다.

Gemini 호출이 성공적으로 응답을 반환하면 generator는 response usage metadata를 stage/model/attempt 단위로 기록합니다. 비용 리포트는 `.tmp/newsroom-cost-report.json`과 `content/newsroom/YYYY-MM-DD/cost-report.md`에 남으며, prompt tokens, output tokens, thinking tokens, cached tokens, total tokens, estimated cost를 포함합니다.

Gemini request에는 stage별 thinking budget을 적용합니다. 기본값은 reporter `0`, editor/completion `512`, repair `0`, fact-check `0`, scoring `0`입니다. `GEMINI_THINKING_BUDGET_*` 환경변수로 조정할 수 있고, cost report의 call row에는 실제 response의 `thinking_tokens`와 함께 `thinking_budget_requested`, `thinking_budget_applied`가 남습니다.

`NEWSROOM_WARN_COST_USD`와 `NEWSROOM_MAX_COST_USD`는 비용 관찰용 기준값입니다. 현재 운영 기준으로 두 값을 넘어도 workflow를 실패시키지 않고 warning만 출력합니다. 이 리포트는 비용 발생 위치를 파악하기 위한 artifact이며, 품질 점수나 publish readiness 판단을 변경하지 않습니다.

scheduled run의 기본 fallback은 `gemini-2.5-flash-lite`까지만 사용합니다. `gemini-2.5-pro`는 manual `workflow_dispatch`에서 `allow_pro=true`를 명시한 경우에만 사용할 수 있으며, Pro가 실제 호출되면 workflow log와 cost report의 `pro_policy` / `pro_model` 필드에 남습니다. Pro 계열 모델은 thinking disable을 지원하지 않거나 최소 budget 제약이 있을 수 있으므로, requested budget이 `0`인 Pro 호출은 `thinkingConfig`를 생략하고 cost report warning에 남깁니다.

## Final Cost Reduction Operating Model

현재 운영 모델은 비용을 낮추기 위해 품질 기준을 낮추지 않습니다. 비용 절감은 네 가지 장치로 이루어집니다.

- deterministic scoring이 LLM 호출 전에 Camera HAL / Android Camera 후보를 먼저 줄입니다.
- `article-capsules.json`이 full context 대신 compact capsule만 Gemini에 전달합니다.
- quality retry는 전체 뉴스레터 재생성이 아니라 실패 section repair 또는 replace로 제한합니다.
- scheduled run은 Flash/Flash-Lite만 사용하고 Pro는 manual high-quality run에서 명시적으로 허용한 경우에만 사용합니다.

운영자가 비용 원인을 확인할 때는 아래 순서로 artifact를 봅니다.

| 확인 대상 | 위치 | 판단 기준 |
| --- | --- | --- |
| cost report(비용 리포트) | `.tmp/newsroom-cost-report.json`, `content/newsroom/YYYY-MM-DD/cost-report.md` | stage/model/attempt별 estimated cost, `thinking_tokens`, `cached_tokens`, Pro 호출 여부를 확인합니다. |
| selection report(기사 선정 리포트) | `content/newsroom/YYYY-MM-DD/shortlisted-candidates.json`, `article-capsules.json`, PR 본문 selection diagnostics | 후보가 8-12개 수준으로 제한됐는지, generic AI/C++가 HAL 후보를 밀어내지 않았는지 확인합니다. |
| quality report(품질 리포트) | `content/newsroom/YYYY-MM-DD/quality-report.json`, `quality-report.md` | hard fail과 soft deduction을 분리해 보고, `article_results`의 `PASS` / `DEMOTE` / `FAIL`과 repair action을 확인합니다. |
| generation status artifact(생성 상태 결과 파일) | `.tmp/newsletter-generation-status.json` | `publish_ready`, `quality_status`, `final_selected_article_count_for_gate`, failure reason을 확인합니다. |
| summary cache report(요약 cache 리포트) | `.tmp/summary-cache-report.json`, `content/newsroom/YYYY-MM-DD/summary-cache-report.md` | cache hit/miss와 miss reason을 보고 반복 요약 비용을 확인합니다. |

## Safe Scheduled Defaults

현재 scheduled run의 provider/model 기본값은 GitHub Variables가 아니라 `DEFAULT_RUNTIME_CONFIG`에서 결정됩니다. 기본값은 `LLM_PROVIDER=gemini`, `LLM_MODEL=gemini-2.5-flash`, `LLM_FALLBACK_MODELS=gemini-2.5-flash-lite`와 같습니다. workflow YAML은 `allow_pro` 값을 fallback list로 조합하지 않고 `NEWSROOM_ALLOW_PRO_ON_MANUAL` 정책 플래그만 JS runtime으로 전달합니다. JS model policy는 `workflow_dispatch`, `NEWSROOM_ALLOW_PRO_ON_MANUAL=true`, `LLM_PROVIDER=gemini` 조건을 모두 만족할 때만 Gemini Pro fallback을 추가합니다.

scheduled run(예약 자동 실행)의 안전 기본값은 아래와 같습니다. provider/model은 code default이고, 나머지는 workflow와 runtime config의 기본값을 사용합니다.

```text
LOOKBACK_DAYS=21
LLM_PROVIDER=gemini
LLM_MODEL=gemini-2.5-flash
LLM_FALLBACK_MODELS=gemini-2.5-flash-lite
GEMINI_MAX_RETRIES=2
GEMINI_RETRY_DELAYS_MS=20000,10000
GEMINI_RETRY_MAX_DELAY_MS=300000
GEMINI_THINKING_BUDGET_REPORTER=0
GEMINI_THINKING_BUDGET_EDITOR=512
GEMINI_THINKING_BUDGET_REPAIR=0
GEMINI_THINKING_BUDGET_FACTCHECK=0
GEMINI_THINKING_BUDGET_SCORING=0
NEWSROOM_MAX_QUALITY_RETRIES=1
NEWSROOM_MAX_SECTION_REPAIRS=1
NEWSROOM_WARN_COST_USD=0.15
NEWSROOM_MAX_COST_USD=0.25
NEWSROOM_ALLOW_PRO_ON_SCHEDULE=false
NEWSROOM_ALLOW_PRO_ON_MANUAL=false
NEWSROOM_PRO_ESCALATION=manual
```

manual high-quality run(수동 고품질 실행)에서만 `allow_pro=true`를 선택할 수 있습니다. 이때 workflow는 fallback list를 만들지 않고 `NEWSROOM_ALLOW_PRO_ON_MANUAL=true`만 전달합니다. JS model policy는 provider가 `gemini`인 `workflow_dispatch` 실행에서만 `gemini-2.5-pro` fallback을 추가합니다. scheduled run, internal provider, `allow_pro=false`에서는 Pro fallback을 추가하지 않습니다.

## Recovery Artifacts

`content/newsroom/YYYY-MM-DD/recovery-prompt.md`는 deterministic selection, LLM JSON parsing, fact-check, quality, validation이 retry 후에도 실패할 때 작성됩니다. shortlist, selected input, failed section, quality deduction, fact-check finding, exact rerun command를 포함합니다.

## GitHub Actions 운영

### 일일 RAW 후보 PR

`Newsroom 01 - Manual Source Collection PR` (`.github/workflows/01-newsroom-manual-source-collect-pr.yml`) workflow는 매일 09:00 KST에 실행됩니다.

```text
KST daily 09:00 = UTC daily 00:00
branch: newsroom-raw/YYYY-MM-DD
```

workflow는 `main`에 직접 push하지 않고 RAW candidate 검토용 PR을 만듭니다.

### 3-stage RAW workflow

`#154` cutover 이후 schedule entrypoint는 Stage 1 RAW workflow입니다. Final newsletter generation은 승인된 candidate artifact를 입력으로 받는 수동 workflow로만 실행합니다.

- `Newsroom 01 - Manual Source Collection PR` (`.github/workflows/01-newsroom-manual-source-collect-pr.yml`): `collect`만 실행하고 `manual-candidates.json`, compatibility `candidates.json`, `raw-candidate-manifest.json`을 생성합니다. Gemini/API secret을 사용하지 않습니다.
- `Newsroom 02 - Gemini Source Discovery PR` (`.github/workflows/02-newsroom-gemini-source-discovery-pr.yml`): `NEWSROOM_ENABLE_GEMINI_SOURCE_DISCOVERY=false`에서는 credential-free disabled pass-through로 `merged-candidates.json`을 만듭니다. `true`에서는 LLM credential preflight 뒤 Gemini proposal을 `gemini-source-proposals.json`에 저장하고, deterministic fetch/normalize/schema validation을 통과한 URL만 `gemini-candidates.json`과 `merged-candidates.json`에 반영합니다.
- `Newsroom 03 - Gemini Final Newsletter PR` (`.github/workflows/03-newsroom-final-pr.yml`): `NEWSROOM_CANDIDATE_INPUT_MODE=artifact`로 approved candidate artifact만 읽고 `collect`를 재실행하지 않습니다.

Stage 1/3 smoke가 통과하기 전에는 새 Stage 1 schedule을 활성화하지 않습니다. cutover PR에서 기존 all-in-one schedule을 제거한 뒤 새 Stage 1 RAW workflow schedule을 활성화합니다.

### Secret

Repository Settings > Secrets and variables > Actions:

```text
GEMINI_API_KEY
INTERNAL_LLM_API_KEY
```

선택 변수:

```text
INTERNAL_LLM_ENDPOINT=https://internal.example/api
INTERNAL_LLM_API_VERSION=v1
GEMINI_MAX_RETRIES=2
GEMINI_RETRY_DELAYS_MS=20000,10000
GEMINI_RETRY_MAX_DELAY_MS=300000
GEMINI_THINKING_BUDGET_REPORTER=0
GEMINI_THINKING_BUDGET_EDITOR=512
GEMINI_THINKING_BUDGET_REPAIR=0
GEMINI_THINKING_BUDGET_FACTCHECK=0
GEMINI_THINKING_BUDGET_SCORING=0
NEWSROOM_MAX_QUALITY_RETRIES=1
NEWSROOM_MAX_SECTION_REPAIRS=1
NEWSROOM_WARN_COST_USD=0.15
NEWSROOM_MAX_COST_USD=0.25
NEWSROOM_ALLOW_PRO_ON_SCHEDULE=false
NEWSROOM_ALLOW_PRO_ON_MANUAL=false
NEWSROOM_PRO_ESCALATION=manual
```

### 수동 Final Generation 실행

GitHub Actions에서 `Newsroom 03 - Gemini Final Newsletter PR` (`.github/workflows/03-newsroom-final-pr.yml`)을 선택하고 `Run workflow`를 누릅니다. `newsletter_date`를 입력하고, 필요하면 승인된 `manual-candidates.json` 또는 `merged-candidates.json` artifact path를 `candidate_input_path`에 입력합니다. Pro 계열 모델을 수동으로 허용해야 하는 경우에만 `allow_pro=true`를 선택합니다.

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

## Quality Gate Drift 계약

`qualityGatePolicy.hardFailConditions`는 `config/newsletter-policy.json`에 있는 hard fail inventory의 source of truth입니다. `score`는 숫자 품질 점수일 뿐이며 hard fail blocker를 덮어쓸 수 없습니다. `score >= qualityGatePolicy.threshold`여도 blocking deduction, `source_gap`, fact-check `must_fix`, stale claim hard failure, strict mode의 `quality-report.json` recompute drift가 있으면 해당 이슈는 `publish-ready` / `final_publish_ready`가 아닙니다.

<!-- NEWSLETTER_POLICY:BEGIN -->
<!-- This block is generated. Update config/newsletter-policy.json, then run npm.cmd run sync:policy-docs. -->

### Newsletter Policy

- Source of truth: `config/newsletter-policy.json`
- Main article count: 3-5
- Required Primary Camera Stack articles: at least 1
- Primary Camera Stack buckets: `direct_aosp_camera`, `camera_driver_image_pipeline`, `android_platform_camera_adjacent`
- Supporting main buckets: `soc_platform_signal`, `cpp_ai_tooling_fallback`
- Forbidden main buckets: `generic_tech_watchlist`
- Candidate pool preflight: publishable candidates at least 5; reserve candidates at least 2; camera stack candidates at least 2
- Selection windows: primary 7 days; fallback 21 days; reference 90 days
- Selection window enforcement: configured for later slices only; this policy block does not mean current candidate filtering or promotion behavior has changed.
- Quality threshold: 85
- Hard fail conditions remain blocking: source-less main article; source candidate binding failure; missing dated evidence; source_gap_risk; fact-check must_fix; duplicate source URL; stale claim hard failure; undated watch/reference page promoted to main article; CameraX source extraction failure

<!-- NEWSLETTER_POLICY:END -->
